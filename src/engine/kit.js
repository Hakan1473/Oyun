// Modelleme kiti: basit geometrileri (kutu, silindir, koni, küre...) renklendirip
// tek bir ağa (mesh) birleştirir. Her bina böylece 1–3 çizim çağrısıyla çizilir.
//
//   const kit = new Kit();
//   kit.box(1, 1, 1, C.wall, { y: 0.5, r: 0.05 });
//   kit.group({ x: 1, ry: Math.PI / 2 }, () => { kit.cone(0.5, 1, 8, C.roofRed, { y: 1 }); });
//   const mesh = kit.build();

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MATERIALS, SLOT } from './materials.js';

const KEEP = new Set(['position', 'normal', 'color']);
const cache = new Map();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

function cached(key, make) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

function matrixFrom(o) {
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
  _q.setFromEuler(_e);
  const s = o.s ?? 1;
  _s.set(o.sx ?? s, o.sy ?? s, o.sz ?? s);
  _p.set(o.x || 0, o.y || 0, o.z || 0);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

export function prismGeometry(len, base, height) {
  // Üçgen kesitli prizma: kesit z–y düzleminde (taban `base`, tepe `height`), x boyunca `len`.
  const shape = new THREE.Shape();
  shape.moveTo(-base / 2, 0);
  shape.lineTo(base / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

export class Kit {
  constructor() {
    this.slots = [[], [], []];
    this.stack = [];
    this.current = new THREE.Matrix4();
  }

  push(o) {
    this.stack.push(this.current.clone());
    this.current.multiply(matrixFrom(o));
    return this;
  }

  pop() {
    this.current = this.stack.pop() ?? new THREE.Matrix4();
    return this;
  }

  group(o, fn) {
    this.push(o);
    fn();
    this.pop();
    return this;
  }

  add(geo, color, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
    _m.copy(this.current).multiply(matrixFrom(o));
    g.applyMatrix4(_m);
    if (o.flat) {
      g.deleteAttribute('normal');
      g.computeVertexNormals();
    } else if (!g.attributes.normal) {
      g.computeVertexNormals();
    }
    _c.set(color);
    if (o.shade) _c.multiplyScalar(o.shade);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = _c.r;
      arr[i * 3 + 1] = _c.g;
      arr[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.slots[o.slot ?? SLOT.MATTE].push(g);
    return this;
  }

  // --- ilkel şekiller -----------------------------------------------------

  box(w, h, d, color, o = {}) {
    const r = o.r ? Math.min(o.r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3) : 0;
    const geo = r > 0
      ? cached(`rb:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r))
      : cached(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
    return this.add(geo, color, o);
  }

  cyl(rTop, rBot, h, seg, color, o = {}) {
    const open = !!o.open;
    const ts = o.thetaStart ?? 0;
    const tl = o.thetaLength ?? Math.PI * 2;
    const geo = cached(`c:${rTop}:${rBot}:${h}:${seg}:${open}:${ts}:${tl}`,
      () => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open, ts, tl));
    return this.add(geo, color, o);
  }

  cone(r, h, seg, color, o = {}) {
    const geo = cached(`k:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
    return this.add(geo, color, { flat: seg <= 12, ...o });
  }

  // Kare tabanlı piramit; `half` tabanın yarı genişliği.
  pyramid(half, h, color, o = {}) {
    const geo = cached(`p:${half}:${h}`, () => {
      const g = new THREE.ConeGeometry(half * Math.SQRT2, h, 4);
      g.rotateY(Math.PI / 4);
      return g;
    });
    return this.add(geo, color, { flat: true, ...o });
  }

  sphere(r, color, o = {}) {
    const ws = o.ws ?? 12;
    const hs = o.hs ?? 8;
    const geo = cached(`s:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
    return this.add(geo, color, o);
  }

  // Yarım küre (kubbe), tabanı y=0'da.
  dome(r, color, o = {}) {
    const ws = o.ws ?? 14;
    const geo = cached(`d:${r}:${ws}`, () => new THREE.SphereGeometry(r, ws, 7, 0, Math.PI * 2, 0, Math.PI / 2));
    return this.add(geo, color, o);
  }

  blob(r, color, o = {}) {
    const detail = o.detail ?? 1;
    const geo = cached(`i:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
    return this.add(geo, color, { flat: true, ...o });
  }

  rock(r, color, o = {}) {
    const geo = cached(`r:${r}`, () => new THREE.DodecahedronGeometry(r, 0));
    return this.add(geo, color, { flat: true, ...o });
  }

  prism(len, base, height, color, o = {}) {
    const geo = cached(`pr:${len}:${base}:${height}`, () => prismGeometry(len, base, height));
    return this.add(geo, color, { flat: true, ...o });
  }

  disc(r, seg, color, o = {}) {
    const geo = cached(`ci:${r}:${seg}`, () => {
      const g = new THREE.CircleGeometry(r, seg);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    return this.add(geo, color, o);
  }

  torus(r, tube, color, o = {}) {
    const geo = cached(`t:${r}:${tube}`, () => new THREE.TorusGeometry(r, tube, 6, 16));
    return this.add(geo, color, o);
  }

  // --- çıktı ----------------------------------------------------------------

  get empty() {
    return this.slots.every((s) => s.length === 0);
  }

  geometry(slot = SLOT.MATTE) {
    const list = this.slots[slot];
    if (!list.length) return null;
    const g = mergeGeometries(list, false);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  build(materials = MATERIALS) {
    const parts = [];
    const mats = [];
    this.slots.forEach((list, i) => {
      if (!list.length) return;
      parts.push(mergeGeometries(list, false));
      mats.push(materials[i]);
    });
    const geo = parts.length === 1 ? parts[0] : mergeGeometries(parts, true);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mats.length === 1 ? mats[0] : mats);
    mesh.userData.slotMap = this.slots.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

// Bir ağın malzemelerini, slot düzenini koruyarak başka bir malzeme kümesiyle değiştirir.
export function applyMaterialSet(mesh, set) {
  const map = mesh.userData.slotMap;
  if (!map) return;
  mesh.material = map.length === 1 ? set[map[0]] : map.map((i) => set[i]);
}
