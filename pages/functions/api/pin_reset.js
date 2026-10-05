import { ensureGameTables, hashPw, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!(await pwMatches(env, b.pw || ""))) return json({ error: "forbidden" }, 403);
  const sid = String(b.sid || "").slice(0, 24);
  if (!sid) return json({ error: "bad sid" }, 400);
  await ensureGameTables(env);
  await env.DB.prepare("DELETE FROM pins WHERE email=?").bind(sid).run();
  return json({ ok: true });
}

async function pwMatches(env, submitted) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
  const TEACHER_PW = env.TEACHER_PW || "sensei";
  if (row && row.value) {
    const h = await hashPw(submitted);
    return row.value === h || row.value === submitted;
  }
  return submitted === TEACHER_PW;
}
