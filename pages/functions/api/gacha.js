import { GACHA_ITEMS, getUser, countInv, grantAch, verifySession, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const sess = await verifySession(env, b.token);
  if (!sess) return json({ error: "ログインしてください" }, 401);
  const u = await getUser(env, sess.email, sess.name);
  const COST = 100;
  if ((u.points || 0) < COST) return json({ error: `ポイントが足りません（${COST}pt必要）` }, 400);
  const roll = Math.random();
  const rarity = roll < 0.6 ? "N" : roll < 0.9 ? "R" : roll < 0.99 ? "SR" : "SSR";
  const pool = GACHA_ITEMS.filter((i) => i.rarity === rarity);
  const item = pool[Math.floor(Math.random() * pool.length)];
  const owned = await env.DB.prepare(
    "SELECT 1 AS x FROM inventory WHERE email=? AND item=?"
  ).bind(sess.email, item.id).first();
  let refund = 0;
  if (owned) {
    refund = 50;
  } else {
    await env.DB.prepare("INSERT INTO inventory (email, item) VALUES (?, ?)").bind(sess.email, item.id).run();
  }
  await env.DB.prepare(
    "UPDATE users SET points=points-?+?, gacha_count=gacha_count+1 WHERE email=?"
  ).bind(COST, refund, sess.email).run();
  const newAch = [];
  const invCnt = await countInv(env, sess.email);
  for (const [k, c] of [["gacha10", (u.gacha_count || 0) + 1 >= 10], ["ssr", rarity === "SSR"], ["shop5", invCnt >= 5], ["coll30", invCnt >= 30], ["coll50", invCnt >= 50]]) {
    const g = await grantAch(env, sess.email, k, c);
    if (g) newAch.push(g);
  }
  return json({
    ok: true, item, dup: !!owned, refund,
    points: (u.points || 0) - COST + refund + newAch.reduce((s, a) => s + a.bonus, 0),
    ach_new: newAch,
  });
}
