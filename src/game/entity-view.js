// Bir varlığın (bina, süs, engel) sahnedeki karşılığı: model, temas gölgesi,
// inşaat iskelesi, yaylanma animasyonu, baca dumanı.

import * as THREE from 'three';
import { getDef } from '../buildings/index.js';
import { buildModel } from './models.js';
import { Kit, applyMaterialSet } from '../engine/kit.js';
import { C } from '../engine/palette.js';
import { MATERIALS, HIGHLIGHT, clippedMaterials, contactShadowMaterial } from '../engine/materials.js';

const scaffoldCache = new Map();
function scaffoldGeometry(size, height) {
  const h = Math.round(height * 4) / 4;
  const key = `${size}:${h}`;
  if (scaffoldCache.has(key)) return scaffoldCache.get(key);
  const k = new Kit();
  const e = size / 2 - 0.14;
  for (const [x, z] of [[e, e], [e, -e], [-e, e], [-e, -e]]) {
    k.box(0.07, h, 0.07, C.woodLight, { x, y: h / 2, z });
  }
  const levels = Math.max(1, Math.round(h / 0.7));
  for (let l = 1; l <= levels; l++) {
    const y = (h * l) / (levels + 0.3);
    k.box(size - 0.2, 0.05, 0.05, C.wood, { y, z: e });
    k.box(0.05, 0.05, size - 0.2, C.wood, { x: e, y });
    k.box(size - 0.2, 0.05, 0.05, C.wood, { y, z: -e });
    k.box(0.05, 0.05, size - 0.2, C.wood, { x: -e, y });
    // Yürüme tahtası (ön yüzlerde)
    k.box(size - 0.25, 0.03, 0.18, C.woodPale, { y: y + 0.03, z: e + 0.06 });
    k.box(0.18, 0.03, size - 0.25, C.woodPale, { x: e + 0.06, y: y + 0.03 });
  }
  // Çapraz destekler
  const diag = Math.atan2(h / (levels + 0.3), size - 0.3);
  k.box(Math.hypot(size - 0.3, h / (levels + 0.3)), 0.035, 0.035, C.wood, { y: h / (levels + 0.3) / 2, z: e + 0.02, rz: diag });
  k.box(0.035, 0.035, Math.hypot(size - 0.3, h / (levels + 0.3)), C.wood, { x: e + 0.02, y: h / (levels + 0.3) / 2, rx: -diag });
  // Kereste yığını ve tabela
  k.box(0.5, 0.06, 0.16, C.woodPale, { x: e - 0.15, y: 0.03, z: e + 0.35 });
  k.box(0.5, 0.06, 0.16, C.woodLight, { x: e - 0.12, y: 0.09, z: e + 0.33, ry: 0.15 });
  k.box(0.04, 0.32, 0.04, C.wood, { x: -e + 0.1, y: 0.16, z: e + 0.3 });
  k.box(0.26, 0.18, 0.03, C.flowerYellow, { x: -e + 0.1, y: 0.3, z: e + 0.32 });
  k.box(0.2, 0.025, 0.035, C.iron, { x: -e + 0.1, y: 0.3, z: e + 0.33, rz: 0.6 });
  const g = k.geometry();
  scaffoldCache.set(key, g);
  return g;
}

