// The player's car: a 2025 Toyota GR 86 (ZN8) silhouette in Halo white, with a light machine gun
// on the roof. Built entirely from code — see loft.js for how the body shape is described.
//
// Real-car numbers it is modelled to (metres, 1 unit = 1 m):
//   length 4.265  width 1.775  height 1.310  wheelbase 2.575  track 1.52/1.55  18" wheels (Ø0.63)
// Nose points down +Z, so the car's forward vector is (sin yaw, 0, cos yaw).
import * as THREE from "three";
import { body, loft, section, wedge, WELL_SEGMENTS } from "./loft.js";

const AXLE_F = 1.2875, AXLE_R = -1.2875;
const TRACK_F = 0.760, TRACK_R = 0.775;
const WHEEL_R = 0.315, WHEEL_W = 0.225;

// ---- materials ----------------------------------------------------------------
export const paint = (color) => new THREE.MeshPhysicalMaterial({
  color, metalness: 0.28, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.09,
});
// Privacy-dark glass. Kept mostly matte and with a low env contribution, otherwise the
// environment map turns every window into a white mirror and the cabin reads as bodywork.
const glass = new THREE.MeshPhysicalMaterial({
  color: 0x05070c, metalness: 0, roughness: 0.28, envMapIntensity: 0.14,
  clearcoat: 0.45, clearcoatRoughness: 0.2, side: THREE.DoubleSide,
});
const trim = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.72, metalness: 0.25 });
const mesh = new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.95, metalness: 0.05 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.22, metalness: 0.95 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.95, metalness: 0.0 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0x5a6069, roughness: 0.34, metalness: 0.85 });
const gunMat = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.55, metalness: 0.7 });
const gunDark = new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.8, metalness: 0.4 });
const emissive = (c, i = 2.2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i, roughness: 1 });

// ---- body cross-sections -------------------------------------------------------
// [ z, halfWidth, floorY, deckY, shoulderRadius, wheelArchY ]
const SHELL = [
  [-2.205, 0.560, 0.45, 0.885, 0.10],          // tail wraps round instead of ending in a flat wall
  [-2.180, 0.680, 0.40, 0.925, 0.12],
  [-2.140, 0.762, 0.36, 0.958, 0.14],
  [-2.000, 0.815, 0.32, 1.010, 0.16],
  [-1.800, 0.868, 0.30, 1.030, 0.18],
  [-1.660, 0.876, 0.30, 1.033, 0.19, 0.32],   // rear arch opens
  [-1.520, 0.882, 0.30, 1.035, 0.19, 0.50],
  [-1.288, 0.888, 0.30, 1.030, 0.20, 0.54],   // rear axle — widest point, the haunch
  [-1.060, 0.882, 0.28, 1.018, 0.20, 0.50],
  [-0.940, 0.874, 0.26, 1.008, 0.20, 0.32],
  [-0.820, 0.868, 0.24, 1.000, 0.20],
  [-0.400, 0.855, 0.22, 0.985, 0.20],
  [ 0.100, 0.852, 0.21, 0.975, 0.20],
  [ 0.520, 0.856, 0.21, 0.968, 0.20],          // cowl — windscreen starts here
  [ 0.800, 0.866, 0.22, 0.952, 0.20],
  [ 0.930, 0.870, 0.23, 0.945, 0.20, 0.30],   // front arch opens
  [ 1.060, 0.878, 0.24, 0.935, 0.20, 0.48],
  [ 1.288, 0.880, 0.25, 0.920, 0.20, 0.53],   // front axle
  [ 1.500, 0.874, 0.26, 0.902, 0.20, 0.48],
  [ 1.640, 0.862, 0.27, 0.888, 0.19, 0.31],
  [ 1.760, 0.848, 0.28, 0.872, 0.19],
  [ 1.900, 0.822, 0.30, 0.852, 0.17],
  [ 2.020, 0.800, 0.33, 0.830, 0.16],
  [ 2.095, 0.772, 0.36, 0.812, 0.15],
  [ 2.145, 0.724, 0.39, 0.790, 0.13],
  [ 2.180, 0.646, 0.43, 0.762, 0.12],          // prow curls back over these four stations, so the
  [ 2.200, 0.508, 0.48, 0.724, 0.10],          // front reads as a nose rather than a flat wall
  [ 2.210, 0.310, 0.54, 0.678, 0.07],
];

