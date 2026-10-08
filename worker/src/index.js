export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch {
      return json({ error: "サーバーが混み合っています。少し待ってからもう一度試してください" }, 503);
    }
  },
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
      if (!sid || sid === "-" || !name) return json({ error: "クラス・番号・名前を入れてください" }, 400);
      if (pin.length < 4) return json({ error: "PINは4文字以上にしてください" }, 400);
      try {
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
      } catch {
        return json({ error: "サーバーが混み合っています。少し待ってからもう一度試してください" }, 503);
      }
    }

    if (url.pathname === "/api/pin_reset" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      if (!(await pwMatches(env, b.pw || ""))) return json({ error: "forbidden" }, 403);
      const sid = String(b.sid || "").slice(0, 24);
      if (!sid) return json({ error: "bad sid" }, 400);
      await ensureGameTables(env);
      await env.DB.prepare("DELETE FROM pins WHERE email=?").bind(sid).run();
      return json({ ok: true });
    }

    if (url.pathname === "/api/me") {
      const sess = await verifySession(env, url.searchParams.get("token") || "");
      if (!sess) return json({ error: "ログインしてください" }, 401);
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
      const tot = await getTotals(env, u);
      const total = tot.total;
      const correct = tot.correct;
      const level = levelOf(correct);
      const power = await getPower(env, sess.email, correct);
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
          return { key: k, desc: MISSIONS[k].desc, goal: MISSIONS[k].goal, bonus: MISSIONS[k].bonus,
            progress: r ? r.progress : 0, claimed: r ? r.claimed : 0 };
        }),
        achievements: ACH,
        unlocked: ach.results.map((r) => r.key),
        regions: await getRegions(env, sess.email),
        boss: await getBoss(env, sess.email),
        login_bonus: bonus,
        items: ALL_ITEMS,
        gacha: GACHA_ITEMS,
      });
    }

    if (url.pathname === "/api/buy" && request.method === "POST") {
      return json({ error: "アイテムはガチャでのみ入手できます" }, 400);
    }

    if (url.pathname === "/api/gacha" && request.method === "POST") {
      const b = await body(request);
      if (!b) return json({ error: "bad request" }, 400);
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
        ok: true, item, dup: !!owned, refund,
        points: (u.points || 0) - COST + refund + newAch.reduce((s, a) => s + a.bonus, 0),
        ach_new: newAch,
      });
    }

    if (url.pathname === "/api/equip" && request.method === "POST") {
      const b = await body(request);
      if (!b) return json({ error: "bad request" }, 400);
      const sess = await verifySession(env, b.token);
      if (!sess) return json({ error: "ログインしてください" }, 401);
      if (!SLOTS.includes(b.slot)) return json({ error: "bad slot" }, 400);
      await ensureGameTables(env);
      const allItems = ALL_ITEMS;
      if (b.item) {
        if (!allItems[b.item] || allItems[b.item].slot !== b.slot) return json({ error: "bad item" }, 400);
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
      const ec = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM equipped WHERE email=?"
      ).bind(sess.email).first();
      await grantAch(env, sess.email, "fulleq", (ec && ec.c) >= SLOTS.length);
      const ue = await getUser(env, sess.email, sess.name);
      const te = await getTotals(env, ue);
      return json({ ok: true, power: await getPower(env, sess.email, te.correct) });
    }

    if (url.pathname === "/api/ranking") {
      const sess = await verifySession(env, url.searchParams.get("token") || "");
      if (!sess) return json({ error: "ログインしてください" }, 401);
      await ensureGameTables(env);
      const users = await env.DB.prepare(
        "SELECT email, name, points, login_streak, answered_total, correct_total FROM users"
      ).all();
      const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
      const all = ALL_ITEMS;
      const eqP = {};
      for (const r of eqs.results) {
        const it = all[r.item];
        if (it) eqP[r.email] = (eqP[r.email] || 0) + it.power;
      }
      const week = await env.DB.prepare(
        "SELECT student, COUNT(*) AS c, SUM(correct) AS s FROM answers WHERE ts >= ? GROUP BY student"
      ).bind(Date.now() / 1000 - 7 * 86400).all();
      const weekMap = {};
      for (const r of week.results) {
        weekMap[String(r.student).split(" ")[0]] = (r.s || 0) * 8 + r.c * 2;
      }
      const list = [];
      for (const u of users.results) {
        const t = await getTotals(env, u);
        const id = u.email.split("@")[0];
        list.push({
          id,
          name: u.name || "",
          power: basePower(levelOf(t.correct)) + (eqP[u.email] || 0),
          points: u.points,
          streak: u.login_streak || 0,
          total: t.total,
          weekly: weekMap[id] || 0,
          rank: rankOf(t.total),
        });
      }
      return json({
        power: [...list].sort((a, b) => b.power - a.power || b.points - a.points).slice(0, 30),
        weekly: [...list].sort((a, b) => b.weekly - a.weekly).slice(0, 30),
        rank: [...list].sort((a, b) => b.total - a.total).slice(0, 30),
        streak: [...list].sort((a, b) => b.streak - a.streak).slice(0, 30),
        me: sess.email.split("@")[0],
      });
    }

    if (url.pathname === "/api/answer" && request.method === "POST") {
      const b = await body(request);
      if (!b) return json({ error: "bad request" }, 400);
      const sess = await verifySession(env, b.token);
      if (!sess) return json({ error: "ログインしてください" }, 401);
      const student = `${sess.email.split("@")[0]} ${sess.name}`.slice(0, 50);
      if (!env.DB) return json({ error: "DB binding がありません（Variable name DB で D1 を割り当ててください）" }, 500);
      try {
        await env.DB.prepare(
          "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)"
        ).bind(student, String(b.term || "").slice(0, 200), String(b.direction || "").slice(0, 10),
          b.correct ? 1 : 0, Date.now() / 1000).run();
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
      const c01 = b.correct ? 1 : 0;
      await env.DB.prepare(
        "UPDATE users SET answered_total=CASE WHEN answered_total>=0 THEN answered_total+1 ELSE answered_total END, " +
        "correct_total=CASE WHEN correct_total>=0 THEN correct_total+? ELSE correct_total END, last_activity=? WHERE email=?"
      ).bind(c01, Date.now() / 1000, sess.email).run();
      await env.DB.prepare(
        "INSERT INTO term_stats (term, answered, correct, last_ts) VALUES (?, 1, ?, ?) " +
        "ON CONFLICT(term) DO UPDATE SET answered=answered+1, correct=correct+excluded.correct, last_ts=excluded.last_ts"
      ).bind(String(b.term || "").slice(0, 200), c01, Date.now() / 1000).run();
      const u = await getUser(env, sess.email, sess.name);
      const streak = b.correct ? (u.cur_streak || 0) + 1 : 0;
      const tot = await getTotals(env, u);
      const power = await getPower(env, sess.email, tot.correct);
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
      const total = tot.total;
      const correctTotal = tot.correct;
      const level = levelOf(correctTotal);
      const levelUp = level > levelOf(correctTotal - (b.correct ? 1 : 0)) ? level : null;
      const hour = new Date(Date.now() + 9 * 3600e3).getUTCHours();
      const newAch = [];
      const tryA = async (k, c) => { const a = await grantAch(env, sess.email, k, c); if (a) newAch.push(a); };
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
      await tryA("rich", (u.lifetime || 0) + earned >= 1000);
      await tryA("lv5", level >= 5);
      await tryA("lv10", level >= 10);
      if (bossRes && bossRes.killed) await tryA("boss", true);
      const regionHits = await checkRegions(env, sess.email);
      for (const r of regionHits) newAch.push(r);
      const points = (u.points || 0) + earned + doneM.reduce((s, x) => s + x.bonus, 0) +
        newAch.reduce((s, x) => s + x.bonus, 0) + (bossRes && bossRes.killed ? 200 : 0);
      return json({
        ok: true, earned, combo, points,
        missions_done: doneM, ach_new: newAch,
        total, rank: rankOf(total),
        rank_up: rankOf(total) !== rankOf(total - 1) ? rankOf(total) : null,
        level, correct_total: correctTotal, level_up: levelUp,
        boss: bossRes,
      });
    }

    if (url.pathname === "/api/reset" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      if (!(await pwMatches(env, b.pw || ""))) return json({ error: "forbidden" }, 403);
      await ensureGameTables(env);
      for (const t of ["answers", "users", "inventory", "equipped", "missions", "achievements", "pins", "boss", "boss_damage", "term_stats"]) {
        try {
          await env.DB.prepare(`DELETE FROM ${t}`).run();
        } catch {}
      }
      return json({ ok: true });
    }

    if (url.pathname === "/api/password" && request.method === "POST") {
      const b = await body(request);
      if (!b) return json({ error: "bad request" }, 400);
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
      PW_CACHE = { value: null, ts: 0 };
      return json({ ok: true });
    }

    if (url.pathname === "/api/stats") {
      if (!(await pwMatches(env, url.searchParams.get("pw") || ""))) {
        return json({ error: "forbidden" }, 403);
      }
      if (!env.DB) return json({ error: "DB binding がありません（Variable name DB で D1 を割り当ててください）" }, 500);
      await ensureGameTables(env);
      try {
        const us = await env.DB.prepare(
          "SELECT email, name, points, login_streak, answered_total, correct_total, last_activity FROM users"
        ).all();
        const eqs = await env.DB.prepare("SELECT email, item FROM equipped").all();
        const termRows = await env.DB.prepare(
          "SELECT term, answered, correct FROM term_stats ORDER BY CAST(correct AS REAL)/MAX(answered,1) ASC"
        ).all();
        const eqP = {};
        for (const r of eqs.results) {
          const it = ALL_ITEMS[r.item];
          if (it) eqP[r.email] = (eqP[r.email] || 0) + it.power;
        }
        const students = [];
        for (const u of us.results) {
          const t = await getTotals(env, u);
          const a = t.total;
          const c = t.correct;
          students.push({
            student: `${u.email.split("@")[0]} ${u.name || ""}`.trim(),
            answered: a,
            correct: c,
            rate: a ? Math.round((c / a) * 1000) / 10 : 0,
            points: u.points || 0,
            power: basePower(levelOf(c)) + (eqP[u.email] || 0),
            level: levelOf(c),
            rank: rankOf(a),
            streak: u.login_streak || 0,
            last_ts: u.last_activity || 0,
          });
        }
        students.sort((x, y) => y.last_ts - x.last_ts);
        let boss = null;
        try { boss = await getBoss(env, ""); } catch {}
        return json({
          students,
          terms: termRows.results.map((r) => ({
            term: r.term,
            answered: r.answered,
            correct: r.correct,
            rate: r.answered ? Math.round((r.correct / r.answered) * 1000) / 10 : 0,
          })),
          boss,
        });
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }

    const map = { "/": "/index.html", "/teacher": "/teacher.html", "/terms": "/terms.json" };
    const assetPath = map[url.pathname] || url.pathname;
    return env.ASSETS.fetch(new Request(new URL(assetPath, url.origin), request));
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const SLOTS = ["head", "body", "lhand", "rhand", "pants", "feet"];

const GACHA_ITEMS = [
  { id: "w0", name: "ボールペンランス", slot: "rhand", power: 5, rarity: "N" },
  { id: "w1", name: "エンピツソード", slot: "rhand", power: 10, rarity: "N" },
  { id: "w2", name: "計算機ブレード", slot: "rhand", power: 30, rarity: "R" },
  { id: "w3", name: "ルーターハンマー", slot: "rhand", power: 50, rarity: "SR" },
  { id: "w4", name: "サーバーブレード", slot: "rhand", power: 80, rarity: "SR" },
  { id: "w5", name: "フレームワークス", slot: "rhand", power: 120, rarity: "SR" },
  { id: "w6", name: "暗号キーアックス", slot: "rhand", power: 150, rarity: "SSR" },
  { id: "w7", name: "ゼロデイエッジ", slot: "rhand", power: 200, rarity: "SSR" },
  { id: "w8", name: "量子ブレイド", slot: "rhand", power: 250, rarity: "SSR" },
  { id: "w9", name: "伝説のフロッピー", slot: "rhand", power: 400, rarity: "SSR" },
  { id: "a0", name: "ジャージ", slot: "body", power: 5, rarity: "N" },
  { id: "a1", name: "学生服", slot: "body", power: 10, rarity: "N" },
  { id: "a2", name: "ネクタイアーマー", slot: "body", power: 15, rarity: "N" },
  { id: "a3", name: "ビジネススーツ", slot: "body", power: 30, rarity: "R" },
  { id: "a4", name: "ファイアウォールメイル", slot: "body", power: 50, rarity: "SR" },
  { id: "a5", name: "デバッグアーマー", slot: "body", power: 80, rarity: "SR" },
  { id: "a6", name: "クラウドローブ", slot: "body", power: 120, rarity: "SR" },
  { id: "a7", name: "AIアーマー", slot: "body", power: 150, rarity: "SSR" },
  { id: "a8", name: "エンタープライズ鎧", slot: "body", power: 200, rarity: "SSR" },
  { id: "a9", name: "神ゼロアーマー", slot: "body", power: 400, rarity: "SSR" },
  { id: "x0", name: "名札バッジ", slot: "lhand", power: 5, rarity: "N" },
  { id: "x1", name: "鉛筆削りのお守り", slot: "lhand", power: 10, rarity: "N" },
  { id: "x2", name: "USBメモリ", slot: "lhand", power: 15, rarity: "N" },
  { id: "x3", name: "カードリーダー", slot: "lhand", power: 25, rarity: "R" },
  { id: "x4", name: "電卓のお守り", slot: "lhand", power: 40, rarity: "R" },
  { id: "x5", name: "外付けSSD", slot: "lhand", power: 60, rarity: "SR" },
  { id: "x6", name: "メガネ", slot: "head", power: 80, rarity: "SR" },
  { id: "x7", name: "光ファイバー", slot: "lhand", power: 100, rarity: "SR" },
  { id: "x8", name: "電子辞書", slot: "lhand", power: 150, rarity: "SSR" },
  { id: "x9", name: "QRコードお守り", slot: "lhand", power: 220, rarity: "SSR" },

  { id: "g1", name: "ペーパーナイフ", slot: "rhand", power: 5, rarity: "N" },
  { id: "g2", name: "消しゴムダガー", slot: "rhand", power: 8, rarity: "N" },
  { id: "gw3", name: "ホチキスガン", slot: "rhand", power: 4, rarity: "N" },
  { id: "gw4", name: "定規ソード", slot: "rhand", power: 6, rarity: "N" },
  { id: "g3", name: "鉄のキーボード", slot: "rhand", power: 18, rarity: "R" },
  { id: "g4", name: "光るマウス", slot: "rhand", power: 25, rarity: "R" },
  { id: "gw5", name: "バーコードブレード", slot: "rhand", power: 16, rarity: "R" },
  { id: "gw6", name: "プリンターアックス", slot: "rhand", power: 28, rarity: "R" },
  { id: "g5", name: "ファイアウォールブレード", slot: "rhand", power: 60, rarity: "SR" },
  { id: "gw7", name: "バイナリハンマー", slot: "rhand", power: 50, rarity: "SR" },
  { id: "g6", name: "伝説のサーバー", slot: "rhand", power: 150, rarity: "SSR" },
  { id: "gw8", name: "聖剣エクセル", slot: "rhand", power: 170, rarity: "SSR" },
  { id: "g7", name: "パーカー", slot: "body", power: 5, rarity: "N" },
  { id: "g8", name: "白衣", slot: "body", power: 8, rarity: "N" },
  { id: "ga3", name: "体操服", slot: "body", power: 4, rarity: "N" },
  { id: "ga4", name: "レインコート", slot: "body", power: 6, rarity: "N" },
  { id: "g9", name: "セキュリティベスト", slot: "body", power: 20, rarity: "R" },
  { id: "ga5", name: "セキュリティジャケット", slot: "body", power: 32, rarity: "R" },
  { id: "ga6", name: "バックアップベスト", slot: "body", power: 16, rarity: "R" },
  { id: "g10", name: "クラウドアーマー", slot: "body", power: 60, rarity: "SR" },
  { id: "ga7", name: "補助記憶アーマー", slot: "body", power: 50, rarity: "SR" },
  { id: "g11", name: "量子スーツ", slot: "body", power: 150, rarity: "SSR" },
  { id: "ga8", name: "時空プロテクター", slot: "body", power: 170, rarity: "SSR" },
  { id: "g12", name: "鉛筆キャップ", slot: "head", power: 5, rarity: "N" },
  { id: "gx3", name: "付箋お守り", slot: "lhand", power: 4, rarity: "N" },
  { id: "gx4", name: "消しゴムお守り", slot: "lhand", power: 7, rarity: "N" },
  { id: "g13", name: "クリップ", slot: "lhand", power: 12, rarity: "R" },
  { id: "gx5", name: "電池パック", slot: "lhand", power: 14, rarity: "R" },
  { id: "gx6", name: "LANケーブル", slot: "lhand", power: 30, rarity: "R" },
  { id: "g14", name: "SSD", slot: "lhand", power: 35, rarity: "SR" },
  { id: "g15", name: "GPUお守り", slot: "lhand", power: 55, rarity: "SR" },
  { id: "g16", name: "量子チップ", slot: "lhand", power: 120, rarity: "SSR" },
  { id: "gx7", name: "シンギュラリティチップ", slot: "lhand", power: 180, rarity: "SSR" },
  { id: "h1", name: "学生帽", slot: "head", power: 8, rarity: "N" },
  { id: "h2", name: "ヘッドホン", slot: "head", power: 12, rarity: "N" },
  { id: "h3", name: "ノート魔法帽", slot: "head", power: 15, rarity: "R" },
  { id: "h4", name: "セキュリティヘルメット", slot: "head", power: 20, rarity: "R" },
  { id: "h5", name: "クラウドクラウン", slot: "head", power: 30, rarity: "R" },
  { id: "h6", name: "AIバイザー", slot: "head", power: 55, rarity: "SR" },
  { id: "h7", name: "量子ハイロ", slot: "head", power: 80, rarity: "SR" },
  { id: "h8", name: "伝説の王冠", slot: "head", power: 160, rarity: "SSR" },
  { id: "p0", name: "ジャージズボン", slot: "pants", power: 5, rarity: "N" },
  { id: "p1", name: "学生ズボン", slot: "pants", power: 8, rarity: "N" },
  { id: "p2", name: "スラックス", slot: "pants", power: 12, rarity: "R" },
  { id: "p3", name: "ジーンズ", slot: "pants", power: 18, rarity: "R" },
  { id: "p4", name: "ワークパンツ", slot: "pants", power: 25, rarity: "R" },
  { id: "p5", name: "ファイアパンツ", slot: "pants", power: 45, rarity: "SR" },
  { id: "p6", name: "クラウドパンツ", slot: "pants", power: 55, rarity: "SR" },
  { id: "p7", name: "AIレッグ", slot: "pants", power: 70, rarity: "SR" },
  { id: "p8", name: "エンタープライズ脚甲", slot: "pants", power: 120, rarity: "SSR" },
  { id: "p9", name: "神ゼロレギンス", slot: "pants", power: 180, rarity: "SSR" },
  { id: "f0", name: "上履き", slot: "feet", power: 4, rarity: "N" },
  { id: "f1", name: "スニーカー", slot: "feet", power: 8, rarity: "N" },
  { id: "f2", name: "革靴", slot: "feet", power: 12, rarity: "R" },
  { id: "f3", name: "セキュリティブーツ", slot: "feet", power: 20, rarity: "R" },
  { id: "f4", name: "光速スニーカー", slot: "feet", power: 30, rarity: "R" },
  { id: "f5", name: "ファイアブーツ", slot: "feet", power: 45, rarity: "SR" },
  { id: "f6", name: "クラウドブーツ", slot: "feet", power: 55, rarity: "SR" },
  { id: "f7", name: "ホバーシューズ", slot: "feet", power: 70, rarity: "SR" },
  { id: "f8", name: "量子ブーツ", slot: "feet", power: 110, rarity: "SSR" },
  { id: "f9", name: "伝説の羽根靴", slot: "feet", power: 160, rarity: "SSR" },
  { id: "s0", name: "下敷きシールド", slot: "lhand", power: 5, rarity: "N" },
  { id: "s1", name: "消しゴムシールド", slot: "lhand", power: 6, rarity: "N" },
  { id: "s2", name: "定規シールド", slot: "lhand", power: 8, rarity: "N" },
  { id: "s3", name: "キーボードシールド", slot: "lhand", power: 15, rarity: "R" },
  { id: "s4", name: "教科書シールド", slot: "lhand", power: 18, rarity: "R" },
  { id: "s5", name: "バックアップシールド", slot: "lhand", power: 25, rarity: "R" },
  { id: "s6", name: "ファイアウォールシールド", slot: "lhand", power: 50, rarity: "SR" },
  { id: "s7", name: "サーバーシールド", slot: "lhand", power: 60, rarity: "SR" },
  { id: "s8", name: "量子シールド", slot: "lhand", power: 90, rarity: "SR" },
  { id: "s9", name: "聖盾エクセル", slot: "lhand", power: 170, rarity: "SSR" },
];

const ALL_ITEMS = {};
for (const i of GACHA_ITEMS) ALL_ITEMS[i.id] = i;

function levelOf(correct) { return 1 + Math.floor(correct / 20); }
function basePower(lv) { return 100 + 10 * (lv - 1); }

const MISSIONS = {
  ans10: { desc: "10問回答する", goal: 10, bonus: 60 },
  cor15: { desc: "15問正解する", goal: 15, bonus: 100 },
  str8: { desc: "8問連続正解する", goal: 8, bonus: 80 },
};

const ACH = {
  first: { name: "はじめの一歩", desc: "初めて回答した", bonus: 20 },
  ans50: { name: "五十問の壁", desc: "累計50問回答", bonus: 30 },
  ans100: { name: "百問の先輩", desc: "累計100問回答", bonus: 50 },
  ans300: { name: "三百問の猛者", desc: "累計300問回答", bonus: 100 },
  ans500: { name: "五百問の仙人", desc: "累計500問回答", bonus: 150 },
  streak10: { name: "十連撃", desc: "10問連続正解", bonus: 50 },
  streak20: { name: "二十連撃", desc: "20問連続正解", bonus: 100 },
  streak30: { name: "無双", desc: "30問連続正解", bonus: 200 },
  early: { name: "朝活", desc: "朝7時前に回答", bonus: 30 },
  night: { name: "夜型人間", desc: "23時以降に回答", bonus: 30 },
  rich: { name: "ポイント長者", desc: "累計1000pt獲得", bonus: 80 },
  gacha10: { name: "ガチャ中毒", desc: "ガチャを10回まわす", bonus: 50 },
  ssr: { name: "神引き", desc: "SSRを引き当てる", bonus: 100 },
  boss: { name: "討伐隊", desc: "ボス討伐に貢献", bonus: 80 },
  region1: { name: "制覇のはじまり", desc: "分野を1つ制覇", bonus: 100 },
  login3: { name: "三日坊主脱却", desc: "3日連続ログイン", bonus: 30 },
  login7: { name: "習慣の天才", desc: "7日連続ログイン", bonus: 70 },
  shop5: { name: "コレクター", desc: "アイテムを5種所持", bonus: 50 },
  coll30: { name: "コレクター改", desc: "アイテムを30種所持", bonus: 150 },
  coll50: { name: "アイテム博物館", desc: "アイテムを50種所持", bonus: 300 },
  fulleq: { name: "フル装備", desc: "6スロットすべてに装備", bonus: 100 },
  lv5: { name: "レベル5", desc: "レベル5に到達", bonus: 150 },
  lv10: { name: "レベル10", desc: "レベル10に到達", bonus: 400 },
};

const RANKS = [
  { min: 800, label: "SS", title: "情報の神" },
  { min: 400, label: "S", title: "電脳賢者" },
  { min: 200, label: "A", title: "検定の覇者" },
  { min: 100, label: "B", title: "用語マスター" },
  { min: 50, label: "C", title: "問題ハンター" },
  { min: 20, label: "D", title: "勉強家見習い" },
  { min: 0, label: "E", title: "ただの生徒" },
];

const BOSS_NAMES = [
  "エラーデーモン", "青画面の魔王ブルースクリーン", "漢字変換バグワーム",
  "メモリリークの巨獣", "404番目の亡霊", "暗黒SQLインジェクタ",
  "フリーズの鬼神", "文字化けモンスター",
];
const BOSS_HP = 2000;

function rankOf(total) {
  for (const r of RANKS) if (total >= r.min) return r.label;
  return "E";
}

function nextRankAt(total) {
  const next = [...RANKS].reverse().find((r) => r.min > total);
  return next ? next.min : null;
}

function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function weekKey() {
  const d = new Date(Date.now() + 9 * 3600e3);
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return d.getUTCFullYear() + "-W" + Math.ceil(((d - jan1) / 864e5 + 1) / 7);
}

function hashCode(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

let TABLES_READY = false;

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
    "CREATE TABLE IF NOT EXISTS pins (email TEXT PRIMARY KEY, pin TEXT)",
    "CREATE TABLE IF NOT EXISTS term_stats (term TEXT PRIMARY KEY, answered INTEGER DEFAULT 0, correct INTEGER DEFAULT 0, last_ts REAL)",
    "CREATE INDEX IF NOT EXISTS idx_answers_student ON answers(student)",
    "CREATE INDEX IF NOT EXISTS idx_answers_ts ON answers(ts)",
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  const alters = [
    "ALTER TABLE users ADD COLUMN login_streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN best_streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lifetime INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN gacha_count INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN answered_total INTEGER DEFAULT -1",
    "ALTER TABLE users ADD COLUMN correct_total INTEGER DEFAULT -1",
    "ALTER TABLE users ADD COLUMN last_activity REAL DEFAULT 0",
  ];
  for (const a of alters) { try { await env.DB.prepare(a).run(); } catch {} }
  const mig = [
    "UPDATE equipped SET slot='rhand' WHERE slot='weapon'",
    "UPDATE equipped SET slot='body' WHERE slot='armor'",
    "UPDATE equipped SET slot='lhand' WHERE slot='acc'",
    "DELETE FROM equipped WHERE item IN ('x6','g12')",
    "DELETE FROM equipped WHERE item NOT IN (SELECT item FROM inventory WHERE inventory.email = equipped.email)",
    "INSERT OR IGNORE INTO term_stats (term, answered, correct, last_ts) SELECT term, COUNT(*), SUM(correct), MAX(ts) FROM answers GROUP BY term",
    "UPDATE users SET last_activity=(SELECT MAX(ts) FROM answers WHERE student LIKE users.email || ' %') WHERE last_activity=0",
  ];
  for (const m of mig) { try { await env.DB.prepare(m).run(); } catch {} }
  TABLES_READY = true;
}

async function getUser(env, email, name) {
  await ensureGameTables(env);
  let u = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if (!u) {
    await env.DB.prepare("INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)").bind(email, name).run();
    u = { email, name, points: 0, last_login: "", cur_streak: 0, login_streak: 0, best_streak: 0, lifetime: 0, gacha_count: 0, answered_total: -1, correct_total: -1, last_activity: 0 };
  } else if (name && name !== u.name) {
    await env.DB.prepare("UPDATE users SET name=? WHERE email=?").bind(name, email).run();
    u.name = name;
  }
  return u;
}

async function countInv(env, email) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM inventory WHERE email=?").bind(email).first();
  return (r && r.c) || 0;
}

async function getTotals(env, u) {
  if (u.answered_total >= 0 && u.correct_total >= 0) {
    return { total: u.answered_total, correct: u.correct_total };
  }
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(correct), 0) AS c FROM answers WHERE student LIKE ?"
  ).bind(u.email.split("@")[0] + " %").first();
  const total = (r && r.n) || 0;
  const correct = (r && r.c) || 0;
  await env.DB.prepare(
    "UPDATE users SET answered_total=?, correct_total=? WHERE email=?"
  ).bind(total, correct, u.email).run();
  u.answered_total = total;
  u.correct_total = correct;
  return { total, correct };
}

