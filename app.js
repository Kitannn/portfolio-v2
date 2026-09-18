// kitannn° portfolio v2 — renders everything from data.js (synced from the main site)
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
      <div>(c) ${esc(S.handle)} ${new Date().getFullYear()} · ${esc(S.name)}<br><a href="https://kitannn.com">← classic site</a></div>
      <a href="#top" data-top>Back to top ↑</a>
      ${barcode(S.handle)}
    </footer>`;

  // ---------- pages ----------
  const heroWindows = [
    { id: "portrait", title: "portrait.jpg", src: S.portrait, x: 9, y: 18, w: 230, h: 290, depth: 18, href: "#/profile" },
    { id: "cc", title: "cosmic_carnage.jpg", src: games[0]?.cover, x: 27, y: 50, w: 330, h: 205, depth: 30, href: `#/works/${slug(games[0]?.title || "")}` },
    { id: "photo", title: "tokyo.jpg", src: photos[0]?.cover, x: 53, y: 57, w: 210, h: 250, depth: 12, href: `#/works/${slug(photos[0]?.title || "")}` },
    { id: "sims", title: "town_stories.webp", src: games[1]?.cover, x: 48, y: 17, w: 250, h: 165, depth: 24, href: `#/works/${slug(games[1]?.title || "")}` },
  ];
  let cloudSeed = 0;
  const cloud = (style, depth) => `<div class="layer" data-depth="${depth}"><div class="cloud" style="${style}"><canvas data-gl="cloud" data-seed="${(cloudSeed++ % 3) * 1.7}"></canvas><i></i><i></i><i></i><i></i></div></div>`;
  const holoWords = ["game design", "technical design", "content design", "photography", S.location, "roblox incubator 2026"];
  const holo = () => `
    <div class="holo" aria-hidden="true"><canvas data-gl="holo"></canvas>
      <div class="marquee"><div class="track">${[0, 1].map(() => `<span>${holoWords.map((w) => `${esc(S.handle)} ✦ ${esc(w)} ✦ `).join("")}</span>`).join("")}</div></div>
    </div>`;

  const pages = {
    home: () => `
      <section class="hero" id="top">
        <div class="layer" data-depth="6"><div class="hero-grid"><canvas data-gl="grid" data-cells="12,10" data-amp="0.024"></canvas>${warpSvg(12, 10, 2.4)}</div></div>
        <div class="layer" data-depth="10"><div class="hero-birb"><img src="${esc(asset("images/birbkit-1024.jpg"))}" alt="birbKit, ${esc(first)}'s avatar"></div></div>
        ${heroWindows.filter((w) => w.src).map((w, i) => `
          <div class="layer" data-depth="${w.depth}">
            <div class="win float-win" data-win="${w.id}" style="left:${w.x}%;top:${w.y}%;width:${w.w}px;height:${w.h}px;z-index:${10 + i}">
              <div class="win-bar"><span>${esc(w.title)}</span><button class="win-x" type="button" aria-label="Close window" data-winclose>×</button></div>
              <div class="win-body">${w.href ? `<a href="${w.href}" aria-label="Open ${esc(w.title)}">` : ""}<img src="${esc(asset(w.src))}" alt="" draggable="false" style="${w.img || ""}">${w.href ? "</a>" : ""}</div>
            </div>
          </div>`).join("")}
        ${cloud("left:7%;top:8%;width:130px", 40)}
        ${cloud("right:3%;top:5%;width:110px;animation-delay:-3s", 34)}
        ${cloud("left:40%;bottom:-2%;width:150px;animation-delay:-6s", 46)}
        <div class="hero-caption"><p>${esc(S.handle)}<br>game design<br>portfolio</p>${barcode(S.name)}</div>
        <button class="pill ghost restore" type="button" hidden>Restore windows ↺</button>
        <div class="hero-hint">drag the windows ↗</div>
      </section>
      ${holo()}

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
        ${secHead("Works", "Games first — live service, mobile and Roblox — then side projects.", ["All works", "#/works"])}
        <div class="works-grid">${S.work.filter((w) => w.featured).map(workCard).join("")}</div>
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
            <div class="win"><div class="win-bar"><span>portrait.jpg</span><span>${esc(S.handle)}</span></div>
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
      <div class="m-foot"><span>(c) ${esc(S.handle)} · ${esc(w.year)}</span>${barcode(w.title)}</div>`;
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

  // ---------- hero: parallax + draggable windows ----------
  const initHero = () => {
    const hero = app.querySelector(".hero");
    if (!hero) return;
    const layers = [...hero.querySelectorAll(".layer")];
    if (!reduceMotion && matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        layers.forEach((l) => { const d = +l.dataset.depth; l.style.transform = `translate(${-nx * d}px, ${-ny * d}px)`; });
      });
    }
    let z = 20;
    const restore = hero.querySelector(".restore");
    hero.querySelectorAll(".float-win").forEach((win) => {
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
      hero.querySelectorAll(".float-win").forEach((w) => w.classList.remove("closed"));
      restore.hidden = true;
    });
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
      window.KGL?.unmount();
      app.innerHTML = pages[page](workFilter);
      window.KGL?.mount(app);
      document.querySelectorAll(".pill-nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
      if (page === "works") renderWorks();
      initWarps();
      initHero();
      reveal();
      if (!id) scrollTo({ top: 0, behavior: "instant" });
    }
    const w = id && S.work.find((x) => slug(x.title) === id);
    if (w) {
      openModal(w);
      document.title = `${w.title} — ${S.handle}`;
    } else {
      closeModal();
      document.title = `${S.handle} — ${page === "home" ? "Portfolio v2" : page[0].toUpperCase() + page.slice(1)}`;
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
  document.getElementById("mark-text").textContent = S.handle;
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

  route();
})();
