import { ITEMS, ensureGameTables, verifySession, json } from "../_game.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sess = await verifySession(env, url.searchParams.get("token") || "");
  if (!sess) return json({ error: "Googleログインしてください" }, 401);
  await ensureGameTables(env);
  const users = await env.DB.prepare("SELECT email, name, points FROM users").all();
  const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
  const powerMap = {};
  for (const u of users.results) powerMap[u.email] = 100;
  for (const r of eqs.results) {
    if (ITEMS[r.item] && powerMap[r.email] !== undefined) powerMap[r.email] += ITEMS[r.item].power;
  }
  const list = users.results
    .map((u) => ({
      id: u.email.split("@")[0],
      name: u.name,
      power: powerMap[u.email],
      points: u.points,
    }))
    .sort((a, b) => b.power - a.power || b.points - a.points)
    .slice(0, 30);
  return json({ ranking: list, me: sess.email.split("@")[0] });
}
