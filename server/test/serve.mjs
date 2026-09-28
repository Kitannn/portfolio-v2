// Runs the Worker on localhost so the real client can talk to it, with no Cloudflare account and
// nothing installed — same D1-over-node:sqlite shim as harness.mjs, wrapped in a plain HTTP server.
//
//   node server/test/serve.mjs [port]
//
// Then, in the arcade page's console:
//   localStorage.setItem("hkitandrun.endpoint", "http://localhost:8787"); location.reload();
//
// This is a development convenience, not the deployment. The real thing is `wrangler deploy` —
// see server/README.md.
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../src/worker.js";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 8787);

function makeD1(db) {
  const prepare = (sql) => {
    let params = [];
    const stmt = {
      bind(...a) { params = a; return stmt; },
      async run() { db.prepare(sql).run(...params); return { success: true }; },
      async first() { return db.prepare(sql).get(...params) ?? null; },
      async all() { return { results: db.prepare(sql).all(...params) }; },
      _exec() { db.prepare(sql).run(...params); },
    };
    return stmt;
  };
  return {
    prepare,
    async batch(stmts) { for (const s of stmts) s._exec(); return stmts.map(() => ({ success: true })); },
  };
}

const db = new DatabaseSync(join(here, "dev.sqlite"));
db.exec(readFileSync(join(here, "..", "schema.sql"), "utf8"));
const env = { DB: makeD1(db), IP_SALT: "dev-salt", STATS_KEY: "dev-stats-key" };

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  // node:http gives no client IP worth rate-limiting in dev, so every request looks like one
  // machine — which is exactly what it is.
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  headers.set("cf-connecting-ip", req.socket.remoteAddress || "127.0.0.1");

  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });

  const out = await worker.fetch(request, env);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => {
  console.log(`leaderboard worker on http://localhost:${port}`);
  console.log(`db: ${join(here, "dev.sqlite")}`);
});
