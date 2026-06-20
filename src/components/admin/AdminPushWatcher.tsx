import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAdminNotificationsFn, getVapidPublicKeyFn, subscribeAdminPushFn } from "@/lib/api/content.functions";
import { registerAppServiceWorker, showLocalNotification, subscribeAdminPush } from "@/lib/push-client";

/** Registers push + polls for new admin alerts while the dashboard is open. */
export function AdminPushWatcher() {
  const seenIds = useRef<Set<number>>(new Set());
  const ready = useRef(false);

  const { data: items = [] } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: getAdminNotificationsFn,
    refetchInterval: 45_000,
  });

  useEffect(() => {
    void (async () => {
      await registerAppServiceWorker();
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return;

      const { publicKey } = await getVapidPublicKeyFn();
      if (!publicKey) return;
      const sub = await subscribeAdminPush(publicKey);
      if (sub) await subscribeAdminPushFn({ data: sub });
    })();
  }, []);

  useEffect(() => {
    if (!ready.current) {
      items.forEach((n) => seenIds.current.add(n.id));
      ready.current = true;
      return;
    }

    for (const n of items) {
      if (seenIds.current.has(n.id) || n.isRead) continue;
      seenIds.current.add(n.id);
      const url =
        n.type === "approval"
          ? "/admin?view=approval"
          : n.type === "feedback"
            ? "/admin?view=feedbacks"
            : "/admin?view=notifications";
      showLocalNotification(n.title, n.body, url);
    }
  }, [items]);

  return null;
}
