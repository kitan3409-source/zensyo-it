import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import urllib.parse
import urllib.request
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = Path("/data") if Path("/data").is_dir() else BASE_DIR
DB_PATH = DATA_DIR / "quiz.db"
TEACHER_PASSWORD = os.environ.get("TEACHER_PW", "sensei")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
HD_DOMAIN = "gse.okayama-c.ed.jp"

app = FastAPI(title="全商情報処理1級 4択クイズ")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student TEXT NOT NULL,
            term TEXT NOT NULL,
            direction TEXT NOT NULL,
            correct INTEGER NOT NULL,
            ts REAL NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT, points INTEGER DEFAULT 0, last_login TEXT DEFAULT '', cur_streak INTEGER DEFAULT 0)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS inventory (email TEXT, item TEXT, PRIMARY KEY (email, item))"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS equipped (email TEXT, slot TEXT, item TEXT, PRIMARY KEY (email, slot))"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS missions (email TEXT, day TEXT, key TEXT, progress INTEGER DEFAULT 0, claimed INTEGER DEFAULT 0, PRIMARY KEY (email, day, key))"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS achievements (email TEXT, key TEXT, ts REAL, PRIMARY KEY (email, key))"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS boss (id INTEGER PRIMARY KEY AUTOINCREMENT, week TEXT, name TEXT, hp INTEGER, max_hp INTEGER, defeated INTEGER DEFAULT 0)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS boss_damage (email TEXT, boss_id INTEGER, dmg INTEGER DEFAULT 0, PRIMARY KEY (email, boss_id))"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS pins (email TEXT PRIMARY KEY, pin TEXT)"
    )
    for col in ("login_streak", "best_streak", "lifetime", "gacha_count"):
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
    return conn


