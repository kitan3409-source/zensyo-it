import os
import sqlite3
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = Path("/data") if Path("/data").is_dir() else BASE_DIR
DB_PATH = DATA_DIR / "quiz.db"
TEACHER_PASSWORD = os.environ.get("TEACHER_PW", "sensei")

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
    return conn


class AnswerIn(BaseModel):
    student: str
    term: str
    direction: str
    correct: bool


@app.post("/api/answer")
def post_answer(a: AnswerIn):
    student = a.student.strip()[:50]
    if not student:
        raise HTTPException(400, "student is required")
    conn = get_db()
    conn.execute(
        "INSERT INTO answers (student, term, direction, correct, ts) VALUES (?, ?, ?, ?, ?)",
        (student, a.term[:200], a.direction[:10], int(a.correct), time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/stats")
def get_stats(pw: str = ""):
    if pw != TEACHER_PASSWORD:
        raise HTTPException(403, "forbidden")
    conn = get_db()
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
