// Köylüler: evlerinden çıkar, taş yollarda yürür, kuyunun başında sohbet eder.
// Ustalar (sarı baretli) inşaatlara koşar ve çekiç sallar.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';
import { C } from '../engine/palette.js';
import { MATERIALS, contactShadowMaterial } from '../engine/materials.js';
import { mulberry32 } from '../core/rng.js';
import { findPath } from './pathfinding.js';

const SPEED = 0.9;
const EMOTES = ['♪', '❤', '☀', '✿', '★'];
const shadowGeo = new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2);

function villagerGeometry(rng, role) {
  const kit = new Kit();
  const skin = rng.pick(C.skin);
  const hair = rng.pick(C.hair);
  const shirt = role === 'builder' ? C.roofOrange : rng.pick(C.shirt);
  const pants = rng.pick([0x4a5a78, 0x5b4636, 0x3e4a3e, 0x6b5a8a]);
  kit.cyl(0.028, 0.03, 0.08, 6, pants, { x: -0.04, y: 0.04 });
  kit.cyl(0.028, 0.03, 0.08, 6, pants, { x: 0.04, y: 0.04 });
  kit.cyl(0.072, 0.098, 0.19, 12, shirt, { y: 0.17 });
  kit.sphere(0.028, skin, { x: -0.1, y: 0.15, ws: 8, hs: 6 });
  kit.sphere(0.028, skin, { x: 0.1, y: 0.15, ws: 8, hs: 6 });
  kit.sphere(0.086, skin, { y: 0.335, ws: 14, hs: 10 });
  kit.sphere(0.012, 0x2a2420, { x: -0.032, y: 0.345, z: 0.078, ws: 6, hs: 4 });
  kit.sphere(0.012, 0x2a2420, { x: 0.032, y: 0.345, z: 0.078, ws: 6, hs: 4 });
  kit.sphere(0.014, 0xf59a9a, { x: -0.052, y: 0.318, z: 0.068, ws: 6, hs: 4 });
  kit.sphere(0.014, 0xf59a9a, { x: 0.052, y: 0.318, z: 0.068, ws: 6, hs: 4 });

  if (role === 'builder') {
    kit.dome(0.094, C.flowerYellow, { y: 0.35 });
    kit.cyl(0.11, 0.11, 0.015, 14, C.flowerYellow, { y: 0.352, z: 0.02 });
    kit.torus(0.088, 0.016, C.woodDark, { y: 0.1, rx: Math.PI / 2 });
    kit.box(0.14, 0.05, 0.02, C.flowerYellow, { y: 0.2, z: 0.09 });
  } else {
    const hat = rng.int(0, 3);
    if (hat === 0) {
      kit.dome(0.09, hair, { y: 0.34, z: -0.012, sy: 0.95 });
    } else if (hat === 1) {
      // Yazma (başörtüsü)
      kit.dome(0.096, rng.pick([C.flowerRed, C.flowerPurple, C.roofTeal, C.wallWhite]), { y: 0.33, z: -0.01, sy: 1.08 });
      kit.sphere(0.03, C.wallWhite, { y: 0.31, z: -0.095, ws: 6, hs: 4 });
    } else if (hat === 2) {
      // Hasır şapka
      kit.dome(0.088, hair, { y: 0.34, z: -0.012 });
      kit.cyl(0.15, 0.15, 0.014, 14, C.hay, { y: 0.4 });
      kit.cyl(0.065, 0.078, 0.06, 12, C.hay, { y: 0.435 });
      kit.cyl(0.08, 0.08, 0.015, 12, C.cloth, { y: 0.415 });
    } else {
      kit.dome(0.09, hair, { y: 0.34, z: -0.012 });
      kit.sphere(0.045, hair, { y: 0.36, z: -0.085, ws: 8, hs: 6 });
    }
  }
  return kit.geometry();
}

let hammerGeo = null;
function hammer() {
  if (!hammerGeo) {
    const k = new Kit();
    k.box(0.016, 0.15, 0.016, C.wood, { y: 0.075 });
    k.box(0.07, 0.036, 0.036, C.iron, { y: 0.15 });
    hammerGeo = k.geometry();
  }
  const m = new THREE.Mesh(hammerGeo, MATERIALS[0]);
  m.position.set(0.1, 0.15, 0.02);
  return m;
}