def get_secret(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT value FROM settings WHERE key='session_secret'").fetchone()
    if row and row[0]:
        return row[0]
    s = secrets.token_hex(16)
    conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('session_secret', ?)", (s,))
    conn.commit()
    return s


def make_token(conn: sqlite3.Connection, email: str, name: str) -> str:
    exp = int((time.time() + 7 * 24 * 3600) * 1000)
    payload = f"{email}|{name}|{exp}"
    sig = hmac.new(get_secret(conn).encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.b64encode(payload.encode()).decode() + "." + sig


def verify_token(conn: sqlite3.Connection, token: str):
    if not token or "." not in token:
        return None
    b64, sig = token.split(".", 1)
    try:
        payload = base64.b64decode(b64).decode()
    except Exception:
        return None
    if hmac.new(get_secret(conn).encode(), payload.encode(), hashlib.sha256).hexdigest() != sig:
        return None
    parts = payload.split("|")
    if len(parts) < 3 or float(parts[2]) < time.time() * 1000:
        return None
    return {"email": parts[0], "name": parts[1]}


ITEMS = {
    "w0": {"name": "ボールペンランス", "slot": "weapon", "power": 5, "price": 20},
    "w1": {"name": "エンピツソード", "slot": "weapon", "power": 10, "price": 50},
    "w2": {"name": "計算機ブレード", "slot": "weapon", "power": 30, "price": 150},
    "w3": {"name": "ルーターハンマー", "slot": "weapon", "power": 50, "price": 250},
    "w4": {"name": "サーバーブレード", "slot": "weapon", "power": 80, "price": 400},
    "w5": {"name": "フレームワークス", "slot": "weapon", "power": 120, "price": 600},
    "w6": {"name": "暗号キーアックス", "slot": "weapon", "power": 150, "price": 800},
    "w7": {"name": "ゼロデイエッジ", "slot": "weapon", "power": 200, "price": 1200},
    "w8": {"name": "量子ブレイド", "slot": "weapon", "power": 250, "price": 1500},
    "w9": {"name": "伝説のフロッピー", "slot": "weapon", "power": 400, "price": 3000},
    "a0": {"name": "ジャージ", "slot": "armor", "power": 5, "price": 25},
    "a1": {"name": "学生服", "slot": "armor", "power": 10, "price": 50},
    "a2": {"name": "ネクタイアーマー", "slot": "armor", "power": 15, "price": 80},
    "a3": {"name": "ビジネススーツ", "slot": "armor", "power": 30, "price": 150},
    "a4": {"name": "ファイアウォールメイル", "slot": "armor", "power": 50, "price": 250},
    "a5": {"name": "デバッグアーマー", "slot": "armor", "power": 80, "price": 400},
    "a6": {"name": "クラウドローブ", "slot": "armor", "power": 120, "price": 600},
    "a7": {"name": "AIアーマー", "slot": "armor", "power": 150, "price": 800},
    "a8": {"name": "エンタープライズ鎧", "slot": "armor", "power": 200, "price": 1200},
    "a9": {"name": "神ゼロアーマー", "slot": "armor", "power": 400, "price": 3000},
    "x0": {"name": "名札バッジ", "slot": "acc", "power": 5, "price": 20},
    "x1": {"name": "鉛筆削りのお守り", "slot": "acc", "power": 10, "price": 40},
    "x2": {"name": "USBメモリ", "slot": "acc", "power": 15, "price": 80},
    "x3": {"name": "カードリーダー", "slot": "acc", "power": 25, "price": 120},
    "x4": {"name": "電卓のお守り", "slot": "acc", "power": 40, "price": 200},
    "x5": {"name": "外付けSSD", "slot": "acc", "power": 60, "price": 300},
    "x6": {"name": "メガネ", "slot": "acc", "power": 80, "price": 350},
    "x7": {"name": "光ファイバー", "slot": "acc", "power": 100, "price": 500},
    "x8": {"name": "電子辞書", "slot": "acc", "power": 150, "price": 700},
    "x9": {"name": "QRコードお守り", "slot": "acc", "power": 220, "price": 1200},
}

GACHA_ITEMS = [
    {"id": "g1", "name": "ペーパーナイフ", "slot": "weapon", "power": 5, "rarity": "N"},
    {"id": "g2", "name": "消しゴムダガー", "slot": "weapon", "power": 8, "rarity": "N"},
    {"id": "gw3", "name": "ホチキスガン", "slot": "weapon", "power": 4, "rarity": "N"},
    {"id": "gw4", "name": "定規ソード", "slot": "weapon", "power": 6, "rarity": "N"},
    {"id": "g3", "name": "鉄のキーボード", "slot": "weapon", "power": 18, "rarity": "R"},
    {"id": "g4", "name": "光るマウス", "slot": "weapon", "power": 25, "rarity": "R"},
    {"id": "gw5", "name": "バーコードブレード", "slot": "weapon", "power": 16, "rarity": "R"},
    {"id": "gw6", "name": "プリンターアックス", "slot": "weapon", "power": 28, "rarity": "R"},
    {"id": "g5", "name": "ファイアウォールブレード", "slot": "weapon", "power": 60, "rarity": "SR"},
    {"id": "gw7", "name": "バイナリハンマー", "slot": "weapon", "power": 50, "rarity": "SR"},
    {"id": "g6", "name": "伝説のサーバー", "slot": "weapon", "power": 150, "rarity": "SSR"},
    {"id": "gw8", "name": "聖剣エクセル", "slot": "weapon", "power": 170, "rarity": "SSR"},
    {"id": "g7", "name": "パーカー", "slot": "armor", "power": 5, "rarity": "N"},
    {"id": "g8", "name": "白衣", "slot": "armor", "power": 8, "rarity": "N"},
    {"id": "ga3", "name": "体操服", "slot": "armor", "power": 4, "rarity": "N"},
    {"id": "ga4", "name": "レインコート", "slot": "armor", "power": 6, "rarity": "N"},
    {"id": "g9", "name": "セキュリティベスト", "slot": "armor", "power": 20, "rarity": "R"},
    {"id": "ga5", "name": "セキュリティジャケット", "slot": "armor", "power": 32, "rarity": "R"},
    {"id": "ga6", "name": "バックアップベスト", "slot": "armor", "power": 16, "rarity": "R"},
    {"id": "g10", "name": "クラウドアーマー", "slot": "armor", "power": 60, "rarity": "SR"},
    {"id": "ga7", "name": "補助記憶アーマー", "slot": "armor", "power": 50, "rarity": "SR"},
    {"id": "g11", "name": "量子スーツ", "slot": "armor", "power": 150, "rarity": "SSR"},
    {"id": "ga8", "name": "時空プロテクター", "slot": "armor", "power": 170, "rarity": "SSR"},
    {"id": "g12", "name": "鉛筆キャップ", "slot": "acc", "power": 5, "rarity": "N"},
    {"id": "gx3", "name": "付箋お守り", "slot": "acc", "power": 4, "rarity": "N"},
    {"id": "gx4", "name": "消しゴムお守り", "slot": "acc", "power": 7, "rarity": "N"},
    {"id": "g13", "name": "クリップ", "slot": "acc", "power": 12, "rarity": "R"},
    {"id": "gx5", "name": "電池パック", "slot": "acc", "power": 14, "rarity": "R"},
    {"id": "gx6", "name": "LANケーブル", "slot": "acc", "power": 30, "rarity": "R"},
    {"id": "g14", "name": "SSD", "slot": "acc", "power": 35, "rarity": "SR"},
    {"id": "g15", "name": "GPUお守り", "slot": "acc", "power": 55, "rarity": "SR"},
    {"id": "g16", "name": "量子チップ", "slot": "acc", "power": 120, "rarity": "SSR"},
    {"id": "gx7", "name": "シンギュラリティチップ", "slot": "acc", "power": 180, "rarity": "SSR"},
]

ALL_ITEMS = dict(ITEMS)
for _i in GACHA_ITEMS:
    ALL_ITEMS[_i["id"]] = _i

MISSIONS = {
    "ans10": {"desc": "10問回答する", "goal": 10, "bonus": 60},
    "cor15": {"desc": "15問正解する", "goal": 15, "bonus": 100},
    "str8": {"desc": "8問連続正解する", "goal": 8, "bonus": 80},
}

ACH = {
    "first": {"name": "はじめの一歩", "desc": "初めて回答した", "bonus": 20},
    "ans50": {"name": "五十問の壁", "desc": "累計50問回答", "bonus": 30},
    "ans100": {"name": "百問の先輩", "desc": "累計100問回答", "bonus": 50},
    "ans300": {"name": "三百問の猛者", "desc": "累計300問回答", "bonus": 100},
    "ans500": {"name": "五百問の仙人", "desc": "累計500問回答", "bonus": 150},
    "streak10": {"name": "十連撃", "desc": "10問連続正解", "bonus": 50},
    "streak20": {"name": "二十連撃", "desc": "20問連続正解", "bonus": 100},
    "streak30": {"name": "無双", "desc": "30問連続正解", "bonus": 200},
    "early": {"name": "朝活", "desc": "朝7時前に回答", "bonus": 30},
    "night": {"name": "夜型人間", "desc": "23時以降に回答", "bonus": 30},
    "rich": {"name": "ポイント長者", "desc": "累計1000pt獲得", "bonus": 80},
    "gacha10": {"name": "ガチャ中毒", "desc": "ガチャを10回まわす", "bonus": 50},
    "ssr": {"name": "神引き", "desc": "SSRを引き当てる", "bonus": 100},
    "boss": {"name": "討伐隊", "desc": "ボス討伐に貢献", "bonus": 80},
    "region1": {"name": "制覇のはじまり", "desc": "分野を1つ制覇", "bonus": 100},
    "login3": {"name": "三日坊主脱却", "desc": "3日連続ログイン", "bonus": 30},
    "login7": {"name": "習慣の天才", "desc": "7日連続ログイン", "bonus": 70},
    "shop5": {"name": "コレクター", "desc": "アイテムを5種所持", "bonus": 50},
}

RANKS = [
    (800, "SS", "情報の神"),
    (400, "S", "電脳賢者"),
    (200, "A", "検定の覇者"),
    (100, "B", "用語マスター"),
    (50, "C", "問題ハンター"),
    (20, "D", "勉強家見習い"),
    (0, "E", "ただの生徒"),
]

BOSS_NAMES = [
    "エラーデーモン", "青画面の魔王ブルースクリーン", "漢字変換バグワーム",
    "メモリリークの巨獣", "404番目の亡霊", "暗黒SQLインジェクタ",
    "フリーズの鬼神", "文字化けモンスター",
]
BOSS_HP = 2000


def rank_of(total: int) -> str:
    for m, label, _ in RANKS:
        if total >= m:
            return label
    return "E"


def next_rank_at(total: int):
    for m, label, _ in reversed(RANKS):
        if m > total:
            return m
    return None


def week_key() -> str:
    d = time.gmtime(time.time() + 9 * 3600)
    jan1 = time.mktime((d.tm_year, 1, 1, 0, 0, 0, 0, 0, 0))
    week = int(((time.mktime(d) - jan1) / 86400 + 1) / 7) + 1
    return f"{d.tm_year}-W{week}"


def get_total(conn: sqlite3.Connection, email: str) -> int:
    r = conn.execute(
        "SELECT COUNT(*) FROM answers WHERE student LIKE ?", (email.split("@")[0] + " %",)
    ).fetchone()
    return r[0] if r else 0


def get_power(conn: sqlite3.Connection, email: str) -> int:
    p = 100
    for (it,) in conn.execute("SELECT item FROM equipped WHERE email=?", (email,)):
        if it in ALL_ITEMS:
            p += ALL_ITEMS[it]["power"]
    return p


def grant_ach(conn: sqlite3.Connection, email: str, key: str, cond: bool):
    if not cond:
        return None
    got = conn.execute("SELECT 1 FROM achievements WHERE email=? AND key=?", (email, key)).fetchone()
    if got:
        return None
    a = ACH[key]
    conn.execute("INSERT OR IGNORE INTO achievements (email, key, ts) VALUES (?, ?, ?)", (email, key, time.time()))
    conn.execute("UPDATE users SET points=points+? WHERE email=?", (a["bonus"], email))
    conn.commit()
    return {"key": key, "name": a["name"], "desc": a["desc"], "bonus": a["bonus"]}


_TERMS_MAP = None

def get_terms_map() -> dict:
    global _TERMS_MAP
    if _TERMS_MAP is not None:
        return _TERMS_MAP
    _TERMS_MAP = {}
    try:
        j = json.loads((STATIC_DIR / "terms.json").read_text())
        for t in j.get("terms", j):
            _TERMS_MAP[t["term"]] = t.get("category", "その他")
    except Exception:
        pass
    return _TERMS_MAP


def get_regions(conn: sqlite3.Connection, email: str):
    tm = get_terms_map()
    cats = {}
    for term, c, s in conn.execute(
        "SELECT term, COUNT(*), SUM(correct) FROM answers WHERE student LIKE ? GROUP BY term",
        (email.split("@")[0] + " %",),
    ):
        cat = tm.get(term, "その他")
        d = cats.setdefault(cat, {"c": 0, "s": 0})
        d["c"] += c
        d["s"] += s or 0
    return [
        {"cat": cat, "answered": v["c"], "rate": round(v["s"] / v["c"] * 100) if v["c"] else 0,
         "cleared": v["c"] >= 8 and v["s"] / v["c"] >= 0.6}
        for cat, v in cats.items()
    ]


def check_regions(conn: sqlite3.Connection, email: str):
    regions = get_regions(conn, email)
    hits = []
    for r in regions:
        if not r["cleared"]:
            continue
        key = "region:" + r["cat"]
        got = conn.execute("SELECT 1 FROM achievements WHERE email=? AND key=?", (email, key)).fetchone()
        if not got:
            conn.execute("INSERT OR IGNORE INTO achievements (email, key, ts) VALUES (?, ?, ?)", (email, key, time.time()))
            conn.execute("UPDATE users SET points=points+100 WHERE email=?", (email,))
            conn.commit()
            hits.append({"key": key, "name": "分野制覇", "desc": f"「{r['cat']}」を制覇", "bonus": 100})
    g = grant_ach(conn, email, "region1", sum(1 for x in regions if x["cleared"]) >= 1)
    if g:
        hits.append(g)
    return hits


def get_boss(conn: sqlite3.Connection, email: str = "") -> dict:
    wk = week_key()
    b = conn.execute("SELECT * FROM boss ORDER BY id DESC LIMIT 1").fetchone()
    if not b or b[1] != wk:
        name = BOSS_NAMES[abs(hash(wk)) % len(BOSS_NAMES)]
        conn.execute("INSERT INTO boss (week, name, hp, max_hp) VALUES (?, ?, ?, ?)", (wk, name, BOSS_HP, BOSS_HP))
        conn.commit()
        b = conn.execute("SELECT * FROM boss ORDER BY id DESC LIMIT 1").fetchone()
    my = 0
    if email:
        d = conn.execute("SELECT dmg FROM boss_damage WHERE email=? AND boss_id=?", (email, b[0])).fetchone()
        my = d[0] if d else 0
    c = conn.execute("SELECT COUNT(DISTINCT email) FROM boss_damage WHERE boss_id=?", (b[0],)).fetchone()
    return {"name": b[2], "hp": b[3], "max_hp": b[4], "defeated": bool(b[5]), "my_dmg": my, "attackers": c[0] if c else 0}


def damage_boss(conn: sqlite3.Connection, email: str, dmg: int):
    wk = week_key()
    b = conn.execute("SELECT * FROM boss WHERE week=?", (wk,)).fetchone()
    if not b or b[5]:
        return None
    new_hp = max(0, b[3] - dmg)
    conn.execute("UPDATE boss SET hp=? WHERE id=?", (new_hp, b[0]))
    conn.execute(
        "INSERT INTO boss_damage (email, boss_id, dmg) VALUES (?, ?, ?) ON CONFLICT(email, boss_id) DO UPDATE SET dmg=dmg+excluded.dmg",
        (email, b[0], dmg),
    )
    conn.commit()
    if new_hp == 0:
        conn.execute("UPDATE boss SET defeated=1 WHERE id=?", (b[0],))
        for (e,) in conn.execute("SELECT email FROM boss_damage WHERE boss_id=?", (b[0],)):
            conn.execute("UPDATE users SET points=points+200 WHERE email=?", (e,))
        conn.commit()
        return {"killed": True, "name": b[2], "dmg": dmg}
    return {"killed": False, "dmg": dmg, "hp": new_hp}


def today_jst() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 9 * 3600))


