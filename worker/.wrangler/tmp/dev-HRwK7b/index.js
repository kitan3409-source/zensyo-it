var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var src_default = {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch {
      return json({ error: "\u30B5\u30FC\u30D0\u30FC\u304C\u6DF7\u307F\u5408\u3063\u3066\u3044\u307E\u3059\u3002\u5C11\u3057\u5F85\u3063\u3066\u304B\u3089\u3082\u3046\u4E00\u5EA6\u8A66\u3057\u3066\u304F\u3060\u3055\u3044" }, 503);
    }
  }
};
async function handle(request, env) {
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
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(b.credential || "")
    );
    if (!r.ok) return json({ error: "Google\u30ED\u30B0\u30A4\u30F3\u306B\u5931\u6557\u3057\u307E\u3057\u305F" }, 401);
    const t = await r.json();
    if (t.aud !== env.GOOGLE_CLIENT_ID) return json({ error: "client_id \u304C\u4E00\u81F4\u3057\u307E\u305B\u3093" }, 401);
    if (t.hd !== "gse.okayama-c.ed.jp") {
      return json({ error: "\u5B66\u6821\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\uFF08@gse.okayama-c.ed.jp\uFF09\u3067\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" }, 403);
    }
    const email = t.email;
    const name = t.name || "";
    const secret = await getSecret(env);
    const exp = Date.now() + 7 * 24 * 3600 * 1e3;
    const payload = `${email}|${name}|${exp}`;
    const sig = await hmacSha256(secret, payload);
    const token = b64e(payload) + "." + sig;
    return json({ token, display: `${email.split("@")[0]} ${name}` });
  }
  if (url.pathname === "/api/student_login" && request.method === "POST") {
    let b;
    try {
      b = await request.json();
    } catch {
      return json({ error: "bad request" }, 400);
    }
    const sid = `${b.cls || ""}-${b.num || ""}`.replace(/[|@\s]/g, "").slice(0, 24);
    const name = String(b.name || "").replace(/\|/g, "").trim().slice(0, 30);
    const pin = String(b.pin || "");
    if (!sid || sid === "-" || !name) return json({ error: "\u30AF\u30E9\u30B9\u30FB\u756A\u53F7\u30FB\u540D\u524D\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044" }, 400);
    if (pin.length < 4) return json({ error: "PIN\u306F4\u6587\u5B57\u4EE5\u4E0A\u306B\u3057\u3066\u304F\u3060\u3055\u3044" }, 400);
    try {
      await ensureGameTables(env);
      const stored = await env.DB.prepare("SELECT pin FROM pins WHERE email=?").bind(sid).first();
      const hash = await hashPw(pin);
      if (stored) {
        if (stored.pin !== hash) return json({ error: "PIN\u304C\u9055\u3044\u307E\u3059\uFF08\u5FD8\u308C\u305F\u3089\u5148\u751F\u306B\u30EA\u30BB\u30C3\u30C8\u3057\u3066\u3082\u3089\u3063\u3066\uFF09" }, 403);
      } else {
        await env.DB.prepare("INSERT INTO pins (email, pin) VALUES (?, ?)").bind(sid, hash).run();
      }
      const secret = await getSecret(env);
      const exp = Date.now() + 7 * 24 * 3600 * 1e3;
      const payload = `${sid}|${name}|${exp}`;
      const sig = await hmacSha256(secret, payload);
      return json({ token: b64e(payload) + "." + sig, display: `${sid} ${name}` });
    } catch {
      return json({ error: "\u30B5\u30FC\u30D0\u30FC\u304C\u6DF7\u307F\u5408\u3063\u3066\u3044\u307E\u3059\u3002\u5C11\u3057\u5F85\u3063\u3066\u304B\u3089\u3082\u3046\u4E00\u5EA6\u8A66\u3057\u3066\u304F\u3060\u3055\u3044" }, 503);
    }
  }
  if (url.pathname === "/api/pin_reset" && request.method === "POST") {
    let b;
    try {
      b = await request.json();
    } catch {
      return json({ error: "bad request" }, 400);
    }
    if (!await pwMatches(env, b.pw || "")) return json({ error: "forbidden" }, 403);
    const sid = String(b.sid || "").slice(0, 24);
    if (!sid) return json({ error: "bad sid" }, 400);
    await ensureGameTables(env);
    await env.DB.prepare("DELETE FROM pins WHERE email=?").bind(sid).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/me") {
    const sess = await verifySession(env, url.searchParams.get("token") || "");
    if (!sess) return json({ error: "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" }, 401);
    const u = await getUser(env, sess.email, sess.name);
    const today = todayJST();
    let bonus = 0;
    if (u.last_login !== today) {
      const y = new Date(Date.now() + 9 * 36e5 - 864e5).toISOString().slice(0, 10);
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
    const correct = await getCorrect(env, sess.email);
    const level = levelOf(correct);
    const power = await getPower(env, sess.email);
    return json({
      display: `${sess.email.split("@")[0]} ${sess.name}`,
      points: u.points,
      power,
      base_power: basePower(level),
      total,
      correct_total: correct,
      level,
      next_level_at: level * 20,
      rank: rankOf(total),
      next_at: nextRankAt(total),
      streak: u.login_streak || 0,
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
          claimed: r ? r.claimed : 0
        };
      }),
      achievements: ACH,
      unlocked: ach.results.map((r) => r.key),
      regions: await getRegions(env, sess.email),
      boss: await getBoss(env, sess.email),
      login_bonus: bonus,
      items: ALL_ITEMS,
      gacha: GACHA_ITEMS
    });
  }
  if (url.pathname === "/api/buy" && request.method === "POST") {
    return json({ error: "\u30A2\u30A4\u30C6\u30E0\u306F\u30AC\u30C1\u30E3\u3067\u306E\u307F\u5165\u624B\u3067\u304D\u307E\u3059" }, 400);
  }
  if (url.pathname === "/api/gacha" && request.method === "POST") {
    const b = await body(request);
    if (!b) return json({ error: "bad request" }, 400);
    const sess = await verifySession(env, b.token);
    if (!sess) return json({ error: "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" }, 401);
    const u = await getUser(env, sess.email, sess.name);
    const COST = 100;
    if ((u.points || 0) < COST) return json({ error: `\u30DD\u30A4\u30F3\u30C8\u304C\u8DB3\u308A\u307E\u305B\u3093\uFF08${COST}pt\u5FC5\u8981\uFF09` }, 400);
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
    const g = await grantAch(env, sess.email, "gacha10", (u.gacha_count || 0) + 1 >= 10);
    if (g) newAch.push(g);
    const c = await grantAch(env, sess.email, "ssr", rarity === "SSR");
    if (c) newAch.push(c);
    const invCnt = await countInv(env, sess.email);
    const sh = await grantAch(env, sess.email, "shop5", invCnt >= 5);
    if (sh) newAch.push(sh);
    const c30 = await grantAch(env, sess.email, "coll30", invCnt >= 30);
    if (c30) newAch.push(c30);
    const c50 = await grantAch(env, sess.email, "coll50", invCnt >= 50);
    if (c50) newAch.push(c50);
    return json({
      ok: true,
      item,
      dup: !!owned,
      refund,
      points: (u.points || 0) - COST + refund + newAch.reduce((s, a) => s + a.bonus, 0),
      ach_new: newAch
    });
  }
  if (url.pathname === "/api/equip" && request.method === "POST") {
    const b = await body(request);
    if (!b) return json({ error: "bad request" }, 400);
    const sess = await verifySession(env, b.token);
    if (!sess) return json({ error: "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" }, 401);
    if (!SLOTS.includes(b.slot)) return json({ error: "bad slot" }, 400);
    await ensureGameTables(env);
    const allItems = ALL_ITEMS;
    if (b.item) {
      if (!allItems[b.item] || allItems[b.item].slot !== b.slot) return json({ error: "bad item" }, 400);
      const owned = await env.DB.prepare(
        "SELECT 1 AS x FROM inventory WHERE email=? AND item=?"
      ).bind(sess.email, b.item).first();
      if (!owned) return json({ error: "\u6301\u3063\u3066\u3044\u307E\u305B\u3093" }, 400);
      await env.DB.prepare(
        "INSERT INTO equipped (email, slot, item) VALUES (?, ?, ?) ON CONFLICT(email, slot) DO UPDATE SET item=excluded.item"
      ).bind(sess.email, b.slot, b.item).run();
    } else {
      await env.DB.prepare("DELETE FROM equipped WHERE email=? AND slot=?").bind(sess.email, b.slot).run();
    }
    const ec = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM equipped WHERE email=?"
    ).bind(sess.email).first();
    await grantAch(env, sess.email, "fulleq", (ec && ec.c) >= SLOTS.length);
    return json({ ok: true, power: await getPower(env, sess.email) });
  }
  if (url.pathname === "/api/ranking") {
    const sess = await verifySession(env, url.searchParams.get("token") || "");
    if (!sess) return json({ error: "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" }, 401);
    await ensureGameTables(env);
    const users = await env.DB.prepare("SELECT email, name, points, login_streak FROM users").all();
    const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
    const all = ALL_ITEMS;
    const totals = await env.DB.prepare(
      "SELECT student, COUNT(*) AS c, SUM(correct) AS cor FROM answers GROUP BY student"
    ).all();
    const corMap = {};
    for (const r of totals.results) corMap[String(r.student).split(" ")[0]] = r.cor || 0;
    const powerMap = {};
    for (const u of users.results)
      powerMap[u.email] = basePower(levelOf(corMap[u.email.split("@")[0]] || 0));
    for (const r of eqs.results) {
      if (all[r.item] && powerMap[r.email] !== void 0) powerMap[r.email] += all[r.item].power;
    }
    const week = await env.DB.prepare(
      "SELECT student, COUNT(*) AS c, SUM(correct) AS s FROM answers WHERE ts >= ? GROUP BY student"
    ).bind(Date.now() / 1e3 - 7 * 86400).all();
    const totMap = {}, nameMap = {}, weekMap = {};
    for (const r of totals.results) {
      const id = String(r.student).split(" ")[0];
      totMap[id] = r.c;
      nameMap[id] = String(r.student).split(" ").slice(1).join(" ");
    }
    for (const r of week.results) {
      weekMap[String(r.student).split(" ")[0]] = (r.s || 0) * 8 + r.c * 2;
    }
    const entry = /* @__PURE__ */ __name((u) => ({
      id: u.email.split("@")[0],
      name: u.name || nameMap[u.email.split("@")[0]] || "",
      power: powerMap[u.email],
      points: u.points,
      streak: u.login_streak || 0,
      total: totMap[u.email.split("@")[0]] || 0,
      weekly: weekMap[u.email.split("@")[0]] || 0,
      rank: rankOf(totMap[u.email.split("@")[0]] || 0)
    }), "entry");
    const list = users.results.map(entry);
    return json({
      power: [...list].sort((a, b) => b.power - a.power || b.points - a.points).slice(0, 30),
      weekly: [...list].sort((a, b) => b.weekly - a.weekly).slice(0, 30),
      rank: [...list].sort((a, b) => b.total - a.total).slice(0, 30),
      streak: [...list].sort((a, b) => b.streak - a.streak).slice(0, 30),
      me: sess.email.split("@")[0]
    });
  }
  if (url.pathname === "/api/answer" && request.method === "POST") {
    const b = await body(request);
    if (!b) return json({ error: "bad request" }, 400);
    const sess = await verifySession(env, b.token);
    if (!sess) return json({ error: "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" }, 401);
    const student = `${sess.email.split("@")[0]} ${sess.name}`.slice(0, 50);
    if (!env.DB) return json({ error: "DB binding \u304C\u3042\u308A\u307E\u305B\u3093\uFF08Variable name DB \u3067 D1 \u3092\u5272\u308A\u5F53\u3066\u3066\u304F\u3060\u3055\u3044\uFF09" }, 500);
    try {
      await env.DB.prepare(
        "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        student,
        String(b.term || "").slice(0, 200),
        String(b.direction || "").slice(0, 10),
        b.correct ? 1 : 0,
        Date.now() / 1e3
      ).run();
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
    const u = await getUser(env, sess.email, sess.name);
    const streak = b.correct ? (u.cur_streak || 0) + 1 : 0;
    const power = await getPower(env, sess.email);
    const combo = b.correct && streak >= 3 ? Math.min(streak * 2, 20) : 0;
    const earned = (b.correct ? 10 : 2) + combo;
    await env.DB.prepare(
      "UPDATE users SET points=points+?, lifetime=lifetime+?, cur_streak=?, best_streak=MAX(COALESCE(best_streak,0),?) WHERE email=?"
    ).bind(earned, earned, streak, streak, sess.email).run();
    const doneM = [];
    const m1 = await bumpMission(env, sess.email, "ans10", 1, true);
    if (m1) doneM.push(m1);
    if (b.correct) {
      const m2 = await bumpMission(env, sess.email, "cor15", 1, true);
      if (m2) doneM.push(m2);
      const m3 = await bumpMission(env, sess.email, "str8", streak, false);
      if (m3) doneM.push(m3);
    }
    let bossRes = null;
    if (b.correct) bossRes = await damageBoss(env, sess.email, 1 + Math.floor(power / 80));
    const total = await getTotal(env, sess.email);
    const correctTotal = await getCorrect(env, sess.email);
    const level = levelOf(correctTotal);
    const levelUp = level > levelOf(correctTotal - (b.correct ? 1 : 0)) ? level : null;
    const hour = new Date(Date.now() + 9 * 36e5).getUTCHours();
    const newAch = [];
    const tryA = /* @__PURE__ */ __name(async (k, c) => {
      const a = await grantAch(env, sess.email, k, c);
      if (a) newAch.push(a);
    }, "tryA");
    await tryA("first", total >= 1);
    await tryA("ans50", total >= 50);
    await tryA("ans100", total >= 100);
    await tryA("ans300", total >= 300);
    await tryA("ans500", total >= 500);
    await tryA("streak10", streak >= 10);
    await tryA("streak20", streak >= 20);
    await tryA("streak30", streak >= 30);
    await tryA("early", hour < 7);
    await tryA("night", hour >= 23);
    await tryA("rich", (u.lifetime || 0) + earned >= 1e3);
    await tryA("lv5", level >= 5);
    await tryA("lv10", level >= 10);
    if (bossRes && bossRes.killed) await tryA("boss", true);
    const regionHits = await checkRegions(env, sess.email);
    for (const r of regionHits) newAch.push(r);
    const points = (u.points || 0) + earned + doneM.reduce((s, x) => s + x.bonus, 0) + newAch.reduce((s, x) => s + x.bonus, 0) + (bossRes && bossRes.killed ? 200 : 0);
    return json({
      ok: true,
      earned,
      combo,
      points,
      missions_done: doneM,
      ach_new: newAch,
      total,
      rank: rankOf(total),
      rank_up: rankOf(total) !== rankOf(total - 1) ? rankOf(total) : null,
      level,
      correct_total: correctTotal,
      level_up: levelUp,
      boss: bossRes
    });
  }
  if (url.pathname === "/api/reset" && request.method === "POST") {
    let b;
    try {
      b = await request.json();
    } catch {
      return json({ error: "bad request" }, 400);
    }
    if (!await pwMatches(env, b.pw || "")) return json({ error: "forbidden" }, 403);
    await ensureGameTables(env);
    for (const t of ["answers", "users", "inventory", "equipped", "missions", "achievements", "pins", "boss", "boss_damage"]) {
      try {
        await env.DB.prepare(`DELETE FROM ${t}`).run();
      } catch {
      }
    }
    return json({ ok: true });
  }
  if (url.pathname === "/api/password" && request.method === "POST") {
    const b = await body(request);
    if (!b) return json({ error: "bad request" }, 400);
    if (!await pwMatches(env, b.pw || "")) return json({ error: "forbidden" }, 403);
    if (!env.DB) return json({ error: "DB binding \u304C\u3042\u308A\u307E\u305B\u3093" }, 500);
    const np = String(b.new_pw || "").trim();
    if (np.length < 4) return json({ error: "4\u6587\u5B57\u4EE5\u4E0A\u306B\u3057\u3066\u304F\u3060\u3055\u3044" }, 400);
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    ).run();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('pw', ?)"
    ).bind(await hashPw(np)).run();
    PW_CACHE = { value: null, ts: 0 };
    return json({ ok: true });
  }
  if (url.pathname === "/api/stats") {
    if (!await pwMatches(env, url.searchParams.get("pw") || "")) {
      return json({ error: "forbidden" }, 403);
    }
    if (!env.DB) return json({ error: "DB binding \u304C\u3042\u308A\u307E\u305B\u3093\uFF08Variable name DB \u3067 D1 \u3092\u5272\u308A\u5F53\u3066\u3066\u304F\u3060\u3055\u3044\uFF09" }, 500);
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
    const rate = /* @__PURE__ */ __name((r) => r.answered ? Math.round(r.correct / r.answered * 1e3) / 10 : 0, "rate");
    let ptMap = {}, pwMap = {}, streakMap = {}, corMap = {};
    for (const r of students.results) corMap[String(r.student).split(" ")[0]] = r.correct || 0;
    try {
      const us = await env.DB.prepare("SELECT email, points, login_streak FROM users").all();
      const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
      const all = ALL_ITEMS;
      for (const u of us.results) {
        const k = u.email.split("@")[0];
        ptMap[k] = u.points;
        pwMap[k] = basePower(levelOf(corMap[k] || 0));
        streakMap[k] = u.login_streak || 0;
      }
      for (const r of eqs.results) {
        const k = r.email.split("@")[0];
        if (all[r.item] && pwMap[k] !== void 0) pwMap[k] += all[r.item].power;
      }
    } catch {
    }
    let boss = null;
    try {
      boss = await getBoss(env, "");
    } catch {
    }
    return json({
      students: students.results.map((r) => ({
        student: r.student,
        answered: r.answered,
        correct: r.correct,
        rate: rate(r),
        points: ptMap[String(r.student).split(" ")[0]] || 0,
        power: pwMap[String(r.student).split(" ")[0]] || 100,
        level: levelOf(r.correct || 0),
        rank: rankOf(r.answered),
        streak: streakMap[String(r.student).split(" ")[0]] || 0,
        last_ts: r.last_ts
      })),
      terms: terms.results.map((r) => ({
        term: r.term,
        answered: r.answered,
        correct: r.correct,
        rate: rate(r)
      })),
      boss
    });
  }
  const map = { "/": "/index.html", "/teacher": "/teacher.html", "/terms": "/terms.json" };
  const assetPath = map[url.pathname] || url.pathname;
  return env.ASSETS.fetch(new Request(new URL(assetPath, url.origin), request));
}
__name(handle, "handle");
async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(body, "body");
var SLOTS = ["head", "body", "lhand", "rhand", "pants", "feet"];
var GACHA_ITEMS = [
  { id: "w0", name: "\u30DC\u30FC\u30EB\u30DA\u30F3\u30E9\u30F3\u30B9", slot: "rhand", power: 5, rarity: "N" },
  { id: "w1", name: "\u30A8\u30F3\u30D4\u30C4\u30BD\u30FC\u30C9", slot: "rhand", power: 10, rarity: "N" },
  { id: "w2", name: "\u8A08\u7B97\u6A5F\u30D6\u30EC\u30FC\u30C9", slot: "rhand", power: 30, rarity: "R" },
  { id: "w3", name: "\u30EB\u30FC\u30BF\u30FC\u30CF\u30F3\u30DE\u30FC", slot: "rhand", power: 50, rarity: "SR" },
  { id: "w4", name: "\u30B5\u30FC\u30D0\u30FC\u30D6\u30EC\u30FC\u30C9", slot: "rhand", power: 80, rarity: "SR" },
  { id: "w5", name: "\u30D5\u30EC\u30FC\u30E0\u30EF\u30FC\u30AF\u30B9", slot: "rhand", power: 120, rarity: "SR" },
  { id: "w6", name: "\u6697\u53F7\u30AD\u30FC\u30A2\u30C3\u30AF\u30B9", slot: "rhand", power: 150, rarity: "SSR" },
  { id: "w7", name: "\u30BC\u30ED\u30C7\u30A4\u30A8\u30C3\u30B8", slot: "rhand", power: 200, rarity: "SSR" },
  { id: "w8", name: "\u91CF\u5B50\u30D6\u30EC\u30A4\u30C9", slot: "rhand", power: 250, rarity: "SSR" },
  { id: "w9", name: "\u4F1D\u8AAC\u306E\u30D5\u30ED\u30C3\u30D4\u30FC", slot: "rhand", power: 400, rarity: "SSR" },
  { id: "a0", name: "\u30B8\u30E3\u30FC\u30B8", slot: "body", power: 5, rarity: "N" },
  { id: "a1", name: "\u5B66\u751F\u670D", slot: "body", power: 10, rarity: "N" },
  { id: "a2", name: "\u30CD\u30AF\u30BF\u30A4\u30A2\u30FC\u30DE\u30FC", slot: "body", power: 15, rarity: "N" },
  { id: "a3", name: "\u30D3\u30B8\u30CD\u30B9\u30B9\u30FC\u30C4", slot: "body", power: 30, rarity: "R" },
  { id: "a4", name: "\u30D5\u30A1\u30A4\u30A2\u30A6\u30A9\u30FC\u30EB\u30E1\u30A4\u30EB", slot: "body", power: 50, rarity: "SR" },
  { id: "a5", name: "\u30C7\u30D0\u30C3\u30B0\u30A2\u30FC\u30DE\u30FC", slot: "body", power: 80, rarity: "SR" },
  { id: "a6", name: "\u30AF\u30E9\u30A6\u30C9\u30ED\u30FC\u30D6", slot: "body", power: 120, rarity: "SR" },
  { id: "a7", name: "AI\u30A2\u30FC\u30DE\u30FC", slot: "body", power: 150, rarity: "SSR" },
  { id: "a8", name: "\u30A8\u30F3\u30BF\u30FC\u30D7\u30E9\u30A4\u30BA\u93A7", slot: "body", power: 200, rarity: "SSR" },
  { id: "a9", name: "\u795E\u30BC\u30ED\u30A2\u30FC\u30DE\u30FC", slot: "body", power: 400, rarity: "SSR" },
  { id: "x0", name: "\u540D\u672D\u30D0\u30C3\u30B8", slot: "lhand", power: 5, rarity: "N" },
  { id: "x1", name: "\u925B\u7B46\u524A\u308A\u306E\u304A\u5B88\u308A", slot: "lhand", power: 10, rarity: "N" },
  { id: "x2", name: "USB\u30E1\u30E2\u30EA", slot: "lhand", power: 15, rarity: "N" },
  { id: "x3", name: "\u30AB\u30FC\u30C9\u30EA\u30FC\u30C0\u30FC", slot: "lhand", power: 25, rarity: "R" },
  { id: "x4", name: "\u96FB\u5353\u306E\u304A\u5B88\u308A", slot: "lhand", power: 40, rarity: "R" },
  { id: "x5", name: "\u5916\u4ED8\u3051SSD", slot: "lhand", power: 60, rarity: "SR" },
  { id: "x6", name: "\u30E1\u30AC\u30CD", slot: "head", power: 80, rarity: "SR" },
  { id: "x7", name: "\u5149\u30D5\u30A1\u30A4\u30D0\u30FC", slot: "lhand", power: 100, rarity: "SR" },
  { id: "x8", name: "\u96FB\u5B50\u8F9E\u66F8", slot: "lhand", power: 150, rarity: "SSR" },
  { id: "x9", name: "QR\u30B3\u30FC\u30C9\u304A\u5B88\u308A", slot: "lhand", power: 220, rarity: "SSR" },
  { id: "g1", name: "\u30DA\u30FC\u30D1\u30FC\u30CA\u30A4\u30D5", slot: "rhand", power: 5, rarity: "N" },
  { id: "g2", name: "\u6D88\u3057\u30B4\u30E0\u30C0\u30AC\u30FC", slot: "rhand", power: 8, rarity: "N" },
  { id: "gw3", name: "\u30DB\u30C1\u30AD\u30B9\u30AC\u30F3", slot: "rhand", power: 4, rarity: "N" },
  { id: "gw4", name: "\u5B9A\u898F\u30BD\u30FC\u30C9", slot: "rhand", power: 6, rarity: "N" },
  { id: "g3", name: "\u9244\u306E\u30AD\u30FC\u30DC\u30FC\u30C9", slot: "rhand", power: 18, rarity: "R" },
  { id: "g4", name: "\u5149\u308B\u30DE\u30A6\u30B9", slot: "rhand", power: 25, rarity: "R" },
  { id: "gw5", name: "\u30D0\u30FC\u30B3\u30FC\u30C9\u30D6\u30EC\u30FC\u30C9", slot: "rhand", power: 16, rarity: "R" },
  { id: "gw6", name: "\u30D7\u30EA\u30F3\u30BF\u30FC\u30A2\u30C3\u30AF\u30B9", slot: "rhand", power: 28, rarity: "R" },
  { id: "g5", name: "\u30D5\u30A1\u30A4\u30A2\u30A6\u30A9\u30FC\u30EB\u30D6\u30EC\u30FC\u30C9", slot: "rhand", power: 60, rarity: "SR" },
  { id: "gw7", name: "\u30D0\u30A4\u30CA\u30EA\u30CF\u30F3\u30DE\u30FC", slot: "rhand", power: 50, rarity: "SR" },
  { id: "g6", name: "\u4F1D\u8AAC\u306E\u30B5\u30FC\u30D0\u30FC", slot: "rhand", power: 150, rarity: "SSR" },
  { id: "gw8", name: "\u8056\u5263\u30A8\u30AF\u30BB\u30EB", slot: "rhand", power: 170, rarity: "SSR" },
  { id: "g7", name: "\u30D1\u30FC\u30AB\u30FC", slot: "body", power: 5, rarity: "N" },
  { id: "g8", name: "\u767D\u8863", slot: "body", power: 8, rarity: "N" },
  { id: "ga3", name: "\u4F53\u64CD\u670D", slot: "body", power: 4, rarity: "N" },
  { id: "ga4", name: "\u30EC\u30A4\u30F3\u30B3\u30FC\u30C8", slot: "body", power: 6, rarity: "N" },
  { id: "g9", name: "\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\u30D9\u30B9\u30C8", slot: "body", power: 20, rarity: "R" },
  { id: "ga5", name: "\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\u30B8\u30E3\u30B1\u30C3\u30C8", slot: "body", power: 32, rarity: "R" },
  { id: "ga6", name: "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30D9\u30B9\u30C8", slot: "body", power: 16, rarity: "R" },
  { id: "g10", name: "\u30AF\u30E9\u30A6\u30C9\u30A2\u30FC\u30DE\u30FC", slot: "body", power: 60, rarity: "SR" },
  { id: "ga7", name: "\u88DC\u52A9\u8A18\u61B6\u30A2\u30FC\u30DE\u30FC", slot: "body", power: 50, rarity: "SR" },
  { id: "g11", name: "\u91CF\u5B50\u30B9\u30FC\u30C4", slot: "body", power: 150, rarity: "SSR" },
  { id: "ga8", name: "\u6642\u7A7A\u30D7\u30ED\u30C6\u30AF\u30BF\u30FC", slot: "body", power: 170, rarity: "SSR" },
  { id: "g12", name: "\u925B\u7B46\u30AD\u30E3\u30C3\u30D7", slot: "head", power: 5, rarity: "N" },
  { id: "gx3", name: "\u4ED8\u7B8B\u304A\u5B88\u308A", slot: "lhand", power: 4, rarity: "N" },
  { id: "gx4", name: "\u6D88\u3057\u30B4\u30E0\u304A\u5B88\u308A", slot: "lhand", power: 7, rarity: "N" },
  { id: "g13", name: "\u30AF\u30EA\u30C3\u30D7", slot: "lhand", power: 12, rarity: "R" },
  { id: "gx5", name: "\u96FB\u6C60\u30D1\u30C3\u30AF", slot: "lhand", power: 14, rarity: "R" },
  { id: "gx6", name: "LAN\u30B1\u30FC\u30D6\u30EB", slot: "lhand", power: 30, rarity: "R" },
  { id: "g14", name: "SSD", slot: "lhand", power: 35, rarity: "SR" },
  { id: "g15", name: "GPU\u304A\u5B88\u308A", slot: "lhand", power: 55, rarity: "SR" },
  { id: "g16", name: "\u91CF\u5B50\u30C1\u30C3\u30D7", slot: "lhand", power: 120, rarity: "SSR" },
  { id: "gx7", name: "\u30B7\u30F3\u30AE\u30E5\u30E9\u30EA\u30C6\u30A3\u30C1\u30C3\u30D7", slot: "lhand", power: 180, rarity: "SSR" },
  { id: "h1", name: "\u5B66\u751F\u5E3D", slot: "head", power: 8, rarity: "N" },
  { id: "h2", name: "\u30D8\u30C3\u30C9\u30DB\u30F3", slot: "head", power: 12, rarity: "N" },
  { id: "h3", name: "\u30CE\u30FC\u30C8\u9B54\u6CD5\u5E3D", slot: "head", power: 15, rarity: "R" },
  { id: "h4", name: "\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\u30D8\u30EB\u30E1\u30C3\u30C8", slot: "head", power: 20, rarity: "R" },
  { id: "h5", name: "\u30AF\u30E9\u30A6\u30C9\u30AF\u30E9\u30A6\u30F3", slot: "head", power: 30, rarity: "R" },
  { id: "h6", name: "AI\u30D0\u30A4\u30B6\u30FC", slot: "head", power: 55, rarity: "SR" },
  { id: "h7", name: "\u91CF\u5B50\u30CF\u30A4\u30ED", slot: "head", power: 80, rarity: "SR" },
  { id: "h8", name: "\u4F1D\u8AAC\u306E\u738B\u51A0", slot: "head", power: 160, rarity: "SSR" },
  { id: "p0", name: "\u30B8\u30E3\u30FC\u30B8\u30BA\u30DC\u30F3", slot: "pants", power: 5, rarity: "N" },
  { id: "p1", name: "\u5B66\u751F\u30BA\u30DC\u30F3", slot: "pants", power: 8, rarity: "N" },
  { id: "p2", name: "\u30B9\u30E9\u30C3\u30AF\u30B9", slot: "pants", power: 12, rarity: "R" },
  { id: "p3", name: "\u30B8\u30FC\u30F3\u30BA", slot: "pants", power: 18, rarity: "R" },
  { id: "p4", name: "\u30EF\u30FC\u30AF\u30D1\u30F3\u30C4", slot: "pants", power: 25, rarity: "R" },
  { id: "p5", name: "\u30D5\u30A1\u30A4\u30A2\u30D1\u30F3\u30C4", slot: "pants", power: 45, rarity: "SR" },
  { id: "p6", name: "\u30AF\u30E9\u30A6\u30C9\u30D1\u30F3\u30C4", slot: "pants", power: 55, rarity: "SR" },
  { id: "p7", name: "AI\u30EC\u30C3\u30B0", slot: "pants", power: 70, rarity: "SR" },
  { id: "p8", name: "\u30A8\u30F3\u30BF\u30FC\u30D7\u30E9\u30A4\u30BA\u811A\u7532", slot: "pants", power: 120, rarity: "SSR" },
  { id: "p9", name: "\u795E\u30BC\u30ED\u30EC\u30AE\u30F3\u30B9", slot: "pants", power: 180, rarity: "SSR" },
  { id: "f0", name: "\u4E0A\u5C65\u304D", slot: "feet", power: 4, rarity: "N" },
  { id: "f1", name: "\u30B9\u30CB\u30FC\u30AB\u30FC", slot: "feet", power: 8, rarity: "N" },
  { id: "f2", name: "\u9769\u9774", slot: "feet", power: 12, rarity: "R" },
  { id: "f3", name: "\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\u30D6\u30FC\u30C4", slot: "feet", power: 20, rarity: "R" },
  { id: "f4", name: "\u5149\u901F\u30B9\u30CB\u30FC\u30AB\u30FC", slot: "feet", power: 30, rarity: "R" },
  { id: "f5", name: "\u30D5\u30A1\u30A4\u30A2\u30D6\u30FC\u30C4", slot: "feet", power: 45, rarity: "SR" },
  { id: "f6", name: "\u30AF\u30E9\u30A6\u30C9\u30D6\u30FC\u30C4", slot: "feet", power: 55, rarity: "SR" },
  { id: "f7", name: "\u30DB\u30D0\u30FC\u30B7\u30E5\u30FC\u30BA", slot: "feet", power: 70, rarity: "SR" },
  { id: "f8", name: "\u91CF\u5B50\u30D6\u30FC\u30C4", slot: "feet", power: 110, rarity: "SSR" },
  { id: "f9", name: "\u4F1D\u8AAC\u306E\u7FBD\u6839\u9774", slot: "feet", power: 160, rarity: "SSR" },
  { id: "s0", name: "\u4E0B\u6577\u304D\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 5, rarity: "N" },
  { id: "s1", name: "\u6D88\u3057\u30B4\u30E0\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 6, rarity: "N" },
  { id: "s2", name: "\u5B9A\u898F\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 8, rarity: "N" },
  { id: "s3", name: "\u30AD\u30FC\u30DC\u30FC\u30C9\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 15, rarity: "R" },
  { id: "s4", name: "\u6559\u79D1\u66F8\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 18, rarity: "R" },
  { id: "s5", name: "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 25, rarity: "R" },
  { id: "s6", name: "\u30D5\u30A1\u30A4\u30A2\u30A6\u30A9\u30FC\u30EB\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 50, rarity: "SR" },
  { id: "s7", name: "\u30B5\u30FC\u30D0\u30FC\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 60, rarity: "SR" },
  { id: "s8", name: "\u91CF\u5B50\u30B7\u30FC\u30EB\u30C9", slot: "lhand", power: 90, rarity: "SR" },
  { id: "s9", name: "\u8056\u76FE\u30A8\u30AF\u30BB\u30EB", slot: "lhand", power: 170, rarity: "SSR" }
];
var ALL_ITEMS = {};
for (const i of GACHA_ITEMS) ALL_ITEMS[i.id] = i;
function levelOf(correct) {
  return 1 + Math.floor(correct / 20);
}
__name(levelOf, "levelOf");
function basePower(lv) {
  return 100 + 10 * (lv - 1);
}
__name(basePower, "basePower");
var MISSIONS = {
  ans10: { desc: "10\u554F\u56DE\u7B54\u3059\u308B", goal: 10, bonus: 60 },
  cor15: { desc: "15\u554F\u6B63\u89E3\u3059\u308B", goal: 15, bonus: 100 },
  str8: { desc: "8\u554F\u9023\u7D9A\u6B63\u89E3\u3059\u308B", goal: 8, bonus: 80 }
};
var ACH = {
  first: { name: "\u306F\u3058\u3081\u306E\u4E00\u6B69", desc: "\u521D\u3081\u3066\u56DE\u7B54\u3057\u305F", bonus: 20 },
  ans50: { name: "\u4E94\u5341\u554F\u306E\u58C1", desc: "\u7D2F\u8A0850\u554F\u56DE\u7B54", bonus: 30 },
  ans100: { name: "\u767E\u554F\u306E\u5148\u8F29", desc: "\u7D2F\u8A08100\u554F\u56DE\u7B54", bonus: 50 },
  ans300: { name: "\u4E09\u767E\u554F\u306E\u731B\u8005", desc: "\u7D2F\u8A08300\u554F\u56DE\u7B54", bonus: 100 },
  ans500: { name: "\u4E94\u767E\u554F\u306E\u4ED9\u4EBA", desc: "\u7D2F\u8A08500\u554F\u56DE\u7B54", bonus: 150 },
  streak10: { name: "\u5341\u9023\u6483", desc: "10\u554F\u9023\u7D9A\u6B63\u89E3", bonus: 50 },
  streak20: { name: "\u4E8C\u5341\u9023\u6483", desc: "20\u554F\u9023\u7D9A\u6B63\u89E3", bonus: 100 },
  streak30: { name: "\u7121\u53CC", desc: "30\u554F\u9023\u7D9A\u6B63\u89E3", bonus: 200 },
  early: { name: "\u671D\u6D3B", desc: "\u671D7\u6642\u524D\u306B\u56DE\u7B54", bonus: 30 },
  night: { name: "\u591C\u578B\u4EBA\u9593", desc: "23\u6642\u4EE5\u964D\u306B\u56DE\u7B54", bonus: 30 },
  rich: { name: "\u30DD\u30A4\u30F3\u30C8\u9577\u8005", desc: "\u7D2F\u8A081000pt\u7372\u5F97", bonus: 80 },
  gacha10: { name: "\u30AC\u30C1\u30E3\u4E2D\u6BD2", desc: "\u30AC\u30C1\u30E3\u309210\u56DE\u307E\u308F\u3059", bonus: 50 },
  ssr: { name: "\u795E\u5F15\u304D", desc: "SSR\u3092\u5F15\u304D\u5F53\u3066\u308B", bonus: 100 },
  boss: { name: "\u8A0E\u4F10\u968A", desc: "\u30DC\u30B9\u8A0E\u4F10\u306B\u8CA2\u732E", bonus: 80 },
  region1: { name: "\u5236\u8987\u306E\u306F\u3058\u307E\u308A", desc: "\u5206\u91CE\u30921\u3064\u5236\u8987", bonus: 100 },
  login3: { name: "\u4E09\u65E5\u574A\u4E3B\u8131\u5374", desc: "3\u65E5\u9023\u7D9A\u30ED\u30B0\u30A4\u30F3", bonus: 30 },
  login7: { name: "\u7FD2\u6163\u306E\u5929\u624D", desc: "7\u65E5\u9023\u7D9A\u30ED\u30B0\u30A4\u30F3", bonus: 70 },
  shop5: { name: "\u30B3\u30EC\u30AF\u30BF\u30FC", desc: "\u30A2\u30A4\u30C6\u30E0\u30925\u7A2E\u6240\u6301", bonus: 50 },
  coll30: { name: "\u30B3\u30EC\u30AF\u30BF\u30FC\u6539", desc: "\u30A2\u30A4\u30C6\u30E0\u309230\u7A2E\u6240\u6301", bonus: 150 },
  coll50: { name: "\u30A2\u30A4\u30C6\u30E0\u535A\u7269\u9928", desc: "\u30A2\u30A4\u30C6\u30E0\u309250\u7A2E\u6240\u6301", bonus: 300 },
  fulleq: { name: "\u30D5\u30EB\u88C5\u5099", desc: "6\u30B9\u30ED\u30C3\u30C8\u3059\u3079\u3066\u306B\u88C5\u5099", bonus: 100 },
  lv5: { name: "\u30EC\u30D9\u30EB5", desc: "\u30EC\u30D9\u30EB5\u306B\u5230\u9054", bonus: 150 },
  lv10: { name: "\u30EC\u30D9\u30EB10", desc: "\u30EC\u30D9\u30EB10\u306B\u5230\u9054", bonus: 400 }
};
var RANKS = [
  { min: 800, label: "SS", title: "\u60C5\u5831\u306E\u795E" },
  { min: 400, label: "S", title: "\u96FB\u8133\u8CE2\u8005" },
  { min: 200, label: "A", title: "\u691C\u5B9A\u306E\u8987\u8005" },
  { min: 100, label: "B", title: "\u7528\u8A9E\u30DE\u30B9\u30BF\u30FC" },
  { min: 50, label: "C", title: "\u554F\u984C\u30CF\u30F3\u30BF\u30FC" },
  { min: 20, label: "D", title: "\u52C9\u5F37\u5BB6\u898B\u7FD2\u3044" },
  { min: 0, label: "E", title: "\u305F\u3060\u306E\u751F\u5F92" }
];
var BOSS_NAMES = [
  "\u30A8\u30E9\u30FC\u30C7\u30FC\u30E2\u30F3",
  "\u9752\u753B\u9762\u306E\u9B54\u738B\u30D6\u30EB\u30FC\u30B9\u30AF\u30EA\u30FC\u30F3",
  "\u6F22\u5B57\u5909\u63DB\u30D0\u30B0\u30EF\u30FC\u30E0",
  "\u30E1\u30E2\u30EA\u30EA\u30FC\u30AF\u306E\u5DE8\u7363",
  "404\u756A\u76EE\u306E\u4EA1\u970A",
  "\u6697\u9ED2SQL\u30A4\u30F3\u30B8\u30A7\u30AF\u30BF",
  "\u30D5\u30EA\u30FC\u30BA\u306E\u9B3C\u795E",
  "\u6587\u5B57\u5316\u3051\u30E2\u30F3\u30B9\u30BF\u30FC"
];
var BOSS_HP = 2e3;
function rankOf(total) {
  for (const r of RANKS) if (total >= r.min) return r.label;
  return "E";
}
__name(rankOf, "rankOf");
function nextRankAt(total) {
  const next = [...RANKS].reverse().find((r) => r.min > total);
  return next ? next.min : null;
}
__name(nextRankAt, "nextRankAt");
function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1e3).toISOString().slice(0, 10);
}
__name(todayJST, "todayJST");
function weekKey() {
  const d = new Date(Date.now() + 9 * 36e5);
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return d.getUTCFullYear() + "-W" + Math.ceil(((d - jan1) / 864e5 + 1) / 7);
}
__name(weekKey, "weekKey");
function hashCode(s) {
  let h = 0;
  for (const c of s) h = h * 31 + c.charCodeAt(0) | 0;
  return h;
}
__name(hashCode, "hashCode");
async function getTotal(env, email) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM answers WHERE student LIKE ?"
  ).bind(email.split("@")[0] + " %").first();
  return r && r.c || 0;
}
__name(getTotal, "getTotal");
var TABLES_READY = false;
async function ensureGameTables(env) {
  if (TABLES_READY) return;
  const stmts = [
    "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT, points INTEGER DEFAULT 0, last_login TEXT DEFAULT '', cur_streak INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS inventory (email TEXT, item TEXT, PRIMARY KEY (email, item))",
    "CREATE TABLE IF NOT EXISTS equipped (email TEXT, slot TEXT, item TEXT, PRIMARY KEY (email, slot))",
    "CREATE TABLE IF NOT EXISTS missions (email TEXT, day TEXT, key TEXT, progress INTEGER DEFAULT 0, claimed INTEGER DEFAULT 0, PRIMARY KEY (email, day, key))",
    "CREATE TABLE IF NOT EXISTS achievements (email TEXT, key TEXT, ts REAL, PRIMARY KEY (email, key))",
    "CREATE TABLE IF NOT EXISTS boss (id INTEGER PRIMARY KEY AUTOINCREMENT, week TEXT, name TEXT, hp INTEGER, max_hp INTEGER, defeated INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS boss_damage (email TEXT, boss_id INTEGER, dmg INTEGER DEFAULT 0, PRIMARY KEY (email, boss_id))",
    "CREATE TABLE IF NOT EXISTS pins (email TEXT PRIMARY KEY, pin TEXT)"
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  const alters = [
    "ALTER TABLE users ADD COLUMN login_streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN best_streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lifetime INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN gacha_count INTEGER DEFAULT 0"
  ];
  for (const a of alters) {
    try {
      await env.DB.prepare(a).run();
    } catch {
    }
  }
  const mig = [
    "UPDATE equipped SET slot='rhand' WHERE slot='weapon'",
    "UPDATE equipped SET slot='body' WHERE slot='armor'",
    "UPDATE equipped SET slot='lhand' WHERE slot='acc'",
    "DELETE FROM equipped WHERE item IN ('x6','g12')",
    "DELETE FROM equipped WHERE item NOT IN (SELECT item FROM inventory WHERE inventory.email = equipped.email)"
  ];
  for (const m of mig) {
    try {
      await env.DB.prepare(m).run();
    } catch {
    }
  }
  TABLES_READY = true;
}
__name(ensureGameTables, "ensureGameTables");
async function getUser(env, email, name) {
  await ensureGameTables(env);
  let u = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if (!u) {
    await env.DB.prepare("INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)").bind(email, name).run();
    u = { email, name, points: 0, last_login: "", cur_streak: 0, login_streak: 0, best_streak: 0, lifetime: 0, gacha_count: 0 };
  } else if (name && name !== u.name) {
    await env.DB.prepare("UPDATE users SET name=? WHERE email=?").bind(name, email).run();
    u.name = name;
  }
  return u;
}
__name(getUser, "getUser");
async function countInv(env, email) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM inventory WHERE email=?").bind(email).first();
  return r && r.c || 0;
}
__name(countInv, "countInv");
async function getCorrect(env, email) {
  const r = await env.DB.prepare(
    "SELECT SUM(correct) AS c FROM answers WHERE student LIKE ?"
  ).bind(email.split("@")[0] + " %").first();
  return r && r.c || 0;
}
__name(getCorrect, "getCorrect");
async function getPower(env, email) {
  const all = ALL_ITEMS;
  const correct = await getCorrect(env, email);
  const rows = await env.DB.prepare("SELECT item FROM equipped WHERE email=?").bind(email).all();
  let p = basePower(levelOf(correct));
  for (const r of rows.results) if (all[r.item]) p += all[r.item].power;
  return p;
}
__name(getPower, "getPower");
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
__name(bumpMission, "bumpMission");
async function grantAch(env, email, key, cond) {
  if (!cond) return null;
  const got = await env.DB.prepare(
    "SELECT 1 AS x FROM achievements WHERE email=? AND key=?"
  ).bind(email, key).first();
  if (got) return null;
  const a = ACH[key];
  await env.DB.prepare(
    "INSERT OR IGNORE INTO achievements (email, key, ts) VALUES (?, ?, ?)"
  ).bind(email, key, Date.now()).run();
  await env.DB.prepare("UPDATE users SET points=points+? WHERE email=?").bind(a.bonus, email).run();
  return { key, name: a.name, desc: a.desc, bonus: a.bonus };
}
__name(grantAch, "grantAch");
var TERMS_MAP = null;
async function getTermsMap(env) {
  if (TERMS_MAP) return TERMS_MAP;
  try {
    const r = await env.ASSETS.fetch(new Request("https://assets.local/terms.json"));
    const j = await r.json();
    TERMS_MAP = {};
    for (const t of j.terms || j) TERMS_MAP[t.term] = t.category;
  } catch {
  }
  return TERMS_MAP || {};
}
__name(getTermsMap, "getTermsMap");
async function getRegions(env, email) {
  const tm = await getTermsMap(env);
  const rows = await env.DB.prepare(
    "SELECT term, COUNT(*) AS c, SUM(correct) AS s FROM answers WHERE student LIKE ? GROUP BY term"
  ).bind(email.split("@")[0] + " %").all();
  const cats = {};
  for (const r of rows.results) {
    const cat = tm[r.term] || "\u305D\u306E\u4ED6";
    if (!cats[cat]) cats[cat] = { c: 0, s: 0 };
    cats[cat].c += r.c;
    cats[cat].s += r.s || 0;
  }
  return Object.entries(cats).map(([cat, v]) => ({
    cat,
    answered: v.c,
    rate: v.c ? Math.round(v.s / v.c * 100) : 0,
    cleared: v.c >= 8 && v.s / v.c >= 0.6
  }));
}
__name(getRegions, "getRegions");
async function checkRegions(env, email) {
  const regions = await getRegions(env, email);
  const hits = [];
  for (const r of regions.filter((x) => x.cleared)) {
    const key = "region:" + r.cat;
    const got = await env.DB.prepare(
      "SELECT 1 AS x FROM achievements WHERE email=? AND key=?"
    ).bind(email, key).first();
    if (!got) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO achievements (email, key, ts) VALUES (?, ?, ?)"
      ).bind(email, key, Date.now()).run();
      await env.DB.prepare("UPDATE users SET points=points+100 WHERE email=?").bind(email).run();
      hits.push({ key, name: "\u5206\u91CE\u5236\u8987", desc: `\u300C${r.cat}\u300D\u3092\u5236\u8987`, bonus: 100 });
    }
  }
  const g = await grantAch(env, email, "region1", regions.filter((x) => x.cleared).length >= 1);
  if (g) hits.push(g);
  return hits;
}
__name(checkRegions, "checkRegions");
async function getBoss(env, email) {
  const wk = weekKey();
  let b = await env.DB.prepare("SELECT * FROM boss ORDER BY id DESC LIMIT 1").first();
  if (!b || b.week !== wk) {
    const name = BOSS_NAMES[Math.abs(hashCode(wk)) % BOSS_NAMES.length];
    await env.DB.prepare(
      "INSERT INTO boss (week, name, hp, max_hp) VALUES (?, ?, ?, ?)"
    ).bind(wk, name, BOSS_HP, BOSS_HP).run();
    b = await env.DB.prepare("SELECT * FROM boss ORDER BY id DESC LIMIT 1").first();
  }
  let my = 0, attackers = 0;
  if (email) {
    const d = await env.DB.prepare(
      "SELECT dmg FROM boss_damage WHERE email=? AND boss_id=?"
    ).bind(email, b.id).first();
    my = d ? d.dmg : 0;
  }
  const c = await env.DB.prepare(
    "SELECT COUNT(DISTINCT email) AS c FROM boss_damage WHERE boss_id=?"
  ).bind(b.id).first();
  attackers = c ? c.c : 0;
  return { name: b.name, hp: b.hp, max_hp: b.max_hp, defeated: !!b.defeated, my_dmg: my, attackers };
}
__name(getBoss, "getBoss");
async function damageBoss(env, email, dmg) {
  const wk = weekKey();
  const b = await env.DB.prepare("SELECT * FROM boss WHERE week=?").bind(wk).first();
  if (!b || b.defeated) return null;
  const newHp = Math.max(0, b.hp - dmg);
  await env.DB.prepare("UPDATE boss SET hp=? WHERE id=?").bind(newHp, b.id).run();
  await env.DB.prepare(
    "INSERT INTO boss_damage (email, boss_id, dmg) VALUES (?, ?, ?) ON CONFLICT(email, boss_id) DO UPDATE SET dmg=dmg+excluded.dmg"
  ).bind(email, b.id, dmg).run();
  if (newHp === 0) {
    await env.DB.prepare("UPDATE boss SET defeated=1 WHERE id=?").bind(b.id).run();
    const parts = await env.DB.prepare(
      "SELECT email FROM boss_damage WHERE boss_id=?"
    ).bind(b.id).all();
    for (const p of parts.results) {
      await env.DB.prepare("UPDATE users SET points=points+200 WHERE email=?").bind(p.email).run();
    }
    return { killed: true, name: b.name, dmg };
  }
  return { killed: false, dmg, hp: newHp };
}
__name(damageBoss, "damageBoss");
function b64e(s) {
  return btoa(unescape(encodeURIComponent(s)));
}
__name(b64e, "b64e");
function b64d(s) {
  return decodeURIComponent(escape(atob(s)));
}
__name(b64d, "b64d");
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
__name(hmacSha256, "hmacSha256");
var SECRET_CACHE = null;
async function getSecret(env) {
  if (SECRET_CACHE) return SECRET_CACHE;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
  ).run();
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key='session_secret'").first();
  if (r && r.value) {
    SECRET_CACHE = r.value;
    return r.value;
  }
  const s = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('session_secret', ?)"
  ).bind(s).run();
  SECRET_CACHE = s;
  return s;
}
__name(getSecret, "getSecret");
async function verifySession(env, token) {
  if (!token || !token.includes(".")) return null;
  const [b64, sig] = token.split(".");
  let payload;
  try {
    payload = b64d(b64);
  } catch {
    return null;
  }
  let secret;
  try {
    secret = await getSecret(env);
  } catch {
    return null;
  }
  if (await hmacSha256(secret, payload) !== sig) return null;
  const [email, name, exp] = payload.split("|");
  if (Number(exp) < Date.now()) return null;
  return { email, name };
}
__name(verifySession, "verifySession");
async function hashPw(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPw, "hashPw");
var PW_CACHE = { value: null, ts: 0 };
async function pwMatches(env, submitted) {
  try {
    let stored;
    if (PW_CACHE.ts > Date.now() - 6e4) {
      stored = PW_CACHE.value;
    } else {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
      ).run();
      const r = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
      stored = r && r.value || null;
      PW_CACHE = { value: stored, ts: Date.now() };
    }
    if (stored) {
      return stored === await hashPw(submitted) || stored === submitted;
    }
  } catch {
  }
  return submitted === (env.TEACHER_PW || "sensei");
}
__name(pwMatches, "pwMatches");
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(json, "json");

// ../../.npm/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.npm/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body2 = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body2);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body2, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-QrFkgh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../.npm/_npx/d77349f55c2be1c0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-QrFkgh/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
