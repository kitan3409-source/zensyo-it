export const SLOTS = ["head", "body", "lhand", "rhand", "pants", "feet"];

export const GACHA_ITEMS = [
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

export const ALL_ITEMS = {};
for (const i of GACHA_ITEMS) ALL_ITEMS[i.id] = i;

export function levelOf(correct) { return 1 + Math.floor(correct / 20); }
export function basePower(lv) { return 100 + 10 * (lv - 1); }

export function allItems() {
  return ALL_ITEMS;
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
  coll30: { name: "コレクター改", desc: "アイテムを30種所持", bonus: 150 },
  coll50: { name: "アイテム博物館", desc: "アイテムを50種所持", bonus: 300 },
  fulleq: { name: "フル装備", desc: "6スロットすべてに装備", bonus: 100 },
  lv5: { name: "レベル5", desc: "レベル5に到達", bonus: 150 },
  lv10: { name: "レベル10", desc: "レベル10に到達", bonus: 400 },
  sharp: { name: "精密射撃", desc: "30問以上回答で正答率90%以上", bonus: 120 },
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
export function bossHp(tier) { return 20000 * Math.max(1, tier); }

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

let TABLES_READY = false;

export async function ensureGameTables(env) {
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
    "CREATE TABLE IF NOT EXISTS user_extras (email TEXT PRIMARY KEY, acc_ema REAL DEFAULT -1)",
    "CREATE TABLE IF NOT EXISTS daily_stats (date TEXT, student TEXT, correct INTEGER DEFAULT 0, PRIMARY KEY (date, student))",
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
  ];
  for (const m of mig) { try { await env.DB.prepare(m).run(); } catch {} }
  try {
    const ts = await env.DB.prepare("SELECT term FROM term_stats LIMIT 1").first();
    if (!ts) {
      await env.DB.prepare("INSERT OR IGNORE INTO term_stats (term, answered, correct, last_ts) SELECT term, COUNT(*), SUM(correct), MAX(ts) FROM answers GROUP BY term").run();
      await env.DB.prepare("UPDATE users SET last_activity=(SELECT MAX(ts) FROM answers WHERE student LIKE users.email || ' %') WHERE last_activity=0").run();
    }
    const ds = await env.DB.prepare("SELECT date FROM daily_stats LIMIT 1").first();
    if (!ds) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO daily_stats (date, student, correct) " +
        "SELECT date(ts,'unixepoch','+9 hours'), substr(student,1,instr(student||' ',' ')-1), SUM(correct) " +
        "FROM answers GROUP BY 1, 2"
      ).run();
    }
  } catch {}
  TABLES_READY = true;
}

export async function getUser(env, email, name) {
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

export async function countInv(env, email) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM inventory WHERE email=?").bind(email).first();
  return (r && r.c) || 0;
}

export async function getTotals(env, u) {
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

export async function getPower(env, email, correct) {
  const all = allItems();
  const rows = await env.DB.prepare("SELECT item FROM equipped WHERE email=?").bind(email).all();
  let p = basePower(levelOf(correct));
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
    for (const t of (j.terms || j)) TERMS_MAP[t.term || t.q] = t.category;
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
  if (!b || b.defeated) {
    const tier = b && b.max_hp >= 20000 ? Math.floor(b.max_hp / 20000) + 1 : 1;
    const name = BOSS_NAMES[Math.abs(hashCode(wk + "-" + tier)) % BOSS_NAMES.length];
    const hp = bossHp(tier);
    await env.DB.prepare(
      "INSERT INTO boss (week, name, hp, max_hp) VALUES (?, ?, ?, ?)"
    ).bind(wk, name, hp, hp).run();
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
  return { id: b.id, name: b.name, hp: b.hp, max_hp: b.max_hp, defeated: !!b.defeated, my_dmg: my, attackers: c ? c.c : 0, tier: Math.max(1, Math.round((b.max_hp || 0) / 20000)) };
}

export async function damageBoss(env, email, dmg) {
  const b = await getBoss(env, email);
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
    const reward = 150 + 50 * Math.max(1, Math.round((b.max_hp || 0) / 20000));
    for (const p of parts.results) {
      await env.DB.prepare("UPDATE users SET points=points+? WHERE email=?").bind(reward, p.email).run();
    }
    return { killed: true, name: b.name, dmg, reward, tier: Math.max(1, Math.round((b.max_hp || 0) / 20000)) };
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

let SECRET_CACHE = null;

export async function getSecret(env) {
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

let PW_CACHE = { value: null, ts: 0 };

export function clearPwCache() {
  PW_CACHE = { value: null, ts: 0 };
}

export async function pwMatches(env, submitted) {
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
  const [email, name, exp, fp] = payload.split("|");
  if (Number(exp) < Date.now()) return null;
  if (email && !email.includes("@")) {
    try {
      const pr = await env.DB.prepare("SELECT pin FROM pins WHERE email=?").bind(email).first();
      if (!pr || String(pr.pin).slice(0, 12) !== (fp || "")) return null;
    } catch { return null; }
  }
  return { email, name };
}

export async function hashPw(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
