import { getUser, bumpMission, verifySession, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const sess = await verifySession(env, b.token);
  if (!sess) return json({ error: "Googleログインしてください" }, 401);
  const student = `${sess.email.split("@")[0]} ${sess.name}`.slice(0, 50);
  await env.DB.prepare(
    "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(
      student,
      String(b.term || "").slice(0, 200),
      String(b.direction || "").slice(0, 10),
      b.correct ? 1 : 0,
      Date.now() / 1000
    )
    .run();
  const earned = b.correct ? 10 : 2;
  const u = await getUser(env, sess.email, sess.name);
  const streak = b.correct ? (u.cur_streak || 0) + 1 : 0;
  await env.DB.prepare("UPDATE users SET points=points+?, cur_streak=? WHERE email=?")
    .bind(earned, streak, sess.email).run();
  const doneM = [];
  const m1 = await bumpMission(env, sess.email, "ans10", 1, true);
  if (m1) doneM.push(m1);
  if (b.correct) {
    const m2 = await bumpMission(env, sess.email, "cor15", 1, true);
    if (m2) doneM.push(m2);
    const m3 = await bumpMission(env, sess.email, "str8", streak, false);
    if (m3) doneM.push(m3);
  }
  const points = (u.points || 0) + earned + doneM.reduce((s, x) => s + x.bonus, 0);
  return json({ ok: true, earned, points, missions_done: doneM });
}