// the glasshouse: raked screen, double-bubble roof, long fastback into the deck
const CABIN = [
  [ 0.560, 0.735, 0.955, 0.990, 0.05],
  [ 0.300, 0.750, 0.960, 1.130, 0.07],
  [ 0.020, 0.762, 0.965, 1.265, 0.09],
  [-0.280, 0.758, 0.970, 1.308, 0.10],
  [-0.640, 0.748, 0.970, 1.310, 0.10],         // roof peak — 1.31 m, the car's real height
  [-0.900, 0.730, 0.968, 1.278, 0.10],
  [-1.180, 0.706, 0.962, 1.180, 0.10],
  [-1.450, 0.684, 0.955, 1.070, 0.09],
  [-1.650, 0.668, 0.950, 0.995, 0.06],
];

const rows = (t) => t.map(([z, hw, yb, yt, r, arch]) => ({ z, pts: section(hw, yb, yt, r, arch) }));

// The cabin is painted bodywork; the windows are separate panels laid just proud of it, so the
// A-pillars, roof and sail panels are simply the paint left showing between them.
const cabinHalfWidth = (z) => {
  const t = CABIN;
  if (z >= t[0][0]) return t[0][1];
  if (z <= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    if (z <= t[i][0] && z >= t[i + 1][0]) {
      const k = (t[i][0] - z) / (t[i][0] - t[i + 1][0]);
      return t[i][1] + (t[i + 1][1] - t[i][1]) * k;
    }
  }
  return 0.74;
};

// A flat outline given in (z, y) wrapped onto the side of the cabin, so the glass follows the
// body's taper instead of poking through it at the narrow rear.
function sideGlass(outline, sign) {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ShapeGeometry(shape, 12);
  const p = g.attributes.position;
  const out = [];
  for (let i = 0; i < p.count; i++) {
    const z = p.getX(i), y = p.getY(i);
    out.push(sign * (cabinHalfWidth(z) + 0.006), y, z);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

// A flat pane across the car, given its four corners (they are already in car space).
function pane(corners) {
  const v = [];
  const add = (i) => v.push(...corners[i]);
  add(0); add(1); add(2);
  add(0); add(2); add(3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

// place a bar between two points, oriented along its length (BoxGeometry runs down local +Z)
function strut(geo, mat, a, b) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.lookAt(new THREE.Vector3(b[0], b[1], b[2]));
  return m;
}

function wheel() {
  const g = new THREE.Group();

  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 26), rubber);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);

  // a slightly proud shoulder so the tyre doesn't read as a plain cylinder
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.985, WHEEL_R * 0.985, WHEEL_W * 1.04, 26), rubber);
  shoulder.rotation.z = Math.PI / 2;
  g.add(shoulder);

  // 18" rim face on the outboard side: dish, lip and ten spokes (five pairs, as on the GR 86)
  const face = new THREE.Group();
  face.position.x = WHEEL_W / 2 + 0.002;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.228, 0.228, 0.03, 24), rimMat);
  dish.rotation.z = Math.PI / 2;
  face.add(dish);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.018, 8, 24), chrome);
  lip.rotation.y = Math.PI / 2;
  face.add(lip);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 14), rimMat);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = 0.012;
  face.add(hub);
  const spokeGeo = new THREE.BoxGeometry(0.026, 0.038, 0.175);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + (i % 2 ? 0.16 : -0.16);
    const sp = new THREE.Mesh(spokeGeo, rimMat);
    sp.position.set(0.004, Math.cos(a) * 0.125, Math.sin(a) * 0.125);
    sp.rotation.x = -a;
    face.add(sp);
  }
  // brake disc + caliper, visible through the spokes
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.018, 20), new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.45, metalness: 0.9 }));
  disc.rotation.z = Math.PI / 2;
  disc.position.x = WHEEL_W * 0.18;
  g.add(disc);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.06), new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.5, metalness: 0.3 }));
  cal.position.set(WHEEL_W * 0.16, 0.14, -0.03);
  g.add(cal);

  g.add(face);
  return g;
}

