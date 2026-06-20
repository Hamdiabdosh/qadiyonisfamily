import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { getDb } from "@/db/index.server";
import {
  announcements,
  appSettings,
  exploreGallery,
  explorePosts,
  exploreSocialLinks,
  familyMembers,
  notifications,
  users,
} from "@/db/schema";
import { parseContactAdmins } from "@/lib/contact-admins";
import { parseKinPageConfig } from "@/lib/kin-page-config";

const SPONSOR_TELEGRAM = "https://t.me/the_wadeh";
const MEMBER_SEARCH_LIMIT = 15;
const EXPLORE_POST_LIMIT = 10;

function truncate(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

async function readSettings(db: ReturnType<typeof getDb>) {
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function loadChatbotUiContext(userId?: string | null) {
  const db = getDb();
  const settings = await readSettings(db);

  const [memberRow] = await db
    .select({ total: count() })
    .from(familyMembers)
    .where(eq(familyMembers.isApproved, true));

  let unreadNotifications = 0;
  if (userId) {
    const unreadRows = await db
      .select({ isRead: notifications.isRead, userId: notifications.userId, type: notifications.type })
      .from(notifications)
      .where(or(eq(notifications.userId, userId), isNull(notifications.userId)));
    unreadNotifications = unreadRows.filter(
      (n) => !n.isRead && (n.type === "announcement" || n.userId === userId),
    ).length;
  }

  return {
    totalMembers: Number(memberRow?.total ?? 0),
    unreadNotifications,
    adminEmail: settings.admin_email ?? "",
    adminPhone: settings.admin_phone ?? "",
    hasVideo: Boolean(settings.youtube_video_url),
    hasAudioGuide: Boolean(
      settings.add_family_audio_filename ||
        settings.add_family_audio_parents_filename ||
        settings.register_audio_filename,
    ),
    contactAdmins: parseContactAdmins(settings.contact_admins),
    sponsorUrl: SPONSOR_TELEGRAM,
    kinPageConfig: parseKinPageConfig(settings.kin_page_config),
  };
}

async function memberNameSearch(db: ReturnType<typeof getDb>, query: string) {
  const term = query.trim();
  if (term.length < 2) return [];
  return db
    .select({
      id: familyMembers.id,
      full_name: familyMembers.fullName,
      generation_level: familyMembers.generationLevel,
      is_in_kin: familyMembers.isInKin,
      is_alive: familyMembers.isAlive,
      current_location: familyMembers.currentLocation,
      gender: familyMembers.gender,
    })
    .from(familyMembers)
    .where(and(eq(familyMembers.isApproved, true), ilike(familyMembers.fullName, `%${term}%`)))
    .orderBy(asc(familyMembers.generationLevel), asc(familyMembers.fullName))
    .limit(MEMBER_SEARCH_LIMIT);
}

export async function buildAssistantSystemPrompt(opts: {
  pathname: string;
  userId?: string | null;
  userMessage: string;
}): Promise<string> {
  const db = getDb();
  const settings = await readSettings(db);
  const contactAdmins = parseContactAdmins(settings.contact_admins);
  const kinConfig = parseKinPageConfig(settings.kin_page_config);

  const [statsRow] = await db
    .select({
      total: count(),
      kinAlive: sql<number>`count(*) filter (where ${familyMembers.isInKin} = true and ${familyMembers.isAlive} = true)`,
      kinDead: sql<number>`count(*) filter (where ${familyMembers.isInKin} = true and ${familyMembers.isAlive} = false)`,
      outAlive: sql<number>`count(*) filter (where ${familyMembers.isInKin} = false and ${familyMembers.isAlive} = true)`,
      outDead: sql<number>`count(*) filter (where ${familyMembers.isInKin} = false and ${familyMembers.isAlive} = false)`,
    })
    .from(familyMembers)
    .where(eq(familyMembers.isApproved, true));

  const [roots, nameHits, posts, gallery, social, recentAnnouncements] = await Promise.all([
    db
      .select({
        id: familyMembers.id,
        full_name: familyMembers.fullName,
        generation_level: familyMembers.generationLevel,
      })
      .from(familyMembers)
      .where(and(eq(familyMembers.isApproved, true), eq(familyMembers.isRoot, true)))
      .limit(5),
    memberNameSearch(db, opts.userMessage),
    db
      .select({
        id: explorePosts.id,
        title: explorePosts.title,
        body: explorePosts.body,
        category: explorePosts.category,
      })
      .from(explorePosts)
      .where(and(eq(explorePosts.isPublished, true), eq(explorePosts.shareWithKin, true)))
      .orderBy(desc(explorePosts.publishedAt))
      .limit(EXPLORE_POST_LIMIT),
    db
      .select({
        id: exploreGallery.id,
        caption: exploreGallery.caption,
        is_featured: exploreGallery.isFeatured,
      })
      .from(exploreGallery)
      .where(and(eq(exploreGallery.isPublished, true), eq(exploreGallery.shareWithKin, true)))
      .orderBy(desc(exploreGallery.isFeatured), desc(exploreGallery.createdAt))
      .limit(12),
    db
      .select({
        platform: exploreSocialLinks.platform,
        label: exploreSocialLinks.label,
        url: exploreSocialLinks.url,
      })
      .from(exploreSocialLinks)
      .where(eq(exploreSocialLinks.isPublished, true))
      .orderBy(asc(exploreSocialLinks.sortOrder)),
    db
      .select({ title: announcements.title, body: announcements.body, published_at: announcements.publishedAt })
      .from(announcements)
      .orderBy(desc(announcements.publishedAt))
      .limit(8),
  ]);

  let userBlock = "";
  if (opts.userId) {
    const [account] = await db
      .select({ full_name: users.fullName, phone: users.phone, email: users.email })
      .from(users)
      .where(eq(users.id, opts.userId))
      .limit(1);
    const submitted = await db
      .select({ total: count() })
      .from(familyMembers)
      .where(eq(familyMembers.submittedByUser, opts.userId));
    const unreadRows = await db
      .select({ title: notifications.title, body: notifications.body, isRead: notifications.isRead })
      .from(notifications)
      .where(or(eq(notifications.userId, opts.userId), isNull(notifications.userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(10);
    const unread = unreadRows.filter((n) => !n.isRead);

    userBlock = [
      "## Signed-in user",
      account ? `Name: ${account.full_name ?? "—"}, phone: ${account.phone ?? "—"}` : "",
      `Members they submitted: ${Number(submitted[0]?.total ?? 0)}`,
      unread.length
        ? `Unread notifications (${unread.length}): ${unread.map((n) => n.title).join("; ")}`
        : "No unread notifications.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const exploreBlock = [
    "### Stories & books",
    posts.length
      ? posts
          .map((p) => `- [${p.category}] ${p.title}: ${truncate(p.body, 180)}`)
          .join("\n")
      : "None published.",
    "### Gallery",
    gallery.length
      ? gallery.map((g) => `- ${g.caption || "Photo"}${g.is_featured ? " (featured)" : ""}`).join("\n")
      : "None published.",
    "### Social links",
    social.length ? social.map((s) => `- ${s.platform}: ${s.label || s.platform} → ${s.url}`).join("\n") : "None.",
  ].join("\n");

  const adminContacts = contactAdmins
    .map((a) => `${a.label ? `${a.label}: ` : ""}phone ${a.phone}, Telegram @${a.telegram}`)
    .join("; ");

  return [
    "You are the Qadi Yonis family tree assistant embedded in the mobile web app.",
    "Answer using ONLY the app data below. Be concise (2-5 sentences) unless the user asks for detail.",
    "Guide users to app pages: Home, Tree, Kin Directory, Explore, Gallery, Add Family, Profile, Notifications, Auth.",
    "For contact admin or sponsorship, point to Profile or the quick-action buttons (Telegram sponsor: @the_wadeh).",
    "Never invent family members. Never share submitter phone numbers from member records.",
    "Contact admin phone/Telegram from CONTACT ADMINS may be shared when asked.",
    `Current page path: ${opts.pathname}`,
    "",
    "## App credits",
    "Founded by: Abdushafi Abdulkadir (Telegram: @lahek11)",
    "Developed by: Abdulfetah Jemal, Software Engineer (https://abdulfetah.site)",
    "Sponsor / support: https://t.me/the_wadeh",
    "",
    "## App settings",
    `Instruction video: ${settings.youtube_video_url ? "yes (Home)" : "not configured"}`,
    `Add-family audio guides: ${settings.add_family_audio_parents_filename || settings.add_family_audio_filename ? "yes" : "no"}`,
    `Register audio guide: ${settings.register_audio_filename ? "yes" : "no"}`,
    `Gallery Telegram group: ${settings.gallery_telegram_group_url || "not set"}`,
    "",
    "## Contact admins (public)",
    adminContacts || "See Profile → Contact Admin.",
    `Sponsor app: ${SPONSOR_TELEGRAM}`,
    "",
    "## Kin directory config",
    JSON.stringify(kinConfig),
    "",
    "## Member statistics (approved)",
    `Total: ${Number(statsRow?.total ?? 0)} | in-kin alive: ${Number(statsRow?.kinAlive ?? 0)} | in-kin deceased: ${Number(statsRow?.kinDead ?? 0)} | out-of-kin alive: ${Number(statsRow?.outAlive ?? 0)} | out-of-kin deceased: ${Number(statsRow?.outDead ?? 0)}`,
    "",
    "## Root ancestor(s)",
    roots.length
      ? roots.map((m) => `#${m.id} ${m.full_name} (gen ${m.generation_level})`).join("\n")
      : "No root member set.",
    "",
    nameHits.length ? "## Members matching this question (search)" : "",
    nameHits.length
      ? nameHits
          .map(
            (m) =>
              `#${m.id} ${m.full_name} gen ${m.generation_level} ${m.is_in_kin ? "in-kin" : "out-of-kin"} ${m.is_alive ? "alive" : "deceased"}${m.current_location ? ` @ ${m.current_location}` : ""}`,
          )
          .join("\n")
      : "Use Kin Directory to search all members by name.",
    "",
    "## Explore content",
    exploreBlock,
    "",
    "## Recent announcements",
    recentAnnouncements.length
      ? recentAnnouncements.map((a) => `- ${a.title}: ${truncate(a.body, 120)}`).join("\n")
      : "None.",
    "",
    userBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

export const GUEST_CHAT_COOKIE = "chat_guest_used";

export function guestTrialUsedFromRequest(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return new RegExp(`(?:^|;\\s*)${GUEST_CHAT_COOKIE}=1(?:;|$)`).test(cookie);
}

export function guestTrialSetCookieHeader(): string {
  return `${GUEST_CHAT_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`;
}
