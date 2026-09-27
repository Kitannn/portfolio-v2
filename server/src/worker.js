// HKIT AND RUN — online leaderboard.
//
// A single Cloudflare Worker over one D1 (SQLite) table set. Deliberately nothing else: no Durable
// Objects, no Queues, no R2, no cron. Those are the pieces that can pull an account onto a paid
// plan, and this is meant to sit inside the Workers free tier forever — 100k requests a day, and
// D1's 5 GB / 5M row reads / 100k row writes.
//
// The client is a static page on GitHub Pages with no secrets in it, so this endpoint is public by
// design. That means every rule that matters has to be enforced HERE. The two that decide whether a
// board is worth reading — is this name acceptable, and is this run physically possible — are
// imported from the game's own source rather than reimplemented, so the server can never quietly
// disagree with the client about either.
import { checkName, MIN, MAX } from "../../arcade/src/name-filter.js";
import { implausible, inconsistent } from "../../arcade/src/run-bounds.js";

// Categories the board ranks. `deaths` is a lifetime tally on the player rather than a run best,
// which is why it is marked and queried differently.
const CATEGORIES = {
  time:   { column: "value", lifetime: false },
  kills:  { column: "value", lifetime: false },
  damage: { column: "value", lifetime: false },
  level:  { column: "value", lifetime: false },
  deaths: { column: "deaths", lifetime: true },
};
const TOP_N = 10;

// Writes per window, by IP and by player. Generous enough that nobody playing normally will ever
// see one, tight enough that a loop with curl gives up.
const IP_WRITES = 30, IP_WINDOW = 600;         // 30 writes per 10 minutes from one address
const PLAYER_WRITES = 6, PLAYER_WINDOW = 60;   // a run takes minutes; six a minute is already absurd

const ALLOWED_ORIGINS = [
  "https://kitannn.com",
  "https://www.kitannn.com",
  "https://kitannn.github.io",
];
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const now = () => Math.floor(Date.now() / 1000);

function cors(origin) {
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN.test(origin)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...cors(origin) },
});

