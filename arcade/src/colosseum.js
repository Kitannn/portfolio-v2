// THE COLOSSEUM — the arena is a stadium, and the stands are the CV.
//
// A bowl of stepped seating rings the whole play area, divided into six wedges, one for each place
// Henry has actually worked. Each wedge is lit in its own colour from the podium wall to the crown,
// carries the name across the barrier you drive along, and holds that project's real key art on the
// upper tier. Oldest job to newest runs clockwise from the start line; Ghost Fox Games gets the
// grand stand opposite it, which is the one you are looking at when the Colossus lands.
//
// The floor is untouched — ARENA is still the full 260 m radius it always was, so there is exactly
// as much room to drive and dodge as before. All of this is built outside it.
//
// It is cheap for its size: the entire bowl is ONE lathed profile revolved around the arena, tinted
// per wedge with a vertex colour, so the seating, the barrier and the crown together cost a single
// draw call. Only the signage is drawn per object.
import * as THREE from "three";
import { ARENA } from "./world.js";
import { TAU } from "./util.js";

const SEGMENTS = 120;          // around the bowl; 120 puts a sector boundary exactly on a seam
const PODIUM_H = 11;           // the barrier at the edge of the floor, where the names go
const TIERS = 10;
const TIER_RISE = 3.6;
const TIER_RUN = 4.0;
const ART_BOTTOM = 47;         // the vertical band above the seating that the key art hangs on
const ART_TOP = 96;            // 49 m of band: enough for a 66 m wide 16:9 panel and a caption
const CROWN = 110;

const ART = "../thumbs/m/games/";

// ---- the six stands --------------------------------------------------------------
// Ordered as they are worked through. `art` are real files from the site, served from the medium
// thumbnails — a full-size cover is several megabytes of texture for something hung 260 m away.
export const STANDS = [
  {
    org: "KEYWORDS STUDIOS", role: "QA DEVELOPMENT SUPPORT III", when: "2019 — 2021",
    line: "Test plans, regression, node-based automation",
    duties: [
      "Test plans and regression for live content",
      "Node-based automation for validation",
      "QA process docs; trained analysts",
    ],
    accent: 0x56d06d, art: [],
  },
  {
    org: "KEYWORDS — EA", role: "GAME SECURITY ANALYST", when: "2021 — 2022",
    line: "Anti-cheat, Splunk dashboards, game integrity",
    duties: [
      "Anti-cheat and game-integrity enforcement",
      "Python and Splunk threat investigation",
      "Dashboards for player data and health",
    ],
    accent: 0x4fd6c0, art: [],
  },
  {
    org: "EA SPORTS", role: "GAME DESIGNER · FIFA MOBILE", when: "2022",
    line: "Live gameplay tuning, telemetry, weekly deploys",
    duties: [
      "Tuned live gameplay from telemetry",
      "Owned weekly live content deploys",
      "Front-end feature design and prototyping",
    ],
    accent: 0x7cc6ff, art: [
      { file: "fifa-mobile-22.webp", cap: "FIFA MOBILE" },
      { file: "fifam-ultimate-team.webp", cap: "ULTIMATE TEAM" },
    ],
  },
  {
    org: "EA", role: "TECHNICAL GAME DESIGNER · FIFA MOBILE", when: "2022 — 2023",
    line: "Haxe on Impact, designer toolsets, World Cup live event",
    duties: [
      "Front-end features in Haxe on Impact",
      "Designer toolsets in C++ and Haxe",
      "2022 World Cup event — record DAU",
    ],
    accent: 0x5f9bff, art: [
      { file: "fifam-angles.webp", cap: "FRONT-END FEATURES" },
      { file: "fcm-gameplay.webp", cap: "LIVE CONTENT" },
    ],
  },
  {
    org: "EA MAXIS", role: "GAME DESIGNER · THE SIMS: TOWN STORIES", when: "2024 — 2026",
    line: "FTUE, quests and event loops · AMP, Unity, C#",
    duties: [
      "FTUE, quests and event loops",
      "Event logic in AMP; tools in Unity C#",
      "Technical design docs in Jira / Confluence",
    ],
    accent: 0x56d06d, art: [
      { file: "sims-cover.webp", cap: "TOWN STORIES" },
      { file: "sims-store-1.webp", cap: "EVENT LOOPS" },
      { file: "sims-store-3.webp", cap: "QUESTS & FTUE" },
    ],
  },
  {
    org: "GHOST FOX GAMES", role: "CO-FOUNDER / GAME DIRECTOR · COSMIC CARNAGE", when: "2026 —",
    line: "Seven EA veterans · Roblox Incubator 2026",
    duties: [
      "PvP vehicular combat and weapon systems",
      "NPC AI — pathing, targeting, threat",
      "Match structure and system documentation",
    ],
    accent: 0xff5f8f, grand: true, art: [
      { file: "cosmic-carnage-keyart.webp", cap: "COSMIC CARNAGE" },
      { file: "gfg-logo.webp", cap: "GHOST FOX GAMES" },
      { file: "cc-boom.webp", cap: "CAR COMBAT" },
    ],
  },
];