class Villager {
  constructor(sys, role, home, seed) {
    this.sys = sys;
    this.role = role;
    this.home = home; // ev kimliği ya da null
    this.rng = mulberry32(seed);
    this.root = new THREE.Group();
    this.body = new THREE.Mesh(villagerGeometry(this.rng, role), MATERIALS[0]);
    this.body.castShadow = false;
    this.root.add(this.body);
    this.shadow = new THREE.Mesh(shadowGeo, contactShadowMaterial('round'));
    this.shadow.position.y = 0.012;
    this.root.add(this.shadow);
    if (role === 'builder') {
      this.tool = hammer();
      this.tool.visible = false;
      this.body.add(this.tool);
    }
    this.pos = new THREE.Vector2();
    this.heading = 0;
    this.path = null;
    this.mode = 'idle';
    this.timer = this.rng.range(0.5, 3);
    this.phase = this.rng.range(0, 6);
    this.scale = 0;
    this.scaleGoal = 1;
    this.job = null;
    this.final = null;
    sys.stage.scene.add(this.root);
  }

  setTile(i, j) {
    const c = this.sys.grid.tileCenter(i, j);
    this.pos.set(c.x + this.rng.range(-0.2, 0.2), c.z + this.rng.range(-0.2, 0.2));
  }

  tile() {
    return this.sys.grid.tileAt(this.pos.x, this.pos.y);
  }

  // (i, j) karosuna yürü; isteğe bağlı olarak son bir noktaya (kapı) yaklaş ve bir yöne bak
  goTo(i, j, { final = null, look = null } = {}) {
    const t = this.tile();
    const p = findPath(this.sys.grid, t.i, t.j, i, j);
    if (!p) return false;
    this.path = p.map(({ i: a, j: b }) => {
      const c = this.sys.grid.tileCenter(a, b);
      return new THREE.Vector2(c.x + this.rng.range(-0.18, 0.18), c.z + this.rng.range(-0.18, 0.18));
    });
    if (this.path.length > 1) this.path.shift();
    this.final = final ? new THREE.Vector2(final.x, final.y) : null;
    this.lookGoal = look;
    this.mode = 'walk';
    return true;
  }

  think() {
    const sys = this.sys;
    if (this.job) {
      const spot = sys.workSpot(this.job, this);
      if (spot && this.goTo(spot.i, spot.j, { look: spot.look })) {
        this.onArrive = 'work';
        return;
      }
      this.mode = 'idle';
      this.timer = 1;
      return;
    }
    const r = this.rng();
    const home = this.home ? sys.doorOf(this.home) : null;
    if (home && r < 0.22) {
      if (this.goTo(home.i, home.j, { final: home.point })) {
        this.onArrive = 'enter';
        return;
      }
    }
    if (r < 0.45) {
      const meet = sys.meetingSpot(this.rng);
      if (meet && this.goTo(meet.i, meet.j, { look: meet.look })) {
        this.onArrive = 'chat';
        return;
      }
    }
    const t = this.tile();
    for (let k = 0; k < 8; k++) {
      const i = t.i + this.rng.int(-7, 7);
      const j = t.j + this.rng.int(-7, 7);
      if (sys.grid.walkable(i, j) && this.goTo(i, j)) {
        this.onArrive = 'idle';
        return;
      }
    }
    this.mode = 'idle';
    this.timer = this.rng.range(1, 3);
  }

  arrive() {
    const what = this.onArrive;
    this.onArrive = null;
    if (this.lookGoal) {
      this.lookAt = this.lookGoal;
      this.lookGoal = null;
    }
    if (what === 'enter') {
      this.mode = 'inside';
      this.scaleGoal = 0;
      this.timer = this.rng.range(6, 16);
    } else if (what === 'work') {
      this.mode = 'work';
      if (this.tool) this.tool.visible = true;
    } else if (what === 'chat') {
      this.mode = 'idle';
      this.timer = this.rng.range(3, 7);
      if (this.rng() < 0.6) this.sys.emote(this, this.rng.pick(EMOTES));
    } else {
      this.mode = 'idle';
      this.timer = this.rng.range(1.2, 4.5);
    }
  }

