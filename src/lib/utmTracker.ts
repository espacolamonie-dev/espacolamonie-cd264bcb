/**
 * UTM & Meta Ads attribution tracker
 * Captures UTM params + fbclid/campaign_id/adset_id/ad_id from URL,
 * persists in localStorage, and provides getter for attaching to records.
 */

const UTM_STORAGE_KEY = "lamonie_utm_data";

export interface UtmData {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  meta_campaign_id: string;
  meta_adset_id: string;
  meta_ad_id: string;
  captured_url: string;
  captured_at: string;
}

const EMPTY_UTM: UtmData = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  fbclid: "",
  meta_campaign_id: "",
  meta_adset_id: "",
  meta_ad_id: "",
  captured_url: "",
  captured_at: "",
};

/** Parse UTM/Meta params from current URL and persist (last-click wins) */
export function captureUtmParams(): void {
  try {
    const params = new URLSearchParams(window.location.search);

    // Check if any relevant param exists
    const keys = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "fbclid", "campaign_id", "adset_id", "ad_id",
    ];
    const hasAny = keys.some((k) => params.has(k));
    if (!hasAny) return;

    const data: UtmData = {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      fbclid: params.get("fbclid") || "",
      meta_campaign_id: params.get("campaign_id") || "",
      meta_adset_id: params.get("adset_id") || "",
      meta_ad_id: params.get("ad_id") || "",
      captured_url: window.location.href,
      captured_at: new Date().toISOString(),
    };

    // If utm_source is empty but fbclid exists, default to facebook/cpc
    if (!data.utm_source && data.fbclid) {
      data.utm_source = "facebook";
      data.utm_medium = data.utm_medium || "cpc";
    }

    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // silently ignore
  }
}

/** Get stored UTM data (or empty defaults) */
export function getStoredUtm(): UtmData {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return { ...EMPTY_UTM };
    return { ...EMPTY_UTM, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_UTM };
  }
}

/** Get only the DB-safe UTM fields (no captured_url/captured_at) for inserts */
export function getUtmForDb(): Omit<UtmData, "captured_url" | "captured_at"> {
  const d = getStoredUtm();
  return {
    utm_source: d.utm_source,
    utm_medium: d.utm_medium,
    utm_campaign: d.utm_campaign,
    utm_content: d.utm_content,
    utm_term: d.utm_term,
    fbclid: d.fbclid,
    meta_campaign_id: d.meta_campaign_id,
    meta_adset_id: d.meta_adset_id,
    meta_ad_id: d.meta_ad_id,
  };
}

/** Check if we have meaningful attribution */
export function hasAttribution(): boolean {
  const d = getStoredUtm();
  return !!(d.utm_source || d.fbclid || d.utm_campaign);
}

/** Clear stored UTM (after conversion, if desired) */
export function clearUtm(): void {
  localStorage.removeItem(UTM_STORAGE_KEY);
}

/** Format a friendly source label */
export function getSourceLabel(utmSource: string): string {
  if (!utmSource) return "Direto";
  const map: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    google: "Google",
    tiktok: "TikTok",
    whatsapp: "WhatsApp",
  };
  return map[utmSource.toLowerCase()] || utmSource;
}
