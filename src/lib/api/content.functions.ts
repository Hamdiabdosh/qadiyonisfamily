import { createServerFn } from "@tanstack/react-start";
import { desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/index.server";
import { announcements, appSettings, feedbacks, notifications, pushSubscriptions } from "@/db/schema";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware.server";
import { createAdminAlert } from "@/lib/admin-notify.server";
import { parseContactAdmins } from "@/lib/contact-admins";
import { parseKinPageConfig } from "@/lib/kin-page-config";
import { getVapidPublicKey } from "@/lib/push.server";
import { deleteGuideAudio, saveGuideAudio } from "@/lib/uploads.server";

export const getPublicSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const rows = await db
    .select()
    .from(appSettings)
    .where(
      or(
        eq(appSettings.key, "youtube_video_url"),
        eq(appSettings.key, "admin_email"),
        eq(appSettings.key, "admin_phone"),
        eq(appSettings.key, "contact_admins"),
        eq(appSettings.key, "kin_page_config"),
        eq(appSettings.key, "add_family_audio_filename"),
        eq(appSettings.key, "add_family_audio_parents_filename"),
        eq(appSettings.key, "add_family_audio_children_filename"),
        eq(appSettings.key, "add_family_audio_submitter_filename"),
        eq(appSettings.key, "register_audio_filename"),
        eq(appSettings.key, "gallery_telegram_group_url"),
      ),
    );
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string | null>;
  const legacyParents = settings.add_family_audio_filename;
  const parentsFilename = settings.add_family_audio_parents_filename ?? legacyParents;
  const childrenFilename = settings.add_family_audio_children_filename;
  const submitterFilename = settings.add_family_audio_submitter_filename;
  const registerFilename = settings.register_audio_filename;
  const toUrl = (name?: string | null) => (name ? `/uploads/${name}` : "");
  return {
    ...settings,
    contact_admins: parseContactAdmins(settings.contact_admins ?? null),
    kin_page_config: parseKinPageConfig(settings.kin_page_config),
    add_family_audio_url: toUrl(legacyParents),
    add_family_audio_parents_url: toUrl(parentsFilename),
    add_family_audio_children_url: toUrl(childrenFilename),
    add_family_audio_submitter_url: toUrl(submitterFilename),
    register_audio_url: toUrl(registerFilename),
  };
});

export const submitFeedbackFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      submitterName: z.string().trim().min(1).max(120),
      submitterPhone: z.string().trim().min(1).max(40),
      message: z.string().trim().min(1).max(2000),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const db = getDb();
    const [row] = await db
      .insert(feedbacks)
      .values({
        userId: context.userId,
        category: "general",
        message: data.message,
        submitterName: data.submitterName,
        submitterPhone: data.submitterPhone,
      })
      .returning();

    await createAdminAlert({
      title: "New feedback received",
      body: `${data.submitterName}: ${data.message.slice(0, 80)}`,
      type: "feedback",
      url: "/admin?view=feedbacks",
    });

    return { id: row.id };
  });

export const getFeedbacksFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    return db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt));
  });

export const markFeedbackReadFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.update(feedbacks).set({ isRead: true }).where(eq(feedbacks.id, data.id));
    return { ok: true };
  });

export const getAnnouncementsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = getDb();
    return db.select().from(announcements).orderBy(desc(announcements.publishedAt));
  });

export const createAnnouncementFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ title: z.string().min(1), body: z.string().min(1) }))
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    const db = getDb();
    const [row] = await db
      .insert(announcements)
      .values({ title: data.title, body: data.body, createdBy: context.userId })
      .returning();

    await db.insert(notifications).values({
      userId: null,
      title: data.title,
      body: data.body.slice(0, 120),
      type: "announcement",
      announcementId: row.id,
    });

    return row;
  });

export const getUserNotificationsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(notifications)
      .where(or(eq(notifications.userId, context.userId), isNull(notifications.userId)))
      .orderBy(desc(notifications.createdAt));
    return rows.filter((n) => n.type === "announcement" || n.userId === context.userId);
  });

export const getAdminNotificationsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    return db
      .select()
      .from(notifications)
      .where(or(eq(notifications.type, "feedback"), eq(notifications.type, "approval"), eq(notifications.type, "system")))
      .orderBy(desc(notifications.createdAt));
  });

export const markNotificationReadFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAuth])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, data.id));
    return { ok: true };
  });

export const getVapidPublicKeyFn = createServerFn({ method: "GET" }).handler(async () => ({
  publicKey: getVapidPublicKey(),
}));

export const subscribeAdminPushFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    const db = getDb();
    await db
      .insert(pushSubscriptions)
      .values({
        userId: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: context.userId,
          p256dh: data.p256dh,
          auth: data.auth,
        },
      });
    return { ok: true };
  });

export const getSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db.select().from(appSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

export const updateSettingsFn = createServerFn({ method: "POST" })
  .inputValidator(z.record(z.string()))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    for (const [key, value] of Object.entries(data)) {
      await db
        .insert(appSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    }
    return { ok: true };
  });

const GUIDE_AUDIO_SETTING_KEYS = {
  parents: "add_family_audio_parents_filename",
  children: "add_family_audio_children_filename",
  submitter: "add_family_audio_submitter_filename",
  register: "register_audio_filename",
} as const;

export const uploadGuideAudioFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fileBase64: z.string().min(1),
      mimeType: z.string().min(1),
      section: z.enum(["parents", "children", "submitter", "register"]),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    const settingKey = GUIDE_AUDIO_SETTING_KEYS[data.section];
    const [current] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, settingKey))
      .limit(1);

    const filename = await saveGuideAudio(
      data.section,
      data.fileBase64,
      data.mimeType,
      current?.value ?? null,
    );

    await db
      .insert(appSettings)
      .values({ key: settingKey, value: filename })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: filename, updatedAt: new Date() },
      });

    return { filename, url: `/uploads/${filename}` };
  });

export const removeGuideAudioFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ section: z.enum(["parents", "children", "submitter", "register"]) }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    const settingKey = GUIDE_AUDIO_SETTING_KEYS[data.section];
    const [current] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, settingKey))
      .limit(1);

    const filenames = new Set<string>();
    if (current?.value) filenames.add(current.value);

    if (data.section === "parents") {
      const [legacy] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "add_family_audio_filename"))
        .limit(1);
      if (legacy?.value) filenames.add(legacy.value);
    }

    for (const filename of filenames) {
      await deleteGuideAudio(filename);
    }

    await db.delete(appSettings).where(eq(appSettings.key, settingKey));
    if (data.section === "parents") {
      await db.delete(appSettings).where(eq(appSettings.key, "add_family_audio_filename"));
    }

    return { ok: true };
  });
