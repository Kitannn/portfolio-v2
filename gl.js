// Portfolio v2 — WebGL2 effects: warped grid, raymarched clouds, VCR playback, hover image distortion.
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
    // Soft 3D cloud: smooth-unioned spheres with a little surface noise, wrap lighting and a cool rim.
    cloud: HEAD + `
uniform float u_seed; uniform vec2 u_rot;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float map(vec3 p) {
  p.yz *= rot(u_rot.x);
  p.xz *= rot(u_rot.y + sin(u_time * .35 + u_seed * 2.) * .25);
  p.xy *= rot(sin(u_time * .4 + u_seed) * .1);
  float d = length(p - vec3(-.55, -.12, 0.)) - .40;
  d = smin(d, length(p - vec3(0., .14, 0.)) - .55, .25);
  d = smin(d, length(p - vec3(.56, -.08, .06)) - .40, .25);
  d = smin(d, length(p - vec3(.12, -.26, .28)) - .36, .25);
  d = smin(d, length(p - vec3(-.2, -.2, -.28)) - .34, .25);
  d = smin(d, length(p - vec3(-.32, .18, .05)) - .34, .22);
  d = smin(d, length(p - vec3(.34, .16, -.02)) - .32, .22);
  d = smin(d, length(p - vec3(.02, -.02, .34)) - .38, .25);
  d = smin(d, length(p - vec3(.05, .0, -.34)) - .36, .25);
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
    // VHS playback: two cover-fit textures cross-fading, line jitter, a rolling tear band, RGB split,
    // scanlines, noise and vignette. u_glitch spikes on every cut between works.
    vcr: HEAD + `
