import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function showNotification(title: string, body: string, tag: string, url: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    console.log("[Notifications] Permission not granted, skipping:", title);
    return;
  }
  console.log("[Notifications] Showing notification:", title, body);
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
  } catch (err) {
    console.error("[Notifications] Error showing notification:", err);
  }
}

/**
 * Returns notification permission state and a function to request permission.
 * On iOS PWA, permission MUST be requested via user gesture (button tap).
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    console.log("[Notifications] Permission result:", result);
    return result;
  }, []);

  return { permission, requestPermission };
}

/**
 * Listens for contract signature events and new visit bookings via Realtime
 * and shows browser/PWA notifications.
 */
export function useContractNotifications() {
  useEffect(() => {
    console.log("[Notifications] Setting up Realtime listeners...");
    console.log("[Notifications] Current permission:", "Notification" in window ? Notification.permission : "not supported");

    const channel = supabase
      .channel("crm-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contract_signatures" },
        (payload) => {
          console.log("[Notifications] contract_signatures UPDATE received");
          const row = payload.new as any;
          if (row.status !== "signed") return;
          showNotification(
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
          console.log("[Notifications] visits INSERT received");
          const row = payload.new as any;
          const dateFormatted = row.visit_date || "";
          const time = row.visit_time ? row.visit_time.slice(0, 5) : "";
          showNotification(
            "📅 Nova Visita Agendada!",
            `${row.client_name} agendou visita para ${dateFormatted} às ${time}h.`,
            `visit-booked-${row.id}`,
            "/visits"
          );
        }
      )
      .subscribe((status) => {
        console.log("[Notifications] Realtime channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
