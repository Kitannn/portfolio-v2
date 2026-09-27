// Runs the real Worker against a real SQLite database, with no Cloudflare account, no wrangler and
// nothing installed — Node 24 ships node:sqlite, and D1 IS SQLite. The shim below implements only
// the slice of the D1 API the Worker actually touches, so what is exercised here is the genuine
// request handler, the genuine SQL and the genuine shared rules from the game's own source.
//
//   node server/test/harness.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../src/worker.js";

const here = dirname(fileURLToPath(import.meta.url));

// ---- the D1 shim ----
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

const db = new DatabaseSync(":memory:");
db.exec(readFileSync(join(here, "..", "schema.sql"), "utf8"));
const env = { DB: makeD1(db), IP_SALT: "test-salt" };

// ---- a tiny request helper ----
let ip = "203.0.113.7";
async function call(method, path, body) {
  const req = new Request(`https://board.example${path}`, {
    method,
    headers: {
      origin: "https://kitannn.com",
      "cf-connecting-ip": ip,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const res = await worker.fetch(req, env);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON is a failure the assertions will catch */ }
  return { status: res.status, json, headers: res.headers };
}

// ---- assertions ----
let pass = 0, fail = 0;
const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label + (detail ? "  <- " + detail : "")); }
};

const goodRun = (over = {}) => ({
  elapsed: 214, kills: 137, level: 14, damage: 21400, fired: 1900, accuracy: 0.52,
  won: false, codes: 0, hacked: false, ...over,
});

console.log("\nregister");
const a = await call("POST", "/v1/register", { name: "kitannn", locale: "en_US" });
ok("issues an id and a tag", a.status === 200 && a.json.tag === "en_US1", JSON.stringify(a.json));
const b = await call("POST", "/v1/register", { name: "KITANNN", locale: "en_US" });
ok("second of the same name gets #2, case-insensitively", b.json?.tag === "en_US2", JSON.stringify(b.json));
const c = await call("POST", "/v1/register", { name: "kitannn", locale: "ja" });
ok("a different locale starts its own numbering", c.json?.tag === "ja1", JSON.stringify(c.json));
const bad = await call("POST", "/v1/register", { name: "n1gg3r", locale: "en_US" });
ok("the server refuses what the client would refuse", bad.status === 422, JSON.stringify(bad.json));
const short = await call("POST", "/v1/register", { name: "ab", locale: "en_US" });
ok("too short is refused", short.status === 422);
const soft = await call("POST", "/v1/register", { name: "shitbox", locale: "en_US" });
ok("a soft word is masked, not refused", soft.status === 200 && soft.json.name === "****box", JSON.stringify(soft.json));
const junkLocale = await call("POST", "/v1/register", { name: "locale test", locale: "'; DROP TABLE players; --" });
ok("a junk locale is shaped, not trusted", junkLocale.json?.tag === "en1", JSON.stringify(junkLocale.json));

console.log("\nsubmit");
const s1 = await call("POST", "/v1/submit", { id: a.json.id, run: goodRun() });
ok("a plausible run is accepted", s1.status === 200 && s1.json.recorded.kills === 137, JSON.stringify(s1.json));
const unknown = await call("POST", "/v1/submit", { id: "not-a-real-id", run: goodRun() });
ok("an unknown id is refused", unknown.status === 404);
for (const [label, over] of [
  ["impossible kills", { kills: 99999 }],
  ["impossible level", { level: 400 }],
  ["accuracy over 100%", { accuracy: 1.5 }],
  ["damage from nothing", { damage: 9e9 }],
  ["won before the boss lands", { won: true, elapsed: 90 }],
  ["a string where a number goes", { kills: "999999" }],
]) {
  // A REJECTED submission still counts against the rate limit, which is deliberate — hammering
  // the validator is exactly the abuse worth stopping. So the counters are cleared between these
  // six, or the last of them comes back 429 before it ever reaches the bounds check.
  db.exec("DELETE FROM rate");
  ip = "203.0.113.20";
  const r = await call("POST", "/v1/submit", { id: a.json.id, run: goodRun(over) });
  ok(`refuses ${label}`, r.status === 422, JSON.stringify(r.json));
}

console.log("\npersonal best");
ip = "203.0.113.31";
await call("POST", "/v1/submit", { id: b.json.id, run: goodRun({ kills: 40, elapsed: 60, level: 5, damage: 900 }) });
ip = "203.0.113.32";
await call("POST", "/v1/submit", { id: b.json.id, run: goodRun({ kills: 10, elapsed: 30, level: 2, damage: 100 }) });
let board = (await call("GET", "/v1/board")).json.board;
let mine = board.kills.find((r) => r.tag === "en_US2");
ok("a worse run does not replace a better one", mine?.value === 40, JSON.stringify(mine));
ip = "203.0.113.33";
await call("POST", "/v1/submit", { id: b.json.id, run: goodRun({ kills: 260, elapsed: 305, level: 21, damage: 44000, won: true }) });
board = (await call("GET", "/v1/board")).json.board;
mine = board.kills.find((r) => r.tag === "en_US2");
ok("a better run does replace it", mine?.value === 260, JSON.stringify(mine));
ok("one row per player, not one per run", board.kills.filter((r) => r.tag === "en_US2").length === 1);
ok("beating the Colossus carries the star", board.time.find((r) => r.tag === "en_US2")?.won === true);

console.log("\nwhat leaves the server");
const row = board.kills[0];
ok("rows carry a name, tag and value", typeof row.name === "string" && typeof row.tag === "string" && typeof row.value === "number");
ok("and no id, ip or timestamp", !("id" in row) && !("player_id" in row) && !("ip_hash" in row) && !("at" in row), JSON.stringify(row));
ok("deaths is a lifetime tally", board.deaths.length > 0 && board.deaths[0].value >= 1, JSON.stringify(board.deaths[0]));
ok("the board is sorted", board.kills.every((r, i, arr) => i === 0 || arr[i - 1].value >= r.value));

console.log("\nrate limits");
ip = "198.51.100.99";
let limited = 0;
for (let i = 0; i < 40; i++) {
  const r = await call("POST", "/v1/register", { name: `flood${i}`, locale: "en" });
  if (r.status === 429) limited++;
}
ok("a flood from one address is cut off", limited > 0, `${limited} of 40 refused`);
ip = "198.51.100.50";
let plLimited = 0;
for (let i = 0; i < 12; i++) {
  const r = await call("POST", "/v1/submit", { id: c.json.id, run: goodRun({ kills: 100 + i }) });
  if (r.status === 429) plLimited++;
}
ok("and so is one player submitting on a loop", plLimited > 0, `${plLimited} of 12 refused`);

console.log("\nthe edges");
const opt = await call("OPTIONS", "/v1/board");
ok("preflight answers", opt.status === 204 && opt.headers.get("access-control-allow-origin") === "https://kitannn.com");
const nf = await call("GET", "/v1/nope");
ok("an unknown path 404s without a stack", nf.status === 404 && !JSON.stringify(nf.json).includes("at "));
const health = await call("GET", "/v1/health");
ok("health responds", health.status === 200 && health.json.ok === true);
const garbage = await call("POST", "/v1/submit", "not json");
ok("a malformed body is a 400, not a 500", garbage.status === 400 || garbage.status === 404, `got ${garbage.status}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
