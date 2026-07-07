import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  bigserial,
  bigint,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", ["admin", "member"]);
export const accountStatusEnum = pgEnum("account_status", ["pending", "approved", "rejected"]);
export const genderEnum = pgEnum("gender_type", ["male", "female"]);
export const familySubmissionStatusEnum = pgEnum("family_submission_status", [
  "pending",
  "approved",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  fullName: text("full_name"),
  memberId: bigint("member_id", { mode: "number" }).references((): AnyPgColumn => familyMembers.id, {
    onDelete: "set null",
  }),
  passwordHash: text("password_hash").notNull(),
  accountStatus: accountStatusEnum("account_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("user_roles_user_id_role_unique").on(table.userId, table.role)],
);

export const familyMembers = pgTable("family_members", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  fullName: text("full_name").notNull(),
  gender: genderEnum("gender").notNull(),
  fatherId: bigint("father_id", { mode: "number" }).references((): AnyPgColumn => familyMembers.id, {
    onDelete: "set null",
  }),
  motherId: bigint("mother_id", { mode: "number" }).references((): AnyPgColumn => familyMembers.id, {
    onDelete: "set null",
  }),
  generationLevel: integer("generation_level").notNull().default(0),
  isInKin: boolean("is_in_kin").notNull().default(false),
  lineagePathFather: text("lineage_path_father").notNull().default("No path"),
  lineagePathMother: text("lineage_path_mother").notNull().default("No path"),
  isAlive: boolean("is_alive").notNull().default(true),
  birthYear: integer("birth_year"),
  birthOrder: integer("birth_order"),
  deathYear: integer("death_year"),
  currentLocation: text("current_location"),
  photoUrl: text("photo_url"),
  submittedBy: text("submitted_by"),
  submitterPhone: text("submitter_phone"),
  submitterIsAlive: boolean("submitter_is_alive").default(true),
  submittedByUser: uuid("submitted_by_user").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  isApproved: boolean("is_approved").notNull().default(false),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  isRoot: boolean("is_root").notNull().default(false),
  submissionId: uuid("submission_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const familySubmissions = pgTable("family_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  submittedByUser: uuid("submitted_by_user").references(() => users.id, { onDelete: "set null" }),
  formData: text("form_data").notNull(),
  memberIds: text("member_ids").notNull(),
  status: familySubmissionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberWives = pgTable(
  "member_wives",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    husbandId: bigint("husband_id", { mode: "number" })
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    wifeId: bigint("wife_id", { mode: "number" })
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("member_wives_husband_wife_unique").on(table.husbandId, table.wifeId)],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const feedbackCategoryEnum = pgEnum("feedback_category", [
  "wedding",
  "funeral",
  "event",
  "idea",
  "general",
]);

export const feedbacks = pgTable("feedbacks", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  submitterName: text("submitter_name"),
  submitterPhone: text("submitter_phone"),
  category: feedbackCategoryEnum("category").notNull().default("general"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationTypeEnum = pgEnum("notification_type", [
  "announcement",
  "approval",
  "feedback",
  "system",
]);

export const notifications = pgTable("notifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: notificationTypeEnum("type").notNull().default("system"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const explorePosts = pgTable("explore_posts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  fileLink: text("file_link"),
  youtubeUrl: text("youtube_url"),
  audioUrl: text("audio_url"),
  category: text("category").notNull().default("story"),
  shareWithKin: boolean("share_with_kin").notNull().default(true),
  isPublished: boolean("is_published").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const exploreGallery = pgTable("explore_gallery", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  isFeatured: boolean("is_featured").notNull().default(false),
  shareWithKin: boolean("share_with_kin").notNull().default(true),
  isPublished: boolean("is_published").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const exploreSocialPlatformEnum = pgEnum("explore_social_platform", [
  "tiktok",
  "facebook",
  "telegram",
  "youtube",
]);

export const exploreSocialLinks = pgTable("explore_social_links", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  platform: exploreSocialPlatformEnum("platform").notNull(),
  accountName: text("account_name").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const translations = pgTable(
  "translations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: text("key").notNull(),
    lang: text("lang").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("translations_key_lang_unique").on(table.key, table.lang)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("push_subscriptions_endpoint_unique").on(table.endpoint)],
);
