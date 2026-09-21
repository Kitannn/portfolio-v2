// THE ROUTE — the plain is not scenery any more, it is a CV you drive through.
//
// One road spirals out from where the car starts, and the six places Henry has actually worked are
// built along it in the order he worked them: QA at Keywords at the inner end, Ghost Fox Games out
// at the rim. Each stop is a gate over the road, a tower carrying the name, and billboards holding
// that project's real key art. The road itself changes colour from one era to the next, so you can
// tell how far through the history you are without reading a word.
//
// Everything here is static: built once, never updated, and merged down hard. The whole route is
// four structural draw calls plus one per signboard, which is why it can afford to be this big.
import * as THREE from "three";
import { mergeParts } from "./loft.js";
import { TAU } from "./util.js";

// ---- the spiral ----------------------------------------------------------------
// The radius grows steadily while the angle sweeps a little over two turns, which gives a road
// long enough that a five-minute run never simply falls off the end of it.
//
// Two details make it a road rather than a coil. The angle is eased (t^EASE), so the first stretch
// is nearly straight and only curls once there is room for it — a constant-rate spiral at r = 2 is
// a knot, not a road. And it is phased a quarter turn, which puts the start line directly in front
// of the car: the GR 86 spawns at the origin facing +Z, and this is what it is facing.
const R0 = 2, R1 = 222;
const TURNS = 2.2;
const EASE = 1.35;
const PHASE = Math.PI / 2;
export const ROAD_HALF = 9;          // half the drivable width

export const routeAt = (t) => {
  const r = R0 + (R1 - R0) * t;
  const a = PHASE + Math.pow(Math.max(0, t), EASE) * TURNS * TAU;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, a, r };
};

// ---- the history ---------------------------------------------------------------
// `t` is where along the spiral the stop sits. `art` are real files from the site, served from
// the medium thumbnails — full-size covers would be several megabytes of texture for something
// you drive past at 160 km/h.
const ART = "../thumbs/m/games/";

export const STOPS = [
  {
    t: 0.115, org: "KEYWORDS STUDIOS", sub: "QA DEVELOPMENT SUPPORT", when: "2019 — 2021",
    line: "Test plans, regression, node-based automation",
    accent: 0x56d06d, art: [],
  },
  {
    t: 0.265, org: "KEYWORDS — EA", sub: "GAME SECURITY ANALYST", when: "2021 — 2022",
    line: "Anti-cheat, Splunk dashboards, game integrity",
    accent: 0x6de0c0, art: [],
  },
  {
    t: 0.425, org: "EA SPORTS", sub: "FIFA MOBILE · GAME DESIGNER", when: "2022",
    line: "Live gameplay tuning, telemetry, weekly deploys",
    accent: 0x7cc6ff, art: [
      { file: "fifa-mobile-22.webp", cap: "FIFA MOBILE" },
      { file: "fifam-ultimate-team.webp", cap: "ULTIMATE TEAM" },
    ],
  },
  {
    t: 0.585, org: "EA", sub: "TECHNICAL GAME DESIGNER", when: "2022 — 2023",
    line: "Haxe on Impact, designer toolsets, World Cup live event",
    accent: 0x5f9bff, art: [
      { file: "fifam-angles.webp", cap: "FRONT-END FEATURES" },
    ],
  },
  {
    t: 0.745, org: "EA MAXIS", sub: "THE SIMS: TOWN STORIES", when: "2024 — 2026",
    line: "FTUE, quests and event loops · AMP, Unity, C#",
    accent: 0x56d06d, art: [
      { file: "sims-cover.webp", cap: "TOWN STORIES" },
      { file: "sims-store-1.webp", cap: "EVENT LOOPS" },
      { file: "sims-store-3.webp", cap: "QUESTS & FTUE" },
    ],
  },
  {
    t: 0.935, org: "GHOST FOX GAMES", sub: "GAME DIRECTOR · COSMIC CARNAGE", when: "2026 —",
    line: "Seven EA veterans · Roblox Incubator 2026",
    accent: 0xff5f8f, art: [
      { file: "cosmic-carnage-keyart.webp", cap: "COSMIC CARNAGE" },
      { file: "cc-boom.webp", cap: "CAR COMBAT" },
      { file: "gfg-logo.webp", cap: "GHOST FOX GAMES" },
    ],
  },
];