uniform sampler2D u_a, u_b; uniform vec2 u_ia, u_ib; uniform float u_mix, u_glitch, u_sq, u_static;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cover(vec2 f, vec2 img) { float sc = max(u_res.x / img.x, u_res.y / img.y); return (f - u_res * .5) / (img * sc) + .5; }
vec3 samp(vec2 f) { return mix(texture(u_a, cover(f, u_ia)).rgb, texture(u_b, cover(f, u_ib)).rgb, u_mix); }
void main() {
  vec2 f = gl_FragCoord.xy, uv = f / u_res;
  float t = u_time, px = u_res.y / 900.;
  float by = 1. - fract(t * .06), bd = abs(uv.y - by);
  float band = smoothstep(.07, 0., bd);
  float blockGlitch = u_glitch * step(.55, hash(vec2(floor(f.y / (22. * px)), floor(t * 30.))));
  f.x += (hash(vec2(floor(f.y / (2. * px)), floor(t * 24.))) - .5) * px * (1.2 + 26. * band + 90. * blockGlitch);
  f.x += sin(uv.y * 38. + t * 2.) * .7 * px;
  f.x += (sin(uv.y * 16. + t * 45.) * 70. + sin(uv.y * 61. - t * 83.) * 18.) * u_sq * px; // feed-in squiggle
  float ca = px * (2. + 5. * band + 14. * u_glitch);
  vec3 col = vec3(samp(f + vec2(ca, 0.)).r, samp(f).g, samp(f - vec2(ca, 0.)).b);
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, 1.18) * .9 + .035;
  col *= .8 + .2 * sin(gl_FragCoord.y * 1.9);
  col += (hash(f + fract(t * 7.)) - .5) * (.09 + .25 * u_glitch + .3 * u_static); // u_static: snow while there's no feed
  col += vec3(.15, 1., .35) * smoothstep(.0035, 0., bd) * .75 + band * .05;
  vec2 q = uv - .5;
  col *= 1. - dot(q, q) * 1.15;
  o = vec4(col, 1.);
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

  const UNIFORMS = ["u_res", "u_time", "u_mouse", "u_hover", "u_col", "u_cells", "u_amp", "u_seed", "u_rot", "u_tex", "u_img", "u_a", "u_b", "u_ia", "u_ib", "u_mix", "u_glitch", "u_sq", "u_static"];

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
    if (inst.type === "cloud") { gl.uniform1f(u.u_seed, opts.seed); const r = canvas._rot || [0, 0]; gl.uniform2f(u.u_rot, r[0], r[1]); }
    if (inst.type === "vcr") vcrUniforms(inst);
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
    titleFx?.draw(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // ---------- VCR controller ----------
  const texture = (gl, src) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 8, 10, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const vcrUniforms = (inst) => {
    const { gl, u } = inst;
    inst.mix = Math.min(1, inst.mix + (reduceMotion ? 1 : inst.rate));
    inst.glitch *= reduceMotion ? 0 : 0.92;
    inst.sq *= reduceMotion ? 0 : 0.93;
    inst.static = inst.cur < 0 ? 1 : Math.max(0, inst.static - (reduceMotion ? 1 : 0.04));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inst.tex[inst.prev] || inst.blank);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, inst.tex[inst.cur] || inst.blank);
    gl.uniform1i(u.u_a, 0); gl.uniform1i(u.u_b, 1);
    gl.uniform2fv(u.u_ia, inst.size[inst.prev] || [1, 1]);
    gl.uniform2fv(u.u_ib, inst.size[inst.cur] || [1, 1]);
    gl.uniform1f(u.u_mix, inst.mix);
    gl.uniform1f(u.u_glitch, inst.glitch);
    gl.uniform1f(u.u_sq, inst.sq);
    gl.uniform1f(u.u_static, inst.static);
    if (inst.mix < 1 || inst.glitch > 0.01 || inst.sq > 0.01 || (inst.static > 0 && inst.static < 1)) inst.dirty = true;
  };
  const vcrController = (inst) => {
    // starts with no feed (blank + snow); the first show() glitches the picture in from nothing
    Object.assign(inst, { tex: [], size: [], cur: -1, prev: -1, mix: 1, rate: 0.07, glitch: 0, sq: 0, static: 1, blank: texture(inst.gl) });
    return {
      set(i, src) {
        inst.gl.activeTexture(inst.gl.TEXTURE2);
        inst.tex[i] = texture(inst.gl, src);
        inst.size[i] = [src.naturalWidth || src.width, src.naturalHeight || src.height];
        inst.dirty = true;
      },
      show(i) {
        if (i === inst.cur) return;
        const first = inst.cur < 0;
        inst.prev = first ? -1 : inst.cur;   // -1 = the blank no-feed texture
        inst.cur = i;
        inst.mix = 0;
        inst.rate = first ? 0.035 : 0.07;     // feed-in fades up slower than a channel change
        inst.glitch = first ? 1.3 : 1;
        inst.sq = first ? 1 : 0;
        inst.dirty = true;
      },
    };
  };

  // theme changes recolor the grids
  addEventListener("kv2-theme", () => instances.forEach((i) => { if (i.type === "grid") { i.col = parseColor(getComputedStyle(i.canvas).color); i.dirty = true; } }));

  // ---------- hover distortion (one shared canvas that hops between images) ----------
  let fx = null;
  const textures = new Map();
  const FX_TARGETS = ".work .thumb img, .profile-side .win-body img";
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

  // ---------- section titles: liquid smear + ripple + RGB split trailing the cursor ----------
  // One fixed full-screen canvas draws every .sec-title on the page as a texture quad over its DOM text.
  // A short trail of recent cursor points (position + velocity) drives the displacement, which fades out.
  const titleFx = (() => {
    const N = 32, LIFE = 0.9; // trail points, seconds each point lives
    const FS = `#version 300 es
precision highp float;
uniform sampler2D u_tex; uniform vec4 u_rect; uniform vec4 u_col; uniform float u_alpha, u_dpr;
uniform vec4 u_trail[${N}]; uniform float u_age[${N}];
out vec4 o;
float cov(vec2 f) {
  vec2 uv = (f - u_rect.xy) / u_rect.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.;
  return texture(u_tex, uv).a;
}
// thick streak: strongest coverage along the smear direction, so letters stretch into solid bands
float streak(vec2 f, vec2 dsp) {
  float s = 0.;
  for (int k = 0; k < 5; k++) s = max(s, cov(f - dsp * (.35 + .2 * float(k))));
  return s;
}
void main() {
  vec2 f = gl_FragCoord.xy, disp = vec2(0.);
  float R = 42. * u_dpr; // tight brush: the smear happens right where the cursor passes
  for (int i = 0; i < ${N}; i++) {
    float life = 1. - u_age[i];
    if (life <= 0.) continue;
    vec2 d = f - u_trail[i].xy, v = u_trail[i].zw;
    float sp = length(v), cap = 26. * u_dpr;
    if (sp > cap) v *= cap / sp;
    vec2 e = d;                                                           // round brush
    float r2 = dot(e, e), fall = exp(-r2 / (R * R)) * life * life;
    float speed = clamp(sp / (5. * u_dpr), 0., 1.);
    disp += v * fall * 1.6;                                               // drag the pixels along with the cursor
    disp.x += sin(sqrt(r2) / (5. * u_dpr) - u_age[i] * 18.) * fall * speed * 3. * u_dpr; // faint ripple inside the brush only
  }
  disp.x *= 1.5; // stretch mostly sideways, like the reference
  float dl = length(disp), lim = 64. * u_dpr;
  disp *= lim * (1. - exp(-dl / lim)) / max(dl, 1e-4); // soft clamp keeps it from tearing apart completely
  float m = clamp(dl / (22. * u_dpr), 0., 1.);
  vec2 ca = vec2(m * 15. * u_dpr, m * 2. * u_dpr);
  float cr = streak(f + ca, disp * 1.2), cg = streak(f, disp), cb = streak(f - ca, disp * .8);
  float base = min(cr, min(cg, cb)), a = max(cr, max(cg, cb));
  vec3 col = u_col.rgb * base + (vec3(cr, cg, cb) - base); // exact text colour where channels agree, pure RGB fringes where they split
  o = vec4(col, a) * u_alpha;
}`;
    const VSQ = `#version 300 es
in vec2 p; uniform vec4 u_rect; uniform vec2 u_res;
void main() { vec2 px = u_rect.xy + p * u_rect.zw; gl_Position = vec4(px / u_res * 2. - 1., 0., 1.); }`;

    let canvas = null, gl = null, u = null, items = [], fg = [1, 1, 1, 1], ok = null;
    const trail = [];
    let last = null;

    const init = () => {
      if (ok !== null) return ok;
      canvas = document.createElement("canvas");
      canvas.id = "title-fx";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
      gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
      if (!gl) { canvas.remove(); return (ok = false); }
      const sh = (k, src) => { const s = gl.createShader(k); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("[gl:title]", gl.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, VSQ), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) { canvas.remove(); return (ok = false); }
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return (ok = false); }
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      u = Object.fromEntries(["u_tex", "u_rect", "u_col", "u_alpha", "u_dpr", "u_trail", "u_age", "u_res"].map((n) => [n, gl.getUniformLocation(prog, n)]));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      readFg();
      if (!reduceMotion) addEventListener("pointermove", (e) => {
        const now = performance.now();
        if (last) {
          const dx = e.clientX - last.x, dy = e.clientY - last.y;
          const steps = Math.min(6, Math.max(1, Math.ceil(Math.hypot(dx, dy) / 12))); // fill gaps on fast moves
          for (let k = 1; k <= steps; k++) trail.push({ x: last.x + (dx * k) / steps, y: last.y + (dy * k) / steps, vx: dx, vy: dy, t: now });
          while (trail.length > N) trail.shift();
        }
        last = { x: e.clientX, y: e.clientY };
      }, { passive: true });
      addEventListener("kv2-theme", () => { readFg(); items.forEach((i) => { i.key = ""; }); });
      document.fonts?.ready.then(() => items.forEach((i) => { i.key = ""; }));
      document.fonts?.addEventListener?.("loadingdone", () => items.forEach((i) => { i.key = ""; })); // e.g. the FONT toggle's font arriving
      return (ok = true);
    };
    const readFg = () => {
      const probe = document.createElement("span");
      probe.style.color = "var(--fg)";
      document.body.appendChild(probe);
      const m = getComputedStyle(probe).color.match(/[\d.]+/g) || [255, 255, 255];
      probe.remove();
      fg = [m[0] / 255, m[1] / 255, m[2] / 255, 1];
    };

    // Rasterise the title's own text (not the ::after caret) in its real font, aligned to the DOM glyph box.
    const build = (it) => {
      const el = it.el, cs = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = range.getClientRects();
      const er = el.getBoundingClientRect();
      const key = [el.textContent, cs.fontFamily, cs.fontSize, cs.fontWeight, fg.join(), Math.round(er.width), rects.length].join("|");
      if (key === it.key) return;
      it.key = key;
      it.skip = rects.length !== 1; // wrapped titles keep plain DOM text
      el.classList.toggle("gl-title", !it.skip);
      if (it.skip) return;
      const tr = range.getBoundingClientRect();
      const text = cs.textTransform === "uppercase" ? el.textContent.toUpperCase() : el.textContent;
      const pad = Math.ceil(Math.max(tr.height * 1.1, 80)); // room for the smear to spill past the glyphs
      Object.assign(it, { tx: tr.left - er.left, ty: tr.top - er.top, tw: tr.width, th: tr.height, pad });
      const c = document.createElement("canvas");
      c.width = Math.ceil((tr.width + pad * 2) * DPR); c.height = Math.ceil((tr.height + pad * 2) * DPR);
      const g = c.getContext("2d");
      g.scale(DPR, DPR);
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ("letterSpacing" in g) g.letterSpacing = cs.letterSpacing;
      g.fillStyle = "#fff";
      g.textBaseline = "alphabetic";
      const asc = g.measureText(text).fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
      g.fillText(text, pad, pad + asc);
      if (!it.tex) it.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, it.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };

    const trailData = new Float32Array(N * 4), ageData = new Float32Array(N);
    const draw = (now) => {
      if (!items.length) return;
      const W = Math.round(innerWidth * DPR), H = Math.round(innerHeight * DPR);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); items.forEach((i) => { i.key = ""; }); }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (let i = 0; i < N; i++) {
        const p = trail[trail.length - 1 - i];
        const age = p ? (now - p.t) / 1000 / LIFE : 1;
        ageData[i] = Math.min(1, age);
        trailData.set(p ? [p.x * DPR, H - p.y * DPR, p.vx * DPR, -p.vy * DPR] : [0, 0, 0, 0], i * 4);
      }
      gl.uniform2f(u.u_res, W, H);
      gl.uniform4fv(u.u_trail, trailData);
      gl.uniform1fv(u.u_age, ageData);
      gl.uniform4fv(u.u_col, fg);
      gl.uniform1f(u.u_dpr, DPR);
      gl.uniform1i(u.u_tex, 0);
      gl.activeTexture(gl.TEXTURE0);
      for (const it of items) {
        if (!it.el.isConnected) continue;
        const er = it.el.getBoundingClientRect();
        if (er.bottom < -200 || er.top > innerHeight + 200) continue;
        build(it);
        if (it.skip) continue;
        const x = er.left + it.tx - it.pad, y = er.top + it.ty - it.pad, w = it.tw + it.pad * 2, h = it.th + it.pad * 2;
        gl.bindTexture(gl.TEXTURE_2D, it.tex);
        gl.uniform4f(u.u_rect, x * DPR, H - (y + h) * DPR, w * DPR, h * DPR);
        gl.uniform1f(u.u_alpha, it.fade ? +getComputedStyle(it.fade).opacity : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    };

    return {
      mount(root) {
        if (!init()) return;
        items = [...root.querySelectorAll(".sec-title")].map((el) => ({ el, fade: el.closest(".fade"), key: "" }));
      },
      unmount() {
        items.forEach((it) => { it.el.classList.remove("gl-title"); if (it.tex) gl.deleteTexture(it.tex); });
        items = [];
        if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      },
      draw,
    };
  })();

  // ---------- public API ----------
  window.KGL = {
    debug: () => [...instances].map((i) => ({ type: i.type, hover: +i.hover.toFixed(2), visible: i.visible, size: [i.canvas.width, i.canvas.height] })),
    // Build every [data-gl] canvas under root; mark hosts with .gl-on so CSS hides their fallbacks.
    mount(root) {
      root.querySelectorAll("canvas[data-gl]").forEach((c) => {
        const type = c.dataset.gl;
        const opts = type === "grid" ? { cells: c.dataset.cells.split(",").map(Number), amp: +c.dataset.amp } : type === "cloud" ? { seed: +c.dataset.seed || 0 } : {};
        const inst = create(c, type, opts);
        if (!inst) return c.remove();
        c.parentElement.classList.add("gl-on");
        if (type === "vcr") c._vcr = vcrController(inst);
      });
      titleFx.mount(root);
    },
    // Release contexts before a page re-render (browsers cap live WebGL contexts at ~16).
    unmount() {
      instances.forEach((i) => { if (!i.opts.manual) destroy(i); });
      if (fx) { fx.active = null; fx.hover = 0; fx.canvas.remove(); }
      titleFx.unmount();
    },
  };
})();
