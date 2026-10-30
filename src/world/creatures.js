// Gölgeler: gece ormandan çıkar. Işıktan acı çeker, ışığın kıyısında dolaşır, karanlıkta
// kalanları avlar, önce meşaleleri söndürmeye çalışır. Şafakta ormana geri çekilir.

import * as THREE from 'three';
import { ShadeRig } from './rigs.js';
import { getDef, levelStats } from '../buildings/index.js';

// her karede yeni vektör üretmemek için (telefonda çöp toplama takılması)
const T1 = new THREE.Vector2();
const T2 = new THREE.Vector2();

const SPEED = 1.15;

export class Shade {
  constructor(sys, x, z, hp) {
    this.sys = sys;
    this.rig = new ShadeRig(Math.random() * 10);
    this.root = this.rig.root;
    this.pos = new THREE.Vector2(x, z);
    this.heading = Math.atan2(-x, -z);
    this.hp = hp;
    this.maxHp = hp;
    this.mode = 'stalk';
    this.timer = 2 + Math.random() * 4;
    this.target = null;
    this.attackT = 0;
    this.cool = 0;
    this.lit = 0;
    this.fade = 0;
    this.orbit = Math.random() < 0.5 ? 1 : -1;
    this.dead = false;
    this.speedK = 0.85 + Math.random() * 0.35;
    this.root.scale.setScalar(0.92 + Math.random() * 0.2);
    sys.game.stage.scene.add(this.root);
  }

  damage(n) {
    this.hp -= n;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.sys.onDeath(this);
    }
  }

  // Hedef seç: karanlıktaki insan > ışık kaynakları > yapılar > grup
  pickTarget() {
    const g = this.sys.game;
    let best = null;
    let bd = Infinity;
    for (const s of g.survivors.present()) {
      if (s.mode === 'inside') continue;
      const d = Math.hypot(s.pos.x - this.pos.x, s.pos.y - this.pos.y);
      const cover = g.lights.coverage(s.pos.x, s.pos.y);
      const score = d * (cover > 0.45 ? 3 : 1);
      if (score < bd && d < 18) {
        bd = score;
        best = { kind: 'survivor', ref: s };
      }
    }
    if (best && bd < 9) return best;
    for (const v of g.views.values()) {
      if (v.instanced || v.e.state === 'building' || !v.e.hp) continue;
      const def = v.def;
      if (def.category === 'nature') continue;
      const d = Math.hypot(v.center.x - this.pos.x, v.center.z - this.pos.y);
      const isLight = !!levelStats(def, v.e.level)?.light && def.id !== 'campfire';
      const score = d * (isLight ? 0.55 : def.blocksCreatures ? 0.8 : 1.3) * (def.id === 'campfire' ? 4 : 1);
      if (score < bd) {
        bd = score;
        best = { kind: 'view', ref: v };
      }
    }
    return best;
  }

  targetPos() {
    const t = this.target;
    if (!t) return null;
    if (t.kind === 'survivor') return t.ref.alive && t.ref.mode !== 'inside' && t.ref.mode !== 'away' ? { x: t.ref.pos.x, y: t.ref.pos.y, r: 0.9 } : null;
    const v = t.ref;
    if (!this.sys.game.views.has(v.e.id)) return null;
    return { x: v.center.x, y: v.center.z, r: v.def.size * 0.5 + 0.55 };
  }

  update(dt, t) {
    const g = this.sys.game;
    const dark = g.cycle.darkness;
    if (this.scripted) {
      this.pose(dt, t, 0.2);
      return;
    }

    // Işığın yakması: sabit ışıklar + fener hüzmeleri
    let burn = 0;
    const cover = g.lights.coverage(this.pos.x, this.pos.y, 1);
    burn += cover * 30;
    for (const s of g.survivors.list) {
      const b = s.inBeam(this.pos.x, this.pos.y);
      if (b > 0) burn += b * 26 * s.def.skills.light;
    }
    if (dark < 0.5) burn += 40;
    this.lit += ((burn > 4 ? 1 : 0) - this.lit) * Math.min(1, dt * 6);
    if (burn > 0) this.damage(burn * dt);
    if (this.dead) return;

    if (this.mode === 'retreat' || dark < 0.25) {
      this.mode = 'retreat';
      const out = T1.copy(this.pos).normalize();
      this.move(out.x, out.y, dt, 1.6);
      this.fade += dt * 0.5;
      if (this.fade > 1.2) this.sys.remove(this);
      this.pose(dt, t, 1);
      return;
    }

    this.timer -= dt;
    this.cool -= dt;
    if (this.attackT > 0) this.attackT -= dt * 1.6;

    // Can azsa karanlığa kaç, toparlan
    if (this.mode !== 'flee' && this.hp < this.maxHp * 0.25 && cover > 0.1) {
      this.mode = 'flee';
      this.timer = 4 + Math.random() * 3;
    }
    if (this.mode === 'flee') {
      const away = T1.copy(this.pos).normalize();
      this.move(away.x, away.y, dt, 1.5);
      if (this.timer <= 0) {
        this.mode = 'stalk';
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
      }
      this.pose(dt, t, 1);
      return;
    }

    if (!this.target || this.timer <= 0 || !this.targetPos()) {
      this.target = this.pickTarget();
      this.timer = 3 + Math.random() * 3;
      if (this.mode === 'stalk' && Math.random() < 0.35) this.timer += 3;
    }
    const tp = this.targetPos();
    if (!tp) {
      this.pose(dt, t, 0);
      return;
    }
    const dx = tp.x - this.pos.x;
    const dz = tp.y - this.pos.y;
    const dist = Math.hypot(dx, dz);
    let dir = T1.set(dx / dist, dz / dist);

    // Önündeki ışık güçlü ise kıyıda dolaş (hedef ışığın kendisi değilse)
    const probe = g.lights.coverage(this.pos.x + dir.x * 1.4, this.pos.y + dir.y * 1.4, 1);
    const targetIsLight = this.target.kind === 'view' && !!levelStats(this.target.ref.def, this.target.ref.e.level)?.light;
    const bold = this.mode === 'rush';
    if (probe > 0.5 && !targetIsLight && !bold) {
      const tang = T2.set(-dir.y * this.orbit, dir.x * this.orbit);
      dir = tang.multiplyScalar(0.9).addScaledVector(dir, -0.25).normalize();
      if (Math.random() < dt * 0.08) this.mode = 'rush';
    } else if (bold && Math.random() < dt * 0.4) {
      this.mode = 'stalk';
    }

    // Barikat engeli
    const ahead = g.grid.tileAt(this.pos.x + dir.x * 0.6, this.pos.y + dir.y * 0.6);
    const blockId = g.grid.at(ahead.i, ahead.j);
    const block = blockId > 0 ? g.views.get(blockId) : null;
    if (block && block.def.blocksCreatures && block.e.hp > 0) {
      this.hit(block, dt, t);
      this.pose(dt, t, 0);
      return;
    }
    // Kapan
    const here = g.grid.tileAt(this.pos.x, this.pos.y);
    const hereId = g.grid.at(here.i, here.j);
    const trapV = hereId > 0 ? g.views.get(hereId) : null;
    if (trapV && trapV.def.id === 'trap' && trapV.e.armed !== false) g.springTrap(trapV, this);

    if (dist > tp.r) {
      this.move(dir.x, dir.y, dt, bold ? 1.6 : 1);
      this.pose(dt, t, 1);
    } else {
      this.heading = Math.atan2(dx, dz);
      if (this.target.kind === 'survivor') {
        if (this.cool <= 0) {
          this.cool = 1.5;
          this.attackT = 1;
          this.target.ref.hurt(17, this.pos);
          g.fx.blood(this.target.ref.pos.x, 1.0, this.target.ref.pos.y);
        }
      } else {
        this.hit(this.target.ref, dt, t);
      }
      this.pose(dt, t, 0);
    }
  }

  hit(view, dt) {
    if (this.cool > 0) return;
    this.cool = 1.3;
    this.attackT = 1;
    this.sys.game.damageView(view, 22, this);
  }

  move(dx, dz, dt, k = 1) {
    const sp = SPEED * this.speedK * k * (this.lit > 0.5 ? 0.45 : 1);
    this.pos.x += dx * sp * dt;
    this.pos.y += dz * sp * dt;
    const want = Math.atan2(dx, dz);
    let d = want - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * 4);
  }

  pose(dt, t, walk) {
    this.rig.pose(dt, { walk, lit: this.lit, attack: Math.max(0, this.attackT), t });
    this.root.position.set(this.pos.x, 0, this.pos.y);
    this.root.rotation.y = this.heading;
    const vis = Math.max(0, 1 - this.fade);
    this.root.scale.y = vis * (this.root.scale.x);
    if (Math.random() < dt * 9) this.sys.game.fx.shade(this.pos.x, 0.2 + Math.random() * 1.5, this.pos.y, 0.7);
  }

  dispose() {
    this.root.removeFromParent();
  }
}