const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;

// A flat panel spanning a chord of a circle bulges away from the wall in the middle and buries its
// ENDS in it. Set it back by exactly that bulge and the ends come to rest on the concrete instead
// of inside it — without this a 118 m headline reads as "WORDS STUD", with both ends swallowed.
const setBack = (radius, width) => radius - (radius - Math.sqrt(Math.max(0, radius * radius - (width / 2) * (width / 2))));

// ---- signage ---------------------------------------------------------------------
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), c);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// The name across the barrier — the thing you read while driving along the edge of the floor.
const barrierTex = (s) => canvasTex(2048, 256, (g, c) => {
  g.fillStyle = "#080a11";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = hex(s.accent);
  g.fillRect(0, 0, c.width, 6);
  g.fillRect(0, c.height - 6, c.width, 6);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = hex(s.accent);
  g.font = '600 34px "IBM Plex Mono", monospace';
  g.fillText(s.when, c.width / 2, 52);
  g.fillStyle = "#f4f1fa";
  g.font = '400 92px Silkscreen, "IBM Plex Mono", monospace';
  g.fillText(s.org, c.width / 2, 130);
  g.fillStyle = "rgba(244,241,250,.66)";
  g.font = '500 32px "IBM Plex Mono", monospace';
  g.fillText(s.role, c.width / 2, 202);
});

// The duty board: what the job actually was. Hung on the band beside the key art, so a stand with
// no shipped art to show still has something on its wall.
const dutyTex = (s, big) => canvasTex(1024, big ? 512 : 720, (g, c) => {
  g.fillStyle = "#080a11";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = hex(s.accent);
  g.fillRect(0, 0, c.width, 8);
  g.fillRect(0, c.height - 8, c.width, 8);
  g.textAlign = "center";
  g.textBaseline = "middle";

  g.fillStyle = hex(s.accent);
  g.font = `600 ${big ? 40 : 46}px "IBM Plex Mono", monospace`;
  g.fillText("RESPONSIBILITIES", c.width / 2, big ? 66 : 82);

  // The role repeats here on purpose: the barrier carrying it is eleven metres off the ground and
  // ninety behind you by the time you are looking up at this.
  g.fillStyle = "#f4f1fa";
  g.font = `400 ${big ? 34 : 40}px Silkscreen, "IBM Plex Mono", monospace`;
  wrap(g, s.role, c.width - 90, c.width / 2, big ? 124 : 158, big ? 44 : 52);

  g.textAlign = "left";
  g.fillStyle = "rgba(244,241,250,.82)";
  const size = big ? 36 : 44;
  g.font = `500 ${size}px "IBM Plex Mono", monospace`;
  let y = big ? 228 : 320;
  for (const d of s.duties) {
    g.fillStyle = hex(s.accent);
    g.fillText("\u25b8", 54, y);
    g.fillStyle = "rgba(244,241,250,.82)";
    y = wrap(g, d, c.width - 140, 104, y, size * 1.24) + size * 1.5;
  }
});

// Very small word wrapper — enough for three short lines of duty text and a job title.
function wrap(g, text, maxWidth, x, y, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxWidth && line) {
      g.fillText(line, x, cy);
      cy += lineHeight;
      line = w;
    } else line = test;
  }
  if (line) g.fillText(line, x, cy);
  return cy;
}

// The headline on the upper tier, readable from right across the arena.
const crownTex = (s) => canvasTex(2048, 192, (g, c) => {
  g.clearRect(0, 0, c.width, c.height);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = hex(s.accent);
  g.font = '400 104px Silkscreen, "IBM Plex Mono", monospace';
  g.fillText(s.org, c.width / 2, 74);
  g.fillStyle = "rgba(244,241,250,.72)";
  g.font = '500 36px "IBM Plex Mono", monospace';
  g.fillText(s.line, c.width / 2, 150);
});

const captionTex = (text, accent) => canvasTex(1024, 96, (g, c) => {
  g.fillStyle = "#080a11";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = hex(accent);
  g.fillRect(0, c.height - 5, c.width, 5);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#e8e3f2";
  g.font = '400 46px Silkscreen, "IBM Plex Mono", monospace';
  g.fillText(text, c.width / 2, c.height / 2 - 4);
});

