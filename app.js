// Henry Tan — portfolio v2. Renders everything from data.js (synced from the main site).
(() => {
  const S = window.SITE;
  const BASE = ""; // content is synced in from ../Portfolio by sync.ps1
  const app = document.getElementById("app");
  const modal = document.getElementById("modal");
  const modalWin = modal.querySelector(".modal-win");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const asset = (p) => (!p || /^(https?:)?\/\//.test(p) ? p : BASE + p);
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const first = S.name.split(" ")[0];
  const games = S.work.filter((w) => w.kind === "game");
  const photos = S.work.filter((w) => w.kind === "photo");
  const net = Object.fromEntries(S.networks);

  // Deterministic barcode from a string — decorative, same text always gives the same bars.
  const barcode = (text, h = 22) => {
    let seed = [...String(text)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    let x = 0, bars = "";
    for (let i = 0; i < 34; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const w = 1 + ((seed >>> 8) % 3), gap = 1 + ((seed >>> 13) % 3);
      bars += `<rect x="${x}" width="${w}" height="${h}"/>`;
      x += w + gap;
    }
    return `<svg class="barcode" viewBox="0 0 ${x} ${h}" width="${x}" height="${h}" fill="currentColor" aria-hidden="true">${bars}</svg>`;
  };

  // ---------- warped grid (SVG, animated on rAF while visible) ----------
  const warps = new Set();
  const warpSvg = (cols, rows, amp) => `<svg class="warp" data-cols="${cols}" data-rows="${rows}" data-amp="${amp}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path/></svg>`;
  const warpD = (cols, rows, amp, t) => {
    const f = (x, y) => [
      x + amp * Math.sin(y * 0.07 + t) * Math.sin(x * 0.035 + t * 0.6),
      y + amp * Math.cos(x * 0.06 + t * 0.8) * Math.sin(y * 0.045 + t * 0.4),
    ];
    const seg = 24;
    let d = "";
    for (let r = 0; r <= rows; r++) {
      const y = (r / rows) * 100;
      for (let i = 0; i <= seg; i++) { const [px, py] = f((i / seg) * 100, y); d += `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`; }
    }
    for (let c = 0; c <= cols; c++) {
      const x = (c / cols) * 100;
      for (let i = 0; i <= seg; i++) { const [px, py] = f(x, (i / seg) * 100); d += `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`; }
    }
    return d;
  };
  const warpIO = new IntersectionObserver((es) => es.forEach((e) => e.target._visible = e.isIntersecting));
  const drawWarp = (svg, t) => svg.firstChild.setAttribute("d", warpD(+svg.dataset.cols, +svg.dataset.rows, +svg.dataset.amp, t));
  const initWarps = () => {
    warps.clear();
    app.querySelectorAll("svg.warp").forEach((s) => {
      if (s.parentElement.classList.contains("gl-on")) return; warps.add(s); warpIO.observe(s); drawWarp(s, 0); });
  };
  let last = 0;
  const tick = (now) => {
    if (now - last > 33) { // ~30fps is plenty for a slow wobble
      last = now;
      warps.forEach((s) => s._visible && drawWarp(s, now / 1600));
    }
    requestAnimationFrame(tick);
  };
  if (!reduceMotion) requestAnimationFrame(tick);

  // ---------- shared bits ----------
  const secHead = (title, lede, link, kicker) => `
    <div class="sec-head fade">
      <div>${kicker ? `<div class="sec-kicker">(${esc(kicker)})</div>` : ""}<h2 class="sec-title">${esc(title)}</h2>${barcode(title)}${lede ? `<p class="sec-lede">${esc(lede)}</p>` : ""}</div>
      ${link ? `<a class="sec-link" href="${link[1]}">(${esc(link[0])})</a>` : ""}
    </div>`;

  const tile = (w) => `<div class="gen-tile" style="--acc:${esc(w.accent || "var(--sky)")}"><small>${esc(w.tag)}</small><b>${esc(w.title)}</b>${barcode(w.title, 18)}</div>`;
  const workCard = (w) => `
    <a class="work fade" href="#/works/${slug(w.title)}">
      <div class="thumb">${w.cover ? `<img src="${esc(asset(w.cover))}" alt="" loading="lazy">` : tile(w)}</div>
      <div class="cap">${esc(w.title)}<small>${esc(w.kind === "game" ? "Game" : "Photo")} · ${esc(w.year)}</small></div>
    </a>`;

  const foot = () => `
    <footer class="foot">
      <div>(c) ${new Date().getFullYear()} ${esc(S.name)}<br><a href="https://v2.kitannn.com">← classic site</a></div>
      <a href="#top" data-top>Back to top ↑</a>
      ${barcode(S.name)}
    </footer>`;

  // ---------- pages ----------
  const heroWindows = [
    // Each window is a lens onto a larger image pinned in hero space (field = zoom × hero, centred on the window's
    // starting spot). Dragging reveals other parts; at the field's edge the image is pulled along so it never gaps.
    // Sizes are for a 1280×800 hero and scale up with larger screens (see --s in initHero).
    { id: "birbkit", title: "birbkit.jpg", src: "images/birbkit-1024.jpg", x: 6, y: 15, w: 250, h: 320, depth: 18, zoom: 0.3, href: "#/profile" },
    { id: "sims", title: "town_stories.webp", src: games[1]?.cover, x: 39, y: 13, w: 215, h: 140, depth: 24, zoom: 0.5, href: `#/works/${slug(games[1]?.title || "")}` },
    { id: "cc", title: "cosmic_carnage.jpg", src: games[0]?.cover, x: 20, y: 51, w: 370, h: 225, depth: 30, zoom: 0.6, href: `#/works/${slug(games[0]?.title || "")}` },
    { id: "photo", title: "tokyo.jpg", src: photos[0]?.cover, x: 46, y: 47, w: 185, h: 235, depth: 12, zoom: 0.55, href: `#/works/${slug(photos[0]?.title || "")}` },
    { id: "fifa", title: "fifa_mobile.jpg", src: games[2]?.hero || games[2]?.cover, x: 61, y: 63, w: 285, h: 175, depth: 22, zoom: 0.55, href: `#/works/${slug(games[2]?.title || "")}` },
  ];
  // Cloud homes as fractions of the hero; physics in initHero pushes them around and springs them back.
  const cloudHomes = [{ x: 0.1, y: 0.16, w: 132 }, { x: 0.93, y: 0.1, w: 112 }, { x: 0.5, y: 0.92, w: 150 }, { x: 0.86, y: 0.78, w: 116 }];
  const clouds = () => `<div class="cloud-layer" aria-hidden="true">${cloudHomes.map((c, i) => `
    <div class="cloud" data-hx="${c.x}" data-hy="${c.y}" style="--cw:${c.w}px"><canvas data-gl="cloud" data-seed="${(i * 1.7).toFixed(1)}"></canvas><i></i><i></i><i></i><i></i></div>`).join("")}</div>`;

  // ---------- VCR works reel ----------
  const reel = S.work.filter((w) => w.featured);
  const blurb = (w) => { const s = String(w.summary || "").split(/(?<=\.)\s/)[0]; return s.length > 170 ? s.slice(0, 167) + "…" : s; };
  const vcr = () => `
    <section class="vcr" style="--n:${reel.length}" aria-label="Featured works">
      <div class="vcr-stick">
        <canvas data-gl="vcr"></canvas>
        <div class="vcr-fallback">${reel.map((w, i) => (w.hero || w.cover ? `<img data-i="${i}" src="${esc(asset(w.hero || w.cover))}" alt="">` : `<div data-i="${i}">${tile(w)}</div>`)).join("")}</div>
        <div class="vcr-lines" aria-hidden="true"></div>
        <div class="vcr-hud vcr-tl"><div class="rec"><i></i>Work</div>
          <ol>${reel.map((w, i) => `<li><button type="button" data-reel="${i}">${i + 1}: ${esc(w.title)}<b> ←</b></button></li>`).join("")}</ol></div>
        <div class="vcr-hud vcr-tr">CH-<span class="vcr-ch">01</span> · SP</div>
        <div class="vcr-hud vcr-bl"><div class="play">PLAY ▶</div><div class="tc">00.00.00.00</div></div>
        <div class="vcr-wins"></div>
      </div>
    </section>`;

  const pages = {
    home: () => `
      <section class="hero" id="top">
        <div class="layer" data-depth="6"><div class="hero-grid"><canvas data-gl="grid" data-cells="12,10" data-amp="0.024"></canvas>${warpSvg(12, 10, 2.4)}</div></div>
        <div class="layer" data-depth="10"><div class="hero-birb"><img src="${esc(asset(S.portrait))}" alt="${esc(S.name)}"></div></div>
        ${heroWindows.filter((w) => w.src).map((w, i) => `
          <div class="layer" data-depth="${w.depth}">
            <div class="win float-win" data-win="${w.id}" data-zoom="${w.zoom}" style="--i:${i};left:${w.x}%;top:${w.y}%;width:calc(${w.w}px * var(--s, 1));height:calc(${w.h}px * var(--s, 1));z-index:${10 + i}">
              <div class="win-bar"><span>${esc(w.title)}</span><button class="win-x" type="button" aria-label="Close window" data-winclose>×</button></div>
              <div class="win-body"><a class="reveal" href="${w.href}" aria-label="Open ${esc(w.title)}"><img src="${esc(asset(w.src))}" alt="" draggable="false"></a></div>
            </div>
          </div>`).join("")}
        ${clouds()}
        <div class="hero-caption"><p><b>${esc(S.name)}</b><br>game designer<br>portfolio</p>${barcode(S.name)}</div>
        <button class="pill ghost restore" type="button" hidden>Restore windows ↺</button>
        <div class="hero-hint">drag the windows · poke the clouds</div>
      </section>

      <section class="section">
        ${secHead(`Hi, I'm ${first}`, S.about[0], ["Profile", "#/profile"], "About")}
        <div class="sec-body fade"><div class="stats">${S.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}</div></div>
      </section>

      <section class="section">
        ${secHead("Experience", "Where I've been designing lately. The full history lives on my CV.", ["CV", asset(S.cvPage)])}
        <div class="split fade">
          <ul class="rows">${S.cv.experience.map((e) => `<li><div class="when">${esc(e.when)}</div><div class="what">${esc(e.org)} — ${esc(e.role)}</div></li>`).join("")}</ul>
          <div class="grid-cell"><canvas data-gl="grid" data-cells="10,8" data-amp="0.03"></canvas>${warpSvg(10, 8, 3)}
            <a class="sticker" href="#/profile" style="left:16%;top:18%;transform:rotate(-8deg)"><img src="${esc(asset(S.avatar))}" alt="birbKit"></a>
            ${games[0]?.logo ? `<a class="sticker logo" href="#/works/${slug(games[0].title)}" style="left:52%;top:10%;width:110px;transform:rotate(6deg)"><img src="${esc(asset(games[0].logo))}" alt="${esc(games[0].title)}"></a>` : ""}
            ${games[2]?.logo ? `<a class="sticker logo" href="#/works/${slug(games[2].title)}" style="left:44%;top:52%;width:120px;transform:rotate(-4deg)"><img src="${esc(asset(games[2].logo))}" alt="${esc(games[2].title)}"></a>` : ""}
          </div>
        </div>
      </section>

      <section class="section">
        ${secHead("Work", "Games first — live service, mobile and Roblox — then side projects. Scroll to play the tape.", ["All work", "#/works"])}
        ${vcr()}
      </section>

      <section class="section">
        ${secHead("Photography", "Street, travel, portraits and a lot of live music.", ["All photos", "#/works?photo"])}
        <div class="works-grid">${S.work.filter((w) => w.featuredPhoto).map(workCard).join("")}</div>
      </section>

      <section class="section">
        ${secHead("FAQ")}
        <div class="sec-body fade">${S.faq.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
      </section>

      <section class="section">
        ${secHead("Contact", "Design roles, Roblox / Unity contracts and photo collabs.", ["Say hello", "#/contact"])}
        <div class="sec-body fade"><a class="mail" href="#" data-mail>${esc(S.email.user)}[at]${esc(S.email.domain)}</a></div>
      </section>
      ${foot()}`,

    works: (filter) => `
      <section class="section page-top works-page" id="top" style="border-top:0">
        <div class="works-top">
        ${secHead("Work", "Games, side projects and photo series. Click anything to open it in a window.")}
        <div class="works-controls">
        <button class="pill ghost filter-toggle" type="button" aria-expanded="false" data-ftoggle><span class="ft-sum">Filters</span> ▾</button>
        <div class="filter-panel">
        <div class="filters">
          <span class="label">(FILTER)</span>
          <div class="chips">${[["all", "All"], ["game", "Games"], ["photo", "Photography"], ["featured", "Featured"]].map(([k, l]) => `<button class="chip${k === filter ? " on" : ""}" type="button" data-filter="${k}">${l}</button>`).join("")}</div>
          <span class="label">(VIEW)</span>
          <div class="chips"><button class="chip" type="button" data-view="wheel">Wheel</button><button class="chip" type="button" data-view="grid">Grid</button></div>
        </div>
        </div>
        <div class="count" id="count"></div>
        </div>
        </div>
        <div id="works-groups"></div>
      </section>
      ${foot()}`,

    profile: () => `
      <section class="section page-top" id="top" style="border-top:0">
        ${secHead("Profile")}
        <div class="profile">
          <aside class="profile-side fade">
            <div class="win"><div class="win-bar"><span>portrait.jpg</span><span>${esc(S.name)}</span></div>
              <div class="win-body"><img src="${esc(asset(S.portrait))}" alt="${esc(S.name)}"></div></div>
            <div class="sticker"><img src="${esc(asset(S.avatar))}" alt="birbKit"></div>
          </aside>
          <div>
            <div class="block about fade"><div class="label">(About)</div>
              <h3 class="sec-title" style="font-size:clamp(30px,4vw,48px);margin-bottom:22px">Hi, I'm ${esc(first)}</h3>
              ${S.about.map((p) => `<p>${esc(p)}</p>`).join("")}
              <div class="btns"><a class="pill" href="${esc(asset(S.resume))}" target="_blank" rel="noopener">Résumé PDF ↓</a><a class="pill ghost" href="${esc(asset(S.cvPage))}">View CV →</a></div></div>
            <div class="block fade"><div class="label">(Identity)</div>
              <dl class="kv">${S.identity.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
            <div class="block fade"><div class="label">(Stats + Skills)</div>
              <div class="stats">${S.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}</div>
              <div class="chips" style="margin-top:18px">${S.styles.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>
            <div class="block fade"><div class="label">(Experience)</div>
              <ul class="timeline">${S.cv.experience.map((e) => `<li><div class="when">${esc(e.when)}</div><div><h3>${esc(e.role)} <span>— ${esc(e.org)}</span></h3>${e.project ? `<div style="color:var(--muted);font-size:12px">${esc(e.project)}</div>` : ""}<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div></li>`).join("")}</ul></div>
            <div class="block fade"><div class="label">(Education)</div>
              <dl class="kv">${S.cv.education.map((e) => `<dt>${esc(e.place)}</dt><dd><b style="font-weight:500">${esc(e.school)}</b><br><span style="color:var(--muted)">${esc(e.credential)}</span></dd>`).join("")}</dl></div>
            <div class="block fade"><div class="label">(Off the clock — <a href="${esc(net["Personal IG"] || "#")}" target="_blank" rel="noopener">@k2ttan</a>)</div>
              <div class="strip">${S.offClock.map((src) => `<img src="${esc(asset(src))}" alt="" loading="lazy">`).join("")}</div></div>
          </div>
        </div>
      </section>
      ${foot()}`,

    contact: () => `
      <section class="section page-top" id="top" style="border-top:0">
        ${secHead("Contact", "Design roles, contract work on Roblox and Unity projects, and photo collaborations. Email is the fastest way to reach me.")}
        <div class="contact-grid">
          <div class="fade">
            <div class="label">(Email)</div>
            <a class="mail" href="#" data-mail>${esc(S.email.user)}[at]${esc(S.email.domain)}</a>
            <ul class="net-rows">${S.networks.map(([k, v]) => `<li><a href="${esc(v)}" target="_blank" rel="noopener"><span>${esc(k)}</span><span>↗</span></a></li>`).join("")}</ul>
            <div class="poem">${S.poem.map((l) => `<p>${l}</p>`).join("")}</div>
          </div>
          <div class="win fade"><div class="win-bar"><span>birbkit.jpg</span><span>●</span></div>
            <div class="win-body" style="aspect-ratio:1"><img src="${esc(asset("images/birbkit-1024.jpg"))}" alt="birbKit"></div></div>
        </div>
      </section>
      ${foot()}`,
  };

  // ---------- works grid / card stream + filter ----------
  let workFilter = "all";
  let workView = "wheel";
  try { workView = localStorage.getItem("kv2-workview") || "wheel"; } catch {}
  let stopHelix = null;
  const two = (n) => String(n).padStart(2, "0");

  // Card stream (after kidzfrmnowhere): one main image per project on tilted slabs drifting mostly down-left.
  // Depth arcs (small far at the top, big and near mid-screen, small again at the bottom), each card has its own
  // random lane and size, the cursor tilts the whole view, and ghost copies trail off whichever edge is behind
  // the card's motion. Few projects (filters) are repeated so the stream always stays dense.
  const GHOSTS = 5;
  const streamSlots = (list) => {
    const reps = Math.max(1, Math.round(12 / Math.max(1, list.length)));
    const slots = [];
    for (let r = 0; r < reps; r++) list.forEach((_, p) => slots.push(p));
    return slots;
  };
  const streamMarkup = (list, slots) => `
    <section class="stream" aria-label="Work stream">
      <div class="stream-stick">
        <div class="stream-world">${slots.map((p, i) => {
          const w = list[p], src = w.hero || w.cover;
          const face = src ? `<img src="${esc(asset(src))}" alt="" decoding="async" draggable="false">` : tile(w);
          const bg = src ? `background-image:url('${esc(asset(src))}')` : `background:${esc(w.accent || "var(--sky)")}`;
          return `<a class="s-card" data-p="${p}" href="#/works/${slug(w.title)}" aria-label="${esc(w.title)}"${i >= list.length ? ' tabindex="-1"' : ""}>
            ${Array.from({ length: GHOSTS }, (_, k) => `<i class="s-ghost" style="${bg};--k:${k + 1}"></i>`).join("")}
            <span class="s-face">${face}</span></a>`;
        }).join("")}</div>
        <div class="s-label" aria-hidden="true"></div>
        <div class="helix-hud h-list"><div class="label">(Projects)</div>
          <ol>${list.map((w, p) => `<li><a href="#/works/${slug(w.title)}" data-sp="${p}">${two(p + 1)} ${esc(w.title)}<b> ←</b></a></li>`).join("")}</ol></div>
        <div class="helix-hud h-count">(${two(list.length)} projects)<br>hover to focus · click to open</div>
      </div>
    </section>`;

  const initStream = (host, list) => {
    const sec = host.querySelector(".stream");
    if (!sec) return null;
    const stick = sec.querySelector(".stream-stick");
    const cards = [...sec.querySelectorAll(".s-card")];
    const links = [...sec.querySelectorAll("[data-sp]")];
    const label = sec.querySelector(".s-label");
    const S_ = cards.length;
    // stable per-slot randomness: lane offset, size, tilt jitter, sway phase
    const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    const gameOrder = S.work.filter((w) => w.kind === "game" && w.cover);
    const photoOrder = S.work.filter((w) => w.kind === "photo");
    const priority = (w) => {
      const g = gameOrder.indexOf(w);
      if (g >= 0) return [1.3, 1.24, 1.18][g] ?? 1.12;           // Ghost Fox, Sims, FIFA
      const ph = photoOrder.indexOf(w);
      if (ph >= 0 && ph < 5) return 1.06 - ph * 0.07;            // Tokyo → Live, decreasing
      return 0.74;                                               // Everyday, Personal Projects
    };
    const vary = cards.map((c, i) => ({
      lane: (rnd(i, 1) - 0.5) * 2, size: priority(list[+c.dataset.p]), sway: rnd(i, 5) * Math.PI * 2,
      off: 0, prev: null, gx: 0, gy: 0,
    }));
    let phase = 0, scrollPhase = 0, scrollTarget = 0, speed = 1, alive = true, last = performance.now(), hot = -1;
    const view = { x: 0, y: 0, tx: 0, ty: 0 }; // cursor-driven viewing angle

    // Wheel view is a full-screen stage: wheel, trackpad, touch-drag and arrow keys drive the stream, not the page.
    const push = (px) => { scrollTarget += px / (stick.clientHeight * 1.6); };
    const onWheel = (e) => { e.preventDefault(); push(e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY); };
    let touchY = null;
    const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e) => { if (touchY === null) return; e.preventDefault(); const y = e.touches[0].clientY; push((touchY - y) * 1.6); touchY = y; };
    const onTouchEnd = () => { touchY = null; };
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea") || !modal.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); push(120); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); push(-120); }
    };
    stick.addEventListener("wheel", onWheel, { passive: false });
    stick.addEventListener("touchstart", onTouchStart, { passive: true });
    stick.addEventListener("touchmove", onTouchMove, { passive: false });
    stick.addEventListener("touchend", onTouchEnd);
    addEventListener("keydown", onKey);

    const focus = (p) => {
      hot = p;
      sec.classList.toggle("hovering", p >= 0);
      cards.forEach((c) => c.classList.toggle("hot", +c.dataset.p === p)); // every copy of the project
      links.forEach((a) => a.classList.toggle("on", +a.dataset.sp === p));
      label.textContent = p >= 0 ? `${list[p].title} — ${list[p].tag}` : "";
      label.classList.toggle("on", p >= 0);
    };
    cards.forEach((c) => {
      c.addEventListener("pointerenter", () => focus(+c.dataset.p));
      c.addEventListener("pointerleave", () => { if (hot === +c.dataset.p) focus(-1); });
    });
    links.forEach((a) => {
      a.addEventListener("pointerenter", () => focus(+a.dataset.sp));
      a.addEventListener("pointerleave", () => focus(-1));
    });
    stick.addEventListener("pointermove", (e) => {
      const r = stick.getBoundingClientRect();
      const lx = e.clientX - r.left, flip = lx + 18 + label.offsetWidth > r.width - 12; // keep the label on screen
      label.style.transform = `translate(${flip ? lx - 18 - label.offsetWidth : lx + 18}px, ${e.clientY - r.top - 6}px)`;
      if (e.pointerType === "mouse") { view.tx = lx / r.width - 0.5; view.ty = (e.clientY - r.top) / r.height - 0.5; }
    });
    stick.addEventListener("pointerleave", () => { view.tx = 0; view.ty = 0; });

    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const frame = (now) => {
      if (!alive || !sec.isConnected) return;
      const dt = Math.max(1 / 240, Math.min(0.05, (now - last) / 1000));
      last = now;
      const r = stick.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const t = now / 1000;
        // drift on its own; ease to a stop while a card is hovered so it can be clicked
        speed += ((hot >= 0 ? 0 : 1) - speed) * (1 - Math.exp(-6 * dt));
        if (!reduceMotion) phase += dt * 0.04 * speed;
        scrollPhase += (scrollTarget - scrollPhase) * (1 - Math.exp(-8 * dt));
        // viewing angle follows the cursor (applied to every card identically)
        view.x += (view.tx - view.x) * (1 - Math.exp(-4 * dt));
        view.y += (view.ty - view.y) * (1 - Math.exp(-4 * dt));
        const rx = 20 - view.y * 14, ry = -14 + view.x * 22;

        const W = stick.clientWidth, H = stick.clientHeight, mobile = W < 640;
        // card width follows the window: the smaller of a share of the width or of the height
        const cw = mobile ? Math.min(W * 0.62, H * 0.3) : Math.min(W * 0.36, H * 0.62);

        // 1) where each card wants to be: mostly down-left, depth arcs far → near (mid-screen) → far
        const P = vary.map((v, i) => {
          let u = (i / S_ + phase + scrollPhase) % 1;
          if (u < 0) u += 1;
          const arc = Math.pow(Math.sin(Math.PI * u), 0.8);
          const w = cw * v.size, h = w * 0.6;          // layout size (scale applied by transform)
          const fit = (W - (mobile ? 12 : 28)) / (w * 1.3); // never wider than the stage, tilt included
          const s = Math.min(fit, (0.4 + 0.72 * arc) * v.size); // on-screen scale: small → big mid-screen → small
          const x = W * (mobile ? 0.62 : 0.66) - W * (mobile ? 0.24 : 0.34) * u
            + v.lane * W * (mobile ? 0.12 : 0.14) + Math.sin(t * 0.3 + v.sway) * W * 0.01
            + view.x * (s - 0.6) * W * 0.05;           // nearer cards parallax more with the view
          const y = -H * 0.28 + H * 1.56 * u + view.y * (s - 0.6) * H * 0.04;
          return { u, s, w, h, x, y };
        });

        // 2) cards never slice through each other: each is its own layer, stacked by depth. On top of that,
        //    heavily overlapping neighbours push each other sideways (the farther/smaller one moves more).
        const push = new Float32Array(S_);
        for (let i = 0; i < S_; i++) for (let j = i + 1; j < S_; j++) {
          const a = P[i], b = P[j];
          const aw = (a.w * a.s) / 2, ah = (a.h * a.s) / 2, bw = (b.w * b.s) / 2, bh = (b.h * b.s) / 2;
          const ax = a.x + vary[i].off, bx = b.x + vary[j].off;
          const ox = aw + bw - Math.abs(ax - bx), oy = ah + bh - Math.abs(a.y - b.y);
          if (ox <= 0 || oy <= Math.min(ah, bh) * 0.5) continue; // only real overlaps, not grazes
          const dir = ax === bx ? (vary[i].lane < vary[j].lane ? -1 : 1) : Math.sign(ax - bx);
          const f = Math.min(ox, W * 0.2) * Math.min(1, oy / (2 * Math.min(ah, bh)));
          const wa = b.s / (a.s + b.s), wb = a.s / (a.s + b.s);
          push[i] += dir * f * wa;
          push[j] -= dir * f * wb;
        }

        for (let i = 0; i < S_; i++) {
          const v = vary[i], p = P[i], c = cards[i];
          v.off += push[i] * (1 - Math.exp(-3 * dt)) - v.off * (1 - Math.exp(-0.35 * dt)); // nudge out, drift home
          // keep the whole card on screen horizontally; if neighbours push it into the edge it overlaps instead
          const half = (p.w * p.s * 1.25) / 2, margin = mobile ? 6 : 14; // 1.25 covers the tilt's widest projection, incl. cursor view angle
          const lo = half + margin, hi = W - half - margin;
          const x = lo > hi ? W / 2 : Math.max(lo, Math.min(hi, p.x + v.off));
          v.off = x - p.x; // don't let the push wind up past the edge
          const o = smooth(0, 0.14, p.u) * (1 - smooth(0.86, 1, p.u));
          c.style.width = p.w + "px";
          c.style.height = p.h + "px";
          c.style.zIndex = String(+c.dataset.p === hot ? 3000 : Math.round(p.u * 1000)); // older cards on top; hovered card to the front
          c.style.transform = `translate(${(x - p.w / 2).toFixed(1)}px, ${(p.y - p.h / 2).toFixed(1)}px) scale(${p.s.toFixed(4)}) perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
          c.style.setProperty("--o", o.toFixed(3));
          // trail: ghosts step back along the card's on-screen motion
          if (v.prev && Math.abs(p.u - v.prev.u) < 0.5) {
            const vx = (x - v.prev.x) / dt, vy = (p.y - v.prev.y) / dt, vs = (p.s - v.prev.s) / dt;
            const tx = (-vx * 0.12) / p.s, ty = (-vy * 0.12 - vs * 60) / p.s;
            const len = Math.hypot(tx, ty), cap = 26;
            const k = len > cap ? cap / len : 1;
            v.gx += (tx * k - v.gx) * (1 - Math.exp(-10 * dt));
            v.gy += (ty * k - v.gy) * (1 - Math.exp(-10 * dt));
          }
          v.prev = { x, y: p.y, s: p.s, u: p.u };
          c.style.setProperty("--gx", v.gx.toFixed(2) + "px");
          c.style.setProperty("--gy", v.gy.toFixed(2) + "px");
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return () => { alive = false; removeEventListener("keydown", onKey); };
  };

  const renderWorks = () => {
    const host = document.getElementById("works-groups");
    if (!host) return;
    stopHelix?.();
    stopHelix = null;
    const list = S.work.filter((w) => workFilter === "all" || (workFilter === "featured" ? w.featured || w.featuredPhoto : w.kind === workFilter));
    const wheel = workView === "wheel";
    host.closest(".works-page")?.classList.toggle("wheel-mode", wheel);
    document.body.classList.toggle("work-wheel", wheel);
    if (wheel) scrollTo({ top: 0, behavior: "instant" });
    if (wheel) {
      const slots = streamSlots(list);
      host.innerHTML = streamMarkup(list, slots);
      stopHelix = initStream(host, list);
    } else {
      // Games and photo sets get their own titled groups; empty groups are skipped.
      const groups = [["game", "Game projects"], ["photo", "Photography sets"]]
        .map(([kind, label]) => [label, list.filter((w) => w.kind === kind)])
        .filter(([, items]) => items.length);
      host.innerHTML = groups.map(([label, items]) => `
        <div class="group-head fade"><h3>${esc(label)}</h3><span>(${two(items.length)})</span></div>
        <div class="works-grid">${items.map(workCard).join("")}</div>`).join("");
    }
    document.getElementById("count").textContent = `(${list.length} PROJECTS)`;
    app.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("on", b.dataset.filter === workFilter));
    app.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === workView));
    const sum = app.querySelector(".ft-sum");
    if (sum) sum.textContent = `${{ all: "All", game: "Games", photo: "Photography", featured: "Featured" }[workFilter]} · ${workView === "wheel" ? "Wheel" : "Grid"}`;
    reveal();
  };

  // ---------- project modal ----------
  const openModal = (w) => {
    const imgs = [...new Set([w.hero, w.cover, ...(w.images || [])].filter(Boolean))];
    const tags = [w.kind === "game" ? "Game" : "Photography", w.year, ...String(w.tag || "").split("·").map((t) => t.trim()).filter(Boolean)];
    modalWin.innerHTML = `
      <div class="win-bar"><span id="modal-title">${esc(w.title)}</span><button class="win-x" type="button" aria-label="Close" data-close>×</button></div>
      <div class="modal-scroll">
        <div class="stage">${imgs.length ? `<img src="${esc(asset(imgs[0]))}" alt="${esc(w.title)}">` : tile(w)}</div>
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) => `<button type="button" class="${i ? "" : "on"}" data-src="${esc(asset(src))}" aria-label="Image ${i + 1}"><img src="${esc(asset(src))}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
        <h2 class="m-title">${esc(w.title)}</h2>
        <div class="m-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        ${w.summary ? `<p class="m-summary">${esc(w.summary)}</p>` : ""}
        ${w.details ? `<dl class="kv">${w.details.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
        ${w.responsibilities ? `<div class="resp">${w.responsibilities.map((g) => `<div><h4>${esc(g.title)}</h4><ul>${g.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></div>`).join("")}</div>` : ""}
        ${(w.links || []).length ? `<div class="m-links">${w.links.map(([l, u]) => `<a class="pill" href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a>`).join("")}</div>` : ""}
        <button class="pill ghost m-close" type="button" data-close>Close</button>
      </div>
      <div class="m-foot"><span>(c) ${esc(S.name)} · ${esc(w.year)}</span>${barcode(w.title)}</div>`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modalWin.querySelector(".modal-scroll").scrollTop = 0;
    modalWin.querySelector("[data-close]").focus({ preventScroll: true });
  };
  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  };
  modal.addEventListener("click", (e) => {
    const t = e.target.closest("[data-close], .thumbs button");
    if (!t) return;
    if (t.matches(".thumbs button")) {
      modalWin.querySelector(".stage img").src = t.dataset.src;
      modalWin.querySelectorAll(".thumbs button").forEach((b) => b.classList.toggle("on", b === t));
    } else closeToPage();
  });

  // ---------- per-page cleanup (listeners that outlive a render) ----------
  let cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);

  // ---------- hero: parallax, reveal-lens windows, cloud physics ----------
  const initHero = () => {
    const hero = app.querySelector(".hero");
    if (!hero) return;
    const layers = [...hero.querySelectorAll(".layer")];
    const wins = [...hero.querySelectorAll(".float-win")];
    const fine = matchMedia("(pointer: fine)").matches;
    const mouse = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, in: false };
    let W = 0, H = 0;
    const onResize = () => {
      W = hero.clientWidth; H = hero.clientHeight;
      hero.style.setProperty("--s", Math.max(1, Math.min(1.8, W / 1280, H / 800)).toFixed(3));
    };
    onResize();
    addEventListener("resize", onResize);
    onCleanup(() => removeEventListener("resize", onResize));

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = true;
    });
    hero.addEventListener("pointerleave", () => { mouse.in = false; });

    // Window lens: the image sits on a fixed field in hero space; the window chooses which part shows.
    wins.forEach((win) => {
      win._cx = (win.offsetLeft + win.offsetWidth / 2) / W; // field centre, as a fraction of the hero
      win._cy = (win.offsetTop + win.offsetHeight / 2) / H;
    });
    const syncLens = (win) => {
      const img = win._img || (win._img = win.querySelector(".reveal img"));
      const body = win._body || (win._body = win.querySelector(".win-body"));
      const cw = body.clientWidth, ch = body.clientHeight;
      const z = +win.dataset.zoom || 1;
      const fw = Math.max(W * z, cw * 1.3), fh = Math.max(H * z, ch * 1.3);
      const fx = win._cx * W - fw / 2, fy = win._cy * H - fh / 2;
      const layer = win.parentElement;
      const hx = win.offsetLeft + (layer._tx || 0) + 1, hy = win.offsetTop + (layer._ty || 0) + 27;
      const ox = Math.min(0, Math.max(cw - fw, fx - hx)), oy = Math.min(0, Math.max(ch - fh, fy - hy));
      img.style.width = fw + "px";
      img.style.height = fh + "px";
      img.style.transform = `translate(${ox}px, ${oy}px)`;
    };

    // Clouds: free-floating bodies (like 109ichiki's objects). Each cruises on its own slowly-wandering heading,
    // bounces off the hero's edges and off each other, tumbles freely, and gets knocked onto a new course by the
    // cursor. No home positions — after a shove they relax back to cruising speed wherever they are.
    const rand = (a, b) => a + Math.random() * (b - a);
    const bodies = [...hero.querySelectorAll(".cloud")].map((el, i) => ({
      el, canvas: el.querySelector("canvas"), w: el.offsetWidth, h: el.offsetWidth / 1.2, r: el.offsetWidth * 0.4,
      hx: +el.dataset.hx, hy: +el.dataset.hy, x: 0, y: 0, vx: 0, vy: 0,
      heading: rand(0, Math.PI * 2), cruise: rand(70, 115),            // px/s
      rx: rand(0, 6), ry: rand(0, 6), sx: 0, sy: 0,
      bsx: rand(0.15, 0.4) * (Math.random() < 0.5 ? -1 : 1), bsy: rand(0.2, 0.5) * (Math.random() < 0.5 ? -1 : 1), // base tumble, rad/s
      live: false, entering: true,
    }));
    const place = (b) => { b.el.style.transform = `translate3d(${b.x - b.w / 2}px, ${b.y - b.h / 2}px, 0)`; };
    const drop = () => bodies.forEach((b, i) => {
      b.x = b.hx * W;
      b.y = reduceMotion ? b.hy * H : -b.h - i * 80;
      b.vx = rand(-40, 40); b.vy = reduceMotion ? 0 : rand(260, 340); // fall in from above, then drift
      b.sx = b.bsx; b.sy = b.bsy;
      b.live = true; b.entering = !reduceMotion;
      place(b);
    });
    bodies.forEach((b) => { b.x = b.hx * W; b.y = -400; place(b); });

    const stepClouds = (dt) => {
      const clampV = (v) => Math.max(-3000, Math.min(3000, v)); // first move after entering reads as a huge jump
      const mvx = clampV((mouse.x - mouse.px) / dt), mvy = clampV((mouse.y - mouse.py) / dt); // cursor velocity, px/s
      const relax = 1 - Math.exp(-0.9 * dt), spinRelax = 1 - Math.exp(-0.7 * dt);
      for (const b of bodies) {
        if (!b.live) continue;
        // wander: the heading drifts slowly; velocity eases toward that cruise vector
        b.heading += (Math.random() - 0.5) * 1.2 * dt;
        if (!b.entering) {
          b.vx += (Math.cos(b.heading) * b.cruise - b.vx) * relax;
          b.vy += (Math.sin(b.heading) * b.cruise - b.vy) * relax;
        }
        // cursor collision: shove it away along the contact normal, plus some of the cursor's own motion
        if (mouse.in && fine && dt > 0) {
          const dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.hypot(dx, dy), R = b.r + 14;
          if (d < R && d > 0.01) {
            const nx = dx / d, ny = dy / d, vn = mvx * nx + mvy * ny;
            b.x = mouse.x + nx * R; b.y = mouse.y + ny * R;
            const push = Math.max(vn, 0) * 0.8 + 140;
            b.vx += nx * push + mvx * 0.3; b.vy += ny * push + mvy * 0.3;
            const sp = Math.hypot(b.vx, b.vy), max = 1400;
            if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
            b.heading = Math.atan2(b.vy, b.vx);
            b.sy += mvx * 0.004 + nx * 1.5; b.sx += mvy * 0.004 + ny * 1.5;
            b.entering = false;
          }
        }
      }
      // cloud–cloud: separate and exchange momentum (equal mass, slightly bouncy)
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], c = bodies[j];
        if (!a.live || !c.live) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), R = a.r + c.r;
        if (d < R && d > 0.01) {
          const nx = dx / d, ny = dy / d, o = (R - d) / 2;
          a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            const k = -rel * 0.95;
            a.vx -= nx * k; a.vy -= ny * k; c.vx += nx * k; c.vy += ny * k;
            a.heading = Math.atan2(a.vy, a.vx); c.heading = Math.atan2(c.vy, c.vx);
            a.sy -= 0.8; c.sy += 0.8;
          }
        }
      }
      // integrate, bounce inside the hero, tumble
      for (const b of bodies) {
        if (!b.live) continue;
        b.x += b.vx * dt; b.y += b.vy * dt;
        const m = b.r * 0.75;
        if (b.entering && b.y > m + 20) { b.entering = false; b.heading = rand(0, Math.PI * 2); } // pick a fresh course once inside
        let bounced = false;
        if (b.x < m) { b.x = m; b.vx = Math.abs(b.vx) * 0.9; bounced = true; }
        if (b.x > W - m) { b.x = W - m; b.vx = -Math.abs(b.vx) * 0.9; bounced = true; }
        if (!b.entering && b.y < m) { b.y = m; b.vy = Math.abs(b.vy) * 0.9; bounced = true; }
        if (b.y > H - m) { b.y = H - m; b.vy = -Math.abs(b.vy) * 0.9; bounced = true; }
        if (bounced) { b.heading = Math.atan2(b.vy, b.vx); b.sx += (Math.random() - 0.5) * 0.8; }
        b.sx += (b.bsx - b.sx) * spinRelax; b.sy += (b.bsy - b.sy) * spinRelax;
        b.rx += b.sx * dt; b.ry += b.sy * dt;
        b.canvas._rot = [b.rx, b.ry];
        place(b);
      }
      mouse.px = mouse.x; mouse.py = mouse.y;
    };

    let dropped = false, lastNow = 0;
    const loop = (now) => {
      if (!hero.isConnected) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60; // seconds, clamped after tab switches
      lastNow = now;
      const nx = mouse.in ? mouse.x / W - 0.5 : 0, ny = mouse.in ? mouse.y / H - 0.5 : 0;
      const still = reduceMotion || !fine;
      for (const l of layers) {
        const d = +l.dataset.depth || 0;
        l._tx = (l._tx || 0) + ((still ? 0 : -nx * d) - (l._tx || 0)) * 0.08;
        l._ty = (l._ty || 0) + ((still ? 0 : -ny * d) - (l._ty || 0)) * 0.08;
        l.style.transform = `translate(${l._tx}px, ${l._ty}px)`;
      }
      wins.forEach(syncLens);
      if (!dropped && document.body.classList.contains("ready")) { dropped = true; setTimeout(drop, reduceMotion ? 0 : 900); }
      if (!reduceMotion) stepClouds(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // dragging + closing windows
    let z = 20;
    const restore = hero.querySelector(".restore");
    wins.forEach((win) => {
      const bar = win.querySelector(".win-bar");
      win.addEventListener("pointerdown", () => { win.style.zIndex = ++z; });
      bar.addEventListener("pointerdown", (e) => {
        if (e.target.closest("[data-winclose]")) return;
        const sx = e.clientX, sy = e.clientY, ox = win.offsetLeft, oy = win.offsetTop;
        win.classList.add("dragging");
        bar.setPointerCapture(e.pointerId);
        const move = (ev) => { win.style.left = ox + ev.clientX - sx + "px"; win.style.top = oy + ev.clientY - sy + "px"; };
        const up = () => { win.classList.remove("dragging"); bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); };
        bar.addEventListener("pointermove", move);
        bar.addEventListener("pointerup", up);
      });
      win.querySelector("[data-winclose]").addEventListener("click", () => {
        win.classList.add("closed");
        restore.hidden = !hero.querySelector(".float-win.closed");
      });
    });
    restore.addEventListener("click", () => {
      wins.forEach((w) => w.classList.remove("closed"));
      restore.hidden = true;
    });
  };

  // ---------- VCR reel: pinned scroll, one work per screen ----------
  const reelCard = (w, aspect) => {
    // Personal Projects has no key art — paint a title card at the reel's own aspect so nothing is cropped.
    const c = document.createElement("canvas");
    const W = 1600, H = Math.round(W / Math.max(0.45, Math.min(2.4, aspect || 16 / 9)));
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = w.accent || "#3bb8f0";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#0e0d12";
    const pad = W * 0.08, fit = (txt, max) => Math.min(max, (W - pad * 2) / (txt.length * 0.62));
    const title = w.title.toUpperCase(), size = fit(title, 150);
    g.font = `500 ${Math.round(size * 0.3)}px "IBM Plex Mono", monospace`;
    g.fillText(String(w.tag || "").toUpperCase(), pad, H * 0.36);
    g.font = `500 ${Math.round(size)}px "IBM Plex Mono", monospace`;
    g.fillText(title, pad, H * 0.36 + size * 1.25);
    const list = (w.details || []).find(([k]) => k === "Games");
    if (list) {
      const items = list[1].split(",").map((t) => t.trim());
      g.font = `400 ${Math.round(size * 0.26)}px "IBM Plex Mono", monospace`;
      items.forEach((t, i) => g.fillText("> " + t, pad, H * 0.36 + size * 1.9 + i * size * 0.38));
    }
    let x = pad;
    for (let i = 0; x < W * 0.55; i++) { const bw = 3 + ((i * 37) % 7); g.fillRect(x, H - pad - 70, bw, 70); x += bw + 4 + ((i * 13) % 5); }
    return c;
  };

  const initVcr = () => {
    const sec = app.querySelector(".vcr");
    if (!sec) return;
    const stick = sec.querySelector(".vcr-stick");
    const ctl = sec.querySelector("canvas[data-gl]")?._vcr;
    const items = [...sec.querySelectorAll(".vcr-fallback [data-i]")];
    const lis = [...sec.querySelectorAll("[data-reel]")];
    const box = sec.querySelector(".vcr-wins");
    const tc = sec.querySelector(".tc"), ch = sec.querySelector(".vcr-ch");
    const t0 = performance.now();
    let cur = -1;

    if (ctl) reel.forEach((w, i) => {
      const src = w.hero || w.cover;
      if (!src) return document.fonts.ready.then(() => ctl.set(i, reelCard(w, stick.clientWidth / stick.clientHeight)));
      const im = new Image();
      im.src = asset(src);
      im.decode().then(() => ctl.set(i, im)).catch(() => {});
    });

    const pushWin = (w, i) => {
      const el = document.createElement("div");
      el.className = "win vcr-win";
      el.innerHTML = `
        <div class="win-bar"><span>work_${String(i + 1).padStart(2, "0")}</span><button class="win-x" type="button" aria-label="Hide" data-vcrhide>×</button></div>
        <div class="vcr-win-body">
          <small>${esc(w.tag)} · ${esc(w.year)}</small>
          <h3>${esc(w.title)}</h3>
          <p>${esc(blurb(w))}</p>
          <div class="vcr-win-foot"><a class="pill" href="#/works/${slug(w.title)}">View project →</a>${barcode(w.title)}</div>
        </div>`;
      box.appendChild(el);
      box.hidden = false;
      [...box.children].slice(0, -2).forEach((c) => c.remove());
      [...box.children].forEach((c, k, all) => c.classList.toggle("behind", k < all.length - 1));
    };

    const show = (i) => {
      if (i === cur) return;
      cur = i;
      ctl?.show(i);
      items.forEach((el) => el.classList.toggle("on", +el.dataset.i === i));
      lis.forEach((b) => b.classList.toggle("on", +b.dataset.reel === i));
      ch.textContent = String(i + 1).padStart(2, "0");
      pushWin(reel[i], i);
    };
    const onScroll = () => {
      const r = sec.getBoundingClientRect();
      show(Math.max(0, Math.min(reel.length - 1, Math.round(-r.top / innerHeight))));
    };
    addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => removeEventListener("scroll", onScroll));
    onScroll();

    sec.addEventListener("click", (e) => {
      const b = e.target.closest("[data-reel]");
      if (b) scrollTo({ top: sec.getBoundingClientRect().top + scrollY + +b.dataset.reel * innerHeight + 2, behavior: "smooth" });
      if (e.target.closest("[data-vcrhide]")) box.hidden = true;
    });

    // VHS timecode hh.mm.ss.ff at 30fps, ticking while the tape is on screen
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      if (!sec.isConnected) return;
      const r = stick.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const f = Math.floor((performance.now() - t0) / (1000 / 30));
        tc.textContent = `${pad(Math.floor(f / 108000))}.${pad(Math.floor(f / 1800) % 60)}.${pad(Math.floor(f / 30) % 60)}.${pad(f % 30)}`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ---------- reveal on scroll ----------
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 });
  const reveal = () => app.querySelectorAll(".fade:not(.in)").forEach((el) => io.observe(el));

  // ---------- router ----------
  let current = "";
  const closeToPage = () => { location.hash = current === "home" ? "#/" : `#/${current}`; };
  const route = () => {
    const raw = location.hash.replace(/^#\/?/, "");
    let [path, query] = raw.split("?");
    let [page, id] = path.split("/");
    if (page === "work") page = "works"; // old-site links
    if (!pages[page]) page = "home";
    if (page === "works" && id && current) page = current; // keep whatever page the window was opened over
    if (page !== current) {
      current = page;
      if (page === "works") workFilter = query === "photo" ? "photo" : query === "game" ? "game" : "all";
      cleanups.forEach((fn) => fn());
      cleanups = [];
      stopHelix?.();
      stopHelix = null;
      document.body.classList.remove("work-wheel");
      window.KGL?.unmount();
      app.innerHTML = pages[page](workFilter);
      window.KGL?.mount(app);
      document.querySelectorAll(".pill-nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
      if (page === "works") renderWorks();
      initWarps();
      initHero();
      initVcr();
      reveal();
      if (!id) scrollTo({ top: 0, behavior: "instant" });
    }
    const w = id && S.work.find((x) => slug(x.title) === id);
    if (w) {
      openModal(w);
      document.title = `${w.title} — ${S.name}`;
    } else {
      closeModal();
      document.title = `${S.name} — ${{ home: "Portfolio", works: "Work", profile: "Profile", contact: "Contact" }[page]}`;
    }
  };
  addEventListener("hashchange", route);

  // ---------- global handlers ----------
  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-filter]");
    const ft = e.target.closest("[data-ftoggle]");
    if (ft) {
      const open = app.querySelector(".filter-panel")?.classList.toggle("open");
      ft.setAttribute("aria-expanded", String(!!open));
      return;
    }
    const closePanel = () => { app.querySelector(".filter-panel")?.classList.remove("open"); app.querySelector("[data-ftoggle]")?.setAttribute("aria-expanded", "false"); };
    if (f || e.target.closest("[data-view]")) closePanel();
    else if (!e.target.closest(".filter-panel")) closePanel();
    if (f) { workFilter = f.dataset.filter; renderWorks(); return; }
    const v = e.target.closest("[data-view]");
    if (v) { workView = v.dataset.view; try { localStorage.setItem("kv2-workview", workView); } catch {} renderWorks(); return; }
    if (e.target.closest("[data-mail]")) { e.preventDefault(); location.href = "mailto:" + S.email.user + "@" + S.email.domain; return; }
    if (e.target.closest("[data-top]")) { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); }
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeToPage(); });

  // socials + mark
  document.getElementById("mark-text").textContent = S.name;
  document.getElementById("socials").innerHTML = ["Instagram", "GitHub"].filter((k) => net[k]).map((k) => `<a class="pill" href="${esc(net[k])}" target="_blank" rel="noopener">${k} ↗</a>`).join("");

  // clock (Vancouver)
  const clock = document.querySelector(".clock");
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Vancouver", hour: "2-digit", minute: "2-digit", hour12: false });
  const setClock = () => { const [h, , m] = fmt.formatToParts(new Date()).map((p) => p.value); clock.innerHTML = `${h}<b>:</b>${m}`; };
  setClock();
  setInterval(setClock, 10000);

  // theme
  const root = document.documentElement;
  try { if (localStorage.getItem("kv2-theme") === "light") root.dataset.theme = "light"; } catch {}
  document.querySelector(".theme-dots").addEventListener("click", () => {
    const light = root.dataset.theme !== "light";
    if (light) root.dataset.theme = "light"; else delete root.dataset.theme;
    try { localStorage.setItem("kv2-theme", light ? "light" : "dark"); } catch {}
    dispatchEvent(new Event("kv2-theme"));
  });

  // ---------- loading screen: console boot over CRT noise → intro ----------
  const runLoader = () => {
    const el = document.getElementById("loader");
    if (!el) return document.body.classList.add("ready");
    const left = el.querySelector(".ld-left"), right = el.querySelector(".ld-right");
    const pcts = [...el.querySelectorAll(".ld-pct")], fills = [...el.querySelectorAll(".ld-fill, .ld-track i")], bar = el.querySelector(".ld-bar");

    // what we wait for: every eager image in the first render, plus web fonts
    const imgs = [...app.querySelectorAll("img")].filter((i) => i.loading !== "lazy");
    const jobs = [...imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }))), document.fonts.ready];
    let done = 0, forced = false, shown = 0, complete = false;
    jobs.forEach((j) => j.then(() => done++));
    setTimeout(() => { forced = true; }, 7000); // never hold the page hostage

    // CRT static: low-res random grain, upscaled
    const noise = el.querySelector(".ld-noise"), g = noise.getContext("2d");
    const sizeNoise = () => { noise.width = Math.ceil(innerWidth / 3); noise.height = Math.ceil(innerHeight / 3); };
    sizeNoise();
    let lastNoise = 0;
    const drawNoise = (now) => {
      if (now - lastNoise < 45) return;
      lastNoise = now;
      const img = g.createImageData(noise.width, noise.height), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    };

    // console text, filled with real site data
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? "EDGE" : /OPR\//.test(ua) ? "OPERA" : /Firefox\//.test(ua) ? "FIREFOX" : /Chrome\//.test(ua) ? "CHROME" : /Safari\//.test(ua) ? "SAFARI" : "UNKNOWN";
    const two = (n) => String(n).padStart(2, "0");
    const now = () => new Date();
    const years = (S.stats.find(([, l]) => /years/i.test(l)) || ["", ""])[0];
    const steps = ["LOAD PORTFOLIO DATA", "MOUNT DESKTOP WINDOWS", "COMPILE WEBGL SHADERS", "CALIBRATE CLOUD PHYSICS", "SPOOL VCR TAPE", "SYNC VANCOUVER CLOCK", "WAKE BIRBKIT"];
    const progress = () => (forced ? 100 : (done / jobs.length) * 100);
    const leftLines = [
      "CONSOLE SETUP", "-------------",
      () => `LOADING SITE : ${complete ? "COMPLETE" : "IN PROGRESS"}`,
      "SETTING TYPE : {IBM PLEX MONO}",
      "SETTING COLOR : {#0E0D12; #EEEAF5}",
      `SERVER : {${(location.hostname || "LOCALHOST").toUpperCase()}}`,
      `PROTOCOL : {${location.protocol.replace(":", "").toUpperCase()}}`,
      "",
      ...steps.map((s, i) => () => `${String(i + 1).padStart(3, "0")} ${s}${shown >= ((i + 1) / steps.length) * 100 - 0.01 ? " ..... OK" : " ....."}`),
      "",
      `WELCOME TO ${S.name.toUpperCase()}`, "-------------",
      `ROLE : {${S.role.toUpperCase()}}`,
      `STUDIO : {${String(S.cv.experience[0]?.org || "").toUpperCase()}}`,
      `EXPERIENCE : {${years} YEARS}`,
      `LOCATION : {${S.location.toUpperCase()}}`,
      "FOCUS : {TECHNICAL DESIGN, CONTENT DESIGN, LIVE OPS}",
    ];
    const rightLines = [
      "PARSING DATA", "-------------",
      () => { const d = now(); return `DATE : {${two(d.getDate())}/${two(d.getMonth() + 1)}/${two(d.getFullYear() % 100)}}`; },
      () => { const d = now(); return `HOUR : {${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}}`; },
      () => `LOADING ASSETS : {${two(forced ? jobs.length : done)} / ${two(jobs.length)}}`,
      `PROJECTS : {${two(S.work.length)}}`,
      "",
      () => `DISPLAY : {${innerWidth}X${innerHeight}}`,
      `BROWSER : {${browser}}`,
      `LANGUAGE : {${(navigator.language || "en").toUpperCase()}}`,
    ];

    // typewriter with a short scramble ahead of the cursor; dynamic lines keep updating once typed
    const GLYPHS = "#%&*+-/<>=[]{}01ABCDEF";
    const rows = [];
    const mount = (host, lines, start) => lines.forEach((ln, i) => {
      const div = document.createElement("div");
      host.appendChild(div);
      rows.push({ div, ln, at: start + i * (reduceMotion ? 0 : 55), typed: false });
    });
    const t0 = performance.now();
    mount(left, leftLines, 0);
    mount(right, rightLines, 450);
    const text = (ln) => (typeof ln === "function" ? ln() : ln);
    const renderRows = (now) => {
      let allTyped = true;
      for (const r of rows) {
        const age = now - t0 - r.at;
        if (age < 0) { allTyped = false; continue; }
        const full = text(r.ln);
        if (!r.typed) {
          const k = Math.floor((age / 240) * full.length);
          if (k >= full.length) r.typed = true;
          else {
            allTyped = false;
            let tail = "";
            for (let j = 0; j < Math.min(3, full.length - k); j++) tail += full[k + j] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            r.div.textContent = full.slice(0, k) + tail;
            continue;
          }
        }
        if (r.div.textContent !== full) r.div.textContent = full;
      }
      return allTyped;
    };

    // the bar follows whichever is slower: real asset loading or the console typing out
    const typingEnd = Math.max(...rows.map((r) => r.at)) + 240;
    let lastFrame = t0;
    const frame = (now) => {
      const dt = Math.min(0.5, (now - lastFrame) / 1000); // seconds; time-based so throttled frames don't slow the bar
      lastFrame = now;
      const typedPct = reduceMotion ? 100 : Math.min(100, ((now - t0) / typingEnd) * 100);
      const target = Math.min(progress(), typedPct);
      shown = Math.min(target, shown + Math.max(25 * dt, (target - shown) * (1 - Math.exp(-9 * dt))));
      pcts.forEach((p) => { p.textContent = String(Math.floor(shown)).padStart(3, "0") + "%"; }); // centre bar + bottom track
      fills.forEach((f) => { f.style.width = shown + "%"; });
      drawNoise(now);
      const typed = renderRows(now);
      if (!complete && shown >= 100 && typed) {
        complete = true; // flips LOADING SITE to COMPLETE
        if (reduceMotion) {
          setTimeout(() => { document.body.classList.add("ready"); el.style.transition = "opacity .4s"; el.style.opacity = "0"; }, 300);
          setTimeout(() => el.remove(), 800);
        } else {
          setTimeout(() => el.classList.add("fold"), 350); // bar splits and folds into an H
          setTimeout(zoomThroughH, 350 + 650);
        }
      }
      if (el.isConnected) requestAnimationFrame(frame);
    };
    addEventListener("resize", sizeNoise);
    requestAnimationFrame(frame);

    const zoomThroughH = () => {
      // intro starts now, so the page seen through the H is already in its hidden starting state
      document.body.classList.add("ready");
      const b = bar.getBoundingClientRect();
      const a = b.width / 3, t = b.height, half = (a * 1.35) / 2; // segment length, thickness, upright half-height
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;  // zoom focus: crossbar centre
      const x0 = b.left + a - t / 2, x1 = b.left + 2 * a + t / 2, y0 = cy - half, y1 = cy + half;
      const pts = [[x0, y0], [x0 + t, y0], [x0 + t, cy - t / 2], [x1 - t, cy - t / 2], [x1 - t, y0], [x1, y0],
        [x1, y1], [x1 - t, y1], [x1 - t, cy + t / 2], [x0 + t, cy + t / 2], [x0 + t, y1], [x0, y1]];
      const W = innerWidth, H = innerHeight, t0 = performance.now(), DUR = 900;
      const MAX = (Math.max(W, H) * 2.2) / t; // big enough that the crossbar alone covers the screen
      const step = (now) => {
        const k = Math.min(1, (now - t0) / DUR), e = k * k * k * k; // ease-in: slow start, fast rush
        const s = Math.exp(Math.log(MAX) * e);
        const h = pts.map(([x, y], i) => `${i ? "L" : "M"}${(cx + (x - cx) * s).toFixed(1)} ${(cy + (y - cy) * s).toFixed(1)}`).join("");
        el.style.clipPath = `path(evenodd, "M0 0H${W}V${H}H0Z${h}Z")`;
        if (k < 1) requestAnimationFrame(step);
        else el.remove();
      };
      requestAnimationFrame(step);
    };
  };

  // ---------- cursor readout: X:Y coordinates, "GRAB" over draggable title bars ----------
  const initCursorHud = () => {
    if (!matchMedia("(pointer: fine)").matches) return;
    const hud = document.createElement("div");
    hud.id = "cursor-hud";
    hud.setAttribute("aria-hidden", "true");
    hud.innerHTML = '<span class="c-xy"></span><span class="c-state">GRAB</span>';
    document.body.appendChild(hud);
    const xy = hud.querySelector(".c-xy");
    const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      hud.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 18}px)`;
      xy.textContent = `X:${pad(e.clientX)}\nY:${pad(e.clientY)}`; // stacked, X over Y
      const onBar = e.target.closest?.(".float-win .win-bar") && !e.target.closest("[data-winclose]");
      hud.classList.toggle("grab", !!onBar || !!document.querySelector(".float-win.dragging"));
      hud.classList.add("on");
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => hud.classList.remove("on"));
  };

  // ---------- CRT overlay on every page (toggleable, remembered per browser) ----------
  let crtOn = true;
  try { crtOn = localStorage.getItem("kv2-crt") !== "off"; } catch {}
  const crtBtn = document.querySelector(".crt-toggle");
  const applyCrt = () => {
    document.body.classList.toggle("crt-on", crtOn);
    crtBtn.setAttribute("aria-pressed", String(crtOn));
  };
  crtBtn.addEventListener("click", () => {
    crtOn = !crtOn;
    try { localStorage.setItem("kv2-crt", crtOn ? "on" : "off"); } catch {}
    applyCrt();
  });
  const initCrt = () => {
    const c = document.querySelector("#crt canvas"), g = c.getContext("2d");
    const size = () => { c.width = Math.ceil(innerWidth / 3); c.height = Math.ceil(innerHeight / 3); };
    size();
    addEventListener("resize", size);
    let last = 0;
    const draw = (now) => {
      if (document.body.classList.contains("crt-on") && !document.hidden && now - last > 50) {
        last = now;
        const img = g.createImageData(c.width, c.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        g.putImageData(img, 0, 0);
      }
      if (!reduceMotion) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  };

  route();
  applyCrt();
  initCrt();
  initCursorHud();
  runLoader();
})();
