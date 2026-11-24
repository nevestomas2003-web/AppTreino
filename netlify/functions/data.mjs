import { neon } from "@neondatabase/serverless";

export const config = { path: "/api/data" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const appKey = Netlify.env.get("APP_KEY");
  const dbUrl = Netlify.env.get("DATABASE_URL");
  if (!appKey || !dbUrl) return json({ error: "not configured" }, 500);
  if (req.headers.get("x-app-key") !== appKey) return json({ error: "unauthorized" }, 401);

  const sql = neon(dbUrl);
  try {
    await sql`CREATE TABLE IF NOT EXISTS tracker (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    if (req.method === "GET") {
      const rows = await sql`SELECT data FROM tracker WHERE id = 'main'`;
      return json({ data: rows.length ? rows[0].data : null });
    }
    if (req.method === "PUT") {
      const body = await req.json();
      if (!body || typeof body.data !== "object") return json({ error: "bad body" }, 400);
      const s = JSON.stringify(body.data);
      await sql`INSERT INTO tracker (id, data, updated_at) VALUES ('main', ${s}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      return json({ ok: true });
    }
    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: "db error" }, 500);
  }
};
