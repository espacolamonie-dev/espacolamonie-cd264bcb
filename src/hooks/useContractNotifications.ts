import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function showNotification(title: string, body: string, tag: string, url: string) {
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
}

/**
 * Listens for contract signature events and new visit bookings via Realtime
 * and shows browser/PWA notifications.
 */
export function useContractNotifications() {
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel("crm-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contract_signatures" },
        (payload) => {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
