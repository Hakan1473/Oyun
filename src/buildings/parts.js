// Mimari yapı taşları: çatı, pencere, kapı, kule, mazgal, bayrak...
// Yeni binalar bu parçaları birleştirerek birkaç satırda modellenebilir.

import * as THREE from 'three';
import { C, shade } from '../engine/palette.js';
import { SLOT } from '../engine/materials.js';

const HALF_PI = Math.PI / 2;

// Bina tabanı: hafif yuvarlatılmış taş/toprak kaide
export function pad(kit, size, { color = C.stone, top = C.stoneLight, h = 0.18, inset = 0.16 } = {}) {
  const w = size - inset * 2;
  kit.box(w, h, w, color, { y: h / 2, r: Math.min(0.08, h / 2) });
  kit.box(w - 0.12, 0.03, w - 0.12, top, { y: h + 0.005, r: 0.012 });
  return h;
}

// Bir yüzeye yerleştirilecek parçalar için koordinat sistemi.
// face: '+z' | '+x' | '-z' | '-x'; d: yüzeyin merkeze uzaklığı; u: yatay, v: dikey
export function onFace(kit, face, d, u, v, fn) {
  const o = {
    '+z': { x: u, y: v, z: d },
    '+x': { x: d, y: v, z: -u, ry: HALF_PI },
    '-z': { x: -u, y: v, z: -d, ry: Math.PI },
    '-x': { x: -d, y: v, z: u, ry: -HALF_PI },
  }[face];
  kit.group(o, fn);
}

// Beşik çatı; mahya x ekseni boyunca. y: duvarın üst kotu.
export function gableRoof(kit, {
  len, depth, rise, y = 0, color, ridge, gable, overhang = 0.14, overhangX = 0.1, thick = 0.09, rows = 2,
}) {
  const halfD = depth / 2;
  const a = Math.atan2(rise, halfD);
  const run = halfD + overhang;
  const slope = run / Math.cos(a);
  const ridgeY = y + rise;
  const L = len + overhangX * 2;
  const dark = shade(color, 0.86);
  for (const s of [-1, 1]) {
    const cz = s * (run / 2);
    const cy = ridgeY - (run / 2) * Math.tan(a);
    const nx = (thick / 2) * Math.cos(a);
    const nz = (thick / 2) * Math.sin(a) * s;
    kit.box(L, thick, slope + 0.02, color, { y: cy + nx, z: cz + nz, rx: s * a, r: 0.02 });
    for (let k = 1; k <= rows; k++) {
      const t = k / (rows + 1);
      const hz = s * t * run;
      const hy = ridgeY - t * run * Math.tan(a);
      kit.box(L + 0.01, 0.022, 0.035, dark, {
        y: hy + Math.cos(a) * (thick + 0.006),
        z: hz + Math.sin(a) * s * (thick + 0.006),
        rx: s * a,
      });
    }
  }
  if (gable !== undefined) kit.prism(len, depth, rise, gable, { y });
  kit.cyl(thick * 0.62, thick * 0.62, L + 0.03, 8, ridge ?? shade(color, 0.78), { y: ridgeY + thick * 0.62, rz: HALF_PI });
  return ridgeY;
}

// Pencere; +z yönüne bakar, merkezde.
export function windowPane(kit, {
  w = 0.24, h = 0.26, frame = C.wallWhite, glass = C.window, sill = true, flowerbox = false,
  shutters = null, arch = false, rng = null, cross = true,
} = {}) {
  kit.box(w + 0.07, h + 0.07, 0.04, frame, { z: 0.005 });
  kit.box(w, h, 0.05, glass, { z: 0.012 });
  kit.box(w * 0.18, h * 0.72, 0.012, C.windowLight, { x: -w * 0.24, z: 0.04 });
  if (arch) {
    kit.cyl(w / 2 + 0.035, w / 2 + 0.035, 0.04, 12, frame, { y: h / 2, z: 0.005, rx: HALF_PI, thetaStart: HALF_PI, thetaLength: Math.PI });
    kit.cyl(w / 2, w / 2, 0.05, 12, glass, { y: h / 2, z: 0.012, rx: HALF_PI, thetaStart: HALF_PI, thetaLength: Math.PI });
  }
  if (cross) {
    kit.box(0.022, h, 0.06, frame, { z: 0.02 });
    kit.box(w, 0.022, 0.06, frame, { z: 0.02 });
  }
  if (sill) kit.box(w + 0.12, 0.035, 0.08, C.stoneLight, { y: -h / 2 - 0.045, z: 0.035 });
  if (flowerbox) {
    kit.box(w + 0.08, 0.07, 0.09, C.wood, { y: -h / 2 - 0.1, z: 0.055 });
    const cols = [C.flowerRed, C.flowerYellow, C.flowerPink, C.flowerWhite];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const fx = -w / 2 + (w * (i + 0.5)) / n;
      kit.blob(0.035, C.leaf, { x: fx, y: -h / 2 - 0.05, z: 0.07, detail: 0 });
      kit.blob(0.03, rng ? rng.pick(cols) : cols[i % cols.length], { x: fx + 0.01, y: -h / 2 - 0.025, z: 0.09, detail: 0 });
    }
  }
  if (shutters) {
    for (const sx of [-1, 1]) {
      kit.box(w * 0.42, h + 0.05, 0.03, shutters, { x: sx * (w / 2 + w * 0.21 + 0.045), z: 0.01, r: 0.008 });
    }
  }
}

