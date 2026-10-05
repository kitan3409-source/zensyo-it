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

export const MISSIONS = {
  ans10: { desc: "10問回答する", goal: 10, bonus: 60 },
  cor15: { desc: "15問正解する", goal: 15, bonus: 100 },
  str8: { desc: "8問連続正解する", goal: 8, bonus: 80 },
};

export function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function ensureGameTables(env) {
  const stmts = [
    "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT, points INTEGER DEFAULT 0, last_login TEXT DEFAULT '', cur_streak INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS inventory (email TEXT, item TEXT, PRIMARY KEY (email, item))",
    "CREATE TABLE IF NOT EXISTS equipped (email TEXT, slot TEXT, item TEXT, PRIMARY KEY (email, slot))",
    "CREATE TABLE IF NOT EXISTS missions (email TEXT, day TEXT, key TEXT, progress INTEGER DEFAULT 0, claimed INTEGER DEFAULT 0, PRIMARY KEY (email, day, key))",
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
}

export async function getUser(env, email, name) {
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

export async function getPower(env, email) {
  const rows = await env.DB.prepare("SELECT item FROM equipped WHERE email=?").bind(email).all();
  let p = 100;
  for (const r of rows.results) if (ITEMS[r.item]) p += ITEMS[r.item].power;
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
