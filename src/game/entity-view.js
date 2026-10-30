// Bir yapının sahnedeki karşılığı: model, temas gölgesi, inşaat iskelesi,
// yaylanma, ateş/duman, ışık kaynakları, hasar sarsıntısı.

import * as THREE from 'three';
import { getDef, levelStats } from '../buildings/index.js';
import { buildModel } from './models.js';
import { Kit, mapMaterials, restoreMaterials } from '../engine/kit.js';
import { highlightOf, clippedOf, blobShadowMaterial } from '../engine/materials.js';

const scaffoldCache = new Map();
function scaffoldMesh(size, height) {
  const h = Math.max(0.8, Math.round(Math.min(height * 0.85, 2.6) * 4) / 4);
  const key = `${size}:${h}`;
  if (!scaffoldCache.has(key)) {
    const k = new Kit();
    const e = size / 2 - 0.12;
    for (const [x, z] of [[e, e], [e, -e], [-e, e], [-e, -e]]) {
      k.cyl(0.035, 0.04, h, 7, 0xd0c4b4, { mat: 'bark', uv: 'native', x, y: h / 2, z, uvRepeat: [1, h] });
    }
    const levels = Math.max(1, Math.round(h / 0.8));
    for (let l = 1; l <= levels; l++) {
      const y = (h * l) / (levels + 0.25);
      k.box(size - 0.2, 0.05, 0.05, 0xd8ccbc, { mat: 'wood', y, z: e });
      k.box(0.05, 0.05, size - 0.2, 0xd8ccbc, { mat: 'wood', x: e, y });
      k.box(size - 0.2, 0.05, 0.05, 0xd8ccbc, { mat: 'wood', y, z: -e });
      k.box(0.05, 0.05, size - 0.2, 0xd8ccbc, { mat: 'wood', x: -e, y });
    }
    k.box(0.6, 0.05, 0.18, 0xe0d4c4, { mat: 'wood', x: e - 0.2, y: 0.03, z: e + 0.32, ry: 0.2 });
    k.box(0.6, 0.05, 0.18, 0xd8ccbc, { mat: 'wood', x: e - 0.15, y: 0.08, z: e + 0.3, ry: 0.35 });
    const m = k.build();
    scaffoldCache.set(key, { geometry: m.geometry, material: m.material });
  }
  const c = scaffoldCache.get(key);
  const mesh = new THREE.Mesh(c.geometry, c.material);
  mesh.castShadow = true;
  return mesh;
}

