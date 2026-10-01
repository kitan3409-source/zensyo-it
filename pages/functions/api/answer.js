export async function onRequestPost({ request, env }) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const student = String(b.student || "").trim().slice(0, 50);
  if (!student) return json({ error: "student is required" }, 400);
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
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