def get_user(conn: sqlite3.Connection, email: str, name: str) -> dict:
    row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not row:
        conn.execute("INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)", (email, name))
        conn.commit()
        return {"email": email, "name": name, "points": 0, "last_login": "", "cur_streak": 0,
                "login_streak": 0, "best_streak": 0, "lifetime": 0, "gacha_count": 0}
    cols = ["email", "name", "points", "last_login", "cur_streak",
            "login_streak", "best_streak", "lifetime", "gacha_count"]
    u = dict(zip(cols, row))
    if name and name != u["name"]:
        conn.execute("UPDATE users SET name=? WHERE email=?", (name, email))
        conn.commit()
        u["name"] = name
    return u


def bump_mission(conn: sqlite3.Connection, email: str, key: str, val: int, additive: bool):
    day = today_jst()
    m = MISSIONS[key]
    row = conn.execute(
        "SELECT progress, claimed FROM missions WHERE email=? AND day=? AND key=?",
        (email, day, key),
    ).fetchone()
    if not row:
        conn.execute(
            "INSERT INTO missions (email, day, key, progress, claimed) VALUES (?, ?, ?, ?, 0)",
            (email, day, key, min(val, m["goal"])),
        )
        conn.commit()
        progress, claimed = min(val, m["goal"]), 0
    else:
        progress, claimed = row
        if not claimed and progress < m["goal"]:
            np = min(m["goal"], progress + val if additive else val)
            conn.execute(
                "UPDATE missions SET progress=? WHERE email=? AND day=? AND key=?",
                (np, email, day, key),
            )
            conn.commit()
            progress = np
    if not claimed and progress >= m["goal"]:
        conn.execute(
            "UPDATE missions SET claimed=1 WHERE email=? AND day=? AND key=?",
            (email, day, key),
        )
        conn.execute("UPDATE users SET points=points+? WHERE email=?", (m["bonus"], email))
        conn.commit()
        return {"desc": m["desc"], "bonus": m["bonus"]}
    return None


