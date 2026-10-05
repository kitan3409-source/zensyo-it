import {
  ITEMS, GACHA_ITEMS, MISSIONS, ACH, todayJST, rankOf, nextRankAt,
  getUser, getPower, getTotal, getRegions, getBoss, grantAch, verifySession, json,
} from "../_game.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sess = await verifySession(env, url.searchParams.get("token") || "");
  if (!sess) return json({ error: "Googleログインしてください" }, 401);
  const u = await getUser(env, sess.email, sess.name);
  const today = todayJST();
  let bonus = 0;
  if (u.last_login !== today) {
    const y = new Date(Date.now() + 9 * 3600e3 - 86400e3).toISOString().slice(0, 10);
    const streak = u.last_login === y ? (u.login_streak || 0) + 1 : 1;
    bonus = 30 + Math.min(streak * 5, 50);
    await env.DB.prepare(
      "UPDATE users SET last_login=?, login_streak=?, points=points+? WHERE email=?"
    ).bind(today, streak, bonus, sess.email).run();
    u.points = (u.points || 0) + bonus;
    u.last_login = today;
    u.login_streak = streak;
    await grantAch(env, sess.email, "login3", streak >= 3);
    await grantAch(env, sess.email, "login7", streak >= 7);
  }
  const inv = await env.DB.prepare("SELECT item FROM inventory WHERE email=?").bind(sess.email).all();
  const eq = await env.DB.prepare("SELECT slot, item FROM equipped WHERE email=?").bind(sess.email).all();
  const ms = await env.DB.prepare("SELECT key, progress, claimed FROM missions WHERE email=? AND day=?").bind(sess.email, today).all();
  const ach = await env.DB.prepare("SELECT key FROM achievements WHERE email=?").bind(sess.email).all();
  const equipped = {};
  for (const r of eq.results) equipped[r.slot] = r.item;
  const total = await getTotal(env, sess.email);
  return json({
    display: `${sess.email.split("@")[0]} ${sess.name}`,
    points: u.points,
    power: await getPower(env, sess.email),
    total,
    rank: rankOf(total),
    next_at: nextRankAt(total),
    streak: u.login_streak || 0,
    equipped,
    inventory: inv.results.map((r) => r.item),
    missions: Object.keys(MISSIONS).map((k) => {
      const r = ms.results.find((x) => x.key === k);
      return { key: k, desc: MISSIONS[k].desc, goal: MISSIONS[k].goal, bonus: MISSIONS[k].bonus,
        progress: r ? r.progress : 0, claimed: r ? r.claimed : 0 };
    }),
    achievements: ACH,
    unlocked: ach.results.map((r) => r.key),
    regions: await getRegions(env, sess.email, url.origin),
    boss: await getBoss(env, sess.email),
    login_bonus: bonus,
    items: ITEMS,
    gacha: GACHA_ITEMS,
  });
}
