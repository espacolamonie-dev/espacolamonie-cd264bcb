import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Returns notification permission state, a function to request permission,
 * and a function to subscribe to Web Push.
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check existing subscription on mount
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      });
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    try {
      // 1. Request notification permission (must be from user gesture)
      if (!("Notification" in window)) {
        console.log("[Push] Notifications not supported");
        return false;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      console.log("[Push] Permission:", perm);

      if (perm !== "granted") return false;

      // 2. Check service worker + PushManager
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.log("[Push] PushManager not supported");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;

      // 3. Get VAPID public key from edge function
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke("manage-push", {
        body: { action: "get-vapid-key" },
      });

      if (vapidError || !vapidData?.publicKey) {
        console.error("[Push] Failed to get VAPID key:", vapidError);
        return false;
      }

      console.log("[Push] Got VAPID public key");

      // 4. Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
      });

      console.log("[Push] Push subscription created");

      // 5. Save subscription to backend
      const { error: subError } = await supabase.functions.invoke("manage-push", {
        body: {
          action: "subscribe",
          subscription: subscription.toJSON(),
        },
      });

      if (subError) {
        console.error("[Push] Failed to save subscription:", subError);
        return false;
      }

      console.log("[Push] Subscription saved successfully!");
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      return false;
    }
  }, []);

  return { permission, isSubscribed, subscribeToPush };
}

/**
 * Listens for contract signature events and new visit bookings via Realtime
 * and shows in-app notifications (when app is open).
 */
export function useContractNotifications() {
  useEffect(() => {
    console.log("[Notifications] Setting up Realtime listeners...");

    const showInAppNotification = (title: string, body: string, tag: string, url: string) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: "/icons/icon-192.png",
              badge: "/icons/icon-192.png",
              tag,
              data: { url },
            } as NotificationOptions);
          });
        } else {
          new Notification(title, { body, icon: "/icons/icon-192.png", tag });
        }
      } catch {
        // Silent fail
      }
    };

    const channel = supabase
      .channel("crm-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contract_signatures" },
        (payload) => {
          const row = payload.new as any;
          if (row.status !== "signed") return;
          showInAppNotification(
            "✅ Contrato Assinado!",
            `${row.client_name} assinou o contrato para ${row.event_date}.`,
            `contract-signed-${row.contract_id}`,
            "/contracts"
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visits" },
        (payload) => {
          const row = payload.new as any;
          const time = row.visit_time ? row.visit_time.slice(0, 5) : "";
          showInAppNotification(
            "📅 Nova Visita Agendada!",
            `${row.client_name} agendou visita para ${row.visit_date} às ${time}h.`,
            `visit-booked-${row.id}`,
            "/visits"
          );
        }
      )
      .subscribe((status) => {
        console.log("[Notifications] Realtime channel:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
