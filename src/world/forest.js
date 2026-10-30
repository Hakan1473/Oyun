// Orman: arka plan ağaçları (parçalı, uzakta düşük ayrıntı) ve ızgaradaki kesilebilir ağaçlar.
// Hepsi örnekli (instanced) çizilir; yüzlerce ağaç birkaç düzine çizim çağrısıdır.

import * as THREE from 'three';
import { MAT } from '../engine/materials.js';
import { mulberry32 } from '../core/rng.js';
import { TREE_TYPES, treeGeometry } from './trees.js';
import { pathDistance } from './layout.js';

const CHUNK = 16;
const dummy = new THREE.Object3D();
const tmpM = new THREE.Matrix4();
const WHITE = new THREE.Color(1, 1, 1);

function instanced(geo, mat, n, shadow) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

export class Forest {
  constructor(stage, cfg, ground, quality) {
    this.stage = stage;
    const N = cfg.grid.size;
    const H = ground.half - 1;
    const rng = mulberry32(4242);
    const step = quality === 'low' ? 2.5 : 2.15;
    const groups = new Map();
    for (let x = -H; x <= H; x += step) {
      for (let z = -H; z <= H; z += step) {
        const px = x + (rng() - 0.5) * step * 0.85;
        const pz = z + (rng() - 0.5) * step * 0.85;
        if (Math.abs(px) < N / 2 + 0.6 && Math.abs(pz) < N / 2 + 0.6) continue;
        const pd = pathDistance(px, pz);
        if (pd.d < pd.path.width / 2 + 1.1) continue;
        if (rng() > 0.86) continue;
        const r = rng();
        const type = r < 0.62 ? 'spruce' : r < 0.82 ? 'deadtree' : 'birch';
        const variant = Math.floor(rng() * TREE_TYPES[type].variants);
        const dist = Math.hypot(px, pz);
        const lod = dist > 30 ? 1 : 0;
        const ck = `${Math.floor((px + H) / CHUNK)},${Math.floor((pz + H) / CHUNK)}`;
        const key = `${ck}|${type}|${variant}|${lod}`;
        if (!groups.has(key)) groups.set(key, { type, variant, lod, items: [], near: dist < 34 });
        groups.get(key).items.push({ x: px, z: pz, rot: rng() * Math.PI * 2, s: 0.85 + rng() * 0.4 + Math.min(0.35, dist / 120), tint: rng() });
      }
    }
    this.meshes = [];
    const tint = new THREE.Color();
    for (const g of groups.values()) {
      const geo = treeGeometry(g.type, g.variant, g.lod);
      const def = TREE_TYPES[g.type];
      const parts = [[geo.trunk, MAT[def.trunkMat]]];
      if (geo.foliage) parts.push([geo.foliage, MAT[def.foliageMat]]);
      for (const [pg, pm] of parts) {
        const m = instanced(pg, pm, g.items.length, g.near);
        g.items.forEach((it, n) => {
          dummy.position.set(it.x, 0, it.z);
          dummy.rotation.set(0, it.rot, 0);
          dummy.scale.setScalar(it.s);
          dummy.updateMatrix();
          m.setMatrixAt(n, dummy.matrix);
          const k = 0.82 + it.tint * 0.3;
          m.setColorAt(n, tint.setRGB(k, k * (0.97 + it.tint * 0.05), k * 0.96));
        });
        m.computeBoundingSphere();
        m.instanceMatrix.needsUpdate = true;
        stage.scene.add(m);
        this.meshes.push(m);
      }
    }
  }
}

// --- ızgaradaki kesilebilir ağaçlar -----------------------------------------------------------

class TreeView {
  constructor(field, e, def, slot, index) {
    this.field = field;
    this.e = e;
    this.def = def;
    this.slot = slot;
    this.index = index;
    this.instanced = true;
    const c = field.grid.center(e.i, e.j, def.size);
    this.center = new THREE.Vector3(c.x + (e.ox ?? 0), 0, c.z + (e.oz ?? 0));
    const geo = treeGeometry(e.type, e.variant ?? 0, 0);
    this.height = geo.height * (e.sc ?? 1);
    this.worldBox = new THREE.Box3(
      new THREE.Vector3(this.center.x - 0.9, 0, this.center.z - 0.9),
      new THREE.Vector3(this.center.x + 0.9, this.height * 0.75, this.center.z + 0.9),
    );
    this.fall = null;
    this.selected = false;
    this.shake = 0;
  }