const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export class EntityView {
  constructor(game, e, { ghost = false } = {}) {
    this.game = game;
    this.e = e;
    this.def = getDef(e.type);
    this.ghost = ghost;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.spring = { t: 9, a: 0 };
    this.lift = 0;
    this.liftGoal = 0;
    this.selected = false;
    this.smokeT = Math.random();
    this.fireT = 0;
    this.hitT = 0;
    this.clipPlane = null;
    this.worldBox = new THREE.Box3();
    this.lightSources = [];

    if (this.def.category !== 'nature' || this.def.size > 1) {
      const s = this.def.size + 0.5;
      const blob = new THREE.Mesh(blobGeo, blobShadowMaterial());
      blob.scale.set(s, 1, s);
      blob.position.y = 0.01;
      blob.renderOrder = 1;
      this.group.add(blob);
    }
    this.build();
    this.setTile(e.i, e.j);
    game.stage.scene.add(this.group);
  }

  get constructing() {
    return this.e.state === 'building' || this.e.state === 'upgrading';
  }

  build() {
    if (this.model) {
      this.body.remove(this.model.root);
      this.model.dispose();
    }
    const level = Math.max(1, this.e.level);
    this.model = buildModel(this.def, { level, variant: this.e.variant ?? 0, state: this.e.state });
    this.body.add(this.model.root);
    this.height = this.model.height;

    if (this.scaffold) {
      this.body.remove(this.scaffold);
      this.scaffold = null;
    }
    this.clipPlane = null;
    if (this.e.state === 'building') {
      this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.1);
      const plane = this.clipPlane;
      mapMaterials(this.model.mesh, (m) => clippedOf(m, plane));
    }
    if (this.constructing) {
      this.scaffold = scaffoldMesh(this.def.size, this.height);
      this.body.add(this.scaffold);
    }
    this.setSelected(this.selected);
    this.#syncLights();
    this.updateBox();
    this.game.stage.markShadows();
  }

  #syncLights() {
    for (const s of this.lightSources) this.game.lights.remove(s);
    this.lightSources = [];
    if (this.ghost || this.e.state === 'building') return;
    const st = levelStats(this.def, this.e.level);
    const c = this.group.position;
    for (const f of this.model.anchors.fires) {
      const L = st?.light ?? { radius: 3, intensity: 2 };
      const s = this.game.lights.add({
        pos: new THREE.Vector3(c.x + f.x, f.y + 0.4, c.z + f.z), color: 0xff8a3c, radius: L.radius, intensity: L.intensity, flicker: 0.35, owner: this, glow: 1.2,
      });
      s.fire = f;
      this.lightSources.push(s);
    }
    for (const l of this.model.anchors.lights) {
      const s = this.game.lights.add({
        pos: new THREE.Vector3(c.x + l.x, l.y, c.z + l.z), color: l.color ?? 0xffb46a, radius: l.radius, intensity: l.intensity, flicker: 0.06, owner: this, glow: 0.8,
      });
      this.lightSources.push(s);
    }
  }

  setTile(i, j) {
    this.e.i = i;
    this.e.j = j;
    const c = this.game.grid.center(i, j, this.def.size);
    this.group.position.set(c.x, 0, c.z);
    this.#syncLights();
    this.updateBox();
  }

  updateBox() {
    if (!this.model) return;
    this.worldBox.copy(this.model.box);
    const s = this.def.size / 2;
    this.worldBox.min.x = Math.min(this.worldBox.min.x, -s * 0.9);
    this.worldBox.max.x = Math.max(this.worldBox.max.x, s * 0.9);
    this.worldBox.min.z = Math.min(this.worldBox.min.z, -s * 0.9);
    this.worldBox.max.z = Math.max(this.worldBox.max.z, s * 0.9);
    this.worldBox.max.y = Math.max(this.worldBox.max.y, 0.4);
    this.worldBox.translate(this.group.position);
  }

  get center() {
    return this.group.position;
  }

  topPoint(out = new THREE.Vector3()) {
    return out.copy(this.group.position).setY(Math.min(this.height, 3.6) + 0.25 + this.lift);
  }

  setSelected(on) {
    this.selected = on;
    if (!this.model || this.clipPlane) return;
    if (on) mapMaterials(this.model.mesh, highlightOf);
    else restoreMaterials(this.model.mesh);
  }

  pop(strength = 1) {
    this.spring = { t: 0, a: 0.1 * strength };
  }

  hit() {
    this.hitT = 0.35;
  }

  setLift(v) {
    this.liftGoal = v;
  }

  // Ateşin gücü (0..1): kamp ateşinde yakıta bağlı
  fireStrength() {
    if (this.def.id === 'campfire') {
      const max = levelStats(this.def, this.e.level).fuelMax;
      const k = Math.min(1, (this.e.fuel ?? 0) / (max * 0.35));
      return this.e.fuel > 0 ? 0.25 + 0.75 * k : 0;
    }
    return this.e.lit === false ? 0 : 1;
  }

  update(dt, t) {
    const sp = this.spring;
    let squash = 0;
    if (sp.t < 1.5) {
      sp.t += dt;
      squash = sp.a * Math.exp(-sp.t * 7) * Math.sin(sp.t * 22);
      this.game.stage.markShadows();
    }
    let shake = 0;
    if (this.hitT > 0) {
      this.hitT -= dt;
      shake = Math.sin(t * 70) * this.hitT * 0.12;
    }
    this.body.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
    this.body.position.x = shake;

    if (Math.abs(this.liftGoal - this.lift) > 0.001) {
      this.lift += (this.liftGoal - this.lift) * Math.min(1, dt * 16);
      this.body.position.y = this.lift;
      this.game.stage.markShadows();
    }

    for (const d of this.model.dynamics) d.update(t);

    if (this.clipPlane) {
      const e = this.e;
      const need = levelStats(this.def, 1).work || 1;
      const p = Math.min(1, (e.progress ?? 0) / need);
      const y = this.height * (0.05 + 0.95 * p) + this.lift;
      if (Math.abs(this.clipPlane.constant - y) > 0.01) {
        this.clipPlane.constant = y;
        this.game.stage.markShadows();
      }
    }

    if (this.ghost || this.e.state === 'building') return;
    const c = this.group.position;
    const strength = this.fireStrength();
    for (const s of this.lightSources) {
      if (s.fire) {
        s.scale = strength;
        s.on = strength > 0.01;
      }
    }
    // Alevler
    if (this.model.anchors.fires.length && strength > 0) {
      this.fireT -= dt;
      while (this.fireT <= 0) {
        this.fireT += 0.035 / Math.max(0.3, strength);
        for (const f of this.model.anchors.fires) {
          this.game.fx.flame(c.x + f.x, f.y + this.lift, c.z + f.z, f.size * (0.5 + strength * 0.5));
          if (Math.random() < 0.08 * f.size) this.game.fx.ember(c.x + f.x, f.y + 0.3, c.z + f.z);
        }
      }
    }
    const smoke = this.model.anchors.smoke;
    if (smoke.length) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.35 + Math.random() * 0.4;
        for (const a of smoke) this.game.fx.smoke(c.x + a.x, a.y + this.lift, c.z + a.z, { scale: this.def.id === 'campfire' ? 0.8 + strength * 0.4 : 0.8 });
      }
    }
    for (const b of this.model.anchors.blinks) {
      if (Math.sin(t * 3.2) > 0.96) this.game.fx.add.spawn({ x: c.x + b.x, y: b.y, z: c.z + b.z, life: 0.25, s0: 0.5, s1: 0.4, a0: 1, c0: [3, 0.2, 0.1], shape: 2, fadeIn: 0.01 });
    }
  }

  dispose() {
    for (const s of this.lightSources) this.game.lights.remove(s);
    this.group.removeFromParent();
    this.model?.dispose();
  }
}