// Kapı; +z yönüne bakar, tabanı y=0'da.
export function door(kit, { w = 0.3, h = 0.5, color = C.door, frame = C.woodDark, arch = true, step = true } = {}) {
  const rect = arch ? h - w / 2 : h;
  kit.box(w + 0.08, rect + 0.04, 0.04, frame, { y: (rect + 0.04) / 2, z: 0.005 });
  kit.box(w, rect, 0.06, color, { y: rect / 2, z: 0.012 });
  if (arch) {
    kit.cyl(w / 2 + 0.04, w / 2 + 0.04, 0.04, 12, frame, { y: rect, z: 0.005, rx: HALF_PI, thetaStart: HALF_PI, thetaLength: Math.PI });
    kit.cyl(w / 2, w / 2, 0.06, 12, color, { y: rect, z: 0.012, rx: HALF_PI, thetaStart: HALF_PI, thetaLength: Math.PI });
  }
  const plank = shade(color, 0.8);
  for (const px of [-w / 6, w / 6]) kit.box(0.015, rect * 0.92, 0.068, plank, { x: px, y: rect * 0.48, z: 0.012 });
  kit.sphere(0.022, C.gold, { x: w * 0.3, y: rect * 0.5, z: 0.055, slot: SLOT.SHINY, ws: 8, hs: 6 });
  if (step) kit.box(w + 0.18, 0.05, 0.16, C.stoneLight, { y: 0.025, z: 0.08, r: 0.015 });
}

// Mazgallı kenar (kale duvarı tepesi)
export function crenels(kit, w, d, y, color, { size = 0.17, gap = 0.4 } = {}) {
  const along = (len, fn) => {
    const n = Math.max(2, Math.round(len / gap));
    for (let k = 0; k < n; k++) fn(-len / 2 + (len * (k + 0.5)) / n);
  };
  along(w, (u) => {
    kit.box(size, size, size * 0.8, color, { x: u, y: y + size / 2, z: d / 2 - size * 0.4, r: 0.02 });
    kit.box(size, size, size * 0.8, color, { x: u, y: y + size / 2, z: -d / 2 + size * 0.4, r: 0.02 });
  });
  along(d, (u) => {
    kit.box(size * 0.8, size, size, color, { x: w / 2 - size * 0.4, y: y + size / 2, z: u, r: 0.02 });
    kit.box(size * 0.8, size, size, color, { x: -w / 2 + size * 0.4, y: y + size / 2, z: u, r: 0.02 });
  });
}

// Yuvarlak kule + konik çatı. Tabanı y0, döndürür: çatı tepesinin y'si
export function tower(kit, { x = 0, z = 0, y0 = 0, r = 0.42, h = 2, wall = C.wall, roof = C.roofRed, band = C.stone, roofH = 0.9, finial = true, merlons = true, windows = [] }) {
  kit.group({ x, z }, () => {
    kit.cyl(r * 0.98, r * 1.04, h, 18, wall, { y: y0 + h / 2 });
    kit.cyl(r * 1.1, r * 1.12, 0.14, 18, band, { y: y0 + 0.07 });
    kit.cyl(r * 1.12, r * 1.08, 0.12, 18, band, { y: y0 + h - 0.06 });
    if (merlons) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        kit.box(0.13, 0.13, 0.13, band, { x: Math.cos(a) * r * 1.02, y: y0 + h + 0.06, z: Math.sin(a) * r * 1.02, ry: -a, r: 0.015 });
      }
    }
    kit.cone(r * 1.28, roofH, 12, roof, { y: y0 + h + 0.12 + roofH / 2 });
    kit.cyl(r * 1.3, r * 1.3, 0.05, 12, shade(roof, 0.8), { y: y0 + h + 0.12 });
    for (const wv of windows) {
      const a = wv.angle;
      kit.group({ x: Math.sin(a) * r * 0.99, y: y0 + wv.y, z: Math.cos(a) * r * 0.99, ry: a }, () => {
        windowPane(kit, { w: 0.13, h: 0.2, arch: true, sill: false, cross: false, frame: C.stoneLight });
      });
    }
    if (finial) {
      const top = y0 + h + 0.12 + roofH;
      kit.cyl(0.015, 0.015, 0.18, 5, C.goldDeep, { y: top + 0.05, slot: SLOT.SHINY });
      kit.sphere(0.055, C.gold, { y: top + 0.03, slot: SLOT.SHINY, ws: 10, hs: 8 });
    }
  });
  return y0 + h + 0.12 + roofH;
}

