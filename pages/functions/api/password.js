import { hashPw, pwMatches, clearPwCache, json } from "../_game.js";

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
  clearPwCache();
  return json({ ok: true });
}
