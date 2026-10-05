export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!(await pwMatches(env, b.pw || ""))) return json({ error: "forbidden" }, 403);
  if (!env.DB) return json({ error: "DB binding がありません" }, 500);
  const np = String(b.new_pw || "").trim();
  if (np.length < 4) return json({ error: "4文字以上にしてください" }, 400);
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
  ).run();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('pw', ?)"
  ).bind(await hashPw(np)).run();
  return json({ ok: true });
}

async function hashPw(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pwMatches(env, submitted) {
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    ).run();
    const r = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
    if (r && r.value) {
      return r.value === (await hashPw(submitted)) || r.value === submitted;
    }
  } catch {}
  return submitted === (env.TEACHER_PW || "sensei");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
