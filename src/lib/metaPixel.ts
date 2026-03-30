// Meta Pixel utilities — frontend tracking with deduplication
import { supabase } from "@/integrations/supabase/client";

let pixelLoaded = false;

/** Load Meta Pixel script dynamically */
export function loadMetaPixel(pixelId: string) {
  if (pixelLoaded || !pixelId) return;
  pixelLoaded = true;

  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  (window as any).fbq("init", pixelId);
  (window as any).fbq("track", "PageView");
}

/** Generate a unique event ID for deduplication */
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Track event via Pixel (client-side) */
export function trackPixelEvent(eventName: string, data?: Record<string, any>, eventId?: string) {
  if (typeof (window as any).fbq !== "function") return;
  const params = { ...data };
  if (eventId) {
    (window as any).fbq("track", eventName, params, { eventID: eventId });
  } else {
    (window as any).fbq("track", eventName, params);
  }
}

/** Send event via Conversions API (server-side edge function) */
export async function sendConversionEvent(
  eventName: string,
  eventId: string,
  userData?: { phone?: string; email?: string; name?: string },
  customData?: Record<string, any>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-conversion`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          event_name: eventName,
          event_id: eventId,
          user_data: userData,
          custom_data: customData,
        }),
      }
    );

    if (!res.ok) {
      console.error("[Meta CAPI] Error:", await res.text());
    }
  } catch (err) {
    console.error("[Meta CAPI] Failed:", err);
  }
}

/**
 * Standard Meta events:
 * - Lead           → lead/client created
 * - Schedule       → visit scheduled
 * - InitiateCheckout → contract created (value = sinal)
 * - CompleteRegistration → contract signed
 * - Purchase       → deposit payment confirmed (value = sinal)
 */
export async function trackMetaEvent(
  eventName: string,
  userData?: { phone?: string; email?: string; name?: string },
  customData?: Record<string, any>,
  contractData?: { totalValue?: number; depositValue?: number }
) {
  const eventId = generateEventId();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: settings } = await supabase
      .from("meta_pixel_settings" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings) return;
    const s = settings as any;

    // Build final custom data — always use deposit value for value-bearing events
    let finalCustomData = { ...customData };
    const valueEvents = ["InitiateCheckout", "Purchase"];
    if (valueEvents.includes(eventName) && contractData) {
      if (s.send_value) {
        // Always send deposit (sinal) value — this is the correct business metric
        const value = contractData.depositValue ?? 0;
        finalCustomData = { ...finalCustomData, value, currency: "BRL" };
      } else {
        delete finalCustomData.value;
        delete finalCustomData.currency;
      }
    }

    if (s.pixel_enabled && s.pixel_id) {
      loadMetaPixel(s.pixel_id);
      trackPixelEvent(eventName, finalCustomData, eventId);
    }

    if (s.capi_enabled) {
      await sendConversionEvent(eventName, eventId, userData, finalCustomData);
    }
  } catch (err) {
    console.error("[Meta] trackMetaEvent error:", err);
  }
}
