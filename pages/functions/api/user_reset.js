import { ensureGameTables, pwMatches, json } from "../_game.js";

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
  for (const t of [
    "pins", "users", "inventory", "equipped",
    "missions", "achievements", "boss_damage",
  ]) {
    try {
      await env.DB.prepare(`DELETE FROM ${t} WHERE email=?`).bind(sid).run();
    } catch {}
  }
  try {
    await env.DB.prepare("DELETE FROM answers WHERE student LIKE ?").bind(sid + " %").run();
  } catch {}
  return json({ ok: true });
}
