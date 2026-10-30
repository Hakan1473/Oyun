// Özel geometriler: inceltilmiş eğri gövdeler (dallar), pürüzlü yumuşak kayalar, kumaş yüzeyler.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// 3B değer gürültüsü (kaya, kök şekilleri için)
function h3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440670441) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise3(x, y, z, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi);
  const v = f(y - yi);
  const w = f(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => h3(xi + dx, yi + dy, zi + dz, seed);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

export function fbm3(x, y, z, oct = 3, seed = 1) {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * noise3(x, y, z, seed + o * 13);
    n += a;
    a *= 0.5;
    x *= 2;
    y *= 2;
    z *= 2;
  }
  return s / n;
}

// Eğri boyunca incelen tüp: dallar, kökler, eğri gövdeler.
// points: Vector3[], radius(t) → yarıçap; uvLen: kabuk dokusunun dikey tekrarı (birim başına)
export function taperTube(points, radius, { radial = 8, segments = null, uvAround = 1, uvLen = 0.6, cap = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const segs = segments ?? Math.max(4, Math.round(curve.getLength() * 3));
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const len = curve.getLength();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const r = radius(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
      uv.push((j / radial) * uvAround, (t * len) / uvLen);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  if (cap) {
    // uç kapağı (incelen dalların ucu)
    const end = pos.length / 3;
    curve.getPointAt(1, p);
    const tan = curve.getTangentAt(1);
    pos.push(p.x + tan.x * radius(1) * 0.6, p.y + tan.y * radius(1) * 0.6, p.z + tan.z * radius(1) * 0.6);
    nor.push(tan.x, tan.y, tan.z);
    uv.push(0.5, len / uvLen);
    const ring = segs * (radial + 1);
    for (let j = 0; j < radial; j++) idx.push(ring + j, end, ring + j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Pürüzlü ama yumuşak kaya: yüksek çözünürlüklü küre + 3B gürültü
export function rockGeometry(r = 0.5, { seed = 1, detail = 3, squash = 0.65, rough = 0.28 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6, 4, seed);
    const flat = v.y < -0.2 ? 0.6 : 1;
    const k = r * (1 + (n - 0.5) * rough * 2);
    v.multiplyScalar(k);
    v.y *= squash * flat;
    if (v.y < -r * 0.15) v.y = -r * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Hafifçe sarkan kumaş (branda): ızgara + sarkma fonksiyonu
export function clothGeometry(w, d, sag, { segW = 12, segD = 8 } = {}) {
  const g = new THREE.PlaneGeometry(w, d, segW, segD);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const z = p.getZ(i) / (d / 2);
    const s = (1 - x * x) * (1 - z * z);
    p.setY(i, -sag * s + Math.sin(x * 9 + z * 4) * sag * 0.05);
  }
  g.computeVertexNormals();
  return g;
}
