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

    if (url.pathname === "/api/me") {
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

    if (url.pathname === "/api/buy" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const sess = await verifySession(env, b.token);
      if (!sess) return json({ error: "Googleログインしてください" }, 401);
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
      return json({ ok: true, points: (u.points || 0) - item.price });
    }

    if (url.pathname === "/api/equip" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const sess = await verifySession(env, b.token);
      if (!sess) return json({ error: "Googleログインしてください" }, 401);
      if (!["weapon", "armor", "acc"].includes(b.slot)) return json({ error: "bad slot" }, 400);
      await ensureGameTables(env);
      if (b.item) {
        if (!ITEMS[b.item] || ITEMS[b.item].slot !== b.slot) return json({ error: "bad item" }, 400);
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

    if (url.pathname === "/api/ranking") {
      const sess = await verifySession(env, url.searchParams.get("token") || "");
      if (!sess) return json({ error: "Googleログインしてください" }, 401);
      await ensureGameTables(env);
      const users = await env.DB.prepare("SELECT email, name, points FROM users").all();
      const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
      const powerMap = {};
      for (const u of users.results) powerMap[u.email] = 100;
      for (const r of eqs.results) {
        if (ITEMS[r.item] && powerMap[r.email] !== undefined) powerMap[r.email] += ITEMS[r.item].power;
      }
      const list = users.results
        .map((u) => ({
          id: u.email.split("@")[0],
          name: u.name,
          power: powerMap[u.email],
          points: u.points,
        }))
        .sort((a, b) => b.power - a.power || b.points - a.points)
        .slice(0, 30);
      return json({ ranking: list, me: sess.email.split("@")[0] });
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
      let ptMap = {}, pwMap = {};
      try {
        const us = await env.DB.prepare("SELECT email, points FROM users").all();
        const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
        for (const u of us.results) { ptMap[u.email.split("@")[0]] = u.points; pwMap[u.email.split("@")[0]] = 100; }
        for (const r of eqs.results) {
          const k = r.email.split("@")[0];
          if (ITEMS[r.item] && pwMap[k] !== undefined) pwMap[k] += ITEMS[r.item].power;
        }
      } catch {}
      return json({
        students: students.results.map((r) => ({
          student: r.student,
          answered: r.answered,
          correct: r.correct,
          rate: rate(r),
          points: ptMap[String(r.student).split(" ")[0]] || 0,
          power: pwMap[String(r.student).split(" ")[0]] || 100,
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

const ITEMS = {
  w1: { name: "エンピツソード", slot: "weapon", power: 10, price: 50 },
  w2: { name: "計算機ブレード", slot: "weapon", power: 30, price: 150 },
  w3: { name: "サーバーブレード", slot: "weapon", power: 80, price: 400 },
  a1: { name: "学生服", slot: "armor", power: 10, price: 50 },
  a2: { name: "ビジネススーツ", slot: "armor", power: 30, price: 150 },
  a3: { name: "デバッグアーマー", slot: "armor", power: 80, price: 400 },
  x1: { name: "USBメモリ", slot: "acc", power: 15, price: 80 },
  x2: { name: "電卓のお守り", slot: "acc", power: 40, price: 200 },
  x3: { name: "光ファイバー", slot: "acc", power: 100, price: 500 },
};

const MISSIONS = {
  ans10: { desc: "10問回答する", goal: 10, bonus: 60 },
  cor15: { desc: "15問正解する", goal: 15, bonus: 100 },
  str8: { desc: "8問連続正解する", goal: 8, bonus: 80 },
};

function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function ensureGameTables(env) {
  const stmts = [
    "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT, points INTEGER DEFAULT 0, last_login TEXT DEFAULT '', cur_streak INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS inventory (email TEXT, item TEXT, PRIMARY KEY (email, item))",
    "CREATE TABLE IF NOT EXISTS equipped (email TEXT, slot TEXT, item TEXT, PRIMARY KEY (email, slot))",
    "CREATE TABLE IF NOT EXISTS missions (email TEXT, day TEXT, key TEXT, progress INTEGER DEFAULT 0, claimed INTEGER DEFAULT 0, PRIMARY KEY (email, day, key))",
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
}

async function getUser(env, email, name) {
  await ensureGameTables(env);
  let u = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if (!u) {
    await env.DB.prepare("INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)").bind(email, name).run();
    u = { email, name, points: 0, last_login: "", cur_streak: 0 };
  } else if (name && name !== u.name) {
    await env.DB.prepare("UPDATE users SET name=? WHERE email=?").bind(name, email).run();
    u.name = name;
  }
  return u;
}

async function getPower(env, email) {
  const rows = await env.DB.prepare("SELECT item FROM equipped WHERE email=?").bind(email).all();
  let p = 100;
  for (const r of rows.results) if (ITEMS[r.item]) p += ITEMS[r.item].power;
  return p;
}

async function bumpMission(env, email, key, val, additive) {
  const day = todayJST();
  const m = MISSIONS[key];
  let row = await env.DB.prepare(
    "SELECT progress, claimed FROM missions WHERE email=? AND day=? AND key=?"
  ).bind(email, day, key).first();
  if (!row) {
    await env.DB.prepare(
      "INSERT INTO missions (email, day, key, progress, claimed) VALUES (?, ?, ?, ?, 0)"
    ).bind(email, day, key, Math.min(val, m.goal)).run();
    row = { progress: Math.min(val, m.goal), claimed: 0 };
  } else if (!row.claimed && row.progress < m.goal) {
    const np = Math.min(m.goal, additive ? row.progress + val : val);
    await env.DB.prepare(
      "UPDATE missions SET progress=? WHERE email=? AND day=? AND key=?"
    ).bind(np, email, day, key).run();
    row.progress = np;
  }
  if (!row.claimed && row.progress >= m.goal) {
    await env.DB.prepare(
      "UPDATE missions SET claimed=1 WHERE email=? AND day=? AND key=?"
    ).bind(email, day, key).run();
    await env.DB.prepare("UPDATE users SET points=points+? WHERE email=?").bind(m.bonus, email).run();
    return { desc: m.desc, bonus: m.bonus };
  }
  return null;
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
