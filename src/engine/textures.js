// Prosedürel doku stüdyosu: tüm yüzeyler açılışta tuvale boyanır, dosya indirilmez.
// Dokular kendini tekrar eden (tileable) şekilde üretilir; böylece geniş alanlarda dikiş görünmez.

import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

// --- periyodik değer gürültüsü --------------------------------------------------

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, px, py, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const mx = (v) => ((v % px) + px) % px;
  const my = (v) => ((v % py) + py) % py;
  const a = hash2(mx(xi), my(yi), seed);
  const b = hash2(mx(xi + 1), my(yi), seed);
  const c = hash2(mx(xi), my(yi + 1), seed);
  const d = hash2(mx(xi + 1), my(yi + 1), seed);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// u, v ∈ [0,1): dokuyla aynı periyotta tekrar eden fbm
export function fbm(u, v, freq, oct = 4, seed = 1, sx = 1, sy = 1) {
  let sum = 0;
  let amp = 0.5;
  let f = freq;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    const px = Math.max(1, Math.round(f * sx));
    const py = Math.max(1, Math.round(f * sy));
    sum += amp * vnoise(u * px, v * py, px, py, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function canvas(size, h = size) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = h;
  return cv;
}

// Piksel piksel boyama: fn(u, v) → [r, g, b, a?]
function paint(cv, fn) {
  const g = cv.getContext('2d');
  const { width: w, height: h } = cv;
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn(x / w, y / h);
      const k = (y * w + x) * 4;
      d[k] = c[0];
      d[k + 1] = c[1];
      d[k + 2] = c[2];
      d[k + 3] = c[3] ?? 255;
    }
  }
  g.putImageData(img, 0, 0);
  return g;
}

// Kenarlarda sarmalayarak çiz: dokunun dikişsiz kalması için
function wrapDraw(g, S, x, y, r, fn) {
  for (const ox of [-S, 0, S]) {
    for (const oy of [-S, 0, S]) {
      const px = x + ox;
      const py = y + oy;
      if (px + r < 0 || px - r > S || py + r < 0 || py - r > S) continue;
      g.save();
      g.translate(px, py);
      fn(g);
      g.restore();
    }
  }
}

