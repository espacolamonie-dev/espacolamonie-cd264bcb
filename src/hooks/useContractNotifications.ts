import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addNotification } from "@/hooks/useNotifications";

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

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

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
      if (!("Notification" in window)) return false;

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

      const reg = await navigator.serviceWorker.ready;

      const { data: vapidData, error: vapidError } = await supabase.functions.invoke("manage-push", {
        body: { action: "get-vapid-key" },
      });

      if (vapidError || !vapidData?.publicKey) return false;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
      });

      const { error: subError } = await supabase.functions.invoke("manage-push", {
        body: { action: "subscribe", subscription: subscription.toJSON() },
      });

      if (subError) return false;

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      return false;
    }
  }, []);

  return { permission, isSubscribed, subscribeToPush };
}

const fmtDate = (d: string) => d ? d.split('-').reverse().join('/') : '';

export function useContractNotifications() {
  useEffect(() => {
    const showNotif = (title: string, body: string, tag: string, url: string, icon: string) => {
      // Add to in-app notification center
      addNotification({ title, body, tag, url, icon });

      // Also show browser notification if granted
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, {
                body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
                tag, data: { url }, vibrate: [200, 100, 200],
              } as NotificationOptions);
            });
          } else {
            new Notification(title, { body, icon: "/icons/icon-192.png", tag });
          }
        } catch {}
      }
    };

    const channel = supabase
      .channel("crm-notifications-v2")
      // Contract signed
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contract_signatures" },
        (payload) => {
          const row = payload.new as any;
          if (row.status !== "signed") return;
          showNotif(
            "Contrato Assinado!",
            `${row.client_name} assinou o contrato para ${fmtDate(row.event_date)}.`,
            `contract-signed-${row.contract_id}`,
            "/contracts",
            "✅"
          );
        }
      )
      // New visit booked
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visits" },
        (payload) => {
          const row = payload.new as any;
          const time = row.visit_time ? row.visit_time.slice(0, 5) : "";
          showNotif(
            "Nova Visita Agendada!",
            `${row.client_name} agendou visita para ${fmtDate(row.visit_date)} às ${time}h.`,
            `visit-booked-${row.id}`,
            "/visits",
            "📅"
          );
        }
      )
      // Payment received
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payments" },
        (payload) => {
          const row = payload.new as any;
          const amount = Number(row.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          showNotif(
            "Pagamento Recebido!",
            `Pagamento de ${amount} registrado. ${row.description || ""}`,
            `payment-${row.id}`,
            "/contracts",
            "💰"
          );
        }
      )
      // Contract status update
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contracts" },
        (payload) => {
          const oldRow = payload.old as any;
          const newRow = payload.new as any;

          // Payment status changed
          if (oldRow.payment_status !== newRow.payment_status) {
            if (newRow.payment_status === "paid_full") {
              showNotif(
                "Pagamento Completo!",
                `Contrato totalmente pago.`,
                `contract-paid-${newRow.id}`,
                "/contracts",
                "🎉"
              );
            } else if (newRow.payment_status === "deposit_paid" && oldRow.payment_status === "pending") {
              showNotif(
                "Sinal Pago!",
                `O sinal do contrato foi confirmado.`,
                `contract-deposit-${newRow.id}`,
                "/contracts",
                "✨"
              );
            }
          }

          // Event checkout
          if (oldRow.event_status !== newRow.event_status && newRow.event_status === "finalizado") {
            showNotif(
              "Evento Finalizado!",
              `O evento foi encerrado e o espaço devolvido.`,
              `event-done-${newRow.id}`,
              "/contracts",
              "🏁"
            );
          }
        }
      )
      // Key delivery signed
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "key_delivery_terms" },
        (payload) => {
          const row = payload.new as any;
          if (row.status !== "signed") return;
          showNotif(
            "Chaves Entregues!",
            `${row.client_name} assinou o termo de entrega de chaves.`,
            `keys-${row.id}`,
            "/contracts",
            "🔑"
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