// ---- signage textures ------------------------------------------------------------
// Drawn to a canvas rather than loaded, because the text has to change per stop and a canvas is
// the cheapest way to get crisp type at whatever size the panel happens to be.
function gateTexture(stop) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 192;
  const g = c.getContext("2d");
  const hex = `#${stop.accent.toString(16).padStart(6, "0")}`;

  g.fillStyle = "#080a11";
  g.fillRect(0, 0, c.width, c.height);
  // a lit strip top and bottom, the way a real gantry sign is edge-lit
  g.fillStyle = hex;
  g.fillRect(0, 0, c.width, 5);
  g.fillRect(0, c.height - 5, c.width, 5);

  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = hex;
  g.font = '600 26px "IBM Plex Mono", monospace';
  g.fillText(stop.when, c.width / 2, 40);

  g.fillStyle = "#f2eefa";
  g.font = '400 64px Silkscreen, "IBM Plex Mono", monospace';
  g.fillText(stop.org, c.width / 2, 100);

  g.fillStyle = "rgba(242,238,250,.62)";
  g.font = '500 24px "IBM Plex Mono", monospace';
  g.fillText(stop.sub, c.width / 2, 152);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// The tall tower panel: the name set vertically, with the one-line summary under it.
function towerTexture(stop) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 1024;
  const g = c.getContext("2d");
  const hex = `#${stop.accent.toString(16).padStart(6, "0")}`;

  g.fillStyle = "#070910";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = hex;
  g.fillRect(0, 0, 4, c.height);
  g.fillRect(c.width - 4, 0, 4, c.height);

  g.save();
  g.translate(c.width / 2, c.height / 2);
  g.rotate(-Math.PI / 2);
  g.textAlign = "center";
  g.textBaseline = "middle";

  g.fillStyle = "#f2eefa";
  g.font = '400 58px Silkscreen, "IBM Plex Mono", monospace';
  g.fillText(stop.org, 0, -26);

  g.fillStyle = hex;
  g.font = '600 26px "IBM Plex Mono", monospace';
  g.fillText(stop.line, 0, 36);
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// The caption bar bolted under a billboard, so a screenshot is never just a floating picture.
function captionTexture(text, accent) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = "#080a11";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = `#${accent.toString(16).padStart(6, "0")}`;
  g.fillRect(0, c.height - 4, c.width, 4);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#e8e3f2";
  g.font = '400 44px Silkscreen, "IBM Plex Mono", monospace';
  g.fillText(text, c.width / 2, c.height / 2 - 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---- the road ------------------------------------------------------------------
// A ribbon built by walking the spiral and laying down a quad per step. The accent colour is a
// vertex attribute, so it crossfades from one era to the next along the tarmac itself.
function buildRoad() {
  const STEPS = 420;
  const pos = [], uv = [], col = [], idx = [];
  const c1 = new THREE.Color(), c2 = new THREE.Color(), cm = new THREE.Color();
  let run = 0;
  let prev = routeAt(0);

  // which two stops a point sits between, and how far along
  const accentAt = (t, out) => {
    let lo = STOPS[0], hi = STOPS[0];
    for (const s of STOPS) { if (s.t <= t) lo = s; }
    hi = STOPS.find((s) => s.t > t) || STOPS[STOPS.length - 1];
    const span = Math.max(1e-4, hi.t - lo.t);
    const k = THREE.MathUtils.clamp((t - lo.t) / span, 0, 1);
    c1.setHex(lo.accent); c2.setHex(hi.accent);
    return out.copy(c1).lerp(c2, k);
  };

  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const p = routeAt(t);
    if (i > 0) run += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;

    // the outward normal of the spiral, near enough: perpendicular to the step direction
    const q = routeAt(Math.min(1, t + 1 / STEPS));
    const r = routeAt(Math.max(0, t - 1 / STEPS));
    let dx = q.x - r.x, dz = q.z - r.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    // Rotate the heading a quarter turn to get the kerb offset. Which quarter turn does not matter
    // here — the ribbon is symmetric — but it does for everything built beside it, so see the note
    // on `nx` in buildRoute().
    const nx = dz, nz = -dx;

    accentAt(t, cm);
    for (const side of [-1, 1]) {
      pos.push(p.x + nx * ROAD_HALF * side, 0.02, p.z + nz * ROAD_HALF * side);
      uv.push(run, side < 0 ? 0 : 1);
      col.push(cm.r, cm.g, cm.b);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);

  const mat = new THREE.ShaderMaterial({
    // The ribbon is stitched in whatever winding the spiral happens to give it, which is not
    // reliably counter-clockwise from above — and a road you can only see from underneath is
    // exactly as useful as no road at all.
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uFog: { value: new THREE.Color(0x06060d) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec2 vUv;
      varying vec3 vAccent;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vAccent = color;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uCam, uFog;
      varying vec2 vUv;
      varying vec3 vAccent;
      varying vec3 vWorld;

      // an anti-aliased stripe centred on c, w wide, in whatever units v is in
      float stripe(float v, float c, float w) {
        float d = abs(v - c);
        return 1.0 - smoothstep(w, w + fwidth(v) * 1.5 + 0.004, d);
      }

      void main() {
        float along = vUv.x;            // metres travelled down the road
        float across = vUv.y;           // 0 at one kerb, 1 at the other

        vec3 col = vec3(0.035, 0.040, 0.058);                 // tarmac, darker than the plain

        // kerb lines, lit in the era's colour
        float kerb = stripe(across, 0.04, 0.02) + stripe(across, 0.96, 0.02);
        col = mix(col, vAccent, clamp(kerb, 0.0, 1.0) * 0.9);

        // dashed centre line
        float dash = step(0.55, fract(along * 0.085));
        col = mix(col, vec3(0.86, 0.85, 0.92), stripe(across, 0.5, 0.012) * dash * 0.75);

        // lane hatching, faint, just enough to read speed
        float rungs = step(0.9, fract(along * 0.05));
        col += vAccent * rungs * 0.06;

        // a pulse of light running the length of the road, outward
        float pulse = exp(-pow(fract(along * 0.0065 - uTime * 0.11) - 0.5, 2.0) * 160.0);
        col += vAccent * pulse * 0.55;

        // glow bleeding inward from the kerbs, so the road reads as lit rather than painted
        float bleed = smoothstep(0.42, 0.0, min(across, 1.0 - across));
        col += vAccent * bleed * 0.10;

        float d = length(vWorld.xz - uCam.xz);
        float f = 1.0 - exp(-pow(d * 0.0052, 2.0));
        col = mix(col, uFog, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0 - clamp(f * 0.9, 0.0, 0.92));
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// ---- structure -------------------------------------------------------------------
// Every dark post, leg, gantry and plinth in the whole route is one geometry; every lit band is
// one instanced box. Two draw calls for the entire build.
// Light enough to read as concrete and steel rather than a hole in the world — these are meant
// to be prominent, and a near-black tower against a near-black plain is just a missing shape.
const DARK = new THREE.MeshStandardMaterial({ color: 0x2a2f3e, roughness: 0.74, metalness: 0.3, flatShading: true });

export function buildRoute(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const road = buildRoad();
  group.add(road.mesh);

  const solids = [];                 // parts fed to mergeParts, in world space
  const bands = [];                  // { m: Matrix4, c: Color } for the lit strips
  const bandCol = [];
  const panels = [];                 // textured planes, added individually

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  // a box placed in world space and rotated about Y, pushed into the merge list
  const box = (w, h, d, x, y, z, yaw) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(yaw);
    g.translate(x, y, z);
    solids.push({ geo: g, mat: 0 });
  };
  const band = (w, h, d, x, y, z, yaw, colour) => {
    bands.push(M.clone().compose(new THREE.Vector3(x, y, z), Q.clone().setFromAxisAngle(UP, yaw), new THREE.Vector3(w, h, d)));
    bandCol.push(new THREE.Color(colour));
  };
  // A lit, textured plane — these are the only per-object draw calls the route spends. Single
  // sided on purpose: a double-sided sign shows its own text mirrored from behind, and there is
  // always a dark box immediately behind one of these to be the blank back of the board.
  const panel = (tex, w, h, x, y, z, yaw, { opacity = 1 } = {}) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide, toneMapped: false, transparent: opacity < 1, opacity })
    );
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    panels.push(m);
    return m;
  };

  const loader = new THREE.TextureLoader();

  for (const stop of STOPS) {
    const here = routeAt(stop.t);
    // the road's heading at this point, and the outward normal
    const ahead = routeAt(Math.min(1, stop.t + 0.004));
    const back = routeAt(Math.max(0, stop.t - 0.004));
    const dx = ahead.x - back.x, dz = ahead.z - back.z;
    const len = Math.hypot(dx, dz) || 1;
    const hx = dx / len, hz = dz / len;                 // heading
    // Outward from the spiral, not inward. The spiral runs anticlockwise, so the heading turned a
    // quarter the OTHER way is the one that points away from the centre — get this backwards and
    // every tower is built on the wrong side of its own road, stacked over the middle of the map.
    const nx = hz, nz = -hx;
    // a plane facing across the road wants its normal along the heading
    const faceRoad = Math.atan2(hx, hz);
    const faceSide = Math.atan2(nx, nz);
    // world position from road-local (sideways, forward) offsets
    const at = (side, fwd) => [here.x + nx * side + hx * fwd, here.z + nz * side + hz * fwd];

    // ---- gate over the road ----
    const GATE_H = 21, PILLAR = 3.4, SPAN = ROAD_HALF + 3.2;
    for (const s of [-1, 1]) {
      const [px, pz] = at(SPAN * s, 0);
      box(PILLAR, GATE_H, PILLAR, px, GATE_H / 2, pz, faceRoad);
      // a lit rib up each pillar
      band(PILLAR * 1.08, GATE_H * 0.62, 0.5, px, GATE_H * 0.46, pz + 0, faceRoad, stop.accent);
    }
    // The gantry itself, with a board bolted to each face — you meet these gates driving in both
    // directions, and a sign you can only read one way round is half a sign.
    box(SPAN * 2 + PILLAR, 5.4, 2.6, here.x, GATE_H - 2.2, here.z, faceRoad);
    const gateTex = gateTexture(stop);
    panel(gateTex, SPAN * 2 - 1, 4.4, here.x + hx * 1.45, GATE_H - 2.2, here.z + hz * 1.45, faceRoad);
    panel(gateTex, SPAN * 2 - 1, 4.4, here.x - hx * 1.45, GATE_H - 2.2, here.z - hz * 1.45, faceRoad + Math.PI);
    band(SPAN * 2 + PILLAR + 0.6, 0.55, 3.0, here.x, GATE_H - 5.2, here.z, faceRoad, stop.accent);

    // ---- the name tower, outside the curve ----
    const TOWER_H = 46, TOWER_W = 9;
    const [tx, tz] = at(ROAD_HALF + 20, -14);
    box(TOWER_W, TOWER_H, 5.5, tx, TOWER_H / 2, tz, faceSide);
    box(TOWER_W + 5, 2.2, 9, tx, 1.1, tz, faceSide);              // plinth, so it lands on the ground
    band(TOWER_W + 0.5, 1.4, 6.0, tx, TOWER_H - 2.5, tz, faceSide, stop.accent);
    band(TOWER_W + 0.5, 1.4, 6.0, tx, 4.4, tz, faceSide, stop.accent);
    const towerTex = towerTexture(stop);
    // the lettering goes on the road-facing side, which is the only side anyone drives past
    panel(towerTex, TOWER_W - 0.8, TOWER_H - 9, tx - nx * 2.9, TOWER_H / 2, tz - nz * 2.9, faceSide + Math.PI);

    // ---- billboards, stepped back along the road on the outside ----
    stop.art.forEach((a, i) => {
      const BW = 27, BH = 15.2;                  // 16:9, and wide enough to read at speed
      const footY = 11;
      const [bx, bz] = at(ROAD_HALF + 13 + (i % 2) * 5, 22 + i * 30);
      // two legs and a spine
      for (const s of [-1, 1]) {
        const lx = bx + hx * (BW * 0.33) * s, lz = bz + hz * (BW * 0.33) * s;
        box(2.0, footY, 2.0, lx, footY / 2, lz, faceSide);
      }
      box(BW + 2.4, BH + 2.4, 1.3, bx, footY + BH / 2 + 1.2, bz, faceSide);      // the frame
      band(BW + 3.0, 0.7, 1.9, bx, footY + BH + 2.8, bz, faceSide, stop.accent);  // light bar on top
      band(BW + 3.0, 0.7, 1.9, bx, footY - 0.2, bz, faceSide, stop.accent);       // ...and under

      // the key art, pushed just proud of the frame on the side facing the road
      const off = 0.95;
      const art = panel(null, BW, BH, bx - nx * off, footY + BH / 2 + 1.2, bz - nz * off, faceSide + Math.PI);
      art.material.color.setHex(0x222634);      // a plate until the image lands
      loader.load(ART + a.file, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        art.material.map = tex;
        art.material.color.setHex(0xffffff);
        art.material.needsUpdate = true;
      });
      panel(captionTexture(a.cap, stop.accent), BW, 2.5, bx - nx * off, footY - 1.9, bz - nz * off, faceSide + Math.PI);
    });
  }

  // ---- the terminus ----
  // The road runs out at Ghost Fox Games, which is where the run is heading and where the Colossus
  // turns up. It gets a wall rather than a gate: three panels facing back down the road, so the
  // last thing ahead of you is the studio, not more tarmac.
  {
    const end = routeAt(1);
    const before = routeAt(0.992);
    const hx = (end.x - before.x), hz = (end.z - before.z);
    const len = Math.hypot(hx, hz) || 1;
    const face = Math.atan2(hx / len, hz / len);
    const gfg = STOPS[STOPS.length - 1];
    const ex = end.x + (hx / len) * 26, ez = end.z + (hz / len) * 26;

    box(74, 30, 4, ex, 15, ez, face);
    box(84, 4, 10, ex, 30.5, ez, face);
    band(84, 1.1, 11, ex, 32.8, ez, face, gfg.accent);
    band(74, 0.9, 5, ex, 1.2, ez, face, gfg.accent);
    for (const s of [-1, 1]) {
      box(6, 40, 6, ex + Math.cos(face) * 40 * s, 20, ez - Math.sin(face) * 40 * s, face);
      band(6.6, 1.2, 6.6, ex + Math.cos(face) * 40 * s, 38, ez - Math.sin(face) * 40 * s, face, gfg.accent);
    }

    const back = -(hx / len), backZ = -(hz / len);
    panel(gateTexture({ ...gfg, org: "GHOST FOX GAMES", sub: "END OF THE LINE", when: "COSMIC CARNAGE" }),
      66, 12.4, ex + back * 2.2, 21, ez + backZ * 2.2, face + Math.PI);
    const wall = panel(null, 62, 11, ex + back * 2.2, 8.5, ez + backZ * 2.2, face + Math.PI);
    wall.material.color.setHex(0x222634);
    loader.load(ART + "cc-tornado.webp", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      wall.material.map = tex;
      wall.material.color.setHex(0xffffff);
      wall.material.needsUpdate = true;
    });
  }

  // ---- fold it all down ----
  const merged = new THREE.Mesh(mergeParts(solids), [DARK]);
  merged.castShadow = false;
  merged.receiveShadow = false;
  merged.frustumCulled = false;
  group.add(merged);

  const bandMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    bands.length
  );
  bandMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bands.length * 3), 3);
  bands.forEach((m, i) => {
    bandMesh.setMatrixAt(i, m);
    bandMesh.setColorAt(i, bandCol[i]);
  });
  bandMesh.instanceMatrix.needsUpdate = true;
  bandMesh.instanceColor.needsUpdate = true;
  bandMesh.frustumCulled = false;
  group.add(bandMesh);

  for (const p of panels) group.add(p);

  return {
    group,
    // the last stop is the one the boss is meant to arrive over
    finale: routeAt(STOPS[STOPS.length - 1].t),
    update(dt, t, camera) {
      road.mat.uniforms.uTime.value = t;
      road.mat.uniforms.uCam.value.copy(camera.position);
    },
  };
}
