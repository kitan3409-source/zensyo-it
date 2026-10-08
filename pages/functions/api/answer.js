import {
  getUser, getPower, getTotals, levelOf, bumpMission, grantAch, damageBoss,
  checkRegions, rankOf, verifySession, json,
} from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const sess = await verifySession(env, b.token);
  if (!sess) return json({ error: "ログインしてください" }, 401);
  const student = `${sess.email.split("@")[0]} ${sess.name}`.slice(0, 50);
  await env.DB.prepare(
    "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    student,
    String(b.term || "").slice(0, 200),
    String(b.direction || "").slice(0, 10),
    b.correct ? 1 : 0,
    Date.now() / 1000
  ).run();
  const c01 = b.correct ? 1 : 0;
  await env.DB.prepare(
    "UPDATE users SET answered_total=CASE WHEN answered_total>=0 THEN answered_total+1 ELSE answered_total END, " +
    "correct_total=CASE WHEN correct_total>=0 THEN correct_total+? ELSE correct_total END, last_activity=? WHERE email=?"
  ).bind(c01, Date.now() / 1000, sess.email).run();
  await env.DB.prepare(
    "INSERT INTO term_stats (term, answered, correct, last_ts) VALUES (?, 1, ?, ?) " +
    "ON CONFLICT(term) DO UPDATE SET answered=answered+1, correct=correct+excluded.correct, last_ts=excluded.last_ts"
  ).bind(String(b.term || "").slice(0, 200), c01, Date.now() / 1000).run();
  const u = await getUser(env, sess.email, sess.name);
  const streak = b.correct ? (u.cur_streak || 0) + 1 : 0;
  const tot = await getTotals(env, u);
  const power = await getPower(env, sess.email, tot.correct);
  const combo = b.correct && streak >= 3 ? Math.min(streak * 2, 20) : 0;
  const earned = (b.correct ? 10 : 2) + combo;
  await env.DB.prepare(
    "UPDATE users SET points=points+?, lifetime=lifetime+?, cur_streak=?, best_streak=MAX(COALESCE(best_streak,0),?) WHERE email=?"
  ).bind(earned, earned, streak, streak, sess.email).run();
  const doneM = [];
  const m1 = await bumpMission(env, sess.email, "ans10", 1, true);
  if (m1) doneM.push(m1);
  if (b.correct) {
    const m2 = await bumpMission(env, sess.email, "cor15", 1, true);
    if (m2) doneM.push(m2);
    const m3 = await bumpMission(env, sess.email, "str8", streak, false);
    if (m3) doneM.push(m3);
  }
  let bossRes = null;
  if (b.correct) bossRes = await damageBoss(env, sess.email, 1 + Math.floor(power / 80));
  const total = tot.total;
  const correctTotal = tot.correct;
  const level = levelOf(correctTotal);
  const levelUp = level > levelOf(correctTotal - (b.correct ? 1 : 0)) ? level : null;
  const hour = new Date(Date.now() + 9 * 3600e3).getUTCHours();
  const newAch = [];
  const tryA = async (k, c) => { const a = await grantAch(env, sess.email, k, c); if (a) newAch.push(a); };
  await tryA("first", total >= 1);
  await tryA("ans50", total >= 50);
  await tryA("ans100", total >= 100);
  await tryA("ans300", total >= 300);
  await tryA("ans500", total >= 500);
  await tryA("streak10", streak >= 10);
  await tryA("streak20", streak >= 20);
  await tryA("streak30", streak >= 30);
  await tryA("early", hour < 7);
  await tryA("night", hour >= 23);
  await tryA("rich", (u.lifetime || 0) + earned >= 1000);
  await tryA("lv5", level >= 5);
  await tryA("lv10", level >= 10);
  if (bossRes && bossRes.killed) await tryA("boss", true);
  const regionHits = await checkRegions(env, sess.email, new URL(request.url).origin);
  for (const r of regionHits) newAch.push(r);
  const points = (u.points || 0) + earned + doneM.reduce((s, x) => s + x.bonus, 0) +
    newAch.reduce((s, x) => s + x.bonus, 0) + (bossRes && bossRes.killed ? 200 : 0);
  return json({
    ok: true, earned, combo, points,
    missions_done: doneM, ach_new: newAch,
    total, rank: rankOf(total),
    rank_up: rankOf(total) !== rankOf(total - 1) ? rankOf(total) : null,
    level, correct_total: correctTotal, level_up: levelUp,
    boss: bossRes,
  });
}
