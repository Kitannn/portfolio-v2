// Analytics — the whole client, about a kilobyte of it.
//
// Counters only. There is no visitor id here, nothing is written to the visitor's device, and no
// cookie is set: a batch says "someone reached Contact", never who. That is a deliberate design
// choice rather than an oversight, and it is what lets the site run this without a consent banner.
//
// A classic script rather than a module, because it has to work on the portfolio (classic scripts)
// and inside the arcade (ES modules) without being built twice. It hangs one function off `window`
// and both callers use it the same way:
//
//   track("cv_download")
//   track("dwell:run", 214)        // a timing, in whole seconds
//
// Nothing here can break a page. Every call is wrapped, the network is fire-and-forget, and if the
// endpoint is missing or blocked the whole thing quietly does nothing.
(function () {
  "use strict";

  // Same Worker as the leaderboard — see arcade/src/online.js, which holds this URL too. Two
  // constants rather than one because that file is a module and this one cannot be.
  var ENDPOINT = "https://hkitandrun-board.hkitannn.workers.dev";

  // Per-browser override, matching the one in arcade/src/online.js. Lets a local Worker be aimed
  // at while developing, so test traffic never lands in the real counters:
  //   localStorage.setItem("kv.analytics", "http://localhost:8787")
  //   localStorage.setItem("kv.analytics", "off")      // or switch it off entirely
  //
  // It can also be set by visiting a link, which is the only practical way to do it on a phone or
  // in a browser whose console you are not about to open:
  //   kitannn.com/?analytics=off     stop counting this browser
  //   kitannn.com/?analytics=on      start again
  // The choice is remembered per browser, per origin, and covers the arcade as well as the site.
  try {
    if (/[?&]analytics=off(&|$)/.test(location.search)) localStorage.setItem("kv.analytics", "off");
    else if (/[?&]analytics=on(&|$)/.test(location.search)) localStorage.removeItem("kv.analytics");
  } catch (e) { /* storage blocked: nothing to remember it with */ }

  try {
    var over = localStorage.getItem("kv.analytics");
    if (over === "off") ENDPOINT = "";
    else if (over) ENDPOINT = over.replace(/\/+$/, "");
  } catch (e) { /* storage blocked: the built-in endpoint stands */ }

  // ---- Cloudflare Web Analytics --------------------------------------------------
  // Free and unlimited, and it answers the things the counters above deliberately cannot:
  // referrers, countries, browsers and Core Web Vitals. It needs a site token, which only the
  // Cloudflare dashboard can mint — see server/README.md.
  //
  // Injected from here rather than pasted into each page so there is ONE place to put the token
  // and it covers the portfolio and the arcade together. Nothing is requested until a real token
  // is set, so an empty constant costs exactly nothing.
  var CF_BEACON = "d75c2067df8241299d95b3053412f067";

  if (CF_BEACON && ENDPOINT !== "") {
    try {
      var cf = document.createElement("script");
      // type=module, matching the snippet Cloudflare currently issues — the beacon is an ES
      // module now, and a module script defers by default so no `defer` is needed.
      cf.type = "module";
      cf.src = "https://static.cloudflareinsights.com/beacon.min.js";
      cf.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_BEACON }));
      // Ad blockers block this script, which is fine and expected — it fails quietly and the
      // first-party counters above carry on regardless. They will always read a little higher.
      cf.onerror = function () { /* blocked; nothing to do */ };
      (document.head || document.documentElement).appendChild(cf);
    } catch (e) { /* never let a beacon break a page */ }
  }

  var BATCH = 40;          // the Worker refuses more than this in one post
  var IDLE_FLUSH = 12000;  // send what we have if nothing else happens
  var queue = [];
  var timer = null;
  var sent = 0;            // a hard cap per page, so no loop can turn into a beacon storm
  var MAX_SENDS = 30;

  function post(body, beacon) {
    if (!ENDPOINT || sent >= MAX_SENDS) return;
    sent++;
    var json = JSON.stringify(body);
    try {
      // On the way out of a page, sendBeacon is the only thing the browser guarantees to deliver;
      // a normal fetch is cancelled the moment the document goes away.
      if (beacon && navigator.sendBeacon) {
        // text/plain, NOT application/json. Only a handful of content types are CORS-safelisted,
        // and application/json is not one of them — it turns the beacon into a preflighted
        // request, which means two round trips while the document is being torn down. text/plain
        // is safelisted, so this goes as a single simple request. The Worker parses the body as
        // JSON regardless of what the header claims.
        navigator.sendBeacon(ENDPOINT + "/v1/event", new Blob([json], { type: "text/plain;charset=UTF-8" }));
        return;
      }
      fetch(ENDPOINT + "/v1/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json,
        keepalive: true,
        mode: "cors",
      }).catch(function () { /* analytics must never surface as an error on someone's page */ });
    } catch (e) { /* ditto */ }
  }

  function flush(beacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!queue.length) return;
    var batch = queue.splice(0, BATCH);
    post({ events: batch }, beacon);
  }

  function track(name, value) {
    try {
      if (!name) return;
      queue.push(typeof value === "number" ? { name: name, value: Math.round(value) } : name);
      if (queue.length >= BATCH) return flush(false);
      if (!timer) timer = setTimeout(function () { flush(false); }, IDLE_FLUSH);
    } catch (e) { /* never */ }
  }

  // Fires at most once per name per page, for things like "they scrolled this far" that would
  // otherwise fire on every scroll event.
  var seen = Object.create(null);
  function once(name, value) {
    if (seen[name]) return;
    seen[name] = 1;
    track(name, value);
  }

  // A page being hidden is the only reliable "they are leaving" signal — `unload` is not fired at
  // all on mobile Safari, and `beforeunload` costs the page its back/forward cache entry.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(true);
  });
  addEventListener("pagehide", function () { flush(true); });

  window.track = track;
  window.trackOnce = once;
  window.trackFlush = flush;
})();
