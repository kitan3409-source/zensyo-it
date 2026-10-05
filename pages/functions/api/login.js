import { b64e, getSecret, hmacSha256, json } from "../_game.js";

export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const r = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" +
      encodeURIComponent(b.credential || "")
  );
  if (!r.ok) return json({ error: "Googleログインに失敗しました" }, 401);
  const t = await r.json();
  if (t.aud !== env.GOOGLE_CLIENT_ID) return json({ error: "client_id が一致しません" }, 401);
  if (t.hd !== "gse.okayama-c.ed.jp") {
    return json({ error: "学校のアカウント（@gse.okayama-c.ed.jp）でログインしてください" }, 403);
  }
  const email = t.email;
  const name = t.name || "";
  const secret = await getSecret(env);
  const exp = Date.now() + 7 * 24 * 3600 * 1000;
  const payload = `${email}|${name}|${exp}`;
  const sig = await hmacSha256(secret, payload);
  const token = b64e(payload) + "." + sig;
  return json({ token, display: `${email.split("@")[0]} ${name}` });
}
