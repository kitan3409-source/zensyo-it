import {
  getUser, getPower, getTotals, levelOf, bumpMission, damageBoss,
  checkRegions, rankOf, verifySession, json, ACH,
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
  const u = await getUser(env, sess.email, sess.name);
  const now = Date.now() / 1000;
  if (u.last_activity && now - u.last_activity < 1.0) {
    return json({ ok: false, too_fast: true, error: "連打ガード：少し間をあけて答えて" });
  }
  const c01 = b.correct ? 1 : 0;
  const term = String(b.term || "").slice(0, 200);
  const streak = b.correct ? (u.cur_streak || 0) + 1 : 0;
  const tot = await getTotals(env, u);
  const power = await getPower(env, sess.email, tot.correct + c01);
  const combo = b.correct && streak >= 3 ? Math.min(streak * 2, 20) : 0;
  const earned = (b.correct ? 10 : 0) + combo;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)"
    ).bind(student, term, String(b.direction || "").slice(0, 10), c01, now),
    env.DB.prepare(
      "UPDATE users SET answered_total=CASE WHEN answered_total>=0 THEN answered_total+1 ELSE answered_total END, " +
      "correct_total=CASE WHEN correct_total>=0 THEN correct_total+? ELSE correct_total END, last_activity=?, " +
      "points=points+?, lifetime=lifetime+?, cur_streak=?, best_streak=MAX(COALESCE(best_streak,0),?) WHERE email=?"
    ).bind(c01, now, earned, earned, streak, streak, sess.email),
    env.DB.prepare(
      "INSERT INTO user_extras (email, acc_ema) VALUES (?, ?) " +
      "ON CONFLICT(email) DO UPDATE SET acc_ema=CASE WHEN acc_ema<0 THEN excluded.acc_ema ELSE acc_ema*0.8+excluded.acc_ema*0.2 END"
    ).bind(sess.email, c01),
    env.DB.prepare(
      "INSERT INTO term_stats (term, answered, correct, last_ts) VALUES (?, 1, ?, ?) " +
      "ON CONFLICT(term) DO UPDATE SET answered=answered+1, correct=correct+excluded.correct, last_ts=excluded.last_ts"
    ).bind(term, c01, now),
    ...(c01 ? [env.DB.prepare(
      "INSERT INTO daily_stats (date, student, correct) VALUES (date('now','+9 hours'), ?, 1) " +
      "ON CONFLICT(date, student) DO UPDATE SET correct=correct+1"
    ).bind(sess.email.split("@")[0])] : []),
  ]);
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
  const total = tot.total + 1;
  const correctTotal = tot.correct + c01;
  const level = levelOf(correctTotal);
  const levelUp = level > levelOf(correctTotal - (b.correct ? 1 : 0)) ? level : null;
  const hour = new Date(Date.now() + 9 * 3600e3).getUTCHours();
  const unlockedRows = await env.DB.prepare(
    "SELECT key FROM achievements WHERE email=?"
  ).bind(sess.email).all();
  const unlocked = new Set(unlockedRows.results.map((r) => r.key));
  const cand = [
    ["first", total >= 1], ["ans50", total >= 50], ["ans100", total >= 100],
    ["ans300", total >= 300], ["ans500", total >= 500],
    ["streak10", streak >= 10], ["streak20", streak >= 20], ["streak30", streak >= 30],
    ["early", hour < 7], ["night", hour >= 23],
    ["rich", (u.lifetime || 0) + earned >= 1000],
    ["lv5", level >= 5], ["lv10", level >= 10],
    ["boss", !!(bossRes && bossRes.killed)],
    ["sharp", correctTotal >= 30 && correctTotal / total >= 0.9],
  ];
  const newAch = [];
  const grants = cand.filter(([k, c]) => c && !unlocked.has(k));
  if (grants.length) {
    let bonusSum = 0;
    const stmts = [];
    for (const [k] of grants) {
      const a = ACH[k];
      bonusSum += a.bonus;
      newAch.push({ key: k, name: a.name, desc: a.desc, bonus: a.bonus });
      stmts.push(env.DB.prepare(
        "INSERT OR IGNORE INTO achievements (email, key, ts) VALUES (?, ?, ?)"
      ).bind(sess.email, k, Date.now()));
    }
    stmts.push(env.DB.prepare("UPDATE users SET points=points+? WHERE email=?").bind(bonusSum, sess.email));
    await env.DB.batch(stmts);
  }
  const regionHits = await checkRegions(env, sess.email, new URL(request.url).origin);
  for (const r of regionHits) newAch.push(r);
  const points = (u.points || 0) + earned + doneM.reduce((s, x) => s + x.bonus, 0) +
    newAch.reduce((s, x) => s + x.bonus, 0) + (bossRes && bossRes.killed ? bossRes.reward : 0);
  return json({
    ok: true, earned, combo, points,
    missions_done: doneM, ach_new: newAch,
    total, rank: rankOf(total),
    rank_up: rankOf(total) !== rankOf(total - 1) ? rankOf(total) : null,
    level, correct_total: correctTotal, level_up: levelUp,
    boss: bossRes,
  });
}
