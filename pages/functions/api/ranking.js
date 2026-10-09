import { allItems, rankOf, levelOf, basePower, ensureGameTables, getTotals, verifySession, json } from "../_game.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sess = await verifySession(env, url.searchParams.get("token") || "");
  if (!sess) return json({ error: "ログインしてください" }, 401);
  await ensureGameTables(env);
  const users = await env.DB.prepare(
    "SELECT email, name, points, login_streak, best_streak, answered_total, correct_total FROM users"
  ).all();
  const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
  const all = allItems();
  const eqP = {};
  for (const r of eqs.results) {
    const it = all[r.item];
    if (it) eqP[r.email] = (eqP[r.email] || 0) + it.power;
  }
  const week = await env.DB.prepare(
    "SELECT student, COUNT(*) AS c, SUM(correct) AS s FROM answers WHERE ts >= ? GROUP BY student"
  ).bind(Date.now() / 1000 - 7 * 86400).all();
  const weekMap = {};
  for (const r of week.results) {
    weekMap[String(r.student).split(" ")[0]] = (r.s || 0) * 10;
  }
  const list = [];
  for (const u of users.results) {
    const t = await getTotals(env, u);
    const id = u.email.split("@")[0];
    const power = basePower(levelOf(t.correct)) + (eqP[u.email] || 0);
    const adj = (t.correct + 12) / (t.total + 20);
    list.push({
      id,
      name: u.name || "",
      power,
      points: u.points,
      streak: u.login_streak || 0,
      total: t.total,
      weekly: Math.round((weekMap[id] || 0) * adj * adj),
      rank: rankOf(t.total),
      acc: Math.round(adj * 1000) / 10,
      raw_acc: t.total ? Math.round((t.correct / t.total) * 1000) / 10 : 0,
      score: Math.round(power * adj * adj),
    });
  }
  return json({
    overall: [...list].sort((a, b) => b.score - a.score).slice(0, 30),
    acc: [...list].sort((a, b) => b.acc - a.acc || b.total - a.total).slice(0, 30),
    power: [...list].sort((a, b) => b.power - a.power || b.points - a.points).slice(0, 30),
    weekly: [...list].sort((a, b) => b.weekly - a.weekly).slice(0, 30),
    rank: [...list].sort((a, b) => b.total - a.total).slice(0, 30),
    streak: [...list].sort((a, b) => b.streak - a.streak).slice(0, 30),
    me: sess.email.split("@")[0],
  });
}