// ---- step lights -----------------------------------------------------------------
// A raked slope in one flat colour reads as a wall, not as seating. A lit nosing on every step is
// what actually says "steps" — the same trick a real stadium uses. It goes on the RISER, the
// vertical face, not along the top of the tread: from a car on the floor you are looking up at
// this thing, and a strip lying flat on a tread is edge-on and invisible from down there.
// All ten rings are one geometry, so the whole lot is a single draw call.
function tierLights() {
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  let base = 0;
  for (let t = 0; t < TIERS; t++) {
    const r = ARENA + 4 + t * TIER_RUN - 0.06;          // a hair proud of the riser it sits on
    const y = PODIUM_H + (t + 1) * TIER_RISE;
    for (let i = 0; i <= SEGMENTS; i++) {
      const f = i / SEGMENTS;
      const a = f * TAU;
      const sector = Math.min(STANDS.length - 1, Math.floor(f * STANDS.length));
      c.setHex(STANDS[sector].accent);
      const sn = Math.sin(a), cs = Math.cos(a);
      pos.push(sn * r, y, cs * r, sn * r, y - 0.85, cs * r);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i > 0) {
        const v = base + (i - 1) * 2;
        idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    base += (SEGMENTS + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// ---- the bowl --------------------------------------------------------------------
// One profile, revolved. Read bottom to top: the barrier you drive along, a walkway, ten steps of
// seating, the vertical band the key art hangs on, and a parapet with the sky behind it.
function bowlProfile() {
  const pts = [new THREE.Vector2(ARENA, 0), new THREE.Vector2(ARENA, PODIUM_H)];
  let r = ARENA + 4, y = PODIUM_H;
  pts.push(new THREE.Vector2(r, y));
  for (let i = 0; i < TIERS; i++) {
    y += TIER_RISE; pts.push(new THREE.Vector2(r, y));     // riser
    r += TIER_RUN;  pts.push(new THREE.Vector2(r, y));     // tread
  }
  pts.push(new THREE.Vector2(r, ART_TOP));                  // the art band, vertical
  pts.push(new THREE.Vector2(r + 10, ART_TOP));             // crown walkway
  pts.push(new THREE.Vector2(r + 10, CROWN));               // parapet
  pts.push(new THREE.Vector2(r + 18, CROWN));
  pts.push(new THREE.Vector2(r + 18, 0));                   // outer skirt, straight to the ground
  return { pts, artR: r, outerR: r + 18 };
}

// Paint each wedge in its stand's colour. LatheGeometry's uv.x IS the angle around the revolution,
// which saves working it back out of the positions — and with the segment count a multiple of six,
// every boundary lands on a seam, so the wedges have crisp edges rather than a smear.
function tintBySector(geo, shade) {
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const sector = Math.min(STANDS.length - 1, Math.floor(uv.getX(i) * STANDS.length));
    c.setHex(STANDS[sector].accent);
    if (shade) shade(c, pos.getY(i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

export function buildColosseum(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const { pts, artR, outerR } = bowlProfile();

  // ---- the structure itself ----
  const bowl = new THREE.LatheGeometry(pts, SEGMENTS);
  // Concrete, not neon: the wedge colour is mixed down to a tint so the stands read as a coloured
  // stand rather than a glowing one, and the barrier at the bottom keeps more of it because that
  // is the part you are nose to nose with.
  tintBySector(bowl, (c, y) => {
    // Strongest on the barrier you drive along, fading up the rake so the colour reads as a stand
    // lit in its own colour rather than as a solid slab of paint.
    const lit = y < PODIUM_H + 1 ? 0.62 : 0.30;
    c.lerp(new THREE.Color(0x2b3140), 1 - lit);
  });
  const bowlMesh = new THREE.Mesh(bowl, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, metalness: 0.06, flatShading: true,
    // A touch of self-illumination. The key light is a single direction, so without this the half
    // of the bowl facing away from it is a silhouette, and half the work history is unreadable.
    emissive: 0x20242f, emissiveIntensity: 1,
    side: THREE.DoubleSide,     // the camera is inside it, and a lathe's facing is not worth guessing
  }));
  bowlMesh.frustumCulled = false;
  group.add(bowlMesh);

  const steps = new THREE.Mesh(tierLights(), new THREE.MeshBasicMaterial({
    vertexColors: true, toneMapped: false, side: THREE.DoubleSide,
    transparent: true, opacity: 0.7,
  }));
  steps.frustumCulled = false;
  group.add(steps);

  // ---- the lit rings: one along the top of the barrier, one under the crown ----
  const band = (radius, y, thick) => {
    const g = new THREE.LatheGeometry([
      new THREE.Vector2(radius, y), new THREE.Vector2(radius, y + thick),
    ], SEGMENTS);
    tintBySector(g);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, toneMapped: false, side: THREE.DoubleSide,
    }));
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  band(ARENA - 0.25, PODIUM_H - 1.1, 0.9);     // the strip you follow round the edge of the floor
  band(artR - 0.3, ART_BOTTOM + 0.4, 1.0);     // where the seating stops and the art band starts
  band(artR + 9.7, ART_TOP + 0.8, 1.2);        // the crown

  // ---- vertical work: stairs up the seating, and floodlight masts on the crown ----
  const dark = new THREE.MeshStandardMaterial({ color: 0x141822, roughness: 0.9, metalness: 0.1, flatShading: true });
  // Floodlights, on the wedge boundaries only. There used to be gangway slabs up the seating as
  // well, on the boundaries AND down the middle of each stand — which put a thirty-metre black
  // box directly in front of half the key art. The step lights do that job now without standing
  // in front of anything.
  const MASTS = STANDS.length;
  const masts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dark, MASTS);
  const lamps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ toneMapped: false, color: 0xfff4d6 }),
    MASTS
  );
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  // A lathe puts phi=0 on +Z: x = r·sin(phi), z = r·cos(phi). Everything hung on the bowl has to
  // use the same convention or the signage drifts off its own wedge.
  const at = (a, r, y) => V.set(Math.sin(a) * r, y, Math.cos(a) * r);

  for (let i = 0; i < MASTS; i++) {
    const a = (i / MASTS) * TAU;                        // exactly on the seams between stands
    Q.setFromAxisAngle(UP, a);
    masts.setMatrixAt(i, M.compose(at(a, artR + 10, CROWN + 9), Q, S.set(2.2, 18, 2.2)));
    lamps.setMatrixAt(i, M.compose(at(a, artR + 8.4, CROWN + 17), Q, S.set(6.0, 1.8, 3.0)));
  }
  for (const m of [masts, lamps]) { m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; group.add(m); }

  // ---- signage ---------------------------------------------------------------------
  const loader = new THREE.TextureLoader();
  const panel = (tex, w, h, a, r, y, { transparent = false } = {}) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent, side: THREE.FrontSide })
    );
    m.position.copy(at(a, setBack(r, w) - 0.5, y));
    m.rotation.y = a + Math.PI;        // face the middle of the arena, which is where everyone is
    group.add(m);
    return m;
  };

  const WEDGE = TAU / STANDS.length;
  STANDS.forEach((s, i) => {
    const mid = (i + 0.5) * WEDGE;

    // the name along the barrier — what you read driving the edge of the floor
    panel(barrierTex(s), 96, 9, mid, ARENA, 5.6);

    // and the headline up on the parapet, clear of the art, readable from the far side
    panel(crownTex(s), 124, 12, mid, artR + 9.4, ART_TOP + 6.5, { transparent: true });

    // The band is laid out as one row of boards: every piece of key art, then the duty board,
    // measured in metres of arc and converted to angle at the end. Spacing them by arc length
    // rather than by a fraction of the wedge is what keeps a stand with one board and a stand
    // with four looking like they belong to the same building.
    const boards = [...s.art.map((a) => ({ art: a })), { duty: true }];
    const artW = s.art.length >= 3 ? 62 : 70;
    const dutyW = s.art.length ? 44 : 104;      // an empty wall gets a much bigger board
    const widths = boards.map((bd) => (bd.duty ? dutyW : artW));
    const GAP = 11;
    const span = widths.reduce((t, w) => t + w, 0) + GAP * (boards.length - 1);
    const artH = artW * 9 / 16;
    const midY = ART_BOTTOM + 7 + artH / 2;

    let cursor = -span / 2;
    boards.forEach((bd, k) => {
      const w = widths[k];
      const off = (cursor + w / 2) / artR;      // arc length to radians
      cursor += w + GAP;

      if (bd.duty) {
        const h = s.art.length ? artH : artH * 1.12;
        panel(dutyTex(s, !!s.art.length), w, h, mid + off, artR, midY);
        return;
      }
      const h = w * 9 / 16;
      const art = panel(null, w, h, mid + off, artR, midY);
      art.material.color.setHex(0x1d2130);      // a plate until the image lands
      loader.load(ART + bd.art.file, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        art.material.map = tex;
        art.material.color.setHex(0xffffff);
        art.material.needsUpdate = true;
      });
      panel(captionTex(bd.art.cap, s.accent), w, 4.2, mid + off, artR, midY - h / 2 - 3.2);
    });
  });

  return {
    group,
    // the middle of the Ghost Fox stand, for anything that wants to point at the end of the story
    finale: { x: Math.sin(5.5 * WEDGE) * ARENA, z: Math.cos(5.5 * WEDGE) * ARENA },
    outerR,
    update() { /* the stands do not move */ },
  };
}
