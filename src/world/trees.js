// Ağaç geometrileri: ladin (sarkık dal katmanları), ölü ağaç (çarpık dallar), huş (soluk gövde, seyrek yaprak).
// Her ağaç iki parçadan oluşur: gövde (kabuk) ve yaprak (alfalı). Ayrıntı düzeyi (lod) uzak ağaçlar için düşer.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { taperTube } from '../engine/geo.js';
import { mulberry32 } from '../core/rng.js';

const DEG = Math.PI / 180;
// Sabit kamera yönü (yaprak kartlarını kameraya hafifçe çevirmek için)
export const VIEW_DIR = new THREE.Vector3(Math.cos(42 * DEG) * Math.sin(45 * DEG), Math.sin(42 * DEG), Math.cos(42 * DEG) * Math.cos(45 * DEG)).normalize();

function colorize(g, fn) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const [r, gg, b] = fn(p.getX(i), p.getY(i), p.getZ(i), i);
    c[i * 3] = r;
    c[i * 3 + 1] = gg;
    c[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function prep(g) {
  for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
  return g.index ? g.toNonIndexed() : g;
}

function merge(list) {
  const g = mergeGeometries(list.map(prep), false);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function trunkGeo(rng, h, r0, { lean = 0.2, radial = 8, roots = 4, tint = [1, 1, 1] } = {}) {
  const bend = new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(lean);
  const pts = [0, 0.3, 0.6, 1].map((t) => new THREE.Vector3(bend.x * t * t, t * h, bend.z * t * t));
  const parts = [taperTube(pts, (t) => r0 * (1 - t * 0.82) * (1 + 0.35 * Math.max(0, 1 - t * 8)), { radial, uvAround: 2, uvLen: 0.9 })];
  for (let k = 0; k < roots; k++) {
    const a = (k / roots) * Math.PI * 2 + rng();
    const L = r0 * (2.4 + rng() * 1.5);
    const rp = [
      new THREE.Vector3(0, r0 * 1.8, 0),
      new THREE.Vector3(Math.cos(a) * L * 0.45, r0 * 0.5, Math.sin(a) * L * 0.45),
      new THREE.Vector3(Math.cos(a) * L, -0.04, Math.sin(a) * L),
    ];
    parts.push(taperTube(rp, (t) => r0 * 0.55 * (1 - t * 0.85), { radial: 6, uvAround: 1, uvLen: 0.9 }));
  }
  const g = merge(parts);
  return colorize(g, (x, y) => {
    const k = 0.55 + 0.45 * Math.min(1, y / 1.5);
    return [k * tint[0], k * tint[1], k * tint[2]];
  });
}

// --- ladin ----------------------------------------------------------------------------

export function spruce(seed, { lod = 0, scale = 1 } = {}) {
  const rng = mulberry32(seed);
  const H = (4.0 + rng() * 1.9) * scale;
  const R = (1.25 + rng() * 0.42) * scale;
  const layers = lod ? 7 : 11;
  const seg = lod ? 10 : 18;
  const rings = lod ? 2 : 3;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  const wob = Array.from({ length: 64 }, () => rng());
  const wobAt = (a, k) => {
    const x = ((a / (Math.PI * 2)) * 8 + k * 3.7) % 8;
    const i = Math.floor(x);
    const f = x - i;
    const w0 = wob[(i + k * 8) % 64];
    const w1 = wob[(i + 1 + k * 8) % 64];
    return w0 + (w1 - w0) * (f * f * (3 - 2 * f));
  };
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1);
    const yTop = H * (0.97 - 0.8 * t);
    const r = R * (0.1 + 0.9 * Math.pow(t, 0.8)) * (0.9 + rng() * 0.2);
    const droop = r * 0.62 + 0.12;
    const rot = rng() * Math.PI * 2;
    const uRep = Math.max(2, Math.round(r * 2.4));
    const base = pos.length / 3;
    for (let j = 0; j <= rings; j++) {
      const s = j / rings;
      for (let i = 0; i <= seg; i++) {
        const a = rot + (i / seg) * Math.PI * 2;
        const w = 1 + (wobAt(a, k) - 0.5) * 0.42 * s;
        const rr = r * (0.06 + 0.94 * s) * w;
        const y = yTop - droop * (s * s * 0.75 + s * 0.25) + (wobAt(a + 1.3, k + 3) - 0.5) * 0.18 * s;
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
        uv.push((i / seg) * uRep, Math.min(0.995, s));
        const ao = (0.42 + 0.58 * s) * (1 - t * 0.38);
        col.push(ao * 0.92, ao, ao * 0.95);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = base + j * (seg + 1) + i;
        const b = a + seg + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const fol = new THREE.BufferGeometry();
  fol.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fol.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  fol.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  fol.setIndex(idx);
  fol.computeVertexNormals();
  // Yumuşak hacim hissi için normalleri dışa ve yukarı doğru bük
  const n = fol.attributes.normal;
  const p = fol.attributes.position;
  const v = new THREE.Vector3();
  const o = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    o.set(p.getX(i), 0.9, p.getZ(i)).normalize();
    if (v.y < 0) v.negate();
    v.lerp(o, 0.55).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  fol.computeBoundingBox();
  fol.computeBoundingSphere();
  const trunk = trunkGeo(rng, H * 0.92, 0.15 * scale, { lean: 0.15, radial: lod ? 6 : 9, roots: lod ? 0 : 4 });
  return { trunk, foliage: fol, height: H, radius: R };
}

// --- ölü ağaç ---------------------------------------------------------------------------

export function deadTree(seed, { lod = 0, scale = 1 } = {}) {
  const rng = mulberry32(seed);
  const H = (3.4 + rng() * 2.0) * scale;
  const r0 = (0.18 + rng() * 0.05) * scale;
  const lean = new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(0.9);
  const spine = [0, 0.25, 0.5, 0.75, 1].map((t, i) => new THREE.Vector3(
    lean.x * t * t + (i ? (rng() - 0.5) * 0.25 : 0), t * H, lean.z * t * t + (i ? (rng() - 0.5) * 0.25 : 0),
  ));
  const curve = new THREE.CatmullRomCurve3(spine);
  const parts = [taperTube(spine, (t) => r0 * (1 - t * 0.88) * (1 + 0.5 * Math.max(0, 1 - t * 7)), { radial: lod ? 6 : 10, uvAround: 2, uvLen: 0.9 })];
  const nb = lod ? 4 : 6 + Math.floor(rng() * 3);
  for (let b = 0; b < nb; b++) {
    const t = 0.35 + rng() * 0.6;
    const start = curve.getPointAt(t);
    const a = rng() * Math.PI * 2;
    const L = (0.9 + rng() * 1.6) * scale * (1.2 - t * 0.5);
    const up = 0.15 + rng() * 0.7;
    const dir = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize();
    const mid = start.clone().addScaledVector(dir, L * 0.5).add(new THREE.Vector3((rng() - 0.5) * 0.3, (rng() - 0.3) * 0.3, (rng() - 0.5) * 0.3));
    const end = start.clone().addScaledVector(dir, L).add(new THREE.Vector3((rng() - 0.5) * 0.5, -rng() * 0.4, (rng() - 0.5) * 0.5));
    const br = r0 * (0.45 - t * 0.25);
    parts.push(taperTube([start, mid, end], (s) => br * (1 - s * 0.85), { radial: lod ? 4 : 6, uvAround: 1, uvLen: 0.9 }));
    if (!lod) {
      for (let c = 0; c < 2; c++) {
        const tt = 0.45 + rng() * 0.4;
        const s0 = new THREE.CatmullRomCurve3([start, mid, end]).getPointAt(tt);
        const d2 = new THREE.Vector3(rng() - 0.5, rng() * 0.8, rng() - 0.5).normalize();
        const e2 = s0.clone().addScaledVector(d2, L * 0.35);
        const m2 = s0.clone().lerp(e2, 0.5).add(new THREE.Vector3(0, 0.08, 0));
        parts.push(taperTube([s0, m2, e2], (s) => br * 0.45 * (1 - s * 0.8), { radial: 4, uvAround: 1, uvLen: 0.9 }));
      }
    }
  }
  if (!lod) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + rng();
      const L = r0 * (3 + rng() * 2);
      parts.push(taperTube([
        new THREE.Vector3(0, r0 * 1.6, 0),
        new THREE.Vector3(Math.cos(a) * L * 0.5, r0 * 0.4, Math.sin(a) * L * 0.5),
        new THREE.Vector3(Math.cos(a) * L, -0.05, Math.sin(a) * L),
      ], (t) => r0 * 0.5 * (1 - t * 0.85), { radial: 6, uvAround: 1, uvLen: 0.9 }));
    }
  }
  const trunk = colorize(merge(parts), (x, y) => {
    const k = 0.5 + 0.38 * Math.min(1, y / 2.5);
    return [k * 0.92, k * 0.9, k * 0.86];
  });
  return { trunk, foliage: null, height: H, radius: 1.6 * scale };
}

// --- huş -----------------------------------------------------------------------------------

export function birch(seed, { lod = 0, scale = 1 } = {}) {
  const rng = mulberry32(seed);
  const H = (4.1 + rng() * 1.6) * scale;
  const r0 = 0.12 * scale;
  const lean = new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(0.7);
  const spine = [0, 0.33, 0.66, 1].map((t) => new THREE.Vector3(lean.x * t * t, t * H, lean.z * t * t));
  const curve = new THREE.CatmullRomCurve3(spine);
  const parts = [taperTube(spine, (t) => r0 * (1 - t * 0.8), { radial: lod ? 6 : 9, uvAround: 1, uvLen: 1.2 })];
  const cards = [];
  const nb = lod ? 3 : 6;
  for (let b = 0; b < nb; b++) {
    const t = 0.5 + rng() * 0.45;
    const s = curve.getPointAt(t);
    const a = rng() * Math.PI * 2;
    const L = 0.7 + rng() * 0.9;
    const e = s.clone().add(new THREE.Vector3(Math.cos(a) * L, 0.4 + rng() * 0.5, Math.sin(a) * L));
    parts.push(taperTube([s, s.clone().lerp(e, 0.5).add(new THREE.Vector3(0, 0.15, 0)), e], (q) => r0 * 0.35 * (1 - q * 0.8), { radial: 4, uvAround: 1, uvLen: 1.2 }));
  }
  // Yaprak kartları: tepede birkaç küme
  const nc = lod ? 8 : 16;
  const top = curve.getPointAt(0.82);
  const card = new THREE.PlaneGeometry(1, 1);
  const tmpQ = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  for (let c = 0; c < nc; c++) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * 1.0;
    const cy = top.y + (rng() - 0.35) * 1.8;
    const center = new THREE.Vector3(top.x + Math.cos(a) * rr, cy, top.z + Math.sin(a) * rr);
    const size = 1.1 + rng() * 0.8;
    const g = card.clone();
    // kameraya dönük, rastgele eğimli
    const look = VIEW_DIR.clone().add(new THREE.Vector3((rng() - 0.5) * 1.2, (rng() - 0.5) * 0.8, (rng() - 0.5) * 1.2)).normalize();
    tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), look);
    const roll = new THREE.Quaternion().setFromAxisAngle(look, rng() * Math.PI * 2);
    m.compose(center, roll.multiply(tmpQ), new THREE.Vector3(size, size, size));
    g.applyMatrix4(m);
    // normaller küme merkezinden dışa
    const n = g.attributes.normal;
    const p = g.attributes.position;
    const ctr = new THREE.Vector3(top.x, top.y + 0.2, top.z);
    for (let i = 0; i < n.count; i++) {
      const d = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(ctr).normalize();
      d.y += 0.5;
      d.normalize();
      n.setXYZ(i, d.x, d.y, d.z);
    }
    const lk = 0.55 + rng() * 0.45;
    const tone = rng();
    colorize(g, (x, y) => {
      const k = lk * (0.75 + 0.25 * Math.min(1, (y - top.y + 1.5) / 2.5));
      return [k * (0.95 + tone * 0.25), k * (0.92 + tone * 0.05), k * (0.62 - tone * 0.1)];
    });
    cards.push(g);
  }
  const trunk = colorize(merge(parts), (x, y) => {
    const k = 0.62 + 0.38 * Math.min(1, y / 2);
    return [k, k, k * 0.98];
  });
  const foliage = merge(cards);
  return { trunk, foliage, height: H, radius: 1.3 * scale };
}

export const TREE_TYPES = {
  spruce: { build: spruce, trunkMat: 'bark', foliageMat: 'needles', variants: 3 },
  deadtree: { build: deadTree, trunkMat: 'bark', foliageMat: null, variants: 2 },
  birch: { build: birch, trunkMat: 'birch', foliageMat: 'leaves', variants: 2 },
};

// Geometri önbelleği: tür:varyant:lod
const cache = new Map();
export function treeGeometry(type, variant, lod = 0) {
  const key = `${type}:${variant}:${lod}`;
  if (!cache.has(key)) cache.set(key, TREE_TYPES[type].build(1000 + variant * 7919 + (type.length * 31), { lod }));
  return cache.get(key);
}