// The IP is never stored. It is hashed with a per-deployment secret purely so the rate limiter can
// count without the table becoming a list of who played.
async function ipKey(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const data = new TextEncoder().encode(`${env.IP_SALT || "hkitandrun"}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 10)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A fixed-window counter in D1. Cruder than a sliding window and a great deal cheaper: one upsert
// and one read, no extra service, and the worst case is that someone gets a few extra writes at a
// window boundary. That is an entirely acceptable trade for a leaderboard.
async function rateLimit(env, kind, key, limit, window) {
  const bucket = Math.floor(now() / window);
  const k = `${kind}:${key}:${bucket}`;
  await env.DB.prepare(
    "INSERT INTO rate (k, n, expires) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + 1"
  ).bind(k, (bucket + 2) * window).run();
  const row = await env.DB.prepare("SELECT n FROM rate WHERE k = ?1").bind(k).first();
  return (row?.n || 0) <= limit;
}

// Old counters are swept lazily on writes rather than by a cron trigger, so the deployment stays a
// single Worker with nothing scheduled behind it.
async function sweep(env) {
  if (Math.random() > 0.02) return;
  await env.DB.prepare("DELETE FROM rate WHERE expires < ?1").bind(now()).run();
}

// Locale comes from the client's own browser, so it is a claim rather than a fact — it is shaped
// and length-capped here and otherwise taken at face value. It only decorates a name.
function cleanLocale(raw) {
  const s = String(raw || "en").replace(/[^A-Za-z0-9_]/g, "").slice(0, 8);
  return /^[a-z]{2,3}(_[A-Z0-9]{2,3})?$/.test(s) ? s : "en";
}

// ---- register -------------------------------------------------------------------
// Issues the player id the client uses to submit, and — the whole reason this has to be a server
// job — the authoritative discriminator. Only something that can see every other player knows
// whether this is the first kitannn or the fourth.
async function register(request, env, origin) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "bad body" }, 400, origin);

  const check = checkName(String(body.name || ""));
  if (!check.ok) return json({ error: "name", reason: check.reason }, 422, origin);

  const name = check.value;
  const locale = cleanLocale(body.locale);
  const lname = name.toLowerCase();

  const ip = await ipKey(request, env);
  if (!(await rateLimit(env, "ip", ip, IP_WRITES, IP_WINDOW))) {
    return json({ error: "rate" }, 429, origin);
  }

  // D1 is a single writer, so contention here is rare — but two registrations of the same name in
  // the same instant would otherwise both read the same "next" number. The unique index refuses
  // the second, and it simply tries again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await env.DB.prepare(
      "SELECT COALESCE(MAX(disc), 0) + 1 AS next FROM players WHERE lname = ?1 AND locale = ?2"
    ).bind(lname, locale).first();
    const disc = Math.max(1, row?.next || 1);
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare(
        `INSERT INTO players (id, name, lname, locale, disc, deaths, runs, created_at, last_seen, ip_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6, ?6, ?7)`
      ).bind(id, name, lname, locale, disc, now(), ip).run();
      return json({ id, name, tag: `${locale}${disc}`, masked: !!check.masked }, 200, origin);
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e;
    }
  }
  return json({ error: "busy" }, 503, origin);
}

// ---- submit ---------------------------------------------------------------------
async function submit(request, env, origin) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return json({ error: "bad body" }, 400, origin);

  const player = await env.DB.prepare("SELECT * FROM players WHERE id = ?1").bind(body.id).first();
  if (!player) return json({ error: "unknown player" }, 404, origin);

  const ip = await ipKey(request, env);
  if (!(await rateLimit(env, "ip", ip, IP_WRITES, IP_WINDOW))) return json({ error: "rate" }, 429, origin);
  if (!(await rateLimit(env, "pl", player.id, PLAYER_WRITES, PLAYER_WINDOW))) return json({ error: "rate" }, 429, origin);

  const r = body.run || {};
  const run = {
    elapsed: Number(r.elapsed), kills: Number(r.kills), level: Number(r.level),
    damage: Number(r.damage), fired: Number(r.fired), accuracy: Number(r.accuracy),
    won: !!r.won,
  };
  // The identical rules the game runs on itself. A submission that fails them is refused rather
  // than flagged: the client's own copy already flagged it, and a board full of flagged nonsense
  // is not a board.
  const broke = implausible(run) || inconsistent(run);
  if (broke) return json({ error: "implausible", reason: broke }, 422, origin);

  const codes = Math.max(0, Math.min(99, Number(r.codes) || 0));
  const hacked = r.hacked ? 1 : 0;
  const t = now();

  const values = {
    time: Math.floor(run.elapsed),
    kills: Math.floor(run.kills),
    damage: Math.floor(run.damage),
    level: Math.floor(run.level),
  };

  // One row per player per category, holding their best. The WHERE on the upsert is what makes it
  // a personal best rather than a log: a worse run is accepted by the API and changes nothing.
  const statements = [];
  for (const [category, value] of Object.entries(values)) {
    statements.push(env.DB.prepare(
      `INSERT INTO scores (player_id, category, value, won, codes, hacked, at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(player_id, category) DO UPDATE SET
         value = excluded.value, won = excluded.won, codes = excluded.codes,
         hacked = excluded.hacked, at = excluded.at
       WHERE excluded.value > scores.value`
    ).bind(player.id, category, value, run.won ? 1 : 0, codes, hacked, t));
  }
  statements.push(env.DB.prepare(
    "UPDATE players SET runs = runs + 1, deaths = deaths + ?2, last_seen = ?3 WHERE id = ?1"
  ).bind(player.id, run.won ? 0 : 1, t));

  await env.DB.batch(statements);
  await sweep(env);

  return json({ ok: true, recorded: values }, 200, origin);
}

// ---- board ----------------------------------------------------------------------
async function board(request, env, origin) {
  const out = {};
  for (const [category, spec] of Object.entries(CATEGORIES)) {
    if (spec.lifetime) {
      const { results } = await env.DB.prepare(
        `SELECT name, locale, disc, deaths AS value, 0 AS won, 0 AS codes, 0 AS hacked
         FROM players WHERE deaths > 0 ORDER BY deaths DESC, last_seen ASC LIMIT ?1`
      ).bind(TOP_N).all();
      out[category] = results.map(shape);
    } else {
      const { results } = await env.DB.prepare(
        `SELECT p.name, p.locale, p.disc, s.value, s.won, s.codes, s.hacked
         FROM scores s JOIN players p ON p.id = s.player_id
         WHERE s.category = ?1 ORDER BY s.value DESC, s.at ASC LIMIT ?2`
      ).bind(category, TOP_N).all();
      out[category] = results.map(shape);
    }
  }
  return json({ board: out, at: now() }, 200, origin);
}

// Only ever the display name and the number. No ids, no timestamps of when someone played, and
// nothing that came off their machine beyond what they chose to call themselves.
const shape = (row) => ({
  name: row.name,
  tag: `${row.locale}${row.disc}`,
  value: row.value,
  won: !!row.won,
  codes: row.codes | 0,
  hacked: !!row.hacked,
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/v1/health") return json({ ok: true, name: MIN + "-" + MAX }, 200, origin);
      if (url.pathname === "/v1/board" && request.method === "GET") return await board(request, env, origin);
      if (url.pathname === "/v1/register" && request.method === "POST") return await register(request, env, origin);
      if (url.pathname === "/v1/submit" && request.method === "POST") return await submit(request, env, origin);
      return json({ error: "not found" }, 404, origin);
    } catch (e) {
      // Never leak a stack to a public endpoint; the reason is in `wrangler tail` if it is needed.
      console.error(e);
      return json({ error: "server" }, 500, origin);
    }
  },
};
