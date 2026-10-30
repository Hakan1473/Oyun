// Hayatta kalanlar: görev yapar (kesme, inşa, toplama), gece ateşin çevresinde nöbet tutar,
// feneriyle gölgelere ışık tutar, yaralanınca kulübeye sığınır.

import * as THREE from 'three';
import { HumanRig } from './rigs.js';
import { findPath } from './pathfinding.js';
import { blobShadowMaterial } from '../engine/materials.js';

const WALK = 2.3;
const RUN = 3.6;
const beamGeo = (() => {
  const g = new THREE.ConeGeometry(1, 1, 20, 1, true);
  g.translate(0, -0.5, 0);
  g.rotateX(-Math.PI / 2);
  // tepeden uca saydamlaşan köşe renkleri
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = Math.max(0, 1 + p.getZ(i)) ** 1.5;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = (1 - k) * 0.5;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
})();
const beamMat = new THREE.MeshBasicMaterial({
  vertexColors: true, color: 0xcfdcff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const blobGeo = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2);

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Survivor {
  constructor(sys, def, data) {
    this.sys = sys;
    this.def = def;
    this.data = data; // kayıttaki kayıt: { id, hp, alive, mode, x, z }
    this.id = def.id;
    this.rig = new HumanRig(def.look);
    this.root = this.rig.root;
    this.pos = new THREE.Vector2(data.x ?? 0, data.z ?? 3);
    this.heading = Math.random() * 6;
    this.mode = data.alive ? (data.mode === 'away' ? 'away' : 'idle') : 'dead';
    this.timer = Math.random() * 2;
    this.path = null;
    this.task = null;
    this.workSpot = null;
    this.aim = null;
    this.deadT = data.alive ? 0 : 1;
    this.hurtFlash = 0;
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.visible = false;
    this.beam.renderOrder = 13;
    sys.game.stage.scene.add(this.beam);
    const blob = new THREE.Mesh(blobGeo, blobShadowMaterial());
    blob.position.y = 0.012;
    this.root.add(blob);
    this.root.rotation.order = 'YXZ';
    sys.game.stage.scene.add(this.root);
    this.root.visible = this.mode !== 'away';
    this.flashOn = false;
  }

  get alive() {
    return this.data.alive;
  }

  get hp() {
    return this.data.hp;
  }

  get busy() {
    return !!this.task || ['away', 'dead', 'inside', 'script'].includes(this.mode);
  }

  get available() {
    return this.alive && !this.task && ['idle', 'guard', 'walk'].includes(this.mode) && !this.scripted;
  }

  tile() {
    return this.sys.game.grid.tileAt(this.pos.x, this.pos.y);
  }

  goTo(i, j, { run = false, onArrive = null, final = null } = {}) {
    const g = this.sys.game.grid;
    const t = this.tile();
    const p = findPath(g, t.i, t.j, i, j, 6000);
    if (!p) return false;
    this.path = p.map(({ i: a, j: b }) => {
      const c = g.tileCenter(a, b);
      return new THREE.Vector2(c.x + (Math.random() - 0.5) * 0.3, c.z + (Math.random() - 0.5) * 0.3);
    });
    if (this.path.length > 1) this.path.shift();
    if (final) this.path.push(new THREE.Vector2(final.x, final.y));
    this.run = run;
    this.onArrive = onArrive;
    if (this.mode !== 'work') this.mode = 'walk';
    return true;
  }

  // Doğrudan noktalardan geçerek yürü (hikâye sahneleri, patikadan gelip gitme)
  walkPoints(points, { run = false, onArrive = null } = {}) {
    this.path = points.map((p) => new THREE.Vector2(p.x, p.z !== undefined ? p.z : p.y));
    this.run = run;
    this.onArrive = onArrive;
    this.mode = 'walk';
  }

  hurt(dmg, from) {
    if (!this.alive || this.mode === 'inside' || this.mode === 'away') return;
    const k = this.def.skills.tough;
    this.data.hp = Math.max(0, this.data.hp - dmg * k);
    this.hurtFlash = 0.4;
    if (from) {
      const d = new THREE.Vector2(this.pos.x - from.x, this.pos.y - from.y).normalize().multiplyScalar(0.5);
      this.pos.add(d);
    }
    this.sys.game.onSurvivorHurt(this, dmg);
    if (this.data.hp <= 0) this.sys.game.killSurvivor(this.id, 'shade');
  }

  die() {
    this.mode = 'dead';
    this.task = null;
    this.path = null;
    this.beam.visible = false;
    this.deadT = 0.001;
  }

  update(dt, t) {
    const sys = this.sys;
    const game = sys.game;
    const dark = game.cycle.darkness;
    let walk = 0;
    let work = null;
    let scared = false;
    this.flashOn = false;

    if (this.mode === 'dead') {
      this.deadT = Math.min(1, this.deadT + dt * 1.4);
      this.rig.pose(dt, { dead: this.deadT, t });
      this.root.position.set(this.pos.x, 0, this.pos.y);
      this.root.rotation.y = this.heading;
      this.beam.visible = false;
      return;
    }
    if (this.mode === 'away' || this.mode === 'inside') {
      this.root.visible = false;
      this.beam.visible = false;
      if (this.mode === 'inside' && dark < 0.3 && !this.scripted) {
        this.mode = 'idle';
        this.root.visible = true;
        const door = game.cabinDoor();
        if (door) this.pos.set(door.x, door.y + 0.4);
      }
      return;
    }
    this.root.visible = true;

    // gece: yaralıysa kulübeye sığın
    if (dark > 0.6 && this.data.hp < 30 && !this.scripted && this.mode !== 'inside' && !this.sheltering) {
      const door = game.cabinDoor();
      const dt0 = game.cabinDoorTile();
      if (door && dt0) {
        this.task = null;
        this.sheltering = true;
        this.goTo(dt0.i, dt0.j, { run: true, final: door, onArrive: () => { this.mode = 'inside'; this.sheltering = false; } });
      }
    }

    // tehlike: yakında gölge ve ışık yoksa kaç
    const threat = game.shades.nearest(this.pos.x, this.pos.y);
    const lit = game.lights.coverage(this.pos.x, this.pos.y, dark);
    if (!this.scripted && threat && threat.d < 2.6 && lit < 0.5 && this.mode !== 'flee') {
      const fire = game.fireSpot();
      if (fire) {
        this.task = null;
        this.mode = 'flee';
        const ft = game.grid.tileAt(fire.x, fire.y);
        this.goTo(ft.i, ft.j, { run: true, onArrive: () => { this.mode = 'idle'; this.timer = 0.5; } });
        this.mode = 'flee';
      }
    }
    scared = !!threat && threat.d < 5 && dark > 0.5;

    // görev
    if (this.task && this.mode !== 'walk' && this.mode !== 'flee') {
      const tk = this.task;
      if (!game.taskValid(tk)) {
        this.task = null;
        this.mode = 'idle';
      } else if (this.mode === 'work') {
        work = tk.kind === 'chop' || tk.kind === 'clear' ? 'chop' : 'build';
        this.heading = lerpAngle(this.heading, Math.atan2(tk.look.x - this.pos.x, tk.look.y - this.pos.y), Math.min(1, dt * 8));
        const rate = tk.kind === 'chop' || tk.kind === 'clear' ? this.def.skills.chop : this.def.skills.build;
        const injured = this.data.hp < 35 ? 0.6 : 1;
        game.workOn(tk, dt * rate * injured, this);
      } else {
        const spot = game.workSpot(tk, this);
        if (!spot || !this.goTo(spot.i, spot.j, { onArrive: () => { this.mode = 'work'; } })) {
          game.dropTask(tk);
          this.task = null;
          this.mode = 'idle';
        } else {
          tk.look = spot.look;
          this.mode = 'walk';
          this.toTask = true;
        }
      }
    }

    // yürüme
    if (this.mode === 'walk' || this.mode === 'flee') {
      const target = this.path?.[0];
      if (!target) {
        this.path = null;
        const cb = this.onArrive;
        this.onArrive = null;
        if (this.mode === 'walk' || this.mode === 'flee') this.mode = this.task && this.toTask ? 'work' : 'idle';
        this.toTask = false;
        this.timer = 1 + Math.random() * 3;
        cb?.();
      } else {
        const dx = target.x - this.pos.x;
        const dz = target.y - this.pos.y;
        const dist = Math.hypot(dx, dz);
        const sp = (this.run || this.mode === 'flee' ? RUN : WALK) * (this.data.hp < 35 ? 0.65 : 1);
        const step = sp * dt;
        if (dist <= step) {
          this.pos.copy(target);
          this.path.shift();
        } else {
          this.pos.x += (dx / dist) * step;
          this.pos.y += (dz / dist) * step;
          this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 10));
        }
        walk = this.run || this.mode === 'flee' ? 1 : 0.7;
      }
    }

    // boşta: gündüz dolaş, gece nöbet
    if (this.mode === 'idle' || this.mode === 'guard') {
      this.timer -= dt;
      if (dark > 0.45) {
        const spot = game.guardSpot(this);
        if (spot && Math.hypot(spot.x - this.pos.x, spot.y - this.pos.y) > 0.8 && this.timer <= 0) {
          const st = game.grid.tileAt(spot.x, spot.y);
          this.goTo(st.i, st.j, { final: spot });
          this.timer = 2;
        } else {
          this.mode = 'guard';
          const look = spot ? Math.atan2(spot.x - spot.cx, spot.y - spot.cz) : this.heading;
          this.heading = lerpAngle(this.heading, look, Math.min(1, dt * 3));
        }
      } else if (this.timer <= 0 && !this.scripted) {
        this.timer = 3 + Math.random() * 6;
        const w = game.wanderSpot(this);
        if (w) this.goTo(w.i, w.j);
      }
    }

    // fener: gece, en yakın gölgeye çevrilir
    if (dark > 0.35 && this.alive && !['inside', 'away'].includes(this.mode)) {
      this.flashOn = true;
      const range = 7.5 * this.def.skills.light;
      this.aim = threat && threat.d < range ? threat.shade : null;
      if (this.aim && this.mode !== 'walk' && this.mode !== 'flee' && this.mode !== 'work') {
        this.heading = lerpAngle(this.heading, Math.atan2(this.aim.pos.x - this.pos.x, this.aim.pos.y - this.pos.y), Math.min(1, dt * 6));
      }
    } else {
      this.aim = null;
    }

    this.rig.setTool(work === 'chop' ? 'axe' : work === 'build' ? 'hammer' : null);
    this.rig.flash.visible = this.flashOn && !work;
    this.rig.pose(dt, { walk, work, scared: scared && !work && walk === 0, hurt: this.data.hp < 35, t, flash: this.flashOn && !work && !!this.aim });
    this.root.position.set(this.pos.x, 0, this.pos.y);
    this.root.rotation.y = this.heading;

    // hüzme
    if (this.flashOn && !work) {
      const len = 7 * this.def.skills.light;
      this.beam.visible = true;
      this.beam.position.set(this.pos.x + Math.sin(this.heading) * 0.3, 1.05, this.pos.y + Math.cos(this.heading) * 0.3);
      this.beam.rotation.set(-0.12, this.heading, 0, 'YXZ');
      this.beam.scale.set(len * 0.32, len * 0.32, len);
    } else {
      this.beam.visible = false;
    }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
  }

  // Fener hüzmesi içinde mi? (gölge hasarı için)
  inBeam(x, z) {
    if (!this.beam.visible) return 0;
    const dx = x - this.pos.x;
    const dz = z - this.pos.y;
    const d = Math.hypot(dx, dz);
    const range = 7.5 * this.def.skills.light;
    if (d > range || d < 0.2) return 0;
    let a = Math.atan2(dx, dz) - this.heading;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    if (Math.abs(a) > 0.36) return 0;
    return (1 - d / range) * 0.6 + 0.4;
  }

  dispose() {
    this.root.removeFromParent();
    this.beam.removeFromParent();
  }
}