def pw_matches(conn: sqlite3.Connection, submitted: str) -> bool:
    row = conn.execute("SELECT value FROM settings WHERE key='pw'").fetchone()
    if row and row[0]:
        return row[0] in (hashlib.sha256(submitted.encode()).hexdigest(), submitted)
    return submitted == TEACHER_PASSWORD


class AnswerIn(BaseModel):
    token: str
    term: str
    direction: str
    correct: bool


@app.get("/api/config")
def get_config():
    return {"client_id": GOOGLE_CLIENT_ID}


class LoginIn(BaseModel):
    credential: str


@app.post("/api/login")
def post_login(l: LoginIn):
    try:
        url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(l.credential)
        with urllib.request.urlopen(url, timeout=10) as r:
            t = json.loads(r.read())
    except Exception:
        raise HTTPException(401, "Googleログインに失敗しました")
    if t.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(401, "client_id が一致しません")
    if t.get("hd") != HD_DOMAIN:
        raise HTTPException(403, "学校のアカウント（@gse.okayama-c.ed.jp）でログインしてください")
    conn = get_db()
    name = t.get("name", "")
    tok = make_token(conn, t["email"], name)
    conn.close()
    return {"token": tok, "display": f"{t['email'].split('@')[0]} {name}"}


@app.post("/api/answer")
def post_answer(a: AnswerIn):
    conn = get_db()
    sess = verify_token(conn, a.token)
    if not sess:
        conn.close()
        raise HTTPException(401, "ログインしてください")
    student = f"{sess['email'].split('@')[0]} {sess['name']}"[:50]
    conn.execute(
        "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)",
        (student, a.term[:200], a.direction[:10], int(a.correct), time.time()),
    )
    conn.commit()
    u = get_user(conn, sess["email"], sess["name"])
    streak = (u["cur_streak"] or 0) + 1 if a.correct else 0
    power = get_power(conn, sess["email"])
    combo = min(streak * 2, 20) if a.correct and streak >= 3 else 0
    earned = (10 if a.correct else 2) + combo
    conn.execute(
        "UPDATE users SET points=points+?, lifetime=lifetime+?, cur_streak=?, best_streak=MAX(COALESCE(best_streak,0),?) WHERE email=?",
        (earned, earned, streak, streak, sess["email"]),
    )
    conn.commit()
    done = []
    for key, val, additive in ([("ans10", 1, True)] + ([("cor15", 1, True), ("str8", streak, False)] if a.correct else [])):
        m = bump_mission(conn, sess["email"], key, val, additive)
        if m:
            done.append(m)
    boss_res = damage_boss(conn, sess["email"], 1 + power // 80) if a.correct else None
    total = get_total(conn, sess["email"])
    hour = time.gmtime(time.time() + 9 * 3600).tm_hour
    new_ach = []
    for k, cond in [
        ("first", total >= 1), ("ans50", total >= 50), ("ans100", total >= 100),
        ("ans300", total >= 300), ("ans500", total >= 500),
        ("streak10", streak >= 10), ("streak20", streak >= 20), ("streak30", streak >= 30),
        ("early", hour < 7), ("night", hour >= 23),
        ("rich", (u["lifetime"] or 0) + earned >= 1000),
        ("boss", bool(boss_res and boss_res.get("killed"))),
    ]:
        g = grant_ach(conn, sess["email"], k, cond)
        if g:
            new_ach.append(g)
    new_ach.extend(check_regions(conn, sess["email"]))
    points = (u["points"] or 0) + earned + sum(x["bonus"] for x in done) + sum(x["bonus"] for x in new_ach) + (200 if boss_res and boss_res.get("killed") else 0)
    conn.close()
    return {
        "ok": True, "earned": earned, "combo": combo, "points": points,
        "missions_done": done, "ach_new": new_ach,
        "total": total, "rank": rank_of(total),
        "rank_up": rank_of(total) if rank_of(total) != rank_of(total - 1) else None,
        "boss": boss_res,
    }


@app.get("/api/me")
def get_me(token: str = ""):
    conn = get_db()
    sess = verify_token(conn, token)
    if not sess:
        conn.close()
        raise HTTPException(401, "ログインしてください")
    u = get_user(conn, sess["email"], sess["name"])
    today = today_jst()
    bonus = 0
    if u["last_login"] != today:
        y = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 9 * 3600 - 86400))
        streak = (u["login_streak"] or 0) + 1 if u["last_login"] == y else 1
        bonus = 30 + min(streak * 5, 50)
        conn.execute("UPDATE users SET last_login=?, login_streak=?, points=points+? WHERE email=?", (today, streak, bonus, sess["email"]))
        conn.commit()
        u["points"] += bonus
        u["last_login"] = today
        u["login_streak"] = streak
        grant_ach(conn, sess["email"], "login3", streak >= 3)
        grant_ach(conn, sess["email"], "login7", streak >= 7)
    inv = [r[0] for r in conn.execute("SELECT item FROM inventory WHERE email=?", (sess["email"],))]
    equipped = {r[0]: r[1] for r in conn.execute("SELECT slot, item FROM equipped WHERE email=?", (sess["email"],))}
    ms = {r[0]: (r[1], r[2]) for r in conn.execute("SELECT key, progress, claimed FROM missions WHERE email=? AND day=?", (sess["email"], today))}
    unlocked = [r[0] for r in conn.execute("SELECT key FROM achievements WHERE email=?", (sess["email"],))]
    total = get_total(conn, sess["email"])
    power = get_power(conn, sess["email"])
    regions = get_regions(conn, sess["email"])
    boss = get_boss(conn, sess["email"])
    streak = u["login_streak"] or 0
    conn.close()
    return {
        "display": f"{sess['email'].split('@')[0]} {sess['name']}",
        "points": u["points"],
        "power": power,
        "total": total,
        "rank": rank_of(total),
        "next_at": next_rank_at(total),
        "streak": streak,
        "equipped": equipped,
        "inventory": inv,
        "missions": [
            {"key": k, "desc": m["desc"], "goal": m["goal"], "bonus": m["bonus"],
             "progress": ms.get(k, (0, 0))[0], "claimed": ms.get(k, (0, 0))[1]}
            for k, m in MISSIONS.items()
        ],
        "achievements": ACH,
        "unlocked": unlocked,
        "regions": regions,
        "boss": boss,
        "login_bonus": bonus,
        "items": ITEMS,
        "gacha": GACHA_ITEMS,
    }


