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
    students = [
        {
            "student": r[0],
            "answered": r[1],
            "correct": r[2],
            "rate": round(r[2] / r[1] * 100, 1) if r[1] else 0,
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
