import { ensureGameTables, hashPw, getSecret, hmacSha256, b64e, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const sid = `${b.cls || ""}-${b.num || ""}`.replace(/[|@\s]/g, "").slice(0, 24);
  const name = String(b.name || "").replace(/\|/g, "").trim().slice(0, 30);
  const pin = String(b.pin || "");
  if (!sid || sid === "-" || !name) return json({ error: "クラス・番号・名前を入れてください" }, 400);
  if (pin.length < 4) return json({ error: "PINは4文字以上にしてください" }, 400);
  await ensureGameTables(env);
  const stored = await env.DB.prepare("SELECT pin FROM pins WHERE email=?").bind(sid).first();
  const hash = await hashPw(pin);
  if (stored) {
    if (stored.pin !== hash) return json({ error: "PINが違います（忘れたら先生にリセットしてもらって）" }, 403);
  } else {
    await env.DB.prepare("INSERT INTO pins (email, pin) VALUES (?, ?)").bind(sid, hash).run();
  }
  const secret = await getSecret(env);
  const exp = Date.now() + 7 * 24 * 3600 * 1000;
  const payload = `${sid}|${name}|${exp}`;
  const sig = await hmacSha256(secret, payload);
  return json({ token: b64e(payload) + "." + sig, display: `${sid} ${name}` });
}