class BuyIn(BaseModel):
    token: str
    item: str


@app.post("/api/buy")
def post_buy(b: BuyIn):
    conn = get_db()
    sess = verify_token(conn, b.token)
    if not sess:
        conn.close()
        raise HTTPException(401, "ログインしてください")
    item = ITEMS.get(b.item)
    if not item:
        conn.close()
        raise HTTPException(400, "アイテムがありません")
    u = get_user(conn, sess["email"], sess["name"])
    owned = conn.execute("SELECT 1 FROM inventory WHERE email=? AND item=?", (sess["email"], b.item)).fetchone()
    if owned:
        conn.close()
        raise HTTPException(400, "もう持ってます")
    if u["points"] < item["price"]:
        conn.close()
        raise HTTPException(400, f"ポイントが足りません（{item['price']}pt必要）")
    conn.execute("UPDATE users SET points=points-? WHERE email=?", (item["price"], sess["email"]))
    conn.execute("INSERT INTO inventory (email, item) VALUES (?, ?)", (sess["email"], b.item))
    conn.commit()
    cnt = conn.execute("SELECT COUNT(*) FROM inventory WHERE email=?", (sess["email"],)).fetchone()[0]
    grant_ach(conn, sess["email"], "shop5", cnt >= 5)
    conn.close()
    return {"ok": True, "points": u["points"] - item["price"]}