const plane = (s) => new THREE.PlaneGeometry(s, s).rotateX(-Math.PI / 2);

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
    this.fxT = 0;
    this.clipPlane = null;
    this.worldBox = new THREE.Box3();

    if (this.def.solid !== false || this.def.category === 'obstacle') {
      const s = this.def.size + (this.def.category === 'obstacle' ? 0.1 : 0.35);
      this.contact = new THREE.Mesh(plane(s), contactShadowMaterial(this.def.category === 'obstacle' || this.def.size === 1 ? 'round' : 'square'));
      this.contact.position.y = 0.008;
      this.contact.renderOrder = 1;
      this.group.add(this.contact);
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
    this.model = buildModel(this.def, { level, variant: this.e.variant ?? 0 });
    this.body.add(this.model.root);
    this.height = this.model.height;

    if (this.scaffold) {
      this.body.remove(this.scaffold);
      this.scaffold = null;
    }
    this.clipPlane = null;
    if (this.e.state === 'building') {
      this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.1);
      this.clipMats = clippedMaterials(this.clipPlane);
      applyMaterialSet(this.model.mesh, this.clipMats);
      for (const d of this.model.dynamics) d.obj.visible = false;
    }
    if (this.constructing) {
      const sh = Math.min(this.height * 0.82, 2.4);
      this.scaffold = new THREE.Mesh(scaffoldGeometry(this.def.size, Math.max(0.6, sh)), MATERIALS[0]);
      this.scaffold.castShadow = true;
      this.body.add(this.scaffold);
    }
    this.setSelected(this.selected);
    this.updateBox();
    this.game.stage.markShadows();
  }

  setTile(i, j) {
    this.e.i = i;
    this.e.j = j;
    const c = this.game.grid.center(i, j, this.def.size);
    this.group.position.set(c.x, 0, c.z);
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
    this.worldBox.max.y = Math.max(this.worldBox.max.y, 0.3);
    this.worldBox.translate(this.group.position);
  }

  get center() {
    return this.group.position;
  }

  topPoint(out = new THREE.Vector3()) {
    return out.copy(this.group.position).setY(this.height + 0.15 + this.lift);
  }

  setSelected(on) {
    this.selected = on;
    if (!this.model || this.clipPlane) return;
    applyMaterialSet(this.model.mesh, on ? HIGHLIGHT : MATERIALS);
  }

  // Yaylanma: zıplayarak yerine oturma (CoC tarzı "pop")
  pop(strength = 1) {
    this.spring = { t: 0, a: 0.14 * strength };
  }

  setLift(v) {
    this.liftGoal = v;
  }

  update(dt, t, now) {
    // yay
    const sp = this.spring;
    let squash = 0;
    if (sp.t < 1.5) {
      sp.t += dt;
      squash = sp.a * Math.exp(-sp.t * 7) * Math.sin(sp.t * 22);
      this.game.stage.markShadows();
    }
    this.body.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);

    if (Math.abs(this.liftGoal - this.lift) > 0.001) {
      this.lift += (this.liftGoal - this.lift) * Math.min(1, dt * 16);
      this.body.position.y = this.lift;
      this.game.stage.markShadows();
    }

    for (const d of this.model.dynamics) d.update(t);

    if (this.clipPlane) {
      const e = this.e;
      const p = Math.min(1, Math.max(0, (now - e.t0) / Math.max(1, e.t1 - e.t0)));
      const y = this.height * (0.06 + 0.94 * p) + this.lift;
      if (Math.abs(this.clipPlane.constant - y) > 0.01) {
        this.clipPlane.constant = y;
        if (!this._lastShadow || now - this._lastShadow > 250) {
          this._lastShadow = now;
          this.game.stage.markShadows();
        }
      }
    }

    if (this.e.state === 'built' && !this.ghost) {
      const smoke = this.model.anchors.smoke;
      if (smoke) {
        this.smokeT -= dt;
        if (this.smokeT <= 0) {
          this.smokeT = 0.45 + Math.random() * 0.5;
          for (const a of smoke) {
            this.game.fx.smoke(this.group.position.x + a.x, a.y + this.lift, this.group.position.z + a.z);
          }
        }
      }
      if (this.def.fx === 'fountain') {
        this.fxT -= dt;
        if (this.fxT <= 0) {
          this.fxT = 0.06;
          const a = Math.random() * Math.PI * 2;
          const sp2 = 0.25 + Math.random() * 0.25;
          this.game.fx.spawn({
            x: this.group.position.x, y: 1.15, z: this.group.position.z,
            vx: Math.cos(a) * sp2, vy: 1.1 + Math.random() * 0.4, vz: Math.sin(a) * sp2,
            g: -5, life: 0.75, s0: 0.07, s1: 0.05, a0: 0.9, color: 0xd6f2ff, shape: 0, fadeIn: 0.02, floor: 0.4,
          });
        }
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.model?.dispose();
    this.clipMats?.forEach((m) => m.dispose());
  }
}
