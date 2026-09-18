// kitannn° v2 — WebGL2 effects: warped grid, holographic band, raymarched clouds, hover image distortion.
// Every effect is progressive: if WebGL2 is missing the CSS/SVG fallback in the page stays visible.
(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const DPR = Math.min(devicePixelRatio || 1, 2);

  const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`;

  const HEAD = `#version 300 es
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_hover;
out vec4 o;
`;

  const SHADERS = {
    // Grid lines warped by slow sine fields, plus a ripple + glow around the cursor.
    grid: HEAD + `
uniform vec4 u_col; uniform vec2 u_cells; uniform float u_amp;
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 asp = vec2(u_res.x / u_res.y, 1.);
  float t = u_time;
  vec2 p = (uv - .5) * 1.06 + .5;
  p += u_amp * vec2(sin(uv.y * 6.3 + t) * sin(uv.x * 3.1 + t * .6), cos(uv.x * 5.2 + t * .8) * sin(uv.y * 4.1 + t * .4));
  vec2 dm = (uv - u_mouse) * asp; float d = length(dm);
  p += u_hover * normalize(dm + 1e-5) / asp * .03 * sin(d * 26. - t * 5.) * exp(-d * 5.);
  vec2 g = p * u_cells, w = fwidth(g);
  vec2 l = abs(fract(g - .5) - .5) / w;
  float line = 1. - min(min(l.x, l.y), 1.);
  float inside = step(-w.x, g.x) * step(g.x, u_cells.x + w.x) * step(-w.y, g.y) * step(g.y, u_cells.y + w.y);
  float a = line * inside * (u_col.a + u_hover * .55 * exp(-d * 7.));
  o = vec4(u_col.rgb * a, a);
}`,
    // Iridescent foil: layered sine bands through a cosine palette, a moving sheen and fine diffraction lines.
    holo: HEAD + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time;
  vec2 p = vec2(uv.x * u_res.x / u_res.y, uv.y);
  float n = sin(p.x * .35 + t * .5) + sin(p.x * .21 - p.y * 2.5 + t * .8) + .5 * sin((p.x + p.y) * .6 - t * .4);
  n += (u_mouse.x - .5) * 1.6 * u_hover;
  vec3 col = .5 + .5 * cos(6.28318 * (vec3(0., .33, .67) + n * .16 + uv.x * .4));
  col = mix(col, vec3(1.), .42);
  float sheen = pow(max(0., sin(p.x * .25 - t * 1.1 + p.y * 1.4)), 28.);
  col += sheen * .55;
  col *= .93 + .07 * sin(gl_FragCoord.x * 1.2 + gl_FragCoord.y * .45);
  o = vec4(col, 1.);
}`,
    // Soft 3D cloud: smooth-unioned spheres with a little surface noise, wrap lighting and a cool rim.
    cloud: HEAD + `
uniform float u_seed;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float map(vec3 p) {
  p.xz *= rot(sin(u_time * .35 + u_seed * 2.) * .45);
  p.xy *= rot(sin(u_time * .4 + u_seed) * .12);
  float d = length(p - vec3(-.55, -.12, 0.)) - .40;
  d = smin(d, length(p - vec3(0., .14, 0.)) - .55, .25);
  d = smin(d, length(p - vec3(.56, -.08, .06)) - .40, .25);
  d = smin(d, length(p - vec3(.12, -.26, .28)) - .36, .25);
  d = smin(d, length(p - vec3(-.2, -.2, -.28)) - .34, .25);
  d = smin(d, length(p - vec3(-.32, .18, .05)) - .34, .22);
  d = smin(d, length(p - vec3(.34, .16, -.02)) - .32, .22);
  d = max(d, -.36 - p.y); // flat-ish base
  return d + .016 * sin(p.x * 11. + u_seed) * sin(p.y * 9. + u_time * .5) * sin(p.z * 10.);
}
vec3 nrm(vec3 p) {
  vec2 e = vec2(.002, -.002);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * u_res) / u_res.y;
  vec3 ro = vec3(0., 0., 3.2), rd = normalize(vec3(uv, -1.45));
  float t = 0., md = 1e3; bool hit = false;
  for (int i = 0; i < 64; i++) {
    float d = map(ro + rd * t);
    md = min(md, d);
    if (d < .001) { hit = true; break; }
    t += d;
    if (t > 6.) break;
  }
  vec3 p = ro + rd * t, n = nrm(p), L = normalize(vec3(-.5, .8, .6));
  float wrap = clamp(dot(n, L) * .5 + .5, 0., 1.);
  float dif = clamp(dot(n, L), 0., 1.);
  float rim = pow(1. - clamp(dot(n, -rd), 0., 1.), 3.);
  vec3 col = mix(vec3(.6, .58, .7), vec3(1.), wrap) + dif * .12 + rim * vec3(.75, .85, 1.) * .3;
  col = min(col * (.86 + .14 * clamp(.5 + .5 * n.y, 0., 1.)), 1.);
  float a = hit ? 1. : smoothstep(.014, 0., md);
  o = vec4(col * a, a);
}`,
    // Hover distortion: ripple from the cursor, a gentle horizontal wave, RGB split and faint scanlines.
    distort: HEAD + `
uniform sampler2D u_tex; uniform vec2 u_img;
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float sc = max(u_res.x / u_img.x, u_res.y / u_img.y);
  vec2 tuv = (gl_FragCoord.xy - u_res * .5) / (u_img * sc) + .5;
  vec2 asp = vec2(u_res.x / u_res.y, 1.);
  vec2 dm = (uv - u_mouse) * asp; float d = length(dm);
  vec2 off = normalize(dm + 1e-5) / asp * sin(d * 34. - u_time * 7.) * exp(-d * 4.5) * .032 * u_hover;
  off.x += sin(uv.y * 24. + u_time * 4.) * .006 * u_hover;
  float ca = .013 * u_hover;
  vec3 c = vec3(texture(u_tex, tuv + off * 1.3 + vec2(ca, 0.)).r, texture(u_tex, tuv + off).g, texture(u_tex, tuv + off * .7 - vec2(ca, 0.)).b);
  c *= 1. - .06 * u_hover * step(.5, fract(gl_FragCoord.y * .5));
  o = vec4(c, 1.);
}`,
  };

  const UNIFORMS = ["u_res", "u_time", "u_mouse", "u_hover", "u_col", "u_cells", "u_amp", "u_seed", "u_tex", "u_img"];

  // ---------- core ----------
  const instances = new Set();
  const pointer = { x: -1e4, y: -1e4 };
  addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });

  const makeGL = (canvas, type) => {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    const sh = (kind, src) => {
      const s = gl.createShader(kind);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(`[gl:${type}]`, gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, SHADERS[type]);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(`[gl:${type}]`, gl.getProgramInfoLog(prog)); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)]));
    return { gl, u };
  };

  const parseColor = (str) => {
    const m = str.match(/[\d.]+/g) || [255, 255, 255, 1];
    return [m[0] / 255, m[1] / 255, m[2] / 255, m[3] === undefined ? 1 : +m[3]];
  };

  const create = (canvas, type, opts = {}) => {
    const ctx = makeGL(canvas, type);
    if (!ctx) return null;
    const inst = { canvas, type, ...ctx, opts, visible: true, hover: 0, dirty: true, mouse: [0.5, 0.5] };
    if (type === "grid") inst.col = parseColor(getComputedStyle(canvas).color);
    if (!opts.manual) {
      inst.io = new IntersectionObserver(([e]) => { inst.visible = e.isIntersecting; inst.dirty = true; });
      inst.io.observe(canvas);
    }
    instances.add(inst);
    return inst;
  };

  const destroy = (inst) => {
    inst.io?.disconnect();
    inst.gl.getExtension("WEBGL_lose_context")?.loseContext();
    instances.delete(inst);
  };

  const resize = (inst) => {
    const { canvas, gl } = inst;
    const w = Math.max(1, Math.round(canvas.clientWidth * DPR)), h = Math.max(1, Math.round(canvas.clientHeight * DPR));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); inst.dirty = true; }
    return [w, h];
  };

  const draw = (inst, t) => {
    const { gl, u, canvas, opts } = inst;
    const [w, h] = resize(inst);
    // cursor relative to the canvas, eased hover amount
    const r = canvas.getBoundingClientRect();
    const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    if (inside || inst.type === "distort") inst.mouse = [(pointer.x - r.left) / r.width, 1 - (pointer.y - r.top) / r.height];
    const target = inst.type === "distort" ? (inst.active ? 1 : 0) : inside && finePointer ? 1 : 0;
    inst.hover += (target - inst.hover) * 0.08;
    gl.uniform2f(u.u_res, w, h);
    gl.uniform1f(u.u_time, t);
    gl.uniform2f(u.u_mouse, inst.mouse[0], inst.mouse[1]);
    gl.uniform1f(u.u_hover, inst.hover);
    if (inst.type === "grid") {
      gl.uniform4fv(u.u_col, inst.col);
      gl.uniform2f(u.u_cells, opts.cells[0], opts.cells[1]);
      gl.uniform1f(u.u_amp, opts.amp);
    }
    if (inst.type === "cloud") gl.uniform1f(u.u_seed, opts.seed);
    if (inst.type === "distort" && inst.img) gl.uniform2f(u.u_img, inst.img[0], inst.img[1]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    inst.dirty = false;
  };

  const loop = (now) => {
    const t = reduceMotion ? 0 : now / 1000;
    instances.forEach((inst) => {
      if (!inst.canvas.isConnected && !inst.opts.manual) return destroy(inst);
      if (inst.type === "distort" ? inst.canvas.isConnected && (inst.active || inst.hover > 0.01) : inst.visible && (!reduceMotion || inst.dirty)) draw(inst, t);
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // theme changes recolor the grids
  addEventListener("kv2-theme", () => instances.forEach((i) => { if (i.type === "grid") { i.col = parseColor(getComputedStyle(i.canvas).color); i.dirty = true; } }));

  // ---------- hover distortion (one shared canvas that hops between images) ----------
  let fx = null;
  const textures = new Map();
  const FX_TARGETS = ".float-win .win-body img, .work .thumb img, .profile-side .win-body img";
  const texFor = (img) => {
    const { gl } = fx;
    let tex = textures.get(img.currentSrc || img.src);
    if (tex) return tex;
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.set(img.currentSrc || img.src, tex);
    return tex;
  };
  const initFx = () => {
    if (fx !== null) return fx;
    const canvas = document.createElement("canvas");
    canvas.className = "fx-canvas";
    fx = create(canvas, "distort", { manual: true }) || false;
    return fx;
  };
  if (finePointer && !reduceMotion) {
    document.addEventListener("pointerover", (e) => {
      const img = e.target.closest?.(FX_TARGETS);
      if (!img || !img.complete || !img.naturalWidth || !initFx()) return;
      const host = img.offsetParent;
      if (!host) return;
      const c = fx.canvas;
      Object.assign(c.style, { left: img.offsetLeft + "px", top: img.offsetTop + "px", width: img.offsetWidth + "px", height: img.offsetHeight + "px" });
      if (c.parentElement !== host) host.appendChild(c);
      fx.gl.bindTexture(fx.gl.TEXTURE_2D, texFor(img));
      // the hero window images are zoomed with object-fit: cover — match that; thumbnails are shown whole
      fx.img = [img.naturalWidth, img.naturalHeight];
      fx.active = img;
      fx.hover = Math.max(fx.hover, 0.05);
    });
    document.addEventListener("pointerout", (e) => {
      if (fx && fx.active && e.target === fx.active) fx.active = null;
    });
  }

  // ---------- public API ----------
  window.KGL = {
    debug: () => [...instances].map((i) => ({ type: i.type, hover: +i.hover.toFixed(2), visible: i.visible, size: [i.canvas.width, i.canvas.height] })),
    // Build every [data-gl] canvas under root; mark hosts with .gl-on so CSS hides their fallbacks.
    mount(root) {
      root.querySelectorAll("canvas[data-gl]").forEach((c) => {
        const type = c.dataset.gl;
        const opts = type === "grid" ? { cells: c.dataset.cells.split(",").map(Number), amp: +c.dataset.amp } : type === "cloud" ? { seed: +c.dataset.seed || 0 } : {};
        if (create(c, type, opts)) c.parentElement.classList.add("gl-on");
        else c.remove();
      });
    },
    // Release contexts before a page re-render (browsers cap live WebGL contexts at ~16).
    unmount() {
      instances.forEach((i) => { if (!i.opts.manual) destroy(i); });
      if (fx) { fx.active = null; fx.hover = 0; fx.canvas.remove(); }
    },
  };
})();