async function getPower(env, email, correct) {
  const all = ALL_ITEMS;
  const rows = await env.DB.prepare("SELECT item FROM equipped WHERE email=?").bind(email).all();
  let p = basePower(levelOf(correct));
  for (const r of rows.results) if (all[r.item]) p += all[r.item].power;
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

let TERMS_MAP = null;
async function getTermsMap(env) {
  if (TERMS_MAP) return TERMS_MAP;
  try {
    const r = await env.ASSETS.fetch(new Request("https://assets.local/terms.json"));
    const j = await r.json();
    TERMS_MAP = {};
    for (const t of (j.terms || j)) TERMS_MAP[t.term] = t.category;
  } catch {}
  return TERMS_MAP || {};
}

async function getRegions(env, email) {
  const tm = await getTermsMap(env);
  const rows = await env.DB.prepare(
    "SELECT term, COUNT(*) AS c, SUM(correct) AS s FROM answers WHERE student LIKE ? GROUP BY term"
  ).bind(email.split("@")[0] + " %").all();
  const cats = {};
  for (const r of rows.results) {
    const cat = tm[r.term] || "その他";
    if (!cats[cat]) cats[cat] = { c: 0, s: 0 };
    cats[cat].c += r.c;
    cats[cat].s += r.s || 0;
  }
  return Object.entries(cats).map(([cat, v]) => ({
    cat,
    answered: v.c,
    rate: v.c ? Math.round((v.s / v.c) * 100) : 0,
    cleared: v.c >= 8 && v.s / v.c >= 0.6,
  }));
}

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
      hits.push({ key, name: "分野制覇", desc: `「${r.cat}」を制覇`, bonus: 100 });
    }
  }
  const g = await grantAch(env, email, "region1", regions.filter((x) => x.cleared).length >= 1);
  if (g) hits.push(g);
  return hits;
}

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