export function buildCar({ color = 0xeef1f6 } = {}) {
  const root = new THREE.Group();      // yaw/position live here
  const chassis = new THREE.Group();   // body roll + pitch live here, so wheels stay planted
  root.add(chassis);

  const shellMat = paint(color);

  const wellMat = new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 1, metalness: 0 });
  const shell = new THREE.Mesh(body(SHELL, { dark: WELL_SEGMENTS }), [shellMat, wellMat]);
  shell.castShadow = true;
  shell.receiveShadow = true;
  chassis.add(shell);

  const cabin = new THREE.Mesh(loft(rows(CABIN)), shellMat);
  cabin.castShadow = true;
  chassis.add(cabin);

  // ---- glass: windscreen, both side DLOs, backlight ----
  // windscreen — pushed a little along its own normal so it sits on the paint, not in it
  chassis.add(new THREE.Mesh(pane([
    [-0.700, 0.996, 0.549], [0.700, 0.996, 0.549], [0.690, 1.313, -0.266], [-0.690, 1.313, -0.266],
  ]), glass));
  // backlight
  chassis.add(new THREE.Mesh(pane([
    [-0.665, 0.999, -1.615], [0.665, 0.999, -1.615], [0.722, 1.283, -0.905], [-0.722, 1.283, -0.905],
  ]), glass));

  // side daylight opening: rising beltline, long roof, kicked up at the rear quarter
  const DLO = [
    [0.470, 0.992], [0.235, 1.165], [-0.255, 1.278], [-0.850, 1.252], [-1.010, 1.130], [-1.105, 1.018],
  ];
  for (const sx of [-1, 1]) {
    chassis.add(new THREE.Mesh(sideGlass(DLO, sx), glass));
    // B-pillar, blacked out as on the real car
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.30, 0.055), mesh);
    bp.position.set(sx * (cabinHalfWidth(-0.33) + 0.012), 1.120, -0.330);
    bp.rotation.x = 0.30;
    chassis.add(bp);
    // chrome window surround along the beltline
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 1.52), trim);
    belt.position.set(sx * (cabinHalfWidth(-0.3) + 0.012), 0.998, -0.310);
    chassis.add(belt);
  }

  // ---- front: matrix grille, corner intakes, splitter, swept headlights ----
  // the wide "functional matrix" intake that fills most of the lower bumper
  const lowerGrille = new THREE.Mesh(wedge(1.04, 0.24, 0.94, 0.21, 0.20), mesh);
  lowerGrille.position.set(0, 0.530, 2.010);
  chassis.add(lowerGrille);

  const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.032, 0.09), trim);
  grilleFrame.position.set(0, 0.672, 2.068);
  chassis.add(grilleFrame);

  const upperSlot = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.042, 0.08), mesh);
  upperSlot.position.set(0, 0.730, 2.078);
  chassis.add(upperSlot);

  const frontBumper = new THREE.Mesh(wedge(1.42, 0.26, 1.10, 0.22, 0.32), trim);
  frontBumper.position.set(0, 0.500, 1.995);
  chassis.add(frontBumper);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.030, 0.26), trim);
  splitter.position.set(0, 0.322, 2.030);
  chassis.add(splitter);

  for (const sx of [-1, 1]) {
    // corner intake with a vertical fin
    const duct = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 0.16), mesh);
    duct.position.set(sx * 0.605, 0.470, 2.010);
    duct.rotation.y = sx * 0.16;
    chassis.add(duct);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.20, 0.10), chrome);
    fin.position.set(sx * 0.585, 0.470, 2.062);
    chassis.add(fin);
    // canard on the bumper corner
    const can = new THREE.Mesh(wedge(0.10, 0.018, 0.02, 0.014, 0.20), trim);
    can.position.set(sx * 0.700, 0.400, 1.960);
    can.rotation.set(0.10, sx * 0.55, 0);
    chassis.add(can);

    // headlight: a swept slim unit set into the wing, pointed at its inner end
    const lamp = new THREE.Mesh(wedge(0.028, 0.050, 0.130, 0.070, 0.34), emissive(0xbfe2ff, 1.3));
    lamp.position.set(sx * 0.508, 0.792, 1.976);
    lamp.rotation.set(0.06, sx * (Math.PI / 2 + 0.24), 0);
    chassis.add(lamp);
    const drl = new THREE.Mesh(wedge(0.024, 0.018, 0.104, 0.024, 0.35), emissive(0xdff1ff, 2.4));
    drl.position.set(sx * 0.508, 0.822, 2.000);
    drl.rotation.set(0.06, sx * (Math.PI / 2 + 0.24), 0);
    chassis.add(drl);
  }

  // ---- hood: power bulge and the two creases that run back from the headlights ----
  // just the two creases that run back from the headlights — a sphere "power bulge" only ever read
  // as an oval decal sitting on the hood
  for (const sx of [-1, 1]) {
    const crease = new THREE.Mesh(wedge(0.034, 0.026, 0.020, 0.016, 0.88), shellMat);
    crease.position.set(sx * 0.632, 0.900, 1.460);
    crease.rotation.set(0.105, sx * 0.050, 0);
    chassis.add(crease);
  }

  // ---- sides: 86 fender vent, mirrors, skirts, handles ----
  for (const sx of [-1, 1]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.115, 0.26), mesh);
    vent.position.set(sx * 0.872, 0.625, 0.845);
    chassis.add(vent);
    const ventFin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.22), chrome);
    ventFin.position.set(sx * 0.880, 0.625, 0.845);
    chassis.add(ventFin);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 1.30), trim);
    skirt.position.set(sx * 0.845, 0.245, 0.150);
    chassis.add(skirt);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.14), trim);
    handle.position.set(sx * 0.862, 0.790, 0.030);
    chassis.add(handle);

    // mirror: a short stalk off the base of the A-pillar with a dark glass face
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.05), trim);
    stalk.position.set(sx * 0.845, 0.982, 0.405);
    chassis.add(stalk);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.095, 0.15), shellMat);
    cap.position.set(sx * 0.930, 0.995, 0.395);
    cap.rotation.y = sx * -0.18;
    chassis.add(cap);
    const mGlass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.070, 0.115), glass);
    mGlass.position.set(sx * 0.962, 0.995, 0.380);
    chassis.add(mGlass);
  }

  // ---- rear: ducktail, full-width lamps, diffuser, twin pipes ----
  const ducktail = new THREE.Mesh(wedge(1.44, 0.024, 1.36, 0.016, 0.24), shellMat);
  ducktail.position.set(0, 1.042, -1.920);
  ducktail.rotation.x = -0.13;
  chassis.add(ducktail);

  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.026, 0.05), trim);
  tailBar.position.set(0, 0.938, -2.150);
  chassis.add(tailBar);

  const brakeLights = [];
  for (const sx of [-1, 1]) {
    const lamp = new THREE.Mesh(wedge(0.026, 0.078, 0.120, 0.090, 0.40), emissive(0xff2d3a, 0.65));
    lamp.position.set(sx * 0.545, 0.945, -2.100);
    lamp.rotation.y = sx * (Math.PI / 2 - 0.10);
    chassis.add(lamp);
    brakeLights.push(lamp.material);

    // the outer "hook" that wraps onto the quarter panel
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.078, 0.16), emissive(0xff2d3a, 0.65));
    hook.position.set(sx * 0.800, 0.945, -1.985);
    chassis.add(hook);
    brakeLights.push(hook.material);

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.10, 14), chrome);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(sx * 0.430, 0.345, -2.115);
    chassis.add(pipe);
  }

  const reverse = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), emissive(0xffffff, 0.35));
  reverse.position.set(0, 0.905, -2.130);
  chassis.add(reverse);

  // the lower bumper is black on the real car — without it the tail is one big blank painted panel
  const rearBumper = new THREE.Mesh(wedge(1.48, 0.30, 1.20, 0.26, 0.34), trim);
  rearBumper.position.set(0, 0.548, -2.040);
  chassis.add(rearBumper);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.15, 0.04), mesh);
  plate.position.set(0, 0.706, -2.202);
  chassis.add(plate);

  const diffuser = new THREE.Mesh(wedge(1.22, 0.13, 1.06, 0.10, 0.38), trim);
  diffuser.position.set(0, 0.374, -1.985);
  chassis.add(diffuser);
  for (let i = -2; i <= 2; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.095, 0.32), mesh);
    fin.position.set(i * 0.20, 0.322, -1.980);
    chassis.add(fin);
  }

  // ---- wheels ----
  const wheels = {};
  for (const [name, x, z] of [["fl", -TRACK_F, AXLE_F], ["fr", TRACK_F, AXLE_F], ["rl", -TRACK_R, AXLE_R], ["rr", TRACK_R, AXLE_R]]) {
    const steer = new THREE.Group();          // front wheels steer here
    steer.position.set(x, WHEEL_R, z);
    const spin = wheel();                     // and roll here
    steer.add(spin);
    root.add(steer);
    wheels[name] = { steer, spin };
  }

  // ---- roof-mounted light machine gun ------------------------------------------
  // yaw ring turns with the aim, the cradle inside it pitches
  const gunYaw = new THREE.Group();
  gunYaw.position.set(0, 1.318, -0.560);
  chassis.add(gunYaw);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.055, 16), gunDark);
  base.position.y = 0.02;
  gunYaw.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.018, 8, 20), gunMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.055;
  gunYaw.add(ring);

  // the two uprights the cradle pivots between
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.05), gunMat);
    post.position.set(sx * 0.105, 0.115, 0);
    gunYaw.add(post);
  }

  const gunPitch = new THREE.Group();
  gunPitch.position.y = 0.175;
  gunYaw.add(gunPitch);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.46), gunMat);
  receiver.position.z = 0.04;
  gunPitch.add(receiver);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.030, 0.62, 12), gunDark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.56;
  gunPitch.add(barrel);

  // barrel shroud with cooling slots
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.26, 12, 1, true), gunMat);
  shroud.rotation.x = Math.PI / 2;
  shroud.position.z = 0.40;
  gunPitch.add(shroud);
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.030, 0.09, 10), gunMat);
  flash.rotation.x = Math.PI / 2;
  flash.position.z = 0.865;
  gunPitch.add(flash);

  // ammo box on the left, charging handle on the right, rear spade grips
  const ammo = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.115, 0.17), gunDark);
  ammo.position.set(-0.10, -0.02, 0.02);
  gunPitch.add(ammo);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.028, 0.10), new THREE.MeshStandardMaterial({ color: 0x8a6a2e, roughness: 0.5, metalness: 0.8 }));
  belt.position.set(-0.062, 0.012, 0.11);
  gunPitch.add(belt);
  const grips = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.045), gunDark);
  grips.position.set(0, -0.02, -0.21);
  gunPitch.add(grips);

  // a lit sight block so you can read where the gun points at a glance
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.06), emissive(0x7cc6ff, 3));
  sight.position.set(0, 0.082, 0.10);
  gunPitch.add(sight);

  // working headlights: two narrow spots, shadowless so they cost almost nothing
  const beams = [];
  for (const sx of [-1, 1]) {
    const beam = new THREE.SpotLight(0xdbecff, 90, 46, 0.42, 0.55, 1.4);
    beam.position.set(sx * 0.50, 0.80, 2.05);
    beam.target.position.set(sx * 0.9, 0.0, 26);
    chassis.add(beam, beam.target);
    beams.push(beam);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.92);
  gunPitch.add(muzzle);

  receiver.castShadow = true;
  barrel.castShadow = true;

  return { root, chassis, wheels, gunYaw, gunPitch, muzzle, brakeLights, beams, shellMat, flashPoint: flash };
}
