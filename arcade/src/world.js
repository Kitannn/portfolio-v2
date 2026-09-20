// The arena: a flat cyber plain with a neon grid, a horizon glow and scattered pylons/slabs.
// Deliberately plain — the spec asks for "relatively basic flat open cybernetic plains", and a quiet
// ground keeps enemies, tracers and telegraph lines readable.
import * as THREE from "three";
import { rand, randInt, TAU } from "./util.js";

export const ARENA = 260;      // play radius; past this the player is nudged back
const GROUND = 1400;           // visual ground plate, much larger so the horizon never shows an edge

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x05050a);
  scene.fog = new THREE.FogExp2(0x06060d, 0.0052);

  // ---- ground: one big plate, grid drawn in world space so it reads as infinite ----
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(0x13161f) },
      uLine: { value: new THREE.Color(0x2e5d8f) },
      uGlow: { value: new THREE.Color(0x7cc6ff) },
      uFog: { value: new THREE.Color(0x06060d) },
      uCam: { value: new THREE.Vector3() },
      uPlayer: { value: new THREE.Vector2() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uBase, uLine, uGlow, uFog, uCam;
      uniform vec2 uPlayer;
      uniform float uTime;
      varying vec3 vWorld;

      // anti-aliased grid: 1.0 on a line, 0.0 between
      float grid(vec2 p, float step, float width) {
        vec2 g = abs(fract(p / step - 0.5) - 0.5) / fwidth(p / step);
        float l = min(g.x, g.y);
        return 1.0 - smoothstep(0.0, width, l);
      }

      void main() {
        vec2 p = vWorld.xz;
        float fine = grid(p, 4.0, 1.0);
        float major = grid(p, 32.0, 1.2);

        float d = length(vWorld.xz - uCam.xz);
        float near = 1.0 - smoothstep(70.0, 340.0, d);      // detail fades out with distance
        vec3 col = uBase;
        col = mix(col, uLine, fine * 0.75 * near);
        col = mix(col, uGlow, major * 0.55 * near);

        // a pool of light under the player, so the car always sits on readable ground
        float pool = 1.0 - smoothstep(0.0, 26.0, length(vWorld.xz - uPlayer));
        col += (uLine * 0.30 + uGlow * 0.06) * pool * pool;

        // a slow pulse rolling outward, just enough motion to feel powered
        float pulse = sin(d * 0.06 - uTime * 1.2) * 0.5 + 0.5;
        col += uGlow * major * pulse * 0.10 * near;

        // distance fog, matched to the scene's FogExp2 so the plate melts into the sky
        float f = 1.0 - exp(-pow(d * 0.0052, 2.0));
        col = mix(col, uFog, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(0x9ec2ff, 0x241634, 1.9);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xdce8ff, 3.1);
  key.position.set(60, 120, 40);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 20;
  key.shadow.camera.far = 320;
  const s = 70;
  key.shadow.camera.left = -s; key.shadow.camera.right = s;
  key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0xff6fae, 1.25);
  rim.position.set(-70, 40, -60);
  scene.add(rim);

  // ---- horizon ring: a faint band of light where the plain meets the sky ----
  const horizon = new THREE.Mesh(
    new THREE.CylinderGeometry(560, 560, 130, 48, 1, true),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: { uTop: { value: new THREE.Color(0x06060d) }, uBot: { value: new THREE.Color(0x2a4a86) } },
      vertexShader: `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uBot; varying float vY;
        void main(){ float t = smoothstep(0.0, 0.42, vY); gl_FragColor = vec4(mix(uBot, uTop, t), 1.0 - t * 0.85); }
      `,
    })
  );
  horizon.position.y = 40;
  scene.add(horizon);

  // ---- scatter: data pylons and low hex slabs, kept outside the immediate play area ----
  const props = new THREE.Group();
  scene.add(props);

  const pylonGeo = new THREE.BoxGeometry(1, 1, 1);
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x14141f, roughness: 0.85, metalness: 0.3, flatShading: true });
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x7cc6ff });
  const stripMat2 = new THREE.MeshBasicMaterial({ color: 0xff5f8f });

  const PYLONS = 46;
  const pylons = new THREE.InstancedMesh(pylonGeo, pylonMat, PYLONS);
  const strips = new THREE.InstancedMesh(pylonGeo, stripMat, PYLONS);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  for (let i = 0; i < PYLONS; i++) {
    const a = (i / PYLONS) * TAU + rand(-0.08, 0.08);
    const r = rand(ARENA * 0.55, ARENA * 1.5);
    const h = rand(14, 52);
    const w = rand(3, 7);
    pos.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU));
    scl.set(w, h, w);
    pylons.setMatrixAt(i, m.compose(pos, q, scl));
    // a lit band near the top of each pylon
    pos.y = h * rand(0.62, 0.9);
    scl.set(w * 1.06, rand(0.5, 1.4), w * 1.06);
    strips.setMatrixAt(i, m.compose(pos, q, scl));
  }
  pylons.instanceMatrix.needsUpdate = true;
  strips.instanceMatrix.needsUpdate = true;
  pylons.castShadow = false;
  props.add(pylons, strips);

  // low slabs inside the arena for a sense of speed — flat enough to drive straight over
  const SLABS = 34;
  const slabGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x101019, roughness: 0.95, metalness: 0.1, flatShading: true });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, SLABS);
  const slabGlow = new THREE.InstancedMesh(slabGeo, randInt(0, 1) ? stripMat : stripMat2, SLABS);
  for (let i = 0; i < SLABS; i++) {
    const a = rand(0, TAU);
    const r = rand(24, ARENA * 0.95);
    const rad = rand(4, 11);
    pos.set(Math.cos(a) * r, 0.09, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU));
    scl.set(rad, 0.18, rad);
    slabs.setMatrixAt(i, m.compose(pos, q, scl));
    pos.y = 0.19;
    scl.set(rad * 0.82, 0.04, rad * 0.82);
    slabGlow.setMatrixAt(i, m.compose(pos, q, scl));
  }
  slabs.instanceMatrix.needsUpdate = true;
  slabGlow.instanceMatrix.needsUpdate = true;
  slabs.receiveShadow = true;
  props.add(slabs, slabGlow);

  // ---- arena boundary: a ring of light the player is pushed back from ----
  const fence = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA, ARENA, 9, 96, 1, true),
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      uniforms: { uCol: { value: new THREE.Color(0x7cc6ff) }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uCol; uniform float uTime; varying vec2 vUv;
        void main(){
          float bars = smoothstep(0.55, 1.0, sin(vUv.x * 380.0) * 0.5 + 0.5);
          float fadeUp = 1.0 - vUv.y;
          float pulse = 0.55 + 0.45 * sin(uTime * 1.6 + vUv.x * 30.0);
          gl_FragColor = vec4(uCol, (0.10 + bars * 0.22) * fadeUp * pulse);
        }
      `,
    })
  );
  fence.position.y = 4.5;
  scene.add(fence);

  return {
    ground, mat, fence, key,
    update(dt, t, camera, playerPos) {
      mat.uniforms.uTime.value = t;
      if (playerPos) mat.uniforms.uPlayer.value.set(playerPos.x, playerPos.z);
      mat.uniforms.uCam.value.copy(camera.position);
      fence.material.uniforms.uTime.value = t;
      // keep the ground plate and prop ring centred on the camera so nothing ever pops in
      ground.position.x = camera.position.x;
      ground.position.z = camera.position.z;
      horizon.position.x = camera.position.x;
      horizon.position.z = camera.position.z;
      // the shadow camera follows the action
      key.position.set(camera.position.x + 60, 120, camera.position.z + 40);
      key.target.position.set(camera.position.x, 0, camera.position.z);
      key.target.updateMatrixWorld();
    },
  };
}
