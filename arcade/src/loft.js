// Lofting helper — the whole car body is built from this rather than shipping a model file.
//
// A "station" is a cross-section of the car at some z (nose is +z). Every station emits the SAME
// number of outline points, so consecutive stations can simply be stitched together with quads.
// That lets one table of numbers describe the nose taper, the wheel arches, the haunches and the
// tapered tail — which is what makes the silhouette read as a specific car rather than a box.
import * as THREE from "three";

const ARCH_W = 0.24;   // how far in from the flank the wheel-arch cut reaches (tyres are 0.225 wide)

// Outline of one cross-section, counter-clockwise, starting at the bottom centre.
//   hw    half width
//   yBot  floor height
//   yTop  deck / roof height at this station
//   r     shoulder radius
//   arch  if above yBot, the outer ARCH_W of the floor is cut up to this height (a wheel arch)
export function section(hw, yBot, yTop, r, arch = yBot) {
  const a = Math.max(arch, yBot);
  const inner = Math.max(hw - ARCH_W, 0.01);
  const right = [
    [0, yBot],
    [inner, yBot],
    [inner, a],
    [hw, a],
    [hw, yTop - r],
    [hw - r * 0.29, yTop - r * 0.29],
    [hw - r, yTop],
    [0, yTop],
  ];
  const left = right.slice(1, 7).reverse().map(([x, y]) => [-x, y]);
  return right.concat(left);   // 14 points
}

// Which outline segments face into a wheel well or the underbody rather than out at the world.
// They get the second material so the arches read as dark cavities — left in paint they catch the
// sky and look like shelves bolted to the car's flanks.
export const WELL_SEGMENTS = new Set([0, 1, 2, 11, 12, 13]);

// Stitch an ordered list of { z, pts } rings into a closed solid.
// `dark` names outline segments to put in material slot 1; everything else lands in slot 0.
// Triangles are grouped by slot rather than emitted in outline order, so this stays two draw calls.
export function loft(rings, { caps = true, dark = null } = {}) {
  const n = rings[0].pts.length;
  const main = [];
  const inner = [];
  const at = (ring, i) => { const p = ring.pts[i]; return [p[0], p[1], ring.z]; };

  for (let s = 0; s < rings.length - 1; s++) {
    const a = rings[s];
    const b = rings[s + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const out = dark && dark.has(i) ? inner : main;
      // Two triangles per quad, wound counter-clockwise as seen from OUTSIDE the body.
      // The outline runs counter-clockwise in its own XY plane and the rings advance along +z,
      // so the quad has to be wound i -> j -> b to put the normal outwards. Getting this backwards
      // turns the whole car inside out: every panel is then back-face culled and you look straight
      // through the near side at the inside of the far one.
      out.push(...at(a, i), ...at(b, j), ...at(b, i));
      out.push(...at(a, i), ...at(a, j), ...at(b, j));
    }
  }

  if (caps) {
    // the end rings close the nose and tail — those are painted panels, not cavities
    const out = main;
    for (const [ring, flip] of [[rings[0], true], [rings[rings.length - 1], false]]) {
      const cx = ring.pts.reduce((s, p) => s + p[0], 0) / n;
      const cy = ring.pts.reduce((s, p) => s + p[1], 0) / n;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        out.push(cx, cy, ring.z);
        // the first ring caps the tail (facing -z), the last caps the nose (+z)
        if (flip) out.push(...at(ring, i), ...at(ring, j));
        else out.push(...at(ring, j), ...at(ring, i));
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(main.concat(inner), 3));
  g.computeVertexNormals();
  if (dark) {
    g.addGroup(0, main.length / 3, 0);
    g.addGroup(main.length / 3, inner.length / 3, 1);
  }
  return g;
}

// Convenience: build a body from rows of [z, halfWidth, yBottom, yTop, shoulderRadius, archHeight]
export function body(rows, opts) {
  return loft(rows.map(([z, hw, yb, yt, r, arch]) => ({ z, pts: section(hw, yb, yt, r, arch) })), opts);
}

// A box with independently sized ends — used for tapered details (canards, diffuser fins, gun parts).
export function wedge(w0, h0, w1, h1, len) {
  const g = new THREE.BoxGeometry(1, 1, len, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getZ(i) > 0 ? 1 : 0;   // +z end uses the second size
    p.setX(i, p.getX(i) * (t ? w1 : w0));
    p.setY(i, p.getY(i) * (t ? h1 : h0));
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// Flatten a pile of primitives into one geometry with material groups, so an enemy costs two or
// three draw calls instead of a dozen. `parts` is [{ geo, pos, rot, scale, mat }] where `mat` is
// the material slot (0 = hull, 1 = emissive trim, …).
export function mergeParts(parts) {
  const slots = new Map();
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();

  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const pos = g.attributes.position;
    let nrm = g.attributes.normal;
    if (!nrm) { g.computeVertexNormals(); nrm = g.attributes.normal; }

    m.compose(
      new THREE.Vector3(...(p.pos || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0]))),
      new THREE.Vector3(...(p.scale || [1, 1, 1]))
    );
    nm.getNormalMatrix(m);

    const slot = p.mat || 0;
    if (!slots.has(slot)) slots.set(slot, { pos: [], nrm: [] });
    const out = slots.get(slot);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      out.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      out.nrm.push(v.x, v.y, v.z);
    }
  }

  const pos = [], nrm = [];
  const geo = new THREE.BufferGeometry();
  for (const slot of [...slots.keys()].sort((a, b) => a - b)) {
    const s = slots.get(slot);
    geo.addGroup(pos.length / 3, s.pos.length / 3, slot);
    pos.push(...s.pos);
    nrm.push(...s.nrm);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return geo;
}