export class Survivors {
  constructor(game, roster, saved) {
    this.game = game;
    this.list = roster.map((def) => {
      const data = saved.find((s) => s.id === def.id);
      return new Survivor(this, def, data);
    });
  }

  get(id) {
    return this.list.find((s) => s.id === id) ?? null;
  }

  alive() {
    return this.list.filter((s) => s.alive);
  }

  present() {
    return this.list.filter((s) => s.alive && s.mode !== 'away');
  }

  update(dt, t) {
    for (const s of this.list) {
      s.update(dt, t);
      s.data.x = s.pos.x;
      s.data.z = s.pos.y;
      s.data.mode = s.mode === 'away' ? 'away' : s.mode === 'dead' ? 'dead' : 'idle';
    }
    // Spot ışıklarını fener tutan en yakın iki kişiye ata
    const spots = this.game.stage.spots;
    const holders = this.list.filter((s) => s.flashOn && s.beam.visible);
    spots.forEach((l, i) => {
      const s = holders[i];
      if (!s) {
        l.intensity = 0;
        return;
      }
      l.position.set(s.pos.x + Math.sin(s.heading) * 0.3, 1.1, s.pos.y + Math.cos(s.heading) * 0.3);
      const r = 7 * s.def.skills.light;
      l.target.position.set(s.pos.x + Math.sin(s.heading) * r, 0, s.pos.y + Math.cos(s.heading) * r);
      l.target.updateMatrixWorld();
      l.distance = r * 1.5;
      l.intensity = 18 * this.game.cycle.darkness;
    });
  }

  // Bir noktaya en yakın müsait kişi
  nearestAvailable(x, z, prefer = null) {
    if (prefer && prefer.available) return prefer;
    let best = null;
    let bd = Infinity;
    for (const s of this.list) {
      if (!s.available) continue;
      const d = Math.hypot(s.pos.x - x, s.pos.y - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
}
