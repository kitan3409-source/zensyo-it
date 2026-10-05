import base64
import hashlib
import hmac
import json
import os
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
    "w1": {"name": "エンピツソード", "slot": "weapon", "power": 10, "price": 50},
    "w2": {"name": "計算機ブレード", "slot": "weapon", "power": 30, "price": 150},
    "w3": {"name": "サーバーブレード", "slot": "weapon", "power": 80, "price": 400},
    "a1": {"name": "学生服", "slot": "armor", "power": 10, "price": 50},
    "a2": {"name": "ビジネススーツ", "slot": "armor", "power": 30, "price": 150},
    "a3": {"name": "デバッグアーマー", "slot": "armor", "power": 80, "price": 400},
    "x1": {"name": "USBメモリ", "slot": "acc", "power": 15, "price": 80},
    "x2": {"name": "電卓のお守り", "slot": "acc", "power": 40, "price": 200},
    "x3": {"name": "光ファイバー", "slot": "acc", "power": 100, "price": 500},
}

MISSIONS = {
    "ans10": {"desc": "10問回答する", "goal": 10, "bonus": 60},
    "cor15": {"desc": "15問正解する", "goal": 15, "bonus": 100},
    "str8": {"desc": "8問連続正解する", "goal": 8, "bonus": 80},
}


def today_jst() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 9 * 3600))


def get_user(conn: sqlite3.Connection, email: str, name: str) -> dict:
    row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not row:
        conn.execute("INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)", (email, name))
        conn.commit()
        return {"email": email, "name": name, "points": 0, "last_login": "", "cur_streak": 0}
    u = dict(zip(["email", "name", "points", "last_login", "cur_streak"], row))
    if name and name != u["name"]:
        conn.execute("UPDATE users SET name=? WHERE email=?", (name, email))
        conn.commit()
        u["name"] = name
    return u


def get_power(conn: sqlite3.Connection, email: str) -> int:
    rows = conn.execute("SELECT item FROM equipped WHERE email=?", (email,)).fetchall()
    p = 100
    for (it,) in rows:
        if it in ITEMS:
            p += ITEMS[it]["power"]
    return p


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
        raise HTTPException(401, "Googleログインしてください")
    student = f"{sess['email'].split('@')[0]} {sess['name']}"[:50]
    conn.execute(
        "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)",
        (student, a.term[:200], a.direction[:10], int(a.correct), time.time()),
    )
    conn.commit()
    earned = 10 if a.correct else 2
    u = get_user(conn, sess["email"], sess["name"])
    streak = (u["cur_streak"] or 0) + 1 if a.correct else 0
    conn.execute("UPDATE users SET points=points+?, cur_streak=? WHERE email=?", (earned, streak, sess["email"]))
    conn.commit()
    done = []
    for key, val, additive in ([("ans10", 1, True)] + ([("cor15", 1, True), ("str8", streak, False)] if a.correct else [])):
        m = bump_mission(conn, sess["email"], key, val, additive)
        if m:
            done.append(m)
    points = (u["points"] or 0) + earned + sum(x["bonus"] for x in done)
    conn.close()
    return {"ok": True, "earned": earned, "points": points, "missions_done": done}


@app.get("/api/me")
def get_me(token: str = ""):
    conn = get_db()
    sess = verify_token(conn, token)
    if not sess:
        conn.close()
        raise HTTPException(401, "Googleログインしてください")
    u = get_user(conn, sess["email"], sess["name"])
    today = today_jst()
    bonus = 0
    if u["last_login"] != today:
        bonus = 30
        conn.execute("UPDATE users SET last_login=?, points=points+30 WHERE email=?", (today, sess["email"]))
        conn.commit()
        u["points"] += 30
    inv = [r[0] for r in conn.execute("SELECT item FROM inventory WHERE email=?", (sess["email"],))]
    equipped = {r[0]: r[1] for r in conn.execute("SELECT slot, item FROM equipped WHERE email=?", (sess["email"],))}
    ms = {r[0]: (r[1], r[2]) for r in conn.execute("SELECT key, progress, claimed FROM missions WHERE email=? AND day=?", (sess["email"], today))}
    power = get_power(conn, sess["email"])
    conn.close()
    return {
        "display": f"{sess['email'].split('@')[0]} {sess['name']}",
        "points": u["points"],
        "power": power,
        "equipped": equipped,
        "inventory": inv,
        "missions": [
            {"key": k, "desc": m["desc"], "goal": m["goal"], "bonus": m["bonus"],
             "progress": ms.get(k, (0, 0))[0], "claimed": ms.get(k, (0, 0))[1]}
            for k, m in MISSIONS.items()
        ],
        "login_bonus": bonus,
        "items": ITEMS,
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
        raise HTTPException(401, "Googleログインしてください")
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
        raise HTTPException(401, "Googleログインしてください")
    if e.slot not in ("weapon", "armor", "acc"):
        conn.close()
        raise HTTPException(400, "bad slot")
    if e.item:
        it = ITEMS.get(e.item)
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
        raise HTTPException(401, "Googleログインしてください")
    users = conn.execute("SELECT email, name, points FROM users").fetchall()
    eqs = conn.execute("SELECT email, item FROM equipped").fetchall()
    conn.close()
    power_map = {e: 100 for e, _, _ in users}
    for e, it in eqs:
        if it in ITEMS and e in power_map:
            power_map[e] += ITEMS[it]["power"]
    lst = sorted(
        ({"id": e.split("@")[0], "name": n, "power": power_map[e], "points": p} for e, n, p in users),
        key=lambda x: (-x["power"], -x["points"]),
    )[:30]
    return {"ranking": lst, "me": sess["email"].split("@")[0]}


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
    for e, p in conn.execute("SELECT email, points FROM users"):
        pt_map[e.split("@")[0]] = p
        pw_map[e.split("@")[0]] = 100
    for e, it in conn.execute("SELECT email, item FROM equipped"):
        k = e.split("@")[0]
        if it in ITEMS and k in pw_map:
            pw_map[k] += ITEMS[it]["power"]
    students = [
        {
            "student": r[0],
            "answered": r[1],
            "correct": r[2],
            "rate": round(r[2] / r[1] * 100, 1) if r[1] else 0,
            "points": pt_map.get(str(r[0]).split(" ")[0], 0),
            "power": pw_map.get(str(r[0]).split(" ")[0], 100),
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
    conn.close()
    return {"students": students, "terms": terms}


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/teacher")
def teacher():
    return FileResponse(STATIC_DIR / "teacher.html")


@app.get("/terms")
def terms():
    return FileResponse(STATIC_DIR / "terms.json")
