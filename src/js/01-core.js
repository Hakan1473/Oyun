import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// =====================================================================
//  Utilities
// =====================================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function lerpAngle(a, b, t) { const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI; return a + d * t; }
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1473);
const R = (a = 0, b = 1) => a + (b - a) * rnd();
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const col = (hex) => new THREE.Color(hex);

function makeSimplex(seed) {
  const r = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = [1, -1, 1, -1, 1, -1, 0, 0], gy = [1, 1, -1, -1, 0, 0, 1, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - i + t, y0 = y - j + t;
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = perm[ii + perm[jj]] & 7; tt *= tt; n += tt * tt * (gx[g] * x0 + gy[g] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = perm[ii + i1 + perm[jj + j1]] & 7; tt *= tt; n += tt * tt * (gx[g] * x1 + gy[g] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = perm[ii + 1 + perm[jj + 1]] & 7; tt *= tt; n += tt * tt * (gx[g] * x2 + gy[g] * y2); }
    return 70 * n;
  };
}
function fbm(fn, x, y, oct = 4, lac = 2, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let o = 0; o < oct; o++) { s += a * fn(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}
function hash3(x, y, z, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(seed, 144665)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
function fbm3(x, y, z, seed, oct = 4) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let o = 0; o < oct; o++) { s += a * vnoise3(x * f, y * f, z * f, seed + o * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// =====================================================================
//  Device / quality
// =====================================================================
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const IS_MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) < 900;
const PRESETS = {
  low: { pr: 0.8, shadows: false, bloom: false, grass: 0.35, shadowSize: 1024 },
  med: { pr: 1.25, shadows: true, bloom: true, grass: 0.65, shadowSize: 1024 },
  high: { pr: 2.0, shadows: true, bloom: true, grass: 1.0, shadowSize: 2048 },
};
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};
let qualityName = store.get('lumora-quality') || (IS_MOBILE ? 'med' : 'high');
let Q = PRESETS[qualityName];
const GRASS_MAX = IS_MOBILE ? 34000 : 80000;
const GRASS_R = IS_MOBILE ? 22 : 32;

// =====================================================================
//  Procedural textures (all generated at load, no external assets)
// =====================================================================
function tileNoise(size, fx, fy, oct, seed, gain = 0.5) {
  const out = new Float32Array(size * size);
  const r = mulberry32(seed);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const Fx = fx << o, Fy = fy << o;
    const g = new Float32Array(Fx * Fy);
    for (let k = 0; k < g.length; k++) g[k] = r();
    for (let y = 0; y < size; y++) {
      const py = (y / size) * Fy, y0 = Math.floor(py), ty = py - y0, sy = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % Fy;
      for (let x = 0; x < size; x++) {
        const px = (x / size) * Fx, x0 = Math.floor(px), tx = px - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % Fx;
        const a = g[y0 * Fx + x0], b = g[y0 * Fx + x1], c = g[y1 * Fx + x0], d = g[y1 * Fx + x1];
        out[y * size + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    tot += amp; amp *= gain;
  }
  for (let k = 0; k < out.length; k++) out[k] /= tot;
  return out;
}
function stretch01(a) {
  let mn = Infinity, mx = -Infinity;
  for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const d = mx - mn || 1;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - mn) / d;
  return a;
}
function worley(size, cells, seed) {
  const r = mulberry32(seed);
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + r()) / cells, (j + r()) / cells]);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
    let f1 = 9, f2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + cells) % cells, jj = (cj + dj + cells) % cells;
      const p = pts[jj * cells + ii];
      let dx = Math.abs(u - p[0]); dx = Math.min(dx, 1 - dx);
      let dy = Math.abs(v - p[1]); dy = Math.min(dy, 1 - dy);
      const d = Math.sqrt(dx * dx + dy * dy) * cells;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    out[y * size + x] = f2 - f1;
  }
  return out;
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function fieldToCanvas(size, fn) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = fn(i);
    img.data[i * 4] = clamp(r * 255, 0, 255); img.data[i * 4 + 1] = clamp(g * 255, 0, 255);
    img.data[i * 4 + 2] = clamp(b * 255, 0, 255); img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function normalFromHeight(h, size, strength) {
  return fieldToCanvas(size, (i) => {
    const x = i % size, y = (i / size) | 0;
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    return [nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5];
  });
}
let maxAniso = 4;
function tex(canvas, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const TEX = {};
function buildTextures() {
  // Ground: fine soil / grass grain
  const S = 512;
  const g1 = tileNoise(S, 8, 8, 5, 11), g2 = tileNoise(S, 48, 48, 2, 12);
  const gh = new Float32Array(S * S);
  for (let i = 0; i < gh.length; i++) gh[i] = g1[i] * 0.7 + g2[i] * 0.5;
  TEX.groundN = tex(normalFromHeight(gh, S, 6), { srgb: false });
  TEX.groundC = tex(fieldToCanvas(S, (i) => { const v = 0.8 + g1[i] * 0.22 + (g2[i] - 0.5) * 0.12; return [v, v, v]; }));
  // Macro variation (anti-tiling)
  const m = stretch01(tileNoise(256, 4, 4, 5, 21));
  TEX.macro = tex(fieldToCanvas(256, (i) => [m[i], m[i], m[i]]), { srgb: false });
  // Stone: mottled with cracks
  const s1 = stretch01(tileNoise(S, 6, 6, 6, 31)), s2 = stretch01(worley(S, 16, 32)), s3 = tileNoise(S, 32, 32, 3, 33);
  TEX.stoneC = tex(fieldToCanvas(S, (i) => {
    const crack = smooth(0.0, 0.035, s2[i]);
    const v = (0.6 + s1[i] * 0.38 + (s3[i] - 0.5) * 0.25) * (0.8 + 0.2 * crack);
    return [v, v * 0.98, v * 0.95];
  }));
  // Water normals
  const w = tileNoise(256, 8, 8, 4, 41, 0.55);
  TEX.waterN = tex(normalFromHeight(w, 256, 10), { srgb: false });
  // Caustics
  const cw = worley(256, 7, 51);
  TEX.caustic = tex(fieldToCanvas(256, (i) => { const v = Math.pow(1 - smooth(0.0, 0.22, cw[i]), 3); return [v, v, v]; }), { srgb: false });
  // Bark
  const b1 = tileNoise(256, 16, 2, 4, 61);
  TEX.barkC = tex(fieldToCanvas(256, (i) => { const v = 0.55 + b1[i] * 0.6; return [v, v * 0.92, v * 0.85]; }));
  TEX.barkN = tex(normalFromHeight(b1, 256, 8), { srgb: false });
  // Fabric weave
  const fw = new Float32Array(256 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const a = Math.sin((x / 256) * TAU * 48), b = Math.sin((y / 256) * TAU * 48);
    fw[y * 256 + x] = (a > 0 ? a : 0) * 0.5 + (b > 0 ? b : 0) * 0.5 + g1[(y * 2) * S + x * 2] * 0.4;
  }
  TEX.fabricN = tex(normalFromHeight(fw, 256, 2.5), { srgb: false, repeat: 3 });
  // Wood planks
  const wd = tileNoise(256, 2, 24, 4, 71);
  TEX.wood = tex(fieldToCanvas(256, (i) => {
    const y = (i / 256) | 0;
    const plank = (y % 64) < 2 ? 0.45 : 1;
    const v = (0.55 + wd[i] * 0.5) * plank;
    return [v * 0.62, v * 0.45, v * 0.3];
  }));
  // Clouds (linear noise)
  const cl = stretch01(tileNoise(256, 4, 4, 6, 81, 0.55));
  TEX.cloud = tex(fieldToCanvas(256, (i) => [cl[i], cl[i], cl[i]]), { srgb: false });
  TEX.leaf = makeLeafTexture();
  TEX.rune = makeRuneTexture();
  TEX.lighthouse = makeLighthouseTexture();
}

function makeLeafTexture() {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  const r = mulberry32(5150);
  x.fillStyle = 'rgb(120,120,120)'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1500; i++) {
    const px = r() * S, py = r() * S, a = r() * TAU, l = 4 + r() * 6, w = l * (0.35 + r() * 0.2);
    const v = Math.floor(90 + r() * 165);
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (px + ox < -12 || px + ox > S + 12 || py + oy < -12 || py + oy > S + 12) continue;
      x.save(); x.translate(px + ox, py + oy); x.rotate(a);
      x.fillStyle = `rgb(${v * 0.55 | 0},${v * 0.55 | 0},${v * 0.55 | 0})`;
      x.beginPath(); x.ellipse(0.8, 0.8, l, w, 0, 0, TAU); x.fill();
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.beginPath(); x.ellipse(0, 0, l, w, 0, 0, TAU); x.fill();
      x.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = maxAniso;
  return t;
}
function makeRuneTexture() {
  const c = makeCanvas(512, 512), x = c.getContext('2d');
  const r = mulberry32(99);
  x.translate(256, 256);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round';
  const ring = (rad, w, a = 1) => { x.globalAlpha = a; x.lineWidth = w; x.beginPath(); x.arc(0, 0, rad, 0, TAU); x.stroke(); };
  ring(246, 6); ring(232, 2, 0.7); ring(170, 3); ring(150, 1.5, 0.6); ring(70, 4); ring(52, 1.5, 0.7);
  // glyph band
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    x.save(); x.rotate(a); x.translate(0, -201); x.globalAlpha = 0.95; x.lineWidth = 4;
    x.beginPath();
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const x0 = (r() - 0.5) * 22, y0 = (r() - 0.5) * 30, x1 = (r() - 0.5) * 22, y1 = (r() - 0.5) * 30;
      x.moveTo(x0, y0); x.lineTo(x1, y1);
    }
    if (r() > 0.5) { x.moveTo(8, 0); x.arc(0, 0, 8, 0, TAU); }
    x.stroke(); x.restore();
  }
  // inner star
  x.globalAlpha = 0.9; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i <= 5; i++) { const a = (i * 2 / 5) * TAU - Math.PI / 2; const px = Math.cos(a) * 150, py = Math.sin(a) * 150; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
  for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; x.globalAlpha = 0.8; x.lineWidth = i % 4 ? 2 : 5; x.beginPath(); x.moveTo(Math.cos(a) * 232, Math.sin(a) * 232); x.lineTo(Math.cos(a) * (i % 4 ? 222 : 212), Math.sin(a) * (i % 4 ? 222 : 212)); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

function makeLighthouseTexture() {
  const W = 512, H = 1024;
  const c = makeCanvas(W, H), x = c.getContext('2d');
  const bands = 6;
  for (let b = 0; b < bands; b++) {
    x.fillStyle = b % 2 ? '#a3342e' : '#e8e1d2';
    x.fillRect(0, (b / bands) * H, W, H / bands);
  }
  // bricks
  const rows = 64;
  for (let r = 0; r < rows; r++) {
    const y = (r / rows) * H;
    x.fillStyle = 'rgba(40,25,20,0.28)'; x.fillRect(0, y, W, 2);
    const off = r % 2 ? 0 : 16;
    for (let i = -1; i < 17; i++) { x.fillRect(i * 32 + off, y, 2, H / rows); }
  }
  // weathering
  const n = tileNoise(128, 4, 8, 5, 7);
  const img = x.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const v = n[((y >> 3) % 128) * 128 + ((xx >> 2) % 128)];
    const grime = 1 - 0.35 * Math.pow(y / H, 3) - (v - 0.5) * 0.25 - 0.1 * Math.max(0, Math.sin(xx * 0.05 + v * 6)) * (y / H);
    const k = (y * W + xx) * 4;
    img.data[k] *= grime; img.data[k + 1] *= grime; img.data[k + 2] *= grime;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.wrapS = THREE.RepeatWrapping;
  return t;
}

// =====================================================================
//  Renderer, scene, fog
// =====================================================================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1500);
const G = { time: { value: 0 } };

// Height-aware exponential fog. THREE.Fog is used as a carrier:
//   fog.near = density, fog.far = ground-mist strength.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth; varying float vFogY;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogY = ( transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[3].xyz ) ).y;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
  varying float vFogDepth; varying float vFogY;
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float fogFactor = 1.0 - exp( - fogNear * fogNear * vFogDepth * vFogDepth );
  float hfog = fogFar * exp( - max( vFogY - 0.5, 0.0 ) * 0.11 ) * ( 1.0 - exp( - vFogDepth * 0.035 ) );
  fogFactor = clamp( fogFactor + hfog * ( 1.0 - fogFactor ), 0.0, 1.0 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
scene.fog = new THREE.Fog(0x6b6a8c, 0.014, 0.5);
