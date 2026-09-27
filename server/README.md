# HKIT AND RUN — online leaderboard

A single Cloudflare Worker over one D1 (SQLite) database. It is what turns the arcade's local
records into a board with other people on it.

**It is not deployed yet.** Until it is, the game is unchanged: the Leaderboard panel says the
online board is not switched on and shows this browser's own records, exactly as before.

---

## It stays on the free plan

Nothing here reaches for a paid feature. There are no Durable Objects, no Queues, no R2 and no
cron triggers — those are the pieces that move an account onto a paid plan. What it does use:

| | free allowance | what this uses |
|---|---|---|
| Workers requests | 100,000 / day | one per board view, one per finished run |
| D1 storage | 5 GB | a few hundred bytes per player |
| D1 rows read | 5,000,000 / day | ~50 per board view |
| D1 rows written | 100,000 / day | ~5 per finished run |

A finished run costs about five row writes. You would need roughly **20,000 completed runs in a
single day** to reach the free D1 write limit. Workers Free needs no card on file.

Rate limiting is done with a table in D1 rather than Cloudflare's rate-limiting product or a
Durable Object, for exactly this reason.

---

## Deploying it

You need a free Cloudflare account. I can't create one for you.

```bash
# 1. sign in (opens a browser)
npx wrangler login

# 2. create the database, from this directory
cd server
npx wrangler d1 create hkitandrun
```

That prints a `database_id`. Paste it into `wrangler.toml`, replacing
`PASTE_THE_ID_FROM_wrangler_d1_create`.

```bash
# 3. create the tables on the real database
npx wrangler d1 execute hkitandrun --remote --file=./schema.sql

# 4. a random string, so the rate limiter can count per address without storing addresses
npx wrangler secret put IP_SALT

# 5. ship it
npx wrangler deploy
```

That last command prints a URL like `https://hkitandrun-board.<your-subdomain>.workers.dev`.
Check it:

```bash
curl https://hkitandrun-board.<your-subdomain>.workers.dev/v1/health
# {"ok":true,"name":"3-16"}
```

### Switching it on in the game

Open `arcade/src/online.js` and put that URL in `BUILT_IN`:

```js
const BUILT_IN = "https://hkitandrun-board.your-subdomain.workers.dev";
```

Bump the `?v=` on `src/main.js` in `arcade/index.html` so browsers pick it up, then commit and
push. The opt-in appears in the Leaderboard panel the next time the page loads.

> The Worker imports the game's own `name-filter.js` and `run-bounds.js` by relative path, so the
> server enforces exactly the rules the client shows. Don't move `server/` out of the repo without
> fixing those two imports — the deploy would fail loudly rather than silently, but still.

---

## What it enforces

The endpoint is public — the client is a static page with no secrets in it, so it has to be. Every
rule therefore lives on the server:

- **Names** go through the game's own filter. Hard-blocked terms are refused; soft ones are masked.
- **The `#tag`** is assigned here and only here. The client's `#en_US1` was always a guess; only
  something that can see every player knows whether this is the first `kitannn` or the fourth.
- **Runs** are checked against `run-bounds.js` — the same bounds the client uses to flag its own
  save. An impossible run is refused, not stored.
- **Rate limits**: 30 writes per 10 minutes per address, 6 per minute per player. A rejected
  submission still counts, because hammering the validator is the thing worth stopping.
- **One row per player per category**, holding their best. A worse run is accepted and changes
  nothing.

**What it does not stop:** a determined person can still craft a run that is merely *plausible* and
post it. Nothing short of replaying the simulation server-side would catch that, and that would
need the game's physics to be deterministic and extractable, which they are not. The board is
honest about it — runs carry the same `CODES` and `CHEATS` flags the local one does.

**What leaves your players' machines:** a display name, a locale string, and five numbers. No
email, no account, no IP stored — addresses are salted and hashed to ten bytes purely so the rate
limiter can count, and swept on a timer. Posting is off by default and asked for separately from
the existing cookie consent.

---

## Running it locally

No account, no wrangler, nothing installed — Node 24 ships `node:sqlite`, and D1 *is* SQLite:

```bash
node server/test/harness.mjs      # 29 assertions against the real Worker
node server/test/serve.mjs        # serves it on http://localhost:8787
```

With the dev server up, point the game at it from the arcade page's console:

```js
localStorage.setItem("hkitandrun.endpoint", "http://localhost:8787");
location.reload();
```

`localStorage.removeItem("hkitandrun.endpoint")` puts it back. That override only ever affects the
browser it is typed into.

---

## Afterwards

```bash
npx wrangler tail                                   # live logs
npx wrangler d1 execute hkitandrun --remote \
  --command "SELECT name, locale, disc, runs FROM players ORDER BY created_at DESC LIMIT 20"
```

To remove a name someone objects to:

```bash
npx wrangler d1 execute hkitandrun --remote \
  --command "DELETE FROM players WHERE lname = 'whatever'"
```

`scores` cascades from `players`, so that takes their rows with it.
