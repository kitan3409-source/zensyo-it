export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/answer" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      const student = String(b.student || "").trim().slice(0, 50);
      if (!student) return json({ error: "student is required" }, 400);
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
      return json({ ok: true });
    }

    if (url.pathname === "/api/password" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "bad request" }, 400);
      }
      if ((b.pw || "") !== (await getPw(env))) return json({ error: "forbidden" }, 403);
      if (!env.DB) return json({ error: "DB binding がありません" }, 500);
      const np = String(b.new_pw || "").trim();
      if (np.length < 4) return json({ error: "4文字以上にしてください" }, 400);
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
      ).run();
      await env.DB.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('pw', ?)"
      ).bind(np).run();
      return json({ ok: true });
    }

    if (url.pathname === "/api/stats") {
      if ((url.searchParams.get("pw") || "") !== (await getPw(env))) {
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
      return json({
        students: students.results.map((r) => ({
          student: r.student,
          answered: r.answered,
          correct: r.correct,
          rate: rate(r),
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

async function getPw(env) {
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    ).run();
    const r = await env.DB.prepare("SELECT value FROM settings WHERE key='pw'").first();
    return (r && r.value) || env.TEACHER_PW || "sensei";
  } catch {
    return env.TEACHER_PW || "sensei";
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