class EquipIn(BaseModel):
    token: str
    slot: str
    item: str = ""


@app.post("/api/equip")
def post_equip(e: EquipIn):
    conn = get_db()
    sess = verify_token(conn, e.token)
    if not sess:
        conn.close()
        raise HTTPException(401, "ログインしてください")
    if e.slot not in ("weapon", "armor", "acc"):
        conn.close()
        raise HTTPException(400, "bad slot")
    if e.item:
        it = ALL_ITEMS.get(e.item)
        if not it or it["slot"] != e.slot:
            conn.close()
            raise HTTPException(400, "bad item")
        owned = conn.execute("SELECT 1 FROM inventory WHERE email=? AND item=?", (sess["email"], e.item)).fetchone()
        if not owned:
            conn.close()
            raise HTTPException(400, "持っていません")
        conn.execute(
            "INSERT INTO equipped (email, slot, item) VALUES (?, ?, ?) ON CONFLICT(email, slot) DO UPDATE SET item=excluded.item",
            (sess["email"], e.slot, e.item),
        )
    else:
        conn.execute("DELETE FROM equipped WHERE email=? AND slot=?", (sess["email"], e.slot))
    conn.commit()
    power = get_power(conn, sess["email"])
    conn.close()
    return {"ok": True, "power": power}


