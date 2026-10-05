export const ITEMS = {
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

export const GACHA_ITEMS = [
  { id: "g1", name: "ペーパーナイフ", slot: "weapon", power: 5, rarity: "N" },
  { id: "g2", name: "消しゴムダガー", slot: "weapon", power: 8, rarity: "N" },
  { id: "g3", name: "鉄のキーボード", slot: "weapon", power: 18, rarity: "R" },
  { id: "g4", name: "光るマウス", slot: "weapon", power: 25, rarity: "R" },
  { id: "g5", name: "ファイアウォールブレード", slot: "weapon", power: 60, rarity: "SR" },
  { id: "g6", name: "伝説のサーバー", slot: "weapon", power: 150, rarity: "SSR" },
  { id: "g7", name: "パーカー", slot: "armor", power: 5, rarity: "N" },
  { id: "g8", name: "白衣", slot: "armor", power: 8, rarity: "N" },
  { id: "g9", name: "セキュリティベスト", slot: "armor", power: 20, rarity: "R" },
  { id: "g10", name: "クラウドアーマー", slot: "armor", power: 60, rarity: "SR" },
  { id: "g11", name: "量子スーツ", slot: "armor", power: 150, rarity: "SSR" },
  { id: "g12", name: "鉛筆キャップ", slot: "acc", power: 5, rarity: "N" },
  { id: "g13", name: "クリップ", slot: "acc", power: 12, rarity: "R" },
  { id: "g14", name: "SSD", slot: "acc", power: 35, rarity: "SR" },
  { id: "g15", name: "GPUお守り", slot: "acc", power: 55, rarity: "SR" },
  { id: "g16", name: "量子チップ", slot: "acc", power: 120, rarity: "SSR" },
];

export function allItems() {
  const m = { ...ITEMS };
  for (const i of GACHA_ITEMS) m[i.id] = i;
  return m;
}

export const MISSIONS = {
  ans10: { desc: "10問回答する", goal: 10, bonus: 60 },
  cor15: { desc: "15問正解する", goal: 15, bonus: 100 },
  str8: { desc: "8問連続正解する", goal: 8, bonus: 80 },
};

export const ACH = {
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
};

export const RANKS = [
  { min: 800, label: "SS", title: "情報の神" },
  { min: 400, label: "S", title: "電脳賢者" },
  { min: 200, label: "A", title: "検定の覇者" },
  { min: 100, label: "B", title: "用語マスター" },
  { min: 50, label: "C", title: "問題ハンター" },
  { min: 20, label: "D", title: "勉強家見習い" },
  { min: 0, label: "E", title: "ただの生徒" },
];

export const BOSS_NAMES = [
  "エラーデーモン", "青画面の魔王ブルースクリーン", "漢字変換バグワーム",
  "メモリリークの巨獣", "404番目の亡霊", "暗黒SQLインジェクタ",
  "フリーズの鬼神", "文字化けモンスター",
];
export const BOSS_HP = 2000;

export function rankOf(total) {
  for (const r of RANKS) if (total >= r.min) return r.label;
  return "E";
}

export function nextRankAt(total) {
  const next = [...RANKS].reverse().find((r) => r.min > total);
  return next ? next.min : null;
}

export function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function weekKey() {
  const d = new Date(Date.now() + 9 * 3600e3);
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return d.getUTCFullYear() + "-W" + Math.ceil(((d - jan1) / 864e5 + 1) / 7);
}

function hashCode(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

export async function getTotal(env, email) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM answers WHERE student LIKE ?"
  ).bind(email.split("@")[0] + " %").first();
  return (r && r.c) || 0;
}

export async function ensureGameTables(env) {
  const stmts = [
    "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT, points INTEGER DEFAULT 0, last_login TEXT DEFAULT '', cur_streak INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS inventory (email TEXT, item TEXT, PRIMARY KEY (email, item))",
    "CREATE TABLE IF NOT EXISTS equipped (email TEXT, slot TEXT, item TEXT, PRIMARY KEY (email, slot))",
    "CREATE TABLE IF NOT EXISTS missions (email TEXT, day TEXT, key TEXT, progress INTEGER DEFAULT 0, claimed INTEGER DEFAULT 0, PRIMARY KEY (email, day, key))",
    "CREATE TABLE IF NOT EXISTS achievements (email TEXT, key TEXT, ts REAL, PRIMARY KEY (email, key))",
    "CREATE TABLE IF NOT EXISTS boss (id INTEGER PRIMARY KEY AUTOINCREMENT, week TEXT, name TEXT, hp INTEGER, max_hp INTEGER, defeated INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS boss_damage (email TEXT, boss_id INTEGER, dmg INTEGER DEFAULT 0, PRIMARY KEY (email, boss_id))",
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  const alters = [
    "ALTER TABLE users ADD COLUMN login_streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN best_streak INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lifetime INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN gacha_count INTEGER DEFAULT 0",
  ];
  for (const a of alters) { try { await env.DB.prepare(a).run(); } catch {} }
}

export async function getUser(env, email, name) {
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

export async function countInv(env, email) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM inventory WHERE email=?").bind(email).first();
  return (r && r.c) || 0;
}

export async function getPower(env, email) {
  const all = allItems();
  const rows = await env.DB.prepare("SELECT item FROM equipped WHERE email=?").bind(email).all();
  let p = 100;
  for (const r of rows.results) if (all[r.item]) p += all[r.item].power;
  return p;
}

export async function bumpMission(env, email, key, val, additive) {
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

export async function grantAch(env, email, key, cond) {
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
export async function getTermsMap(env, origin) {
  if (TERMS_MAP) return TERMS_MAP;
  try {
    const r = await env.ASSETS.fetch(new Request(origin + "/terms.json"));
    const j = await r.json();
    TERMS_MAP = {};
    for (const t of (j.terms || j)) TERMS_MAP[t.term] = t.category;
  } catch {}
  return TERMS_MAP || {};
}

export async function getRegions(env, email, origin) {
  const tm = await getTermsMap(env, origin);
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

export async function checkRegions(env, email, origin) {
  const regions = await getRegions(env, email, origin);
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

export async function getBoss(env, email) {
  const wk = weekKey();
  let b = await env.DB.prepare("SELECT * FROM boss ORDER BY id DESC LIMIT 1").first();
  if (!b || b.week !== wk) {
    const name = BOSS_NAMES[Math.abs(hashCode(wk)) % BOSS_NAMES.length];
    await env.DB.prepare(
      "INSERT INTO boss (week, name, hp, max_hp) VALUES (?, ?, ?, ?)"
    ).bind(wk, name, BOSS_HP, BOSS_HP).run();
    b = await env.DB.prepare("SELECT * FROM boss ORDER BY id DESC LIMIT 1").first();
  }
  let my = 0;
  if (email) {
    const d = await env.DB.prepare(
      "SELECT dmg FROM boss_damage WHERE email=? AND boss_id=?"
    ).bind(email, b.id).first();
    my = d ? d.dmg : 0;
  }
  const c = await env.DB.prepare(
    "SELECT COUNT(DISTINCT email) AS c FROM boss_damage WHERE boss_id=?"
  ).bind(b.id).first();
  return { name: b.name, hp: b.hp, max_hp: b.max_hp, defeated: !!b.defeated, my_dmg: my, attackers: c ? c.c : 0 };
}

export async function damageBoss(env, email, dmg) {
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

export function b64e(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

export function b64d(s) {
  return decodeURIComponent(escape(atob(s)));
}

export async function hmacSha256(secret, msg) {
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

export async function getSecret(env) {
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

export async function verifySession(env, token) {
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

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
