export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const r = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" +
      encodeURIComponent(b.credential || "")
  );
  if (!r.ok) return json({ error: "Googleログインに失敗しました" }, 401);
  const t = await r.json();
  if (t.aud !== env.GOOGLE_CLIENT_ID) return json({ error: "client_id が一致しません" }, 401);
  if (t.hd !== "gse.okayama-c.ed.jp") {
    return json({ error: "学校のアカウント（@gse.okayama-c.ed.jp）でログインしてください" }, 403);
  }
  const email = t.email;
  const name = t.name || "";
  const secret = await getSecret(env);
  const exp = Date.now() + 7 * 24 * 3600 * 1000;
  const payload = `${email}|${name}|${exp}`;
  const sig = await hmacSha256(secret, payload);
  const token = b64e(payload) + "." + sig;
  return json({ token, display: `${email.split("@")[0]} ${name}` });
}

function b64e(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

async function hmacSha256(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getSecret(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
  ).run();
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key='session_secret'").first();
  if (r && r.value) return r.value;
  const s = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('session_secret', ?)"
  ).bind(s).run();
  return s;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
