import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens for contract signature events via Realtime and shows
 * a browser notification when a client signs a contract.
 * Auto-requests notification permission on mount.
 */
export function useContractNotifications() {
  useEffect(() => {
    // Auto-request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel("contract-signed-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "contract_signatures",
        },
        (payload) => {
          const row = payload.new as any;
          if (row.status !== "signed") return;

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              // Use service worker notification for better PWA support
              if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification("✅ Contrato Assinado!", {
                    body: `${row.client_name} assinou o contrato para ${row.event_date}.`,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/icon-192.png",
                    tag: `contract-signed-${row.contract_id}`,
                    data: { url: "/contracts" },
                  } as NotificationOptions);
                });
              } else {
                new Notification("✅ Contrato Assinado!", {
                  body: `${row.client_name} assinou o contrato para ${row.event_date}.`,
                  icon: "/icons/icon-192.png",
                  tag: `contract-signed-${row.contract_id}`,
                });
              }
            } catch {
              // Silent fail
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