async function damageBoss(env, email, dmg) {
  const wk = weekKey();
  const b = await env.DB.prepare("SELECT * FROM boss WHERE week=?").bind(wk).first();
  if (!b || b.defeated) return null;
  const newHp = Math.max(0, b.hp - dmg);
  await env.DB.prepare("UPDATE boss SET hp=? WHERE id=?").bind(newHp, b.id).run();
  await env.DB.prepare(
    "INSERT INTO boss_damage (email, boss_id, dmg) VALUES (?, ?, ?) " +
    "ON CONFLICT(email, boss_id) DO UPDATE SET dmg=dmg+excluded.dmg"
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

let SECRET_CACHE = null;

async function getSecret(env) {
  if (SECRET_CACHE) return SECRET_CACHE;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
  ).run();
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key='session_secret'").first();
  if (r && r.value) { SECRET_CACHE = r.value; return r.value; }
  const s = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('session_secret', ?)"
  ).bind(s).run();
  SECRET_CACHE = s;
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
  let secret;
  try {
    secret = await getSecret(env);
  } catch {
    return null;
  }
  if ((await hmacSha256(secret, payload)) !== sig) return null;
  const [email, name, exp] = payload.split("|");
  if (Number(exp) < Date.now()) return null;
  return { email, name };
}

async function hashPw(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let PW_CACHE = { value: null, ts: 0 };

async function pwMatches(env, submitted) {
  try {
    let stored;
    if (PW_CACHE.ts > Date.now() - 60000) {
      stored = PW_CACHE.value;
    } else {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
      ).run();
      const r = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
      stored = (r && r.value) || null;
      PW_CACHE = { value: stored, ts: Date.now() };
    }
    if (stored) {
      return stored === (await hashPw(submitted)) || stored === submitted;
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
