import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/index.server";
import { notifications, userRoles } from "@/db/schema";
import { sendAdminPushNotification } from "@/lib/push.server";

export type AdminAlertType = "approval" | "feedback" | "system";

export async function createAdminAlert(opts: {
  title: string;
  body: string;
  type: AdminAlertType;
  url?: string;
}) {
  const db = getDb();
  await db.insert(notifications).values({
    userId: null,
    title: opts.title,
    body: opts.body,
    type: opts.type,
  });

  const adminIds = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, "admin"));

  const ids = adminIds.map((r) => r.userId);
  if (ids.length === 0) return;

  await sendAdminPushNotification({
    adminUserIds: ids,
    title: opts.title,
    body: opts.body,
    url: opts.url ?? "/admin?view=notifications",
  });
}