function toTexture(cv, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// --- yüzeyler -------------------------------------------------------------------

function forestFloor(S) {
  const cv = canvas(S);
  const soilA = rgb(0x2a2219);
  const soilB = rgb(0x3a2f20);
  const moss = rgb(0x39452a);
  const mossLight = rgb(0x4f5a33);
  const g = paint(cv, (u, v) => {
    const n = fbm(u, v, 4, 5, 11);
    const m = fbm(u, v, 3, 4, 23);
    const fine = fbm(u, v, 32, 2, 41);
    let c = mix3(soilA, soilB, n);
    const mo = smooth(0.48, 0.66, m);
    c = mix3(c, mix3(moss, mossLight, fine), mo * 0.85);
    const k = 0.82 + fine * 0.3;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  const rng = mulberry32(7);
  const leafCols = ['#5a3b22', '#6b4627', '#4a3a26', '#7a5832', '#3b3021', '#5c4b2a', '#6e3d24'];
  // iğne yapraklar
  g.lineCap = 'round';
  for (let i = 0; i < S * 5; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = S * (0.006 + rng() * 0.012);
    const a = rng() * Math.PI;
    g.strokeStyle = rng() < 0.5 ? 'rgba(92,72,44,0.75)' : 'rgba(60,48,30,0.8)';
    g.lineWidth = Math.max(1, S / 700);
    wrapDraw(g, S, x, y, len, (c) => {
      c.rotate(a);
      c.beginPath();
      c.moveTo(-len / 2, 0);
      c.lineTo(len / 2, 0);
      c.stroke();
    });
  }
  // yaprak döküntüsü
  for (let i = 0; i < S * 2.4; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = S * (0.004 + rng() * 0.007);
    const a = rng() * Math.PI * 2;
    const col = leafCols[Math.floor(rng() * leafCols.length)];
    const shadeK = 0.5 + rng() * 0.5;
    wrapDraw(g, S, x, y, r * 2, (c) => {
      c.rotate(a);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(r * 0.15, r * 0.25, r, r * 0.45, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = shadeK;
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(30,20,12,0.5)';
      c.lineWidth = Math.max(0.6, r * 0.12);
      c.beginPath();
      c.moveTo(-r, 0);
      c.lineTo(r, 0);
      c.stroke();
    });
  }
  // dal parçaları ve çakıllar
  for (let i = 0; i < S * 0.12; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = S * (0.02 + rng() * 0.04);
    const a = rng() * Math.PI;
    wrapDraw(g, S, x, y, len, (c) => {
      c.rotate(a);
      c.strokeStyle = 'rgba(20,14,9,0.6)';
      c.lineWidth = Math.max(1.5, S / 260);
      c.beginPath();
      c.moveTo(-len / 2, 1);
      c.quadraticCurveTo(0, -len * 0.08 + 1, len / 2, 1);
      c.stroke();
      c.strokeStyle = 'rgba(78,60,40,0.9)';
      c.lineWidth = Math.max(1, S / 380);
      c.beginPath();
      c.moveTo(-len / 2, 0);
      c.quadraticCurveTo(0, -len * 0.08, len / 2, 0);
      c.stroke();
    });
  }
  for (let i = 0; i < S * 0.2; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = S * (0.002 + rng() * 0.004);
    const gray = 70 + Math.floor(rng() * 40);
    wrapDraw(g, S, x, y, r * 2, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath();
      c.arc(r * 0.3, r * 0.4, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgb(${gray},${gray - 4},${gray - 10})`;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
    });
  }
  return toTexture(cv);
}

function dirt(S) {
  const cv = canvas(S);
  const a = rgb(0x4b3d2c);
  const b = rgb(0x5f4e39);
  const dark = rgb(0x34291d);
  const g = paint(cv, (u, v) => {
    const n = fbm(u, v, 5, 5, 3);
    const f = fbm(u, v, 40, 2, 9);
    const rut = fbm(u, v, 2, 3, 77);
    let c = mix3(a, b, n);
    c = mix3(c, dark, smooth(0.55, 0.75, rut) * 0.5);
    const k = 0.85 + f * 0.28;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  const rng = mulberry32(19);
  for (let i = 0; i < S * 0.5; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = S * (0.002 + rng() * 0.006);
    const gray = 80 + Math.floor(rng() * 50);
    wrapDraw(g, S, x, y, r * 2, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(r * 0.3, r * 0.35, r, r * 0.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgb(${gray},${gray - 6},${gray - 14})`;
      c.beginPath();
      c.ellipse(0, 0, r, r * 0.8, rng() * 3, 0, Math.PI * 2);
      c.fill();
    });
  }
  g.lineCap = 'round';
  for (let i = 0; i < S * 1.2; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = S * (0.006 + rng() * 0.01);
    const ang = rng() * Math.PI;
    g.strokeStyle = 'rgba(90,70,42,0.6)';
    g.lineWidth = Math.max(1, S / 700);
    wrapDraw(g, S, x, y, len, (c) => {
      c.rotate(ang);
      c.beginPath();
      c.moveTo(-len / 2, 0);
      c.lineTo(len / 2, 0);
      c.stroke();
    });
  }
  return toTexture(cv);
}

// Kabuk: damarlar v (dikey) yönünde
function bark(S) {
  const cv = canvas(S);
  const a = rgb(0x2c241e);
  const b = rgb(0x4a3e33);
  const lichen = rgb(0x6b7258);
  paint(cv, (u, v) => {
    const warp = fbm(u, v, 3, 3, 5) * 0.25;
    const ridge = fbm(u + warp, v, 10, 4, 7, 2.2, 0.35);
    const r = Math.abs(ridge - 0.5) * 2;
    const crack = smooth(0.0, 0.18, r);
    const n = fbm(u, v, 8, 3, 13);
    let c = mix3(a, b, crack * 0.9 + n * 0.2);
    const li = smooth(0.62, 0.72, fbm(u, v, 5, 4, 29));
    c = mix3(c, lichen, li * 0.55);
    const k = 0.55 + crack * 0.6;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  return toTexture(cv);
}

function birchBark(S) {
  const cv = canvas(S);
  const g = paint(cv, (u, v) => {
    const n = fbm(u, v, 6, 4, 3);
    const k = 0.86 + n * 0.16;
    return [214 * k, 208 * k, 196 * k];
  });
  const rng = mulberry32(5);
  for (let i = 0; i < S * 0.18; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const w = S * (0.02 + rng() * 0.08);
    const h = S * (0.004 + rng() * 0.01);
    wrapDraw(g, S, x, y, w, (c) => {
      c.fillStyle = `rgba(30,26,22,${0.55 + rng() * 0.4})`;
      c.beginPath();
      c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      c.fill();
    });
  }
  for (let i = 0; i < 14; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = S * (0.03 + rng() * 0.05);
    wrapDraw(g, S, x, y, r * 2, (c) => {
      c.fillStyle = 'rgba(25,22,18,0.75)';
      c.beginPath();
      c.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
      c.fill();
    });
  }
  return toTexture(cv);
}

// Eskimiş tahta: damarlar u (yatay) yönünde
function wood(S) {
  const cv = canvas(S);
  const a = rgb(0x4a3d31);
  const b = rgb(0x7a6a58);
  const g = paint(cv, (u, v) => {
    const warp = fbm(u, v, 2, 3, 3) * 0.6;
    const grain = fbm(u, v + warp * 0.1, 6, 4, 9, 0.25, 4);
    const lines = Math.abs(Math.sin((v * 22 + warp * 6 + grain * 3) * Math.PI));
    const n = fbm(u, v, 12, 3, 21);
    const weather = fbm(u, v, 3, 4, 33);
    let c = mix3(a, b, 0.35 + grain * 0.45 + n * 0.2);
    c = mix3(c, [118, 116, 108], smooth(0.5, 0.8, weather) * 0.45); // gri, güneşte solmuş
    const k = 0.78 + lines * 0.22;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  const rng = mulberry32(13);
  for (let i = 0; i < 6; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = S * (0.01 + rng() * 0.015);
    wrapDraw(g, S, x, y, r * 3, (c) => {
      c.strokeStyle = 'rgba(30,22,16,0.6)';
      c.lineWidth = r * 0.35;
      c.beginPath();
      c.ellipse(0, 0, r * 2, r, 0, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(30,22,16,0.8)';
      c.beginPath();
      c.ellipse(0, 0, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
      c.fill();
    });
  }
  return toTexture(cv);
}

function endGrain(S) {
  const cv = canvas(S);
  paint(cv, (u, v) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const ring = 0.5 + 0.5 * Math.sin(r * 38 + fbm(u, v, 4, 3, 5) * 6);
    const edge = smooth(0.82, 0.95, r);
    const base = mix3([118, 96, 72], [92, 72, 52], ring * 0.6);
    const c = mix3(base, [52, 40, 30], edge);
    return c;
  });
  return toTexture(cv, { repeat: false });
}

// Yosunlu, eskimiş ahşap pullar: düzensiz genişlik, üst üste binme gölgesi, yer yer eksik pul
function roof(S) {
  const cv = canvas(S);
  const g = cv.getContext('2d');
  const rng = mulberry32(3);
  g.fillStyle = '#0d0b09';
  g.fillRect(0, 0, S, S);
  const rows = 7;
  const rh = S / rows;
  for (let r = rows; r >= -1; r--) {
    let x = -rng() * S * 0.1;
    const y0 = r * rh;
    while (x < S) {
      const w = S * (0.05 + rng() * 0.09);
      if (rng() < 0.04) {
        x += w;
        continue;
      }
      const drop = rh * (1.08 + rng() * 0.18);
      const base = 48 + rng() * 34;
      const warm = rng() * 10;
      const grd = g.createLinearGradient(0, y0, 0, y0 + drop);
      grd.addColorStop(0, `rgb(${base * 0.55 + warm},${base * 0.5},${base * 0.44})`);
      grd.addColorStop(0.85, `rgb(${base + warm},${base * 0.92},${base * 0.8})`);
      grd.addColorStop(1, `rgb(${base * 0.7},${base * 0.64},${base * 0.56})`);
      wrapDraw(g, S, x + w / 2, y0 + drop / 2, Math.max(w, drop), (c) => {
        c.fillStyle = grd;
        c.translate(-x - w / 2, -y0 - drop / 2);
        c.beginPath();
        const sk = (rng() - 0.5) * w * 0.15;
        c.moveTo(x + 1, y0);
        c.lineTo(x + w - 1, y0);
        c.lineTo(x + w - 1 + sk, y0 + drop - rng() * rh * 0.1);
        c.lineTo(x + 1 + sk, y0 + drop - rng() * rh * 0.1);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(15,12,9,0.55)';
        c.lineWidth = Math.max(1, S / 512);
        for (let k = 0; k < 4; k++) {
          const gx = x + w * (0.15 + rng() * 0.7);
          c.beginPath();
          c.moveTo(gx, y0 + drop * 0.2);
          c.lineTo(gx + (rng() - 0.5) * 3, y0 + drop * (0.6 + rng() * 0.35));
          c.stroke();
        }
      });
      x += w;
    }
    // alt sıranın üstüne düşen gölge
    const sh = g.createLinearGradient(0, y0 + rh * 1.0, 0, y0 + rh * 1.25);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(0, y0 + rh, S, rh * 0.25);
  }
  // yosun ve liken
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const m = smooth(0.5, 0.7, fbm(u, v, 3, 5, 17));
      const fine = fbm(u, v, 28, 2, 31);
      const li = smooth(0.66, 0.74, fbm(u, v, 9, 3, 61));
      const k = (y * S + x) * 4;
      const mo = m * (0.55 + fine * 0.6);
      d[k] = lerp(d[k], 50 + fine * 30, mo);
      d[k + 1] = lerp(d[k + 1], 62 + fine * 34, mo);
      d[k + 2] = lerp(d[k + 2], 30 + fine * 14, mo);
      d[k] = lerp(d[k], 128, li * 0.35);
      d[k + 1] = lerp(d[k + 1], 132, li * 0.35);
      d[k + 2] = lerp(d[k + 2], 112, li * 0.35);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(cv);
}

function stone(S) {
  const cv = canvas(S);
  // Basit Voronoi taşları
  const rng = mulberry32(31);
  const pts = Array.from({ length: 26 }, () => [rng(), rng(), 0.7 + rng() * 0.4]);
  paint(cv, (u, v) => {
    let d1 = 9;
    let d2 = 9;
    let id = 0;
    for (let i = 0; i < pts.length; i++) {
      for (const ox of [-1, 0, 1]) {
        for (const oy of [-1, 0, 1]) {
          const dx = u - (pts[i][0] + ox);
          const dy = v - (pts[i][1] + oy);
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            id = i;
          } else if (d < d2) d2 = d;
        }
      }
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1);
    const mortar = smooth(0.0, 0.025, edge);
    const n = fbm(u, v, 10, 4, 7);
    const tone = pts[id][2];
    let c = mix3([70, 70, 68], [128, 126, 120], n);
    c = c.map((x) => x * tone);
    const moss = smooth(0.55, 0.7, fbm(u, v, 4, 4, 9)) * (1 - mortar * 0.6);
    c = mix3(c, [58, 72, 38], moss * 0.7);
    const k = 0.35 + 0.65 * mortar;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  return toTexture(cv);
}

function rock(S) {
  const cv = canvas(S);
  paint(cv, (u, v) => {
    const n = fbm(u, v, 6, 5, 3);
    const f = fbm(u, v, 30, 2, 8);
    const streak = fbm(u, v, 4, 3, 12, 1, 3);
    let c = mix3([62, 62, 60], [118, 116, 110], n * 0.8 + streak * 0.3);
    const li = smooth(0.6, 0.7, fbm(u, v, 7, 3, 44));
    c = mix3(c, [120, 124, 104], li * 0.5);
    const k = 0.8 + f * 0.3;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  return toTexture(cv);
}

function metal(S) {
  const cv = canvas(S);
  paint(cv, (u, v) => {
    const n = fbm(u, v, 8, 4, 3);
    const rust = smooth(0.45, 0.7, fbm(u, v, 4, 5, 9));
    const c = mix3([58, 60, 62], [112, 62, 34], rust);
    const k = 0.75 + n * 0.4;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  return toTexture(cv);
}

function cloth(S) {
  const cv = canvas(S);
  paint(cv, (u, v) => {
    const weave = (Math.sin(u * S * 1.2) * Math.sin(v * S * 1.2)) * 0.5 + 0.5;
    const n = fbm(u, v, 6, 4, 5);
    const dirtK = smooth(0.5, 0.8, fbm(u, v, 3, 4, 19));
    const base = 190 + n * 40;
    const k = (0.9 + weave * 0.1) * (1 - dirtK * 0.35);
    return [base * k, base * k * 0.98, base * k * 0.94];
  });
  return toTexture(cv);
}

// --- yapraklar (alfalı) ------------------------------------------------------------

// Ladin dalı katmanı: u çevre, v içten (0) dışa (1). Uçlar tuvalin üstünde.
function needles(S) {
  const cv = canvas(S);
  const g = cv.getContext('2d');
  const rng = mulberry32(17);
  const cols = 48;
  const edge = Array.from({ length: cols }, (_, i) => 0.7 + 0.22 * fbm(i / cols, 0.3, 5, 3, 3) + rng() * 0.06);
  const heightAt = (x) => {
    const p = (((x / S) * cols) % cols + cols) % cols;
    const i = Math.floor(p);
    const t = p - i;
    return S * lerp(edge[i], edge[(i + 1) % cols], t * t * (3 - 2 * t));
  };
  // dolgu (iç kısım koyu ve sık)
  for (let x = 0; x < S; x += 2) {
    const h = heightAt(x) * 0.78;
    const grd = g.createLinearGradient(0, S, 0, S - h);
    grd.addColorStop(0, '#0e1a12');
    grd.addColorStop(1, '#1c3021');
    g.fillStyle = grd;
    g.fillRect(x, S - h, 2.5, h);
  }
  g.lineCap = 'round';
  // dalcıklar ve iğneler
  for (let i = 0; i < 2600; i++) {
    const x = rng() * S;
    const top = heightAt(x);
    const y = S - rng() * top;
    const tip = (S - y) / top; // 0 içte, 1 uçta
    const len = S * (0.025 + rng() * 0.035) * (0.7 + tip * 0.5);
    const a = -Math.PI / 2 + (rng() - 0.5) * 0.9;
    const light = 0.25 + tip * 0.6 + rng() * 0.2;
    const r = Math.floor(lerp(18, 72, light));
    const gg = Math.floor(lerp(36, 104, light));
    const b = Math.floor(lerp(26, 70, light));
    g.strokeStyle = `rgb(${r},${gg},${b})`;
    g.lineWidth = Math.max(1, S / 300) * (1.3 - tip * 0.5);
    wrapDraw(g, S, x, y, len, (c) => {
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(len, 0);
      c.stroke();
      // yan iğneler
      c.lineWidth *= 0.7;
      for (let k = 1; k < 5; k++) {
        const t = (k / 5) * len;
        const s = len * 0.28 * (1 - k / 6);
        c.beginPath();
        c.moveTo(t, 0);
        c.lineTo(t + s * 0.6, -s);
        c.moveTo(t, 0);
        c.lineTo(t + s * 0.6, s);
        c.stroke();
      }
    });
  }
  const t = toTexture(cv, { repeat: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function leaves(S) {
  const cv = canvas(S);
  const g = cv.getContext('2d');
  const rng = mulberry32(23);
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * S * 0.42;
    const x = S / 2 + Math.cos(a) * rr;
    const y = S / 2 + Math.sin(a) * rr * 0.9;
    const r = S * (0.018 + rng() * 0.018);
    const depth = rr / (S * 0.42);
    const l = 0.35 + (1 - depth) * 0.25 + rng() * 0.35;
    g.save();
    g.translate(x, y);
    g.rotate(rng() * Math.PI * 2);
    g.fillStyle = `rgb(${Math.floor(lerp(40, 150, l))},${Math.floor(lerp(44, 140, l))},${Math.floor(lerp(22, 70, l))})`;
    g.beginPath();
    g.moveTo(-r, 0);
    g.quadraticCurveTo(0, -r * 0.7, r, 0);
    g.quadraticCurveTo(0, r * 0.7, -r, 0);
    g.fill();
    g.restore();
  }
  return toTexture(cv, { repeat: false });
}

function fern(S) {
  const cv = canvas(S);
  const g = cv.getContext('2d');
  const rng = mulberry32(29);
  // tek yaprak sapı: alttan yukarı kıvrılarak
  const steps = 26;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const x = S / 2 + Math.sin(t * 1.6) * S * 0.06;
    const y = S * (0.98 - t * 0.92);
    const len = S * 0.38 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.35);
    const l = 0.35 + t * 0.4 + rng() * 0.1;
    g.fillStyle = `rgb(${Math.floor(lerp(30, 92, l))},${Math.floor(lerp(52, 120, l))},${Math.floor(lerp(24, 52, l))})`;
    for (const side of [-1, 1]) {
      g.save();
      g.translate(x, y);
      g.rotate(side * (1.15 - t * 0.4));
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(len * 0.5, -S * 0.022, len, 0);
      g.quadraticCurveTo(len * 0.5, S * 0.022, 0, 0);
      g.fill();
      g.restore();
    }
  }
  g.strokeStyle = '#2b3a1e';
  g.lineWidth = S / 90;
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = S / 2 + Math.sin(t * 1.6) * S * 0.06;
    const y = S * (0.98 - t * 0.92);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  return toTexture(cv, { repeat: false });
}

// --- hepsi -----------------------------------------------------------------------

export async function createTextures({ quality = 'high', onProgress = null } = {}) {
  const hi = quality === 'high';
  const jobs = [
    ['floor', () => forestFloor(hi ? 1024 : 768)],
    ['dirt', () => dirt(512)],
    ['bark', () => bark(hi ? 512 : 256)],
    ['birch', () => birchBark(256)],
    ['wood', () => wood(hi ? 512 : 256)],
    ['endgrain', () => endGrain(128)],
    ['roof', () => roof(hi ? 512 : 256)],
    ['stone', () => stone(256)],
    ['rock', () => rock(256)],
    ['metal', () => metal(128)],
    ['cloth', () => cloth(256)],
    ['needles', () => needles(512)],
    ['leaves', () => leaves(256)],
    ['fern', () => fern(256)],
  ];
  const T = {};
  for (let k = 0; k < jobs.length; k++) {
    T[jobs[k][0]] = jobs[k][1]();
    onProgress?.((k + 1) / jobs.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return T;
}