@app.get("/api/ranking")
def get_ranking(token: str = ""):
    conn = get_db()
    sess = verify_token(conn, token)
    if not sess:
        conn.close()
        raise HTTPException(401, "ログインしてください")
    users = conn.execute("SELECT email, name, points, login_streak FROM users").fetchall()
    eqs = conn.execute("SELECT email, item FROM equipped").fetchall()
    tot_map = {}
    name_map = {}
    for s, c in conn.execute("SELECT student, COUNT(*) FROM answers GROUP BY student"):
        sid = str(s).split(" ")[0]
        tot_map[sid] = c
        name_map[sid] = " ".join(str(s).split(" ")[1:])
    week_map = {}
    for s, c, sc in conn.execute(
        "SELECT student, COUNT(*), SUM(correct) FROM answers WHERE ts >= ? GROUP BY student",
        (time.time() - 7 * 86400,),
    ):
        week_map[str(s).split(" ")[0]] = (sc or 0) * 8 + c * 2
    conn.close()
    power_map = {e: 100 for e, _, _, _ in users}
    for e, it in eqs:
        if it in ALL_ITEMS and e in power_map:
            power_map[e] += ALL_ITEMS[it]["power"]
    lst = [
        {"id": e.split("@")[0], "name": n or name_map.get(e.split("@")[0], ""),
         "power": power_map[e], "points": p, "streak": st or 0,
         "total": tot_map.get(e.split("@")[0], 0),
         "weekly": week_map.get(e.split("@")[0], 0),
         "rank": rank_of(tot_map.get(e.split("@")[0], 0))}
        for e, n, p, st in users
    ]
    return {
        "power": sorted(lst, key=lambda x: (-x["power"], -x["points"]))[:30],
        "weekly": sorted(lst, key=lambda x: -x["weekly"])[:30],
        "rank": sorted(lst, key=lambda x: -x["total"])[:30],
        "streak": sorted(lst, key=lambda x: -x["streak"])[:30],
        "me": sess["email"].split("@")[0],
    }


class GachaIn(BaseModel):
    token: str


@app.post("/api/gacha")
def post_gacha(g: GachaIn):
    conn = get_db()
    sess = verify_token(conn, g.token)
    if not sess:
        conn.close()
        raise HTTPException(401, "ログインしてください")
    u = get_user(conn, sess["email"], sess["name"])
    COST = 100
    if u["points"] < COST:
        conn.close()
        raise HTTPException(400, f"ポイントが足りません（{COST}pt必要）")
    roll = secrets.randbelow(1000) / 1000
    rarity = "N" if roll < 0.6 else "R" if roll < 0.9 else "SR" if roll < 0.99 else "SSR"
    pool = [i for i in GACHA_ITEMS if i["rarity"] == rarity]
    item = pool[secrets.randbelow(len(pool))]
    owned = conn.execute("SELECT 1 FROM inventory WHERE email=? AND item=?", (sess["email"], item["id"])).fetchone()
    refund = 50 if owned else 0
    if not owned:
        conn.execute("INSERT INTO inventory (email, item) VALUES (?, ?)", (sess["email"], item["id"]))
    conn.execute("UPDATE users SET points=points-?+?, gacha_count=gacha_count+1 WHERE email=?", (COST, refund, sess["email"]))
    conn.commit()
    cnt = conn.execute("SELECT COUNT(*) FROM inventory WHERE email=?", (sess["email"],)).fetchone()[0]
    new_ach = [x for x in [
        grant_ach(conn, sess["email"], "gacha10", (u["gacha_count"] or 0) + 1 >= 10),
        grant_ach(conn, sess["email"], "ssr", rarity == "SSR"),
        grant_ach(conn, sess["email"], "shop5", cnt >= 5),
    ] if x]
    conn.close()
    return {
        "ok": True, "item": item, "dup": bool(owned), "refund": refund,
        "points": u["points"] - COST + refund + sum(x["bonus"] for x in new_ach),
        "ach_new": new_ach,
    }


