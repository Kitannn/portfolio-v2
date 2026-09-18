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
  const secHead = (title, lede, link) => `
    <div class="sec-head fade">
      <div><h2 class="sec-title">${esc(title)}</h2>${barcode(title)}${lede ? `<p class="sec-lede">${esc(lede)}</p>` : ""}</div>
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
      <div>(c) ${new Date().getFullYear()} ${esc(S.name)}<br><a href="https://kitannn.com">← classic site</a></div>
      <a href="#top" data-top>Back to top ↑</a>
      ${barcode(S.name)}
    </footer>`;

  // ---------- pages ----------
  const heroWindows = [
    // Each window is a lens onto a larger image pinned in hero space (field = zoom × hero, centred on the window's
    // starting spot). Dragging reveals other parts; at the field's edge the image is pulled along so it never gaps.
    { id: "portrait", title: "portrait.jpg", src: S.portrait, x: 9, y: 18, w: 230, h: 290, depth: 18, zoom: 0.62, href: "#/profile" },
    { id: "cc", title: "cosmic_carnage.jpg", src: games[0]?.cover, x: 27, y: 50, w: 330, h: 205, depth: 30, zoom: 0.6, href: `#/works/${slug(games[0]?.title || "")}` },
    { id: "photo", title: "tokyo.jpg", src: photos[0]?.cover, x: 53, y: 57, w: 210, h: 250, depth: 12, zoom: 0.55, href: `#/works/${slug(photos[0]?.title || "")}` },
    { id: "sims", title: "town_stories.webp", src: games[1]?.cover, x: 48, y: 17, w: 250, h: 165, depth: 24, zoom: 0.5, href: `#/works/${slug(games[1]?.title || "")}` },
  ];
  // Cloud homes as fractions of the hero; physics in initHero pushes them around and springs them back.
  const cloudHomes = [{ x: 0.1, y: 0.16, w: 132 }, { x: 0.93, y: 0.1, w: 112 }, { x: 0.5, y: 0.92, w: 150 }, { x: 0.86, y: 0.78, w: 116 }];
  const clouds = () => `<div class="cloud-layer" aria-hidden="true">${cloudHomes.map((c, i) => `
    <div class="cloud" data-hx="${c.x}" data-hy="${c.y}" style="width:${c.w}px"><canvas data-gl="cloud" data-seed="${(i * 1.7).toFixed(1)}"></canvas><i></i><i></i><i></i><i></i></div>`).join("")}</div>`;

  // ---------- VCR works reel ----------
  const reel = S.work.filter((w) => w.featured);
  const blurb = (w) => { const s = String(w.summary || "").split(/(?<=\.)\s/)[0]; return s.length > 170 ? s.slice(0, 167) + "…" : s; };
  const vcr = () => `
    <section class="vcr" style="--n:${reel.length}" aria-label="Featured works">
      <div class="vcr-stick">
        <canvas data-gl="vcr"></canvas>
        <div class="vcr-fallback">${reel.map((w, i) => (w.hero || w.cover ? `<img data-i="${i}" src="${esc(asset(w.hero || w.cover))}" alt="">` : `<div data-i="${i}">${tile(w)}</div>`)).join("")}</div>
        <div class="vcr-lines" aria-hidden="true"></div>
        <div class="vcr-hud vcr-tl"><div class="rec"><i></i>Works</div>
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
        <div class="layer" data-depth="10"><div class="hero-birb"><img src="${esc(asset("images/birbkit-1024.jpg"))}" alt="birbKit, ${esc(first)}'s avatar"></div></div>
        ${heroWindows.filter((w) => w.src).map((w, i) => `
          <div class="layer" data-depth="${w.depth}">
            <div class="win float-win" data-win="${w.id}" data-zoom="${w.zoom}" style="--i:${i};left:${w.x}%;top:${w.y}%;width:${w.w}px;height:${w.h}px;z-index:${10 + i}">
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
        ${secHead("About", S.about[0], ["Profile", "#/profile"])}
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
        ${secHead("Works", "Games first — live service, mobile and Roblox — then side projects. Scroll to play the tape.", ["All works", "#/works"])}
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
      <section class="section page-top" id="top" style="border-top:0">
        ${secHead("Works", "Games, side projects and photo series. Click anything to open it in a window.")}
        <div class="filters">
          <span class="label">(FILTER)</span>
          <div class="chips">${[["all", "All"], ["game", "Games"], ["photo", "Photography"], ["featured", "Featured"]].map(([k, l]) => `<button class="chip${k === filter ? " on" : ""}" type="button" data-filter="${k}">${l}</button>`).join("")}</div>
        </div>
        <div class="count" id="count"></div>
        <div class="works-grid" id="works-grid"></div>
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

  // ---------- works grid + filter ----------
  let workFilter = "all";
  const renderWorks = () => {
    const list = S.work.filter((w) => workFilter === "all" || (workFilter === "featured" ? w.featured || w.featuredPhoto : w.kind === workFilter));
    const grid = document.getElementById("works-grid");
    if (!grid) return;
    grid.innerHTML = list.map(workCard).join("");
    document.getElementById("count").textContent = `(${list.length} WORKS)`;
    app.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("on", b.dataset.filter === workFilter));
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
    let W = hero.clientWidth, H = hero.clientHeight;
    const onResize = () => { W = hero.clientWidth; H = hero.clientHeight; };
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

    // Clouds: soft bodies pushed by the cursor, bumping each other, springing back home.
    const bodies = [...hero.querySelectorAll(".cloud")].map((el, i) => ({
      el, canvas: el.querySelector("canvas"), w: el.offsetWidth, h: el.offsetWidth / 1.2, r: el.offsetWidth * 0.4,
      hx: +el.dataset.hx, hy: +el.dataset.hy, x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0, sx: 0, sy: 0, seed: i * 1.3, live: false,
    }));
    const place = (b) => { b.el.style.transform = `translate3d(${b.x - b.w / 2}px, ${b.y - b.h / 2}px, 0) rotate(${Math.max(-12, Math.min(12, b.vx * 0.8))}deg)`; };
    const drop = () => bodies.forEach((b, i) => { b.x = b.hx * W; b.y = reduceMotion ? b.hy * H : -b.h - i * 90; b.vy = 1; b.live = true; place(b); });
    bodies.forEach((b) => { b.x = b.hx * W; b.y = -400; place(b); });

    const stepClouds = (t) => {
      const mvx = mouse.x - mouse.px, mvy = mouse.y - mouse.py;
      for (const b of bodies) {
        if (!b.live) continue;
        const tx = b.hx * W, ty = b.hy * H + Math.sin(t * 0.8 + b.seed) * 8;
        b.vx += (tx - b.x) * 0.0022; b.vy += (ty - b.y) * 0.0022;
        b.vx *= 0.975; b.vy *= 0.975;
        if (mouse.in && fine) {
          const dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.hypot(dx, dy), R = b.r + 16;
          if (d < R && d > 0.01) {
            const nx = dx / d, ny = dy / d, vn = mvx * nx + mvy * ny;
            b.x = mouse.x + nx * R; b.y = mouse.y + ny * R;
            const push = Math.max(vn, 0) * 0.9 + 1.2;
            b.vx += nx * push + mvx * 0.25; b.vy += ny * push + mvy * 0.25;
            b.sy += mvx * 0.004 + nx * 0.012; b.sx += mvy * 0.004 + ny * 0.012;
          }
        }
      }
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], c = bodies[j];
        if (!a.live || !c.live) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), R = a.r + c.r;
        if (d < R && d > 0.01) {
          const nx = dx / d, ny = dy / d, o = (R - d) / 2;
          a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) { const k = -rel * 0.9; a.vx -= nx * k; a.vy -= ny * k; c.vx += nx * k; c.vy += ny * k; a.sy -= 0.01; c.sy += 0.01; }
        }
      }
      for (const b of bodies) {
        if (!b.live) continue;
        b.x += b.vx; b.y += b.vy;
        if (b.x < b.r * 0.5) { b.x = b.r * 0.5; b.vx = Math.abs(b.vx) * 0.6; }
        if (b.x > W - b.r * 0.5) { b.x = W - b.r * 0.5; b.vx = -Math.abs(b.vx) * 0.6; }
        if (b.y > H - b.r * 0.3) { b.y = H - b.r * 0.3; b.vy = -Math.abs(b.vy) * 0.6; }
        // tumble when hit, then settle back to the front-facing pose (nearest full turn)
        const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v));
        b.sx -= wrap(b.rx) * 0.004; b.sy -= wrap(b.ry) * 0.004;
        b.sx = Math.max(-0.25, Math.min(0.25, b.sx)) * 0.955; b.sy = Math.max(-0.25, Math.min(0.25, b.sy)) * 0.955;
        b.rx += b.sx; b.ry += b.sy;
        b.canvas._rot = [b.rx, b.ry];
        place(b);
      }
      mouse.px = mouse.x; mouse.py = mouse.y;
    };

    let dropped = false;
    const loop = (now) => {
      if (!hero.isConnected) return;
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
      if (!reduceMotion) stepClouds(now / 1000);
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
      document.title = `${S.name} — ${page === "home" ? "Portfolio" : page[0].toUpperCase() + page.slice(1)}`;
    }
  };
  addEventListener("hashchange", route);

  // ---------- global handlers ----------
  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-filter]");
    if (f) { workFilter = f.dataset.filter; renderWorks(); return; }
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

  // ---------- loading screen → intro ----------
  const runLoader = () => {
    const el = document.getElementById("loader");
    if (!el) return document.body.classList.add("ready");
    const pct = el.querySelector(".ld-pct"), bar = el.querySelector(".ld-bar i");
    const imgs = [...app.querySelectorAll("img")].filter((i) => i.loading !== "lazy");
    const jobs = [...imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }))), document.fonts.ready];
    let done = 0, forced = false, shown = 0;
    jobs.forEach((j) => j.then(() => done++));
    setTimeout(() => { forced = true; }, 6000); // never hold the page hostage
    const t0 = performance.now();
    const frame = (now) => {
      const target = forced ? 100 : (done / jobs.length) * 100;
      shown = Math.min(target, shown + Math.max(0.7, (target - shown) * 0.12));
      pct.textContent = Math.floor(shown) + "%";
      bar.style.transform = `scaleX(${shown / 100})`;
      if (shown >= 100 && now - t0 > 800) {
        el.classList.add("drain");
        setTimeout(() => { el.classList.add("out"); document.body.classList.add("ready"); }, 480);
        setTimeout(() => el.remove(), 1100);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  route();
  runLoader();
})();
