import { allItems, ensureGameTables, getPower, verifySession, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const sess = await verifySession(env, b.token);
  if (!sess) return json({ error: "ログインしてください" }, 401);
  if (!["weapon", "armor", "acc"].includes(b.slot)) return json({ error: "bad slot" }, 400);
  await ensureGameTables(env);
  const all = allItems();
  if (b.item) {
    if (!all[b.item] || all[b.item].slot !== b.slot) return json({ error: "bad item" }, 400);
    const owned = await env.DB.prepare(
      "SELECT 1 AS x FROM inventory WHERE email=? AND item=?"
    ).bind(sess.email, b.item).first();
    if (!owned) return json({ error: "持っていません" }, 400);
    await env.DB.prepare(
      "INSERT INTO equipped (email, slot, item) VALUES (?, ?, ?) " +
      "ON CONFLICT(email, slot) DO UPDATE SET item=excluded.item"
    ).bind(sess.email, b.slot, b.item).run();
  } else {
    await env.DB.prepare("DELETE FROM equipped WHERE email=? AND slot=?").bind(sess.email, b.slot).run();
  }
  return json({ ok: true, power: await getPower(env, sess.email) });
}
