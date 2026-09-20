// Feature switches for the "less like 109ichiki" redesign. Each one can be turned off on its own:
// set it to false here to go back to the previous version of that piece. Nothing else needs to change.
//
// To compare quickly in a browser, open the site with ?features in the URL (e.g. localhost:8768/?features#/).
// A small panel lists every switch; ticking/unticking saves an override in this browser only and reloads.
// "Reset" clears the overrides so the defaults below apply again.
(() => {
  const DEFAULTS = {
    devices: true,      // hero: 3D game gadgets (Game Boy Color, DS, Switch 2, iPhone) with live screens and modelled backs (false = the 3D clouds)
    viewfinder: true,   // status bar: ISO/shutter/battery camera readout (false = just the clock)
    gameMenu: true,     // nav: START / WORK / PROFILE / CONTACT game menu (false = HOME / WORK / PROFILE / CONTACT pills)
    cartridge: true,    // home reel: cartridge select screen (false = VHS tape: PLAY, timecode, NO FEED)
    slots: true,        // section headers: SLOT 01 · 07Y03M in games save slots (real times) and LOAD links (false = (KICKER) + (LINK))
    inputString: true,  // barcodes: click one to reveal a controller code (Konami code etc.) you can light up (false = plain barcode)
    filmStrip: false,   // barcodes drawn as a film-strip edge instead (false = the original barcode)
    yolkTheme: true,    // theme dots: adds a third, pale yolk-yellow theme (false = dark / light only)
    tuckNav: true,      // header: Instagram / GitHub pills hide off-screen until the cursor visits that corner (false = always shown)
    fontToggle: true,   // status bar: FONT button to switch titles to a pixel display font (false = no button)
  };
  let over = {};
  try { over = JSON.parse(localStorage.getItem("kv2-features") || "{}"); } catch {}
  const F = (window.FEATURES = { ...DEFAULTS, ...over });
  const root = document.documentElement;
  for (const k in DEFAULTS) root.classList.toggle(`f-${k}`, !!F[k]);

  if (!/[?&]features\b/.test(location.search)) return;
  addEventListener("DOMContentLoaded", () => {
    const p = document.createElement("div");
    p.className = "ff-panel";
    p.innerHTML = `<b>Features</b>${Object.keys(DEFAULTS).map((k) => `<label><input type="checkbox" data-k="${k}"${F[k] ? " checked" : ""}> ${k}${k in over ? " *" : ""}</label>`).join("")}<button type="button" data-reset>Reset to defaults</button>`;
    p.addEventListener("change", (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      over[k] = e.target.checked;
      if (over[k] === DEFAULTS[k]) delete over[k];
      try { localStorage.setItem("kv2-features", JSON.stringify(over)); } catch {}
      location.reload();
    });
    p.querySelector("[data-reset]").addEventListener("click", () => { try { localStorage.removeItem("kv2-features"); } catch {} location.reload(); });
    document.body.appendChild(p);
  });
})();
