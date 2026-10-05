import { ITEMS, MISSIONS, todayJST, getUser, getPower, verifySession, json } from "../_game.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sess = await verifySession(env, url.searchParams.get("token") || "");
  if (!sess) return json({ error: "Googleログインしてください" }, 401);
  const u = await getUser(env, sess.email, sess.name);
  const today = todayJST();
  let bonus = 0;
  if (u.last_login !== today) {
    bonus = 30;
    await env.DB.prepare(
      "UPDATE users SET last_login=?, points=points+30 WHERE email=?"
    ).bind(today, sess.email).run();
    u.points = (u.points || 0) + 30;
    u.last_login = today;
  }
  const inv = await env.DB.prepare("SELECT item FROM inventory WHERE email=?").bind(sess.email).all();
  const eq = await env.DB.prepare("SELECT slot, item FROM equipped WHERE email=?").bind(sess.email).all();
  const ms = await env.DB.prepare("SELECT key, progress, claimed FROM missions WHERE email=? AND day=?").bind(sess.email, today).all();
  const equipped = {};
  for (const r of eq.results) equipped[r.slot] = r.item;
  return json({
    display: `${sess.email.split("@")[0]} ${sess.name}`,
    points: u.points,
    power: await getPower(env, sess.email),
    equipped,
    inventory: inv.results.map((r) => r.item),
    missions: Object.keys(MISSIONS).map((k) => {
      const r = ms.results.find((x) => x.key === k);
      return {
        key: k,
        desc: MISSIONS[k].desc,
        goal: MISSIONS[k].goal,
        bonus: MISSIONS[k].bonus,
        progress: r ? r.progress : 0,
        claimed: r ? r.claimed : 0,
      };
    }),
    login_bonus: bonus,
    items: ITEMS,
  });
}
