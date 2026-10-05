export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if ((url.searchParams.get("pw") || "") !== (await getPw(env))) {
    return json({ error: "forbidden" }, 403);
  }
  const students = await env.DB.prepare(
    "SELECT student, COUNT(*) AS answered, SUM(correct) AS correct, MAX(ts) AS last_ts FROM answers GROUP BY student ORDER BY last_ts DESC"
  ).all();
  const terms = await env.DB.prepare(
    "SELECT term, COUNT(*) AS answered, SUM(correct) AS correct FROM answers GROUP BY term ORDER BY CAST(SUM(correct) AS REAL)/COUNT(*) ASC"
  ).all();
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