// Dalgalanan bayrak (dinamik parça)
export function flag(color, { w = 0.42, h = 0.26, phase = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 2);
  geo.translate(w / 2, 0, 0);
  const base = geo.attributes.position.array.slice();
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.75 });
  const mesh = new THREE.Mesh(geo, mat);
  const update = (t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i];
      const k = x / w;
      p[i + 2] = Math.sin(x * 9 - t * 6.5 + phase) * 0.055 * k;
      p[i + 1] = base[i + 1] - k * k * 0.03 + Math.sin(x * 7 - t * 5 + phase) * 0.012 * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return { mesh, update, dispose: () => { geo.dispose(); mat.dispose(); } };
}

// Kütük (yan yatmış silindir, uçları açık renk)
export function log(kit, { len = 0.6, r = 0.08, x = 0, y = 0, z = 0, ry = 0 } = {}) {
  kit.group({ x, y, z, ry }, () => {
    kit.cyl(r, r, len, 9, C.bark, { rz: HALF_PI });
    kit.cyl(r * 0.86, r * 0.86, len + 0.012, 9, C.woodPale, { rz: HALF_PI, sy: 1, s: 1 });
  });
}

// Fıçı
export function barrel(kit, { x = 0, z = 0, y = 0, r = 0.13, h = 0.26 } = {}) {
  kit.group({ x, y, z }, () => {
    kit.cyl(r * 0.88, r * 0.88, h, 12, C.woodLight, { y: h / 2 });
    kit.cyl(r, r, h * 0.6, 12, C.wood, { y: h / 2 });
    for (const t of [0.18, 0.82]) kit.cyl(r * 0.96, r * 0.96, 0.025, 12, C.iron, { y: h * t });
    kit.cyl(r * 0.82, r * 0.82, 0.01, 12, C.woodPale, { y: h + 0.002 });
  });
}

// Tahta sandık
export function crate(kit, { x = 0, z = 0, y = 0, s = 0.24, ry = 0, fill = null, rng = null } = {}) {
  kit.group({ x, y, z, ry }, () => {
    kit.box(s, s * 0.8, s, C.woodLight, { y: s * 0.4, r: 0.01 });
    for (const u of [-1, 1]) {
      kit.box(s + 0.01, 0.03, 0.03, C.wood, { y: s * 0.4 + u * s * 0.3, z: s / 2 });
      kit.box(0.03, 0.03, s + 0.01, C.wood, { y: s * 0.4 + u * s * 0.3, x: s / 2 });
    }
    if (fill) {
      for (let k = 0; k < 6; k++) {
        const fx = ((k % 3) - 1) * s * 0.28;
        const fz = (Math.floor(k / 3) - 0.5) * s * 0.4;
        kit.sphere(s * 0.17, rng ? rng.pick(fill) : fill[k % fill.length], { x: fx, y: s * 0.82, z: fz, ws: 8, hs: 6 });
      }
    }
  });
}

// Fener direği başı (ışıklı)
export function lantern(kit, { y = 0, s = 1 } = {}) {
  kit.group({ y, s }, () => {
    kit.box(0.12, 0.03, 0.12, C.iron, { y: 0 });
    kit.box(0.09, 0.13, 0.09, C.glow, { y: 0.08, slot: SLOT.GLOW });
    for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      kit.box(0.014, 0.14, 0.014, C.iron, { x: px * 0.048, y: 0.08, z: pz * 0.048 });
    }
    kit.pyramid(0.08, 0.08, C.iron, { y: 0.19 });
    kit.sphere(0.018, C.iron, { y: 0.24, ws: 6, hs: 4 });
  });
}
