import { allItems, rankOf, levelOf, basePower, ensureGameTables, verifySession, json } from "../_game.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sess = await verifySession(env, url.searchParams.get("token") || "");
  if (!sess) return json({ error: "ログインしてください" }, 401);
  await ensureGameTables(env);
  const users = await env.DB.prepare("SELECT email, name, points, login_streak FROM users").all();
  const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
  const all = allItems();
  const totals = await env.DB.prepare(
    "SELECT student, COUNT(*) AS c, SUM(correct) AS cor FROM answers GROUP BY student"
  ).all();
  const corMap = {};
  for (const r of totals.results) corMap[String(r.student).split(" ")[0]] = r.cor || 0;
  const powerMap = {};
  for (const u of users.results)
    powerMap[u.email] = basePower(levelOf(corMap[u.email.split("@")[0]] || 0));
  for (const r of eqs.results) {
    if (all[r.item] && powerMap[r.email] !== undefined) powerMap[r.email] += all[r.item].power;
  }
  const week = await env.DB.prepare(
    "SELECT student, COUNT(*) AS c, SUM(correct) AS s FROM answers WHERE ts >= ? GROUP BY student"
  ).bind(Date.now() / 1000 - 7 * 86400).all();
  const totMap = {}, nameMap = {}, weekMap = {};
  for (const r of totals.results) {
    const id = String(r.student).split(" ")[0];
    totMap[id] = r.c;
    nameMap[id] = String(r.student).split(" ").slice(1).join(" ");
  }
  for (const r of week.results) {
    weekMap[String(r.student).split(" ")[0]] = (r.s || 0) * 8 + r.c * 2;
  }
  const list = users.results.map((u) => ({
    id: u.email.split("@")[0],
    name: u.name || nameMap[u.email.split("@")[0]] || "",
    power: powerMap[u.email],
    points: u.points,
    streak: u.login_streak || 0,
    total: totMap[u.email.split("@")[0]] || 0,
    weekly: weekMap[u.email.split("@")[0]] || 0,
    rank: rankOf(totMap[u.email.split("@")[0]] || 0),
  }));
  return json({
    power: [...list].sort((a, b) => b.power - a.power || b.points - a.points).slice(0, 30),
    weekly: [...list].sort((a, b) => b.weekly - a.weekly).slice(0, 30),
    rank: [...list].sort((a, b) => b.total - a.total).slice(0, 30),
    streak: [...list].sort((a, b) => b.streak - a.streak).slice(0, 30),
    me: sess.email.split("@")[0],
  });
}
