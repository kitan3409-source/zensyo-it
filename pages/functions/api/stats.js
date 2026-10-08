import { allItems, rankOf, levelOf, basePower, getBoss, getTotals, ensureGameTables, pwMatches, json } from "../_game.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!(await pwMatches(env, url.searchParams.get("pw") || ""))) {
    return json({ error: "forbidden" }, 403);
  }
  await ensureGameTables(env);
  try {
    const us = await env.DB.prepare(
      "SELECT email, name, points, login_streak, answered_total, correct_total, last_activity FROM users"
    ).all();
    const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
    const termRows = await env.DB.prepare(
      "SELECT term, answered, correct FROM term_stats ORDER BY CAST(correct AS REAL)/MAX(answered,1) ASC"
    ).all();
    const all = allItems();
    const eqP = {};
    for (const r of eqs.results) {
      const it = all[r.item];
      if (it) eqP[r.email] = (eqP[r.email] || 0) + it.power;
    }
    const students = [];
    for (const u of us.results) {
      const t = await getTotals(env, u);
      const a = t.total;
      const c = t.correct;
      students.push({
        student: `${u.email.split("@")[0]} ${u.name || ""}`.trim(),
        answered: a,
        correct: c,
        rate: a ? Math.round((c / a) * 1000) / 10 : 0,
        points: u.points || 0,
        power: basePower(levelOf(c)) + (eqP[u.email] || 0),
        level: levelOf(c),
        rank: rankOf(a),
        streak: u.login_streak || 0,
        last_ts: u.last_activity || 0,
      });
    }
    students.sort((x, y) => y.last_ts - x.last_ts);
    let boss = null;
    try { boss = await getBoss(env, ""); } catch {}
    return json({
      students,
      terms: termRows.results.map((r) => ({
        term: r.term,
        answered: r.answered,
        correct: r.correct,
        rate: r.answered ? Math.round((r.correct / r.answered) * 1000) / 10 : 0,
      })),
      boss,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
