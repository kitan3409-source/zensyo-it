import { allItems, rankOf, levelOf, basePower, getBoss, pwMatches, json } from "../_game.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!(await pwMatches(env, url.searchParams.get("pw") || ""))) {
    return json({ error: "forbidden" }, 403);
  }
  const students = await env.DB.prepare(
    "SELECT student, COUNT(*) AS answered, SUM(correct) AS correct, MAX(ts) AS last_ts FROM answers GROUP BY student ORDER BY last_ts DESC"
  ).all();
  const terms = await env.DB.prepare(
    "SELECT term, COUNT(*) AS answered, SUM(correct) AS correct FROM answers GROUP BY term ORDER BY CAST(SUM(correct) AS REAL)/COUNT(*) ASC"
  ).all();
  const rate = (r) => (r.answered ? Math.round((r.correct / r.answered) * 1000) / 10 : 0);
  let ptMap = {}, pwMap = {}, streakMap = {}, corMap = {};
  for (const r of students.results) corMap[String(r.student).split(" ")[0]] = r.correct || 0;
  try {
    const us = await env.DB.prepare("SELECT email, points, login_streak FROM users").all();
    const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
    const all = allItems();
    for (const u of us.results) {
      const k = u.email.split("@")[0];
      ptMap[k] = u.points;
      pwMap[k] = basePower(levelOf(corMap[k] || 0));
      streakMap[k] = u.login_streak || 0;
    }
    for (const r of eqs.results) {
      const k = r.email.split("@")[0];
      if (all[r.item] && pwMap[k] !== undefined) pwMap[k] += all[r.item].power;
    }
  } catch {}
  let boss = null;
  try { boss = await getBoss(env, ""); } catch {}
  return json({
    students: students.results.map((r) => ({
      student: r.student,
      answered: r.answered,
      correct: r.correct,
      rate: rate(r),
      points: ptMap[String(r.student).split(" ")[0]] || 0,
      power: pwMap[String(r.student).split(" ")[0]] || 100,
      level: levelOf(r.correct || 0),
      rank: rankOf(r.answered),
      streak: streakMap[String(r.student).split(" ")[0]] || 0,
      last_ts: r.last_ts,
    })),
    terms: terms.results.map((r) => ({
      term: r.term,
      answered: r.answered,
      correct: r.correct,
      rate: rate(r),
    })),
    boss,
  });
}


