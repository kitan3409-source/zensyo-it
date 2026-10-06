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
  await env.DB.prepare("DELETE FROM pins WHERE email=?").bind(sid).run();
  return json({ ok: true });
}