  topPoint(out = new THREE.Vector3()) {
    return out.copy(this.center).setY(Math.min(this.height, 4.2) + 0.2);
  }

  setSelected(on) {
    this.selected = on;
    this.field.tint(this, on ? 1.45 : 1);
  }

  pop() {
    this.shake = 0.5;
  }

  matrix(out) {
    const e = this.e;
    dummy.position.copy(this.center);
    dummy.rotation.set(0, e.rot ?? 0, 0);
    dummy.scale.setScalar(e.sc ?? 1);
    if (this.shake > 0) {
      dummy.rotation.z = Math.sin(this.shake * 40) * this.shake * 0.05;
    }
    if (this.fall) {
      const k = Math.min(1, this.fall.t / 1.4);
      const ang = k * k * (Math.PI / 2 - 0.12);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      const q = new THREE.Quaternion().setFromAxisAngle(this.fall.axis, ang);
      const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, e.rot ?? 0, 0));
      dummy.quaternion.copy(q.multiply(q2));
      const sink = Math.max(0, this.fall.t - 1.6) * 1.2;
      dummy.position.y -= sink;
      dummy.scale.setScalar((e.sc ?? 1) * Math.max(0.001, 1 - Math.max(0, this.fall.t - 2.0) * 1.5));
    }
    dummy.updateMatrix();
    return out.copy(dummy.matrix);
  }

  update(dt) {
    let changed = false;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      changed = true;
    }
    if (this.fall) {
      this.fall.t += dt;
      changed = true;
      if (!this.fall.hit && this.fall.t > 1.4) {
        this.fall.hit = true;
        this.fall.onHit?.();
      }
      if (this.fall.t > 2.7) {
        this.fall.onDone?.();
        return;
      }
    }
    if (changed) this.field.write(this);
  }

  dispose() {
    this.field.remove(this);
  }
}

export class TreeField {
  constructor(stage, grid) {
    this.stage = stage;
    this.grid = grid;
    this.slots = new Map(); // tür:varyant → { trunk, foliage, views[] }
    this.views = new Set();
  }

  #slot(type, variant) {
    const key = `${type}:${variant}`;
    if (this.slots.has(key)) return this.slots.get(key);
    const geo = treeGeometry(type, variant, 0);
    const def = TREE_TYPES[type];
    const cap = 160;
    const slot = { key, cap, views: [], meshes: [] };
    slot.meshes.push(instanced(geo.trunk, MAT[def.trunkMat], cap, true));
    if (geo.foliage) slot.meshes.push(instanced(geo.foliage, MAT[def.foliageMat], cap, true));
    for (const m of slot.meshes) {
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, WHITE);
      this.stage.scene.add(m);
    }
    this.slots.set(key, slot);
    return slot;
  }

  add(e, def) {
    const slot = this.#slot(e.type, e.variant ?? 0);
    if (slot.views.length >= slot.cap) return null;
    const v = new TreeView(this, e, def, slot, slot.views.length);
    slot.views.push(v);
    for (const m of slot.meshes) m.count = slot.views.length;
    this.write(v);
    this.tint(v, 1);
    this.views.add(v);
    this.stage.markShadows();
    return v;
  }

  write(v) {
    v.matrix(tmpM);
    for (const m of v.slot.meshes) {
      m.setMatrixAt(v.index, tmpM);
      m.instanceMatrix.needsUpdate = true;
    }
    this.stage.markShadows();
  }

  tint(v, k) {
    const c = new THREE.Color(k, k * 0.98, k * 0.92);
    for (const m of v.slot.meshes) {
      m.setColorAt(v.index, c);
      m.instanceColor.needsUpdate = true;
    }
  }

  remove(v) {
    const slot = v.slot;
    const last = slot.views.pop();
    if (last !== v) {
      slot.views[v.index] = last;
      last.index = v.index;
      this.write(last);
      this.tint(last, last.selected ? 1.45 : 1);
    }
    for (const m of slot.meshes) m.count = slot.views.length;
    this.views.delete(v);
    this.stage.markShadows();
  }

  // Ağacı belirli bir yöne devir
  fell(v, fromX, fromZ, { onHit, onDone } = {}) {
    const dir = new THREE.Vector3(v.center.x - fromX, 0, v.center.z - fromZ);
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize();
    const axis = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    v.fall = { t: 0, axis, onHit, onDone };
  }

  update(dt) {
    for (const v of this.views) v.update(dt);
  }
}
