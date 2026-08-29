/**
 * Cloudflare Pages Functions API: /api/delete
 * Delete Endpoint for Kwitansi D1 SQL Database
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { id } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });
    }

    await env.DB.prepare("DELETE FROM kwitansi WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