export class Shades {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.queue = [];
  }

  get count() {
    return this.list.length;
  }

  // Gece için bir dalga planla
  planNight(day) {
    const n = day === 1 ? 3 : Math.min(14, 2 + day * 2);
    this.queue = [];
    for (let k = 0; k < n; k++) this.queue.push({ at: 4 + (k / n) * 55 + Math.random() * 6 });
    this.nightT = 0;
    this.day = day;
  }

  spawn() {
    const half = this.game.grid.half;
    const a = Math.random() * Math.PI * 2;
    const r = half + 2 + Math.random() * 6;
    return this.spawnAt(Math.cos(a) * r, Math.sin(a) * r);
  }

  spawnAt(x, z) {
    const hp = 60 + (this.day ?? this.game.cycle.day) * 12;
    const s = new Shade(this, x, z, hp);
    this.list.push(s);
    this.game.onShadeSpawn(s);
    return s;
  }

  onDeath(s) {
    this.game.fx.burst(s.pos.x, 0, s.pos.y);
    this.game.onShadeDeath(s);
    this.remove(s);
  }

  remove(s) {
    const i = this.list.indexOf(s);
    if (i >= 0) this.list.splice(i, 1);
    s.dispose();
  }

  nearest(x, z) {
    let best = null;
    let bd = Infinity;
    for (const s of this.list) {
      if (s.mode === 'retreat') continue;
      const d = Math.hypot(s.pos.x - x, s.pos.y - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best ? { shade: best, d: bd } : null;
  }

  update(dt, t) {
    const phase = this.game.cycle.phase;
    if (phase === 'night' && this.queue.length) {
      this.nightT += dt;
      while (this.queue.length && this.queue[0].at <= this.nightT) {
        this.queue.shift();
        this.spawn();
      }
    }
    for (const s of [...this.list]) s.update(dt, t);
  }

  retreatAll() {
    for (const s of this.list) s.mode = 'retreat';
    this.queue = [];
  }
}