class StudentLoginIn(BaseModel):
    cls: str = ""
    num: str = ""
    name: str = ""
    pin: str = ""


@app.post("/api/student_login")
def post_student_login(s: StudentLoginIn):
    sid = re.sub(r"[|@\s]", "", f"{s.cls}-{s.num}")[:24]
    name = s.name.replace("|", "").strip()[:30]
    if not sid or sid == "-" or not name:
        raise HTTPException(400, "クラス・番号・名前を入れてください")
    if len(s.pin) < 4:
        raise HTTPException(400, "PINは4文字以上にしてください")
    conn = get_db()
    stored = conn.execute("SELECT pin FROM pins WHERE email=?", (sid,)).fetchone()
    h = hashlib.sha256(s.pin.encode()).hexdigest()
    if stored:
        if stored[0] != h:
            conn.close()
            raise HTTPException(403, "PINが違います（忘れたら先生にリセットしてもらって）")
    else:
        conn.execute("INSERT INTO pins (email, pin) VALUES (?, ?)", (sid, h))
        conn.commit()
    tok = make_token(conn, sid, name)
    conn.close()
    return {"token": tok, "display": f"{sid} {name}"}


class PinResetIn(BaseModel):
    pw: str
    sid: str


@app.post("/api/pin_reset")
def post_pin_reset(p: PinResetIn):
    conn = get_db()
    if not pw_matches(conn, p.pw):
        conn.close()
        raise HTTPException(403, "forbidden")
    conn.execute("DELETE FROM pins WHERE email=?", (p.sid[:24],))
    conn.commit()
    conn.close()
    return {"ok": True}


class PasswordIn(BaseModel):
    pw: str
    new_pw: str


@app.post("/api/password")
def post_password(p: PasswordIn):
    conn = get_db()
    if not pw_matches(conn, p.pw):
        conn.close()
        raise HTTPException(403, "forbidden")
    np = p.new_pw.strip()
    if len(np) < 4:
        conn.close()
        raise HTTPException(400, "4文字以上にしてください")
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('pw', ?)",
        (hashlib.sha256(np.encode()).hexdigest(),),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/stats")
def get_stats(pw: str = ""):
    conn = get_db()
    if not pw_matches(conn, pw):
        conn.close()
        raise HTTPException(403, "forbidden")
    pt_map = {}
    pw_map = {}
    streak_map = {}
    for e, p, st in conn.execute("SELECT email, points, login_streak FROM users"):
        pt_map[e.split("@")[0]] = p
        pw_map[e.split("@")[0]] = 100
        streak_map[e.split("@")[0]] = st
    for e, it in conn.execute("SELECT email, item FROM equipped"):
        k = e.split("@")[0]
        if it in ALL_ITEMS and k in pw_map:
            pw_map[k] += ALL_ITEMS[it]["power"]
    students = [
        {
            "student": r[0],
            "answered": r[1],
            "correct": r[2],
            "rate": round(r[2] / r[1] * 100, 1) if r[1] else 0,
            "points": pt_map.get(str(r[0]).split(" ")[0], 0),
            "power": pw_map.get(str(r[0]).split(" ")[0], 100),
            "rank": rank_of(r[1]),
            "streak": streak_map.get(str(r[0]).split(" ")[0], 0),
            "last_ts": r[3],
        }
        for r in conn.execute(
            "SELECT student, COUNT(*), SUM(correct), MAX(ts) FROM answers GROUP BY student ORDER BY MAX(ts) DESC"
        )
    ]
    terms = [
        {
            "term": r[0],
            "answered": r[1],
            "correct": r[2],
            "rate": round(r[2] / r[1] * 100, 1) if r[1] else 0,
        }
        for r in conn.execute(
            "SELECT term, COUNT(*), SUM(correct) FROM answers GROUP BY term ORDER BY CAST(SUM(correct) AS REAL)/COUNT(*) ASC"
        )
    ]
    boss = get_boss(conn)
    conn.close()
    return {"students": students, "terms": terms, "boss": boss}


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/teacher")
def teacher():
    return FileResponse(STATIC_DIR / "teacher.html")


@app.get("/terms")
def terms():
    return FileResponse(STATIC_DIR / "terms.json")
