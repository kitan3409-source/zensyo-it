export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/config") {
      return json({ client_id: env.GOOGLE_CLIENT_ID || "" });
    }

    if (url.pathname === "/api/login" && request.method === "POST") {
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

    if (url.pathname === "/api/answer" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const sess = await verifySession(env, b.token);
      if (!sess) return json({ error: "Googleログインしてください" }, 401);
      const student = `${sess.email.split("@")[0]} ${sess.name}`.slice(0, 50);
      if (!env.DB) return json({ error: "DB binding がありません（Variable name DB で D1 を割り当ててください）" }, 500);
      try {
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
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
      return json({ ok: true });
    }

    if (url.pathname === "/api/password" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      if (!(await pwMatches(env, b.pw || ""))) return json({ error: "forbidden" }, 403);
      if (!env.DB) return json({ error: "DB binding がありません" }, 500);
      const np = String(b.new_pw || "").trim();
      if (np.length < 4) return json({ error: "4文字以上にしてください" }, 400);
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
      ).run();
      await env.DB.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('pw', ?)"
      ).bind(await hashPw(np)).run();
      return json({ ok: true });
    }

    if (url.pathname === "/api/stats") {
      if (!(await pwMatches(env, url.searchParams.get("pw") || ""))) {
        return json({ error: "forbidden" }, 403);
      }
      if (!env.DB) return json({ error: "DB binding がありません（Variable name DB で D1 を割り当ててください）" }, 500);
      let students, terms;
      try {
        students = await env.DB.prepare(
          "SELECT student, COUNT(*) AS answered, SUM(correct) AS correct, MAX(ts) AS last_ts FROM answers GROUP BY student ORDER BY last_ts DESC"
        ).all();
        terms = await env.DB.prepare(
          "SELECT term, COUNT(*) AS answered, SUM(correct) AS correct FROM answers GROUP BY term ORDER BY CAST(SUM(correct) AS REAL)/COUNT(*) ASC"
        ).all();
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
      const rate = (r) => (r.answered ? Math.round((r.correct / r.answered) * 1000) / 10 : 0);
      return json({
        students: students.results.map((r) => ({
          student: r.student,
          answered: r.answered,
          correct: r.correct,
          rate: rate(r),
          last_ts: r.last_ts,
        })),
        terms: terms.results.map((r) => ({
          term: r.term,
          answered: r.answered,
          correct: r.correct,
          rate: rate(r),
        })),
      });
    }

    // 静的ファイルへのパスマッピング（/teacher → teacher.html 等）
    const map = { "/": "/index.html", "/teacher": "/teacher.html", "/terms": "/terms.json" };
    const mapped = map[url.pathname] || url.pathname;
    const assetUrl = new URL(mapped, url.origin);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};

function b64e(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

function b64d(s) {
  return decodeURIComponent(escape(atob(s)));
}

async function hmacSha256(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getSecret(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
  ).run();
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key='session_secret'").first();
  if (r && r.value) return r.value;
  const s = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('session_secret', ?)"
  ).bind(s).run();
  return s;
}

async function verifySession(env, token) {
  if (!token || !token.includes(".")) return null;
  const [b64, sig] = token.split(".");
  let payload;
  try {
    payload = b64d(b64);
  } catch {
    return null;
  }
  const secret = await getSecret(env);
  if ((await hmacSha256(secret, payload)) !== sig) return null;
  const [email, name, exp] = payload.split("|");
  if (Number(exp) < Date.now()) return null;
  return { email, name };
}

async function hashPw(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pwMatches(env, submitted) {
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    ).run();
    const r = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
    if (r && r.value) {
      return r.value === (await hashPw(submitted)) || r.value === submitted;
    }
  } catch {}
  return submitted === (env.TEACHER_PW || "sensei");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
