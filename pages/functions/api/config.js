export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ client_id: env.GOOGLE_CLIENT_ID || "" }), {
    headers: { "Content-Type": "application/json" },
  });
}
