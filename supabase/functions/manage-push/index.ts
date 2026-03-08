import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Base64URL helpers ───
function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

// ─── VAPID key management ───
async function getOrCreateVapidKeys(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('push_config').select('*').eq('id', 'default').single();
  if (data) return data;

  console.log('[manage-push] Generating new VAPID keys...');
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const config = {
    id: 'default',
    vapid_public_key: b64UrlEncode(publicKeyRaw),
    vapid_private_key_jwk: JSON.stringify(privateKeyJwk),
  };

  const { error } = await supabase.from('push_config').upsert(config);
  if (error) console.error('[manage-push] Error saving VAPID keys:', error);
  return config;
}

// ─── VAPID JWT ───
async function createVapidJwt(audience: string, subject: string, privateKeyJwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk", privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const enc = (obj: unknown) => b64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const header = enc({ typ: "JWT", alg: "ES256" });
  const payload = enc({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  });

  const token = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(token)
  );

  return `${token}.${b64UrlEncode(sig)}`;
}

// ─── HKDF ───
async function hkdfDerive(ikm: ArrayBuffer, salt: ArrayBuffer | Uint8Array, info: Uint8Array, bits: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bits);
}

// ─── RFC 8291 Web Push Encryption ───
async function encryptPayload(p256dh: string, auth: string, data: string): Promise<Uint8Array> {
  const clientPubBytes = b64UrlDecode(p256dh);
  const authBytes = b64UrlDecode(auth);
  const plaintext = new TextEncoder().encode(data);

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, ["deriveBits"]
  );
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  // Import client's public key
  const clientPub = await crypto.subtle.importKey(
    "raw", clientPubBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPub },
    ephemeral.privateKey, 256
  );

  // Derive IKM using auth secret
  const infoAuth = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    clientPubBytes,
    ephPubRaw
  );
  const ikm = await hkdfDerive(sharedSecret, authBytes, infoAuth, 256);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key and nonce
  const cek = await hkdfDerive(ikm, salt, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdfDerive(ikm, salt, new TextEncoder().encode("Content-Encoding: nonce\0"), 96);

  // Pad plaintext (RFC 8188: delimiter byte 0x02)
  const padded = concatBytes(plaintext, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, padded)
  );

  // Build aes128gcm content encoding body:
  // salt (16) | record size (4) | key ID length (1) | key ID (65) | encrypted data
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  return concatBytes(
    salt,
    rs,
    new Uint8Array([ephPubRaw.length]),
    ephPubRaw,
    encrypted
  );
}

// ─── Send single push ───
async function sendPush(
  endpoint: string, p256dh: string, auth: string,
  payload: string, vapidConfig: { vapid_public_key: string; vapid_private_key_jwk: string }
) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const privateKeyJwk = JSON.parse(vapidConfig.vapid_private_key_jwk);

  const jwt = await createVapidJwt(audience, "mailto:contato@espacolamonie.com.br", privateKeyJwk);
  const body = await encryptPayload(p256dh, auth, payload);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${vapidConfig.vapid_public_key}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "high",
    },
    body,
  });

  console.log(`[manage-push] Push to ${endpoint.slice(0, 60)}... → ${res.status}`);
  return { status: res.status, ok: res.ok };
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ─── Get VAPID public key (public) ───
    if (action === 'get-vapid-key') {
      const config = await getOrCreateVapidKeys(supabase);
      return new Response(JSON.stringify({ publicKey: config.vapid_public_key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Subscribe to push (authenticated) ───
    if (action === 'subscribe') {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || '';

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: corsHeaders,
        });
      }

      const { subscription } = body;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return new Response(JSON.stringify({ error: 'Invalid subscription' }), {
          status: 400, headers: corsHeaders,
        });
      }

      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }, { onConflict: 'endpoint' });

      if (error) {
        console.error('[manage-push] Subscribe error:', error);
        return new Response(JSON.stringify({ error: 'Failed to save subscription' }), {
          status: 500, headers: corsHeaders,
        });
      }

      console.log(`[manage-push] Subscription saved for user ${user.id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Send notification to all subscribers (internal) ───
    if (action === 'send-notification') {
      const { title, body: notifBody, url: notifUrl, tag } = body;

      const config = await getOrCreateVapidKeys(supabase);
      const { data: subscriptions } = await supabase.from('push_subscriptions').select('*');

      if (!subscriptions || subscriptions.length === 0) {
        console.log('[manage-push] No push subscriptions found');
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payload = JSON.stringify({
        title: title || 'Lamoniê CRM',
        body: notifBody || '',
        url: notifUrl || '/visits',
        tag: tag || 'default',
        icon: '/icons/icon-192.png',
      });

      const results = [];
      for (const sub of subscriptions) {
        try {
          const result = await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload, config);
          results.push({ ok: result.ok, status: result.status });

          // Clean up expired/invalid subscriptions
          if (result.status === 410 || result.status === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            console.log(`[manage-push] Removed expired subscription ${sub.id}`);
          }
        } catch (e) {
          console.error('[manage-push] Push error:', e);
          results.push({ ok: false, error: String(e) });
        }
      }

      return new Response(JSON.stringify({ sent: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: corsHeaders,
    });
  } catch (err) {
    console.error('[manage-push] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
