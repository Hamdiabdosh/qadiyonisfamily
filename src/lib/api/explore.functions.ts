import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/index.server";
import { appSettings, exploreGallery, explorePosts, exploreSocialLinks, translations } from "@/db/schema";
import { optionalAuth, requireAdmin, requireAuth } from "@/lib/auth-middleware.server";
import { saveExploreAudio, saveExploreImage } from "@/lib/uploads.server";
import {
  buildAdminTranslationCatalog,
  getDefaultTranslation,
  I18N_LANGS,
  type I18nLang,
} from "@/lib/i18n-dicts";

const socialPlatformSchema = z.enum(["tiktok", "facebook", "telegram", "youtube"]);

async function readGalleryTelegramUrl(db: ReturnType<typeof getDb>) {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "gallery_telegram_group_url"))
    .limit(1);
  return row?.value?.trim() || null;
}

export const getExploreContentFn = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async () => {
    const db = getDb();
    const [posts, gallery, social] = await Promise.all([
      db
        .select()
        .from(explorePosts)
        .where(eq(explorePosts.isPublished, true))
        .orderBy(desc(explorePosts.publishedAt)),
      db
        .select()
        .from(exploreGallery)
        .where(eq(exploreGallery.isPublished, true))
        .orderBy(desc(exploreGallery.isFeatured), desc(exploreGallery.createdAt)),
      db
        .select()
        .from(exploreSocialLinks)
        .where(eq(exploreSocialLinks.isPublished, true))
        .orderBy(asc(exploreSocialLinks.sortOrder), asc(exploreSocialLinks.id)),
    ]);
    const kinGallery = gallery.filter((g) => g.shareWithKin);
    const featured = kinGallery.filter((g) => g.isFeatured).slice(0, 2);
    const galleryPreview = featured.length >= 2 ? featured : kinGallery.slice(0, 2);

    const galleryTelegramUrl = await readGalleryTelegramUrl(db);

    return {
      posts: posts.filter((p) => p.shareWithKin),
      galleryPreview,
      galleryCount: kinGallery.length,
      social,
      galleryTelegramUrl,
    };
  });

export const getExplorePostFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([optionalAuth])
  .handler(async ({ data }) => {
    const db = getDb();
    const [post] = await db
      .select()
      .from(explorePosts)
      .where(eq(explorePosts.id, data.id))
      .limit(1);
    if (!post || !post.isPublished || !post.shareWithKin) return null;
    return post;
  });

export const getGalleryContentFn = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async () => {
    const db = getDb();
    const gallery = await db
      .select()
      .from(exploreGallery)
      .where(eq(exploreGallery.isPublished, true))
      .orderBy(desc(exploreGallery.isFeatured), desc(exploreGallery.createdAt));
    const galleryTelegramUrl = await readGalleryTelegramUrl(db);
    return {
      gallery: gallery.filter((g) => g.shareWithKin),
      galleryTelegramUrl,
    };
  });

export const getExploreAdminFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    const [posts, gallery, social] = await Promise.all([
      db.select().from(explorePosts).orderBy(desc(explorePosts.publishedAt)),
      db.select().from(exploreGallery).orderBy(desc(exploreGallery.createdAt)),
      db.select().from(exploreSocialLinks).orderBy(asc(exploreSocialLinks.sortOrder)),
    ]);
    return { posts, gallery, social };
  });

export const createExplorePostFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      imageUrl: z.string().optional(),
      fileLink: z.string().optional(),
      youtubeUrl: z.string().optional(),
      audioUrl: z.string().optional(),
      category: z.enum(["story", "book"]).default("story"),
      shareWithKin: z.boolean().default(true),
      isPublished: z.boolean().default(true),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    const db = getDb();
    const [row] = await db
      .insert(explorePosts)
      .values({
        title: data.title,
        body: data.body,
        category: data.category,
        shareWithKin: data.shareWithKin,
        isPublished: data.isPublished,
        imageUrl: data.imageUrl || null,
        fileLink: data.fileLink || null,
        youtubeUrl: data.youtubeUrl || null,
        audioUrl: data.audioUrl || null,
        createdBy: context.userId,
      })
      .returning();
    return row;
  });

export const deleteExplorePostFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(explorePosts).where(eq(explorePosts.id, data.id));
    return { ok: true };
  });

export const createGalleryItemFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      imageUrl: z.string().min(1),
      caption: z.string().optional(),
      isFeatured: z.boolean().default(false),
      shareWithKin: z.boolean().default(true),
      isPublished: z.boolean().default(true),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    const db = getDb();
    const [row] = await db
      .insert(exploreGallery)
      .values({
        imageUrl: data.imageUrl,
        caption: data.caption || null,
        isFeatured: data.isFeatured,
        shareWithKin: data.shareWithKin,
        isPublished: data.isPublished,
        createdBy: context.userId,
      })
      .returning();
    return row;
  });

export const deleteGalleryItemFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(exploreGallery).where(eq(exploreGallery.id, data.id));
    return { ok: true };
  });

export const createSocialLinkFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      platform: socialPlatformSchema,
      accountName: z.string().min(1),
      url: z.string().url(),
      sortOrder: z.number().int().default(0),
      isPublished: z.boolean().default(true),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    const [row] = await db.insert(exploreSocialLinks).values(data).returning();
    return row;
  });

export const uploadExploreImageFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fileBase64: z.string().min(1),
      mimeType: z.string().min(1),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const filename = await saveExploreImage(data.fileBase64, data.mimeType);
    return { filename, url: `/uploads/${filename}` };
  });

export const uploadExploreAudioFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fileBase64: z.string().min(1),
      mimeType: z.string().min(1),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const filename = await saveExploreAudio(data.fileBase64, data.mimeType);
    return { filename, url: `/uploads/${filename}` };
  });

export const deleteSocialLinkFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(exploreSocialLinks).where(eq(exploreSocialLinks.id, data.id));
    return { ok: true };
  });

export const getTranslationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const rows = await db.select().from(translations);
  return Object.fromEntries(rows.map((r) => [`${r.lang}.${r.key}`, r.value]));
});

export const getTranslationsAdminFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db.select().from(translations).orderBy(translations.key);
    return buildAdminTranslationCatalog(rows);
  });

export const upsertTranslationFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      key: z.string().min(1),
      lang: z.enum(I18N_LANGS),
      value: z.string().min(1),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    const lang = data.lang as I18nLang;
    const defaultValue = getDefaultTranslation(lang, data.key);

    if (data.value === defaultValue) {
      await db
        .delete(translations)
        .where(and(eq(translations.key, data.key), eq(translations.lang, data.lang)));
      return { ok: true, reset: true };
    }

    await db
      .insert(translations)
      .values({ key: data.key, lang: data.lang, value: data.value })
      .onConflictDoUpdate({
        target: [translations.key, translations.lang],
        set: { value: data.value, updatedAt: new Date() },
      });
    return { ok: true, reset: false };
  });

export const resetTranslationFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ key: z.string().min(1), lang: z.enum(I18N_LANGS) }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db
      .delete(translations)
      .where(and(eq(translations.key, data.key), eq(translations.lang, data.lang)));
    return { ok: true };
  });
