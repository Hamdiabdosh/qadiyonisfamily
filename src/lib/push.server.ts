import webpush from "web-push";
import { inArray } from "drizzle-orm";

import { getDb } from "@/db/index.server";
import { pushSubscriptions } from "@/db/schema";

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@qadiyonis.raafat.site",
    publicKey,
    privateKey,
  );
  vapidReady = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendAdminPushNotification(opts: {
  adminUserIds: string[];
  title: string;
  body: string;
  url?: string;
}) {
  if (!ensureVapid() || opts.adminUserIds.length === 0) return;

  const db = getDb();
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, opts.adminUserIds));

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url ?? "/admin?view=notifications",
  });

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  );
}
