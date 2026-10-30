// Modelleme kiti: ilkel şekilleri dokulu malzemelerle birleştirip tek ağ üretir.
// Her malzeme için bir grup oluşur; bir bina birkaç çizim çağrısıyla çizilir.
//
//   const kit = new Kit();
//   kit.box(1, 1, 1, 0xffffff, { mat: 'wood', y: 0.5 });
//   kit.group({ x: 1, ry: 0.3 }, () => kit.cyl(0.1, 0.1, 2, 12, 0xffffff, { mat: 'bark', uv: 'native' }));
//   const mesh = kit.build();
//
// UV: varsayılan olarak parçanın kendi uzayında kutu izdüşümü (doku yoğunluğu her boyda aynı kalır).
// uv: 'native' geometrinin kendi UV'sini kullanır (silindir kabukları, kütükler).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAT, MAT_KEYS } from './materials.js';
import { rockGeometry } from './geo.js';

const KEEP = new Set(['position', 'normal', 'color', 'uv']);
const cache = new Map();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
let uvSeed = 1;

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

function boxUV(g, scale, offU, offV) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    const nz = Math.abs(n.getZ(i));
    let u;
    let v;
    if (nx >= ny && nx >= nz) {
      u = p.getZ(i);
      v = p.getY(i);
    } else if (ny >= nz) {
      u = p.getX(i);
      v = p.getZ(i);
    } else {
      u = p.getX(i);
      v = p.getY(i);
    }
    uv[i * 2] = u * scale + offU;
    uv[i * 2 + 1] = v * scale + offV;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function prismGeometry(len, base, height) {
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
    this.slots = new Map();
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

  add(geo, color = 0xffffff, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    const mat = o.mat ?? 'plain';
    if (o.uv === 'native' && g.attributes.uv) {
      const [ru, rv] = o.uvRepeat ?? [1, 1];
      const uv = g.attributes.uv;
      const off = (uvSeed++ * 0.6180339) % 1;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru + off, uv.getY(i) * rv + off * 0.37);
    } else {
      const k = uvSeed++;
      boxUV(g, o.uvScale ?? 0.7, (k * 0.6180339) % 1, (k * 0.3819660) % 1);
    }
    _m.copy(this.current).multiply(matrixFrom(o));
    g.applyMatrix4(_m);
    if (o.flat) {
      g.deleteAttribute('normal');
      g.computeVertexNormals();
    }
    _c.set(color);
    if (o.shade) _c.multiplyScalar(o.shade);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    // dikey ortam kapatması: tabana yakın kısımlar biraz koyu
    const ao = o.ao ?? 0;
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) {
      const k = ao ? 1 - ao * Math.max(0, 1 - p.getY(i) / (o.aoH ?? 0.6)) : 1;
      arr[i * 3] = _c.r * k;
      arr[i * 3 + 1] = _c.g * k;
      arr[i * 3 + 2] = _c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!this.slots.has(mat)) this.slots.set(mat, []);
    this.slots.get(mat).push(g);
    return this;
  }

  // --- ilkel şekiller -----------------------------------------------------------

  box(w, h, d, color, o = {}) {
    const r = o.r ? Math.min(o.r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3) : 0;
    const geo = r > 0
      ? cached(`rb:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r))
      : cached(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
    return this.add(geo, color, o);
  }

  cyl(rTop, rBot, h, seg, color, o = {}) {
    const open = !!o.open;
    const ts = o.thetaStart ?? 0;
    const tl = o.thetaLength ?? Math.PI * 2;
    const hs = o.hs ?? 1;
    const geo = cached(`c:${rTop}:${rBot}:${h}:${seg}:${open}:${ts}:${tl}:${hs}`,
      () => new THREE.CylinderGeometry(rTop, rBot, h, seg, hs, open, ts, tl));
    return this.add(geo, color, o);
  }

  cone(r, h, seg, color, o = {}) {
    const geo = cached(`k:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
    return this.add(geo, color, o);
  }

  sphere(r, color, o = {}) {
    const ws = o.ws ?? 20;
    const hs = o.hs ?? 14;
    const geo = cached(`s:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
    return this.add(geo, color, o);
  }

  dome(r, color, o = {}) {
    const ws = o.ws ?? 20;
    const geo = cached(`d:${r}:${ws}`, () => new THREE.SphereGeometry(r, ws, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    return this.add(geo, color, o);
  }

  capsule(r, len, color, o = {}) {
    const geo = cached(`cap:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14));
    return this.add(geo, color, o);
  }

  rock(r, color, o = {}) {
    const seed = o.seed ?? 1;
    const geo = cached(`rk:${r}:${seed}:${o.squash ?? 0.65}`, () => rockGeometry(r, { seed, squash: o.squash ?? 0.65, detail: o.detail ?? 3 }));
    return this.add(geo, color, { mat: 'rock', uvScale: 1.4, ...o });
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
    const arc = o.arc ?? Math.PI * 2;
    const geo = cached(`t:${r}:${tube}:${arc}`, () => new THREE.TorusGeometry(r, tube, 8, 24, arc));
    return this.add(geo, color, o);
  }

  // Yan yatmış kütük: kabuklu gövde + açık renkli kesit uçları
  log(len, r, o = {}) {
    this.group(o, () => {
      this.cyl(r, r, len, 14, o.color ?? 0xffffff, { mat: 'bark', uv: 'native', uvRepeat: [2, len * 1.2], rz: Math.PI / 2 });
      for (const s of [-1, 1]) {
        this.disc(r * 0.97, 14, 0xffffff, { mat: 'endgrain', uv: 'native', x: s * (len / 2 + 0.002), rz: -s * Math.PI / 2 });
      }
    });
    return this;
  }

  // --- çıktı ------------------------------------------------------------------------

  get empty() {
    return this.slots.size === 0;
  }

  geometry(mat = 'plain') {
    const list = this.slots.get(mat);
    if (!list?.length) return null;
    const g = mergeGeometries(list, false);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  build() {
    const parts = [];
    const mats = [];
    const keys = [...this.slots.keys()].sort((a, b) => MAT_KEYS.indexOf(a) - MAT_KEYS.indexOf(b));
    for (const k of keys) {
      parts.push(mergeGeometries(this.slots.get(k), false));
      mats.push(MAT[k]);
    }
    const geo = parts.length === 1 ? parts[0] : mergeGeometries(parts, true);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mats.length === 1 ? mats[0] : mats);
    mesh.userData.baseMaterial = mesh.material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

// Ağın malzemelerini bir dönüştürücüyle değiştir (vurgulama, kesme düzlemi)
export function mapMaterials(mesh, fn) {
  const base = mesh.userData.baseMaterial ?? mesh.material;
  mesh.material = Array.isArray(base) ? base.map(fn) : fn(base);
}

export function restoreMaterials(mesh) {
  if (mesh.userData.baseMaterial) mesh.material = mesh.userData.baseMaterial;
}
