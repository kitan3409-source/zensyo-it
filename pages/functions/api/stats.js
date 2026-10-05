import { ITEMS, json } from "../_game.js";

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
  let ptMap = {}, pwMap = {};
  try {
    const us = await env.DB.prepare("SELECT email, points FROM users").all();
    const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
    for (const u of us.results) { ptMap[u.email.split("@")[0]] = u.points; pwMap[u.email.split("@")[0]] = 100; }
    for (const r of eqs.results) {
      const k = r.email.split("@")[0];
      if (ITEMS[r.item] && pwMap[k] !== undefined) pwMap[k] += ITEMS[r.item].power;
    }
  } catch {}
  return json({
    students: students.results.map((r) => ({
      student: r.student,
      answered: r.answered,
      correct: r.correct,
      rate: rate(r),
      points: ptMap[String(r.student).split(" ")[0]] || 0,
      power: pwMap[String(r.student).split(" ")[0]] || 100,
      last_ts: r.last_ts,
    })),
    terms: terms.results.map((r) => ({
      term: r.term,
      answered: r.answered,
      correct: r.correct,
      rate: rate(r),
    })),
  });
}

async function hashPw(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pwMatches(env, submitted) {
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    ).run();
    const r = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
    if (r && r.value) {
      return r.value === (await hashPw(submitted)) || r.value === submitted;
    }
  } catch {}
  return submitted === (env.TEACHER_PW || "sensei");
}