  update(dt) {
    const s = this.scale + (this.scaleGoal - this.scale) * Math.min(1, dt * 9);
    this.scale = s;
    let hop = 0;
    let rock = 0;

    if (this.mode === 'walk') {
      const target = this.path?.length ? this.path[0] : this.final;
      if (!target) {
        this.path = null;
        this.arrive();
      } else {
        const dx = target.x - this.pos.x;
        const dz = target.y - this.pos.y;
        const dist = Math.hypot(dx, dz);
        const step = SPEED * dt * (this.job ? 1.35 : 1);
        if (dist <= step) {
          this.pos.copy(target);
          if (this.path?.length) this.path.shift();
          else this.final = null;
          if (!this.path?.length && !this.final) {
            this.path = null;
            this.arrive();
          }
        } else {
          this.pos.x += (dx / dist) * step;
          this.pos.y += (dz / dist) * step;
          this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 12));
        }
        this.phase += dt * (this.job ? 15 : 11.5);
        hop = Math.abs(Math.sin(this.phase)) * 0.05;
        rock = Math.sin(this.phase) * 0.09;
      }
    } else if (this.mode === 'work') {
      this.phase += dt * 9;
      const swing = Math.sin(this.phase);
      if (this.tool) this.tool.rotation.x = -0.6 + swing * 1.1;
      hop = Math.max(0, -swing) * 0.02;
      if (this.lookAt) this.heading = lerpAngle(this.heading, Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.y - this.pos.y), Math.min(1, dt * 8));
      if (Math.sin(this.phase - dt * 9) > -0.95 && swing <= -0.95) this.sys.onHammer?.(this);
    } else if (this.mode === 'inside') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = 'idle';
        this.scaleGoal = 1;
        this.timer = 0.6;
        this.heading = 0;
      }
    } else {
      this.timer -= dt;
      this.phase += dt * 2;
      hop = Math.max(0, Math.sin(this.phase * 1.3)) * 0.008;
      if (this.lookAt) this.heading = lerpAngle(this.heading, Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.y - this.pos.y), Math.min(1, dt * 5));
      if (this.timer <= 0) {
        this.lookAt = null;
        this.think();
      }
    }

    this.root.position.set(this.pos.x, 0, this.pos.y);
    this.body.position.y = hop;
    this.body.rotation.set(0, this.heading, rock);
    this.body.scale.set(s, s * (1 - hop * 0.6), s);
    this.shadow.scale.setScalar(Math.max(0.001, s * (1 - hop * 2)));
    this.root.visible = s > 0.02;
  }

  dispose() {
    this.root.removeFromParent();
    this.body.geometry.dispose();
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Villagers {
  constructor(stage, grid, world) {
    this.stage = stage;
    this.grid = grid;
    this.world = world; // { entities(), centerOf(e), sizeOf(e), doorOf(e) , emote(v, text) }
    this.list = [];
    this.seed = 1;
  }

  // Nüfusu evlere göre ayarla
  sync(homes, builders) {
    const want = new Map();
    for (const h of homes) want.set(h.id, h.count);
    for (const v of [...this.list]) {
      if (v.role !== 'villager') continue;
      const n = want.get(v.home) ?? 0;
      if (n > 0) want.set(v.home, n - 1);
      else this.remove(v);
    }
    for (const [home, n] of want) {
      for (let k = 0; k < n; k++) {
        const v = new Villager(this, 'villager', home, this.seed++ * 977);
        const door = this.doorOf(home);
        if (door) v.setTile(door.i, door.j);
        v.timer = v.rng.range(0.2, 2);
        this.list.push(v);
      }
    }
    const have = this.list.filter((v) => v.role === 'builder').length;
    for (let k = have; k < builders; k++) {
      const v = new Villager(this, 'builder', null, 50000 + k * 31);
      const spot = this.world.builderHome?.() ?? { i: 15, j: 21 };
      v.setTile(spot.i + k, spot.j);
      this.list.push(v);
    }
  }

  remove(v) {
    v.dispose();
    this.list.splice(this.list.indexOf(v), 1);
  }

  doorOf(id) {
    return this.world.doorOf(id);
  }

  meetingSpot(rng) {
    return this.world.meetingSpot?.(rng) ?? null;
  }

  workSpot(job, v) {
    return this.world.workSpot(job, v);
  }

  emote(v, text) {
    this.world.emote?.(v, text);
  }

  assign(entityId) {
    if (this.list.some((v) => v.job === entityId)) return;
    const free = this.list.find((v) => v.role === 'builder' && !v.job);
    if (!free) return;
    free.job = entityId;
    free.scaleGoal = 1;
    free.mode = 'idle';
    free.timer = 0;
    free.path = null;
  }

  release(entityId) {
    for (const v of this.list) {
      if (v.job !== entityId) continue;
      v.job = null;
      v.lookAt = null;
      if (v.tool) v.tool.visible = false;
      v.mode = 'idle';
      v.timer = 0.8;
      this.emote(v, '✓');
    }
  }

  // Izgara değişince bina altında kalanları kenara çıkar, yolları yenile
  regrid() {
    for (const v of this.list) {
      const t = v.tile();
      if (!this.grid.walkable(t.i, t.j) && v.mode !== 'inside') {
        const free = nearestFree(this.grid, t.i, t.j);
        if (free) v.setTile(free.i, free.j);
      }
      if (v.mode === 'walk') {
        v.mode = 'idle';
        v.timer = 0.1;
        v.path = null;
      }
    }
  }

  update(dt) {
    for (const v of this.list) {
      if (v.job && v.mode === 'work') {
        const look = this.world.centerOf(v.job);
        if (!look) v.job = null;
        else v.lookAt = look;
      }
      v.update(dt);
    }
  }

  forEach(fn) {
    this.list.forEach(fn);
  }
}

export function nearestFree(grid, i, j) {
  for (let r = 1; r < 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (grid.walkable(i + dx, j + dy)) return { i: i + dx, j: j + dy };
      }
    }
  }
  return null;
}
