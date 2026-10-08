import { ensureGameTables, pwMatches, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!(await pwMatches(env, b.pw || ""))) return json({ error: "forbidden" }, 403);
  await ensureGameTables(env);
  for (const t of ["answers", "users", "inventory", "equipped", "missions", "achievements", "pins", "boss", "boss_damage", "term_stats"]) {
    try {
      await env.DB.prepare(`DELETE FROM ${t}`).run();
    } catch {}
  }
  return json({ ok: true });
}

