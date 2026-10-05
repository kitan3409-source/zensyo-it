import { ITEMS, getUser, countInv, grantAch, verifySession, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const sess = await verifySession(env, b.token);
  if (!sess) return json({ error: "ログインしてください" }, 401);
  const item = ITEMS[b.item];
  if (!item) return json({ error: "アイテムがありません" }, 400);
  const u = await getUser(env, sess.email, sess.name);
  const owned = await env.DB.prepare(
    "SELECT 1 AS x FROM inventory WHERE email=? AND item=?"
  ).bind(sess.email, b.item).first();
  if (owned) return json({ error: "もう持ってます" }, 400);
  if ((u.points || 0) < item.price) {
    return json({ error: `ポイントが足りません（${item.price}pt必要）` }, 400);
  }
  await env.DB.prepare("UPDATE users SET points=points-? WHERE email=?").bind(item.price, sess.email).run();
  await env.DB.prepare("INSERT INTO inventory (email, item) VALUES (?, ?)").bind(sess.email, b.item).run();
  await grantAch(env, sess.email, "shop5", await countInv(env, sess.email) >= 5);
  return json({ ok: true, points: (u.points || 0) - item.price });
}
