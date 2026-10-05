export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if ((b.pw || "") !== (await getPw(env))) return json({ error: "forbidden" }, 403);
  if (!env.DB) return json({ error: "DB binding がありません" }, 500);
  const np = String(b.new_pw || "").trim();
  if (np.length < 4) return json({ error: "4文字以上にしてください" }, 400);
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
  ).run();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('pw', ?)"
  ).bind(np).run();
  return json({ ok: true });
}

async function getPw(env) {
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    ).run();
    const r = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
    return (r && r.value) || env.TEACHER_PW || "sensei";
  } catch {
    return env.TEACHER_PW || "sensei";
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
