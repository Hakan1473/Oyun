// Oyun yöneticisi: yapılar, ağaçlar, görevler, karakterler, gece varlıkları, gün döngüsü ve kayıt.
// Arayüz bus olaylarını dinler ve Game'in eylem metotlarını çağırır.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus } from '../core/events.js';
import { writeSave } from '../core/storage.js';
import { formatNumber } from '../core/format.js';
import { getDef, levelStats } from '../buildings/index.js';
import { Grid } from '../engine/grid.js';
import { EntityView } from './entity-view.js';
import * as R from './rules.js';
import { ROSTER, byId } from './roster.js';
import { Survivors } from '../world/survivors.js';
import { Shades } from '../world/creatures.js';
import { audio } from '../audio/audio.js';
import { PATHS } from '../world/layout.js';
import { icon } from '../ui/icons.js';

const tmpV = new THREE.Vector3();
const RES_NAMES = { wood: 'odun', food: 'erzak' };

function footprintTexture(kind) {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.beginPath();
  g.roundRect(6, 6, s - 12, s - 12, 16);
  if (kind === 'fill') {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill();
  }
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Game {
  constructor({ stage, rig, fx, overlay, lights, cycle, ground, flora, field, state }) {
    Object.assign(this, { stage, rig, fx, overlay, lights, cycle, ground, flora, field, state });
    this.grid = new Grid(CONFIG.grid.size);
    this.field.grid = this.grid;
    this.views = new Map();
    this.selected = null; // { kind: 'entity'|'survivor', id }
    this.mode = 'idle';
    this.place = null;
    this.drag = null;
    this.pointer = null;
    this.time = 0;
    this.paused = false;
    this.dirtyAt = 0;
    this.lastSave = performance.now();
    this.nightLog = null;
    this.uiTick = 0;
    this.warned = {};

    const mk = (kind) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: footprintTexture(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      );
      m.position.y = 0.03;
      m.renderOrder = 2;
      m.visible = false;
      stage.scene.add(m);
      return m;
    };
    this.footprint = mk('fill');
    this.ring = mk('ring');
    this.gridLines = this.#gridOverlay();

    for (const e of state.entities) this.#addView(e);
    this.flora.sync(this.grid);
    this.survivors = new Survivors(this, ROSTER, state.survivors);
    this.shades = new Shades(this);
    for (const s of this.survivors.list) if (!s.alive) s.die();
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => document.hidden && this.save());
  }

  #gridOverlay() {
    const N = CONFIG.grid.size;
    const px = 24;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N * px;
    const g = cv.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      g.beginPath();
      g.moveTo(i * px, 0);
      g.lineTo(i * px, N * px);
      g.moveTo(0, i * px);
      g.lineTo(N * px, i * px);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(N, N).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    );
    m.position.y = 0.02;
    m.renderOrder = 1;
    m.visible = false;
    this.stage.scene.add(m);
    return m;
  }

  showGrid(on) {
    this.gridGoal = on ? 0.3 : 0;
    if (on) this.gridLines.visible = true;
  }

  // --- yardımcılar ------------------------------------------------------------------

  entity(id) {
    return this.state.entities.find((e) => e.id === id) ?? null;
  }

  cabinLevel() {
    const c = this.state.entities.find((e) => e.type === 'cabin');
    return c ? (c.state === 'upgrading' ? c.level : c.level) : 0;
  }

  #constructing(e) {
    return e.state === 'building' || e.state === 'upgrading';
  }

  #addView(e) {
    const def = getDef(e.type);
    this.grid.occupy(e.id, e.i, e.j, def.size, { solid: def.solid !== false, cost: def.pathCost ?? 1 });
    const v = def.instanced ? this.field.add(e, def) : new EntityView(this, e);
    if (!v) return null;
    this.views.set(e.id, v);
    if (this.#constructing(e)) this.#attachProgress(v);
    return v;
  }

  #removeView(id) {
    const v = this.views.get(id);
    if (!v) return;
    v.progressEl?.remove();
    v.bubbleEl?.remove();
    v.hpEl?.remove();
    v.dispose();
    this.views.delete(id);
    this.grid.release(id);
  }

  #removeEntity(id) {
    this.state.entities = this.state.entities.filter((x) => x.id !== id);
    this.state.tasks = this.state.tasks.filter((t) => t.target !== id);
    for (const s of this.survivors?.list ?? []) if (s.task?.target === id) s.task = null;
    if (this.selected?.kind === 'entity' && this.selected.id === id) this.select(null);
    this.#removeView(id);
    this.flora.sync(this.grid);
  }

  markDirty() {
    this.dirtyAt = performance.now();
  }

  save() {
    if (this.noSave) return;
    this.state.savedAt = Date.now();
    this.state.tasks = this.state.tasks.map((t) => ({ ...t, assignee: null }));
    writeSave(this.state);
    this.lastSave = performance.now();
    this.dirtyAt = 0;
  }

  emitAll() {
    bus.emit('resources', this.resourceInfo());
    bus.emit('survivors', this.survivorInfo());
    bus.emit('clock', this.clockInfo());
    bus.emit('objective', this.objectiveInfo());
  }

  resourceInfo() {
    const s = this.state;
    return { wood: s.resources.wood, food: s.resources.food, woodCap: R.storageCap(s, 'wood'), foodCap: R.storageCap(s, 'food') };
  }

  survivorInfo() {
    return this.survivors.list.map((s) => ({
      id: s.id, name: s.def.name, color: s.def.color, hp: s.data.hp, alive: s.alive, mode: s.mode,
      task: s.task?.kind ?? null, selected: this.selected?.kind === 'survivor' && this.selected.id === s.id,
    }));
  }

  clockInfo() {
    const r = this.cycle.remaining();
    return { day: this.cycle.day, ...r, shades: this.shades.count, fuel: this.campfire()?.fuel ?? 0, fuelMax: this.fuelMax() };
  }

  campfire() {
    return this.state.entities.find((e) => e.type === 'campfire') ?? null;
  }

  fuelMax() {
    const f = this.campfire();
    return f ? levelStats(getDef('campfire'), f.level).fuelMax : 1;
  }

  addResources(add, from) {
    const s = this.state;
    const got = {};
    for (const r of R.RESOURCES) {
      if (!add[r]) continue;
      const cap = R.storageCap(s, r);
      const before = s.resources[r];
      s.resources[r] = Math.max(0, Math.min(cap, before + add[r]));
      got[r] = s.resources[r] - before;
      if (got[r] > 0 && from) bus.emit('fly', { res: r, amount: got[r], from });
      if (got[r] < add[r] && add[r] > 0 && !this.warned[`cap-${r}`]) {
        this.warned[`cap-${r}`] = true;
        bus.emit('toast', { text: `${RES_NAMES[r][0].toUpperCase()}${RES_NAMES[r].slice(1)} deposu dolu. Kulübeyi ya da odunluğu büyüt`, icon: r, tone: 'bad' });
      }
    }
    bus.emit('resources', this.resourceInfo());
    this.markDirty();
    return got;
  }

  spend(cost) {
    if (!R.canAfford(this.state, cost)) return false;
    for (const r of R.RESOURCES) this.state.resources[r] -= cost[r] ?? 0;
    bus.emit('resources', this.resourceInfo());
    this.markDirty();
    return true;
  }

  // --- karakterler için dünya sorguları -----------------------------------------------

  cabinDoor() {
    const c = this.state.entities.find((e) => e.type === 'cabin');
    const v = c && this.views.get(c.id);
    if (!v?.model?.door) return null;
    return { x: v.center.x + v.model.door.x, y: v.center.z + v.model.door.z };
  }

  cabinDoorTile() {
    const d = this.cabinDoor();
    if (!d) return null;
    const t = this.grid.tileAt(d.x, d.y + 0.6);
    return this.grid.walkable(t.i, t.j) ? t : this.#nearestWalkable(t.i, t.j);
  }

  fireSpot() {
    const f = this.campfire();
    if (!f) return null;
    const v = this.views.get(f.id);
    return { x: v.center.x + 1.4, y: v.center.z + 0.6 };
  }

  guardSpot(s) {
    const f = this.campfire();
    if (!f) return null;
    const v = this.views.get(f.id);
    const alive = this.survivors.present().filter((x) => x.mode !== 'inside');
    const k = Math.max(0, alive.indexOf(s));
    const n = Math.max(1, alive.length);
    const a = (k / n) * Math.PI * 2 + 0.6;
    const r = 2.3;
    return { x: v.center.x + Math.cos(a) * r, y: v.center.z + Math.sin(a) * r, cx: v.center.x, cz: v.center.z };
  }

  wanderSpot(s) {
    const base = this.fireSpot() ?? { x: 0, y: 3 };
    for (let k = 0; k < 8; k++) {
      const t = this.grid.tileAt(base.x + (Math.random() - 0.5) * 9, base.y + (Math.random() - 0.5) * 8);
      if (this.grid.walkable(t.i, t.j)) return t;
    }
    void s;
    return null;
  }

  #nearestWalkable(i, j) {
    for (let r = 1; r < 8; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (this.grid.walkable(i + di, j + dj)) return { i: i + di, j: j + dj };
        }
      }
    }
    return null;
  }

  #ringTiles(e) {
    const s = getDef(e.type).size;
    const out = [];
    for (let k = -1; k <= s; k++) {
      out.push({ i: e.i + k, j: e.j - 1 }, { i: e.i + k, j: e.j + s });
      if (k >= 0 && k < s) out.push({ i: e.i - 1, j: e.j + k }, { i: e.i + s, j: e.j + k });
    }
    return out;
  }

  workSpot(tk, s) {
    const e = this.entity(tk.target);
    const v = this.views.get(tk.target);
    if (!e || !v) return null;
    const ring = this.#ringTiles(e).filter((t) => this.grid.walkable(t.i, t.j));
    if (!ring.length) return null;
    const me = s.tile();
    const taken = new Set(this.survivors.list.filter((o) => o !== s && o.task === tk).map((o) => `${o.tile().i},${o.tile().j}`));
    ring.sort((a, b) => Math.hypot(a.i - me.i, a.j - me.j) - Math.hypot(b.i - me.i, b.j - me.j));
    const t = ring.find((r) => !taken.has(`${r.i},${r.j}`)) ?? ring[0];
    return { i: t.i, j: t.j, look: { x: v.center.x, y: v.center.z } };
  }

  // --- görevler -------------------------------------------------------------------------

  #task(kind, target, need, extra = {}) {
    if (this.state.tasks.some((t) => t.target === target && t.kind === kind)) return null;
    const tk = { id: this.state.nextId++, kind, target, need, progress: 0, assignee: null, ...extra };
    this.state.tasks.push(tk);
    this.markDirty();
    return tk;
  }

  taskValid(tk) {
    return this.state.tasks.includes(tk) && !!this.entity(tk.target);
  }

  dropTask(tk) {
    tk.assignee = null;
  }

  cancelTask(tk) {
    this.state.tasks = this.state.tasks.filter((t) => t !== tk);
    for (const s of this.survivors.list) if (s.task === tk) s.task = null;
    bus.emit('survivors', this.survivorInfo());
  }

  #assignTasks() {
    const dark = this.cycle.darkness;
    const pref = this.selected?.kind === 'survivor' ? this.survivors.get(this.selected.id) : null;
    for (const tk of this.state.tasks) {
      if (tk.assignee) {
        const s = this.survivors.get(tk.assignee);
        if (s && s.alive && s.task === tk) continue;
        tk.assignee = null;
      }
      const v = this.views.get(tk.target);
      if (!v) continue;
      if (dark > 0.55 && this.lights.coverage(v.center.x, v.center.z) < 0.35) continue;
      const s = this.survivors.nearestAvailable(v.center.x, v.center.z, tk.prefer ? this.survivors.get(tk.prefer) : pref);
      if (!s) break;
      s.task = tk;
      s.mode = 'idle';
      tk.assignee = s.id;
      tk.prefer = null;
      bus.emit('survivors', this.survivorInfo());
    }
  }

  workOn(tk, amount, s) {
    tk.progress += amount;
    const v = this.views.get(tk.target);
    tk.tick = (tk.tick ?? 0) + amount;
    if (v && tk.tick > 0.55) {
      tk.tick = 0;
      if (tk.kind === 'clear') {
        this.fx.chips(v.center.x + (s.pos.x - v.center.x) * 0.3, 0.9, v.center.z + (s.pos.y - v.center.z) * 0.3, 4);
        v.pop?.();
        if (this.#onScreen(v.center)) audio.play('chop', { gap: 200 });
      } else if (this.#onScreen(v.center)) {
        audio.play('hammer', { gap: 260, vol: 0.8 });
      }
    }
    if (tk.kind === 'build' || tk.kind === 'upgrade') {
      const e = this.entity(tk.target);
      if (e) e.progress = tk.progress;
    }
    if (tk.progress >= tk.need) this.#completeTask(tk, s);
  }

  #completeTask(tk, s) {
    this.state.tasks = this.state.tasks.filter((t) => t !== tk);
    for (const o of this.survivors.list) if (o.task === tk) o.task = null;
    const e = this.entity(tk.target);
    if (!e) return;
    const def = getDef(e.type);
    const v = this.views.get(e.id);
    if (tk.kind === 'clear') this.#finishClear(e, def, v, s);
    else if (tk.kind === 'harvest') {
      const reward = this.#roll(def.harvest.reward);
      const top = v.topPoint(tmpV).clone();
      const got = this.addResources(reward, top);
      this.#floater(got, top);
      e.state = 'picked';
      e.regrowDay = this.cycle.day + def.harvest.regrowDays;
      v.build();
      audio.play('harvest');
    } else if (tk.kind === 'build' || tk.kind === 'upgrade') {
      const wasNew = e.state === 'building';
      if (!wasNew) e.level++;
      e.state = 'built';
      e.hp = levelStats(def, e.level).hp ?? e.hp;
      delete e.progress;
      v.progressEl?.remove();
      v.progressEl = null;
      v.build();
      v.pop(1.2);
      this.fx.dust(v.center.x, v.center.z, def.size * 0.45, 10 + def.size * 4);
      audio.play('complete');
      this.state.stats.built++;
      if (def.id === 'cabin') bus.emit('toast', { text: `Kulübe: ${levelStats(def, e.level).name}`, icon: 'check', tone: 'good' });
      else bus.emit('toast', { text: wasNew ? `${def.name} hazır` : `${def.name} güçlendi`, icon: 'check', tone: 'good' });
      bus.emit('story', { type: wasNew ? 'built' : 'upgraded', id: def.id, level: e.level });
      if (this.selected?.id === e.id) bus.emit('select', this.selectedInfo());
    } else if (tk.kind === 'repair') {
      e.hp = levelStats(def, e.level).hp;
      v.pop(0.8);
      audio.play('complete', { vol: 0.6 });
    } else if (tk.kind === 'rearm') {
      e.armed = true;
      v.pop(0.6);
      audio.play('trap', { vol: 0.5 });
    }
    bus.emit('resources', this.resourceInfo());
    bus.emit('survivors', this.survivorInfo());
    bus.emit('objective', this.objectiveInfo());
    this.markDirty();
  }

  #roll(reward) {
    const out = {};
    for (const [r, v] of Object.entries(reward ?? {})) out[r] = Array.isArray(v) ? Math.round(v[0] + Math.random() * (v[1] - v[0])) : v;
    return out;
  }

  #floater(got, at) {
    const parts = Object.entries(got).filter(([, n]) => n > 0).map(([r, n]) => `${icon(r)}<b>+${formatNumber(n)}</b>`);
    if (parts.length) this.overlay.floater(parts.join(' '), at, { dy: -20 });
  }

  #finishClear(e, def, v, s) {
    const reward = this.#roll(def.clear.reward);
    const top = v.topPoint(tmpV).clone();
    const finish = () => {
      const c = v.center.clone();
      this.#removeEntity(e.id);
      if (def.clear.leaves === 'stump') {
        const t = this.grid.tileAt(c.x, c.z);
        if (this.grid.canPlace(t.i, t.j, 1)) {
          const st = { id: this.state.nextId++, type: 'stump', i: t.i, j: t.j, level: 1, state: 'built', variant: Math.floor(Math.random() * 30) };
          this.state.entities.push(st);
          this.#addView(st);
        }
      }
      this.ground.openArea(c.x, c.z, 1.9);
      this.flora.sync(this.grid);
      this.stage.markShadows();
    };
    const got = this.addResources(reward, top);
    this.#floater(got, top);
    if (def.instanced) {
      this.grid.release(e.id);
      this.field.fell(v, s?.pos.x ?? v.center.x - 1, s?.pos.y ?? v.center.z, {
        onHit: () => {
          const fall = new THREE.Vector3(v.center.x - (s?.pos.x ?? 0), 0, v.center.z - (s?.pos.y ?? 0)).normalize().multiplyScalar(2.2);
          this.fx.dust(v.center.x + fall.x, v.center.z + fall.z, 1.4, 22, 0x4a4234);
          this.fx.leaves(v.center.x + fall.x, 0.6, v.center.z + fall.z, 18);
          this.rig.shake = 0.08;
          if (this.#onScreen(v.center)) audio.play('treefall');
        },
        onDone: finish,
      });
      audio.play('creak', { vol: 0.7 });
      this.state.stats.chopped++;
      bus.emit('story', { type: 'chopped', count: this.state.stats.chopped });
    } else {
      this.fx.dust(v.center.x, v.center.z, def.size * 0.4, 12);
      audio.play('poof');
      finish();
    }
  }

  // --- eylemler ---------------------------------------------------------------------------

  order(name, id) {
    audio.unlock();
    const e = this.entity(id);
    if (!e) return;
    const def = getDef(e.type);
    const v = this.views.get(id);
    const prefer = this.selected?.kind === 'survivor' ? this.selected.id : null;
    const dark = this.cycle.darkness > 0.55 && this.lights.coverage(v.center.x, v.center.z) < 0.35;
    const note = () => dark && bus.emit('toast', { text: 'Karanlıkta kimse oraya gitmez. Önce ışık götür', icon: 'moon', tone: 'bad' });
    switch (name) {
      case 'clear': {
        const tk = this.#task('clear', id, def.clear.work, { prefer });
        if (tk) audio.play('order');
        note();
        break;
      }
      case 'harvest': {
        if (e.state === 'picked') return;
        const tk = this.#task('harvest', id, def.harvest.work, { prefer });
        if (tk) audio.play('order');
        note();
        break;
      }
      case 'cancel': {
        const tk = this.state.tasks.find((t) => t.target === id);
        if (tk && tk.kind !== 'build' && tk.kind !== 'upgrade') this.cancelTask(tk);
        audio.play('close');
        break;
      }
      case 'upgrade': return this.upgrade(id);
      case 'feed': return this.feedFire(id);
      case 'repair': return this.repair(id);
      case 'rearm': {
        if (!this.spend({ wood: 4 })) return this.#explain({ reason: 'cost', missing: R.missing(this.state, { wood: 4 }) });
        this.#task('rearm', id, 2.5, { prefer });
        audio.play('order');
        break;
      }
      case 'collect': return this.collect(id);
      case 'remove': return this.removeBuilding(id);
      default: break;
    }
    bus.emit('select', this.selectedInfo());
    bus.emit('survivors', this.survivorInfo());
  }

  feedFire(id) {
    const e = this.entity(id);
    if (!e) return;
    const max = this.fuelMax();
    const amount = CONFIG.survival.feedAmount;
    if ((e.fuel ?? 0) >= max - 5) {
      bus.emit('toast', { text: 'Ateş zaten harlı', icon: 'fire' });
      return;
    }
    if (!this.spend({ wood: amount })) {
      this.#explain({ reason: 'cost', missing: R.missing(this.state, { wood: amount }) });
      return;
    }
    const wasOut = !(e.fuel > 0);
    e.fuel = Math.min(max, (e.fuel ?? 0) + amount * CONFIG.survival.fuelPerWood);
    const v = this.views.get(id);
    v.pop(0.5);
    for (let i = 0; i < 14; i++) this.fx.ember(v.center.x, 0.5, v.center.z);
    audio.play(wasOut ? 'ignite' : 'feed');
    if (wasOut) bus.emit('story', { type: 'fireLit' });
    bus.emit('clock', this.clockInfo());
    bus.emit('objective', this.objectiveInfo());
    bus.emit('select', this.selectedInfo());
    this.markDirty();
  }

  repair(id) {
    const e = this.entity(id);
    if (!e) return;
    const def = getDef(e.type);
    const max = levelStats(def, e.level).hp;
    const missing = max - (e.hp ?? max);
    if (missing <= 0) return;
    const cost = { wood: Math.max(2, Math.ceil(missing / 14)) };
    if (!this.spend(cost)) return this.#explain({ reason: 'cost', missing: R.missing(this.state, cost) });
    this.#task('repair', id, Math.max(2, missing / 45));
    audio.play('order');
    bus.emit('select', this.selectedInfo());
  }

  upgrade(id) {
    const e = this.entity(id);
    if (!e) return;
    const check = R.upgradeCheck(this.state, e);
    if (!check.ok) return this.#explain(check, getDef(e.type));
    this.spend(check.next.cost);
    e.state = 'upgrading';
    e.progress = 0;
    const v = this.views.get(id);
    v.build();
    v.pop(0.9);
    this.#attachProgress(v);
    this.#task('upgrade', id, check.next.work);
    audio.play('build');
    bus.emit('select', this.selectedInfo());
    this.save();
  }

  collect(id) {
    const e = this.entity(id);
    const p = e && R.production(e);
    if (!p) return;
    const amount = Math.floor(R.stored(e, this.state.clock.total));
    if (amount < 1) return;
    const v = this.views.get(id);
    const top = v.topPoint(tmpV).clone();
    const got = this.addResources({ [p.resource]: amount }, top);
    e.lastCollect = this.state.clock.total;
    this.#floater(got, top);
    v.pop(0.7);
    audio.play('harvest');
    this.#refreshBubble(v);
  }

  removeBuilding(id) {
    const e = this.entity(id);
    if (!e) return;
    const def = getDef(e.type);
    if (def.shop === false) return;
    const refund = {};
    for (const [r, n] of Object.entries(def.levels[0].cost)) refund[r] = Math.floor(n / 2);
    const v = this.views.get(id);
    const top = v.topPoint(tmpV).clone();
    this.fx.dust(v.center.x, v.center.z, def.size * 0.4, 12);
    audio.play('poof');
    this.#removeEntity(id);
    this.addResources(refund, top);
    this.stage.markShadows();
    this.save();
  }

  #explain(check, def) {
    audio.play('error');
    const msg = {
      locked: def ? `${def.name} için kulübe ${check.need}. seviye olmalı` : 'Henüz açılmadı',
      limit: def ? `Şimdilik en fazla ${check.limit} ${def.name.toLowerCase()}. Kulübeyi güçlendir` : 'Sınıra ulaştın',
      cost: check.missing ? `${Object.entries(check.missing).map(([r, n]) => `${formatNumber(n)} ${RES_NAMES[r]}`).join(' ve ')} eksik` : 'Yeterli malzeme yok',
      max: 'Zaten en sağlam hâlinde',
      busy: 'Şu an üzerinde çalışılıyor',
      night: 'Gece inşaat yapılamaz',
    }[check.reason] ?? 'Şu an yapılamıyor';
    bus.emit('toast', { text: msg, icon: check.reason === 'cost' ? 'wood' : 'lock', tone: 'bad' });
  }

  // --- seçim ------------------------------------------------------------------------------

  pick(x, y) {
    // önce karakterler (ekran uzayında)
    let best = null;
    let bd = 34;
    for (const s of this.survivors.list) {
      if (!s.root.visible) continue;
      const p = this.rig.worldToScreen(tmpV.set(s.pos.x, 0.9, s.pos.y));
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = { kind: 'survivor', id: s.id };
      }
    }
    if (best) return best;
    const ray = this.rig.ray(x, y);
    let bestV = null;
    let bestD = Infinity;
    for (const v of this.views.values()) {
      const hit = ray.intersectBox(v.worldBox, tmpV);
      if (!hit) continue;
      const d = hit.distanceTo(ray.origin) + (v.def.category === 'nature' ? 0.8 : 0);
      if (d < bestD) {
        bestD = d;
        bestV = v;
      }
    }
    return bestV ? { kind: 'entity', id: bestV.e.id } : null;
  }

  pickShade(x, y) {
    let best = null;
    let bd = 44;
    for (const s of this.shades.list) {
      const p = this.rig.worldToScreen(tmpV.set(s.pos.x, 1.4, s.pos.y));
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  select(sel) {
    const prevV = this.selected?.kind === 'entity' ? this.views.get(this.selected.id) : null;
    prevV?.setSelected(false);
    this.selected = sel;
    this.ring.visible = false;
    if (sel?.kind === 'entity') {
      const v = this.views.get(sel.id);
      if (!v) {
        this.selected = null;
      } else {
        v.setSelected(true);
        v.pop?.(0.6);
        const s = v.def.size;
        this.ring.scale.set(s + 0.1, 1, s + 0.1);
        this.ring.position.set(v.center.x, 0.03, v.center.z);
        this.ring.visible = true;
      }
    }
    if (sel) audio.play('select');
    this.#updateTag();
    bus.emit('select', this.selectedInfo());
    bus.emit('survivors', this.survivorInfo());
  }

  selectedInfo() {
    const sel = this.selected;
    if (!sel) return null;
    if (sel.kind === 'survivor') {
      const s = this.survivors.get(sel.id);
      return s ? { kind: 'survivor', id: s.id, name: s.def.name, def: s.def, hp: s.data.hp, alive: s.alive, task: s.task?.kind } : null;
    }
    const e = this.entity(sel.id);
    return e ? { kind: 'entity', id: e.id, e, def: getDef(e.type) } : null;
  }

  #updateTag() {
    this.tag?.remove();
    this.tag = null;
    const sel = this.selected;
    if (!sel) return;
    const el = document.createElement('div');
    el.className = 'tag';
    if (sel.kind === 'survivor') {
      const s = this.survivors.get(sel.id);
      el.innerHTML = `<b style="color:${s.def.color}">${s.def.name}</b><span>${s.def.role}</span>`;
      this.tag = this.overlay.add(el, (out) => out.set(s.pos.x, 2.05, s.pos.y), { dy: -6, z: 20 });
      return;
    }
    const v = this.views.get(sel.id);
    if (!v) return;
    const lv = v.def.levels?.[v.e.level - 1]?.name;
    el.innerHTML = `<b>${v.def.name}</b>${lv ? `<span>${lv}</span>` : ''}`;
    this.tag = this.overlay.add(el, (out) => v.topPoint(out), { dy: v.constructing ? -54 : -16, z: 20 });
  }

  // Seçili şey için eylem düğmeleri
  actionsFor(info) {
    if (!info) return [];
    if (info.kind === 'survivor') return [{ id: 'profile', icon: 'person', label: 'Hakkında' }];
    const { e, def } = info;
    const out = [];
    const task = this.state.tasks.find((t) => t.target === e.id);
    if (def.category === 'nature') {
      if (task && task.kind !== 'build') {
        out.push({ id: 'cancel', icon: 'close', label: 'Vazgeç', tone: 'danger', hint: `${Math.round((task.progress / task.need) * 100)}%` });
        return out;
      }
      if (def.harvest && e.state !== 'picked') out.push({ id: 'harvest', icon: 'food', label: def.harvest.verb, tone: 'primary', gain: Object.keys(def.harvest.reward) });
      if (def.clear) out.push({ id: 'clear', icon: def.clear.icon, label: def.clear.verb, tone: def.harvest ? '' : 'primary', gain: Object.keys(def.clear.reward) });
      return out;
    }
    out.push({ id: 'info', icon: 'info', label: 'Bilgi' });
    if (def.id === 'campfire') out.push({ id: 'feed', icon: 'fire', label: (e.fuel ?? 0) > 0 ? 'Besle' : 'Yak', cost: { wood: CONFIG.survival.feedAmount }, tone: 'primary' });
    if (this.#constructing(e)) return out;
    const max = levelStats(def, e.level).hp;
    if (max && e.hp < max - 1) out.push({ id: 'repair', icon: 'hammer', label: 'Onar', cost: { wood: Math.max(2, Math.ceil((max - e.hp) / 14)) } });
    if (def.id === 'trap' && e.armed === false) out.push({ id: 'rearm', icon: 'trap', label: 'Yeniden kur', cost: { wood: 4 } });
    const p = R.production(e);
    if (p && R.stored(e, this.state.clock.total) >= 1) out.push({ id: 'collect', icon: p.resource, label: 'Topla', tone: 'resource' });
    if (e.level < def.maxLevel) {
      const chk = R.upgradeCheck(this.state, e);
      out.push({ id: 'upgrade', icon: 'up', label: def.id === 'cabin' ? 'Onar ve güçlendir' : 'Güçlendir', cost: def.levels[e.level].cost, tone: !chk.ok && chk.reason !== 'cost' ? 'locked' : 'primary' });
    }
    if (def.shop !== false) out.push({ id: 'remove', icon: 'trash', label: 'Kaldır', tone: 'danger' });
    return out;
  }

  // --- dokunma ve sürükleme -----------------------------------------------------------------

  onHover(x, y) {
    if (x == null) return;
    const p = this.mode === 'idle' ? this.pick(x, y) : null;
    this.stage.canvas.style.cursor = p ? 'pointer' : this.mode === 'place' ? 'move' : '';
  }

  onTap(x, y) {
    audio.unlock();
    if (this.paused) return;
    if (this.mode === 'place') {
      const g = this.rig.groundAt(x, y);
      const def = this.place.def;
      const fp = this.grid.footprintAt(g.x, g.z, def.size);
      const c = this.grid.clampFootprint(fp.i, fp.j, def.size);
      this.#setGhost(c.i, c.j);
      audio.play('tap');
      return;
    }
    if (this.cycle.darkness > 0.5) {
      const sh = this.pickShade(x, y);
      if (sh) {
        this.focusShade = sh;
        for (const s of this.survivors.present()) if (Math.hypot(s.pos.x - sh.pos.x, s.pos.y - sh.pos.y) < 9) s.aim = sh;
        audio.play('flash');
        bus.emit('toast', { text: 'Fenerler ona çevrildi', icon: 'flash' });
        return;
      }
    }
    const p = this.pick(x, y);
    if (!p) {
      this.select(null);
      return;
    }
    if (p.kind === 'entity') {
      const e = this.entity(p.id);
      if (e && R.production(e) && R.stored(e, this.state.clock.total) >= 1 && this.#readyToCollect(e)) {
        this.collect(e.id);
        return;
      }
      // seçili bir karakter varken ağaca dokunmak: doğrudan emir
      if (this.selected?.kind === 'survivor' && e && getDef(e.type).category === 'nature') {
        const def = getDef(e.type);
        const kind = def.harvest && e.state !== 'picked' ? 'harvest' : 'clear';
        this.order(kind, e.id);
        this.select(p);
        return;
      }
    }
    if (this.selected && this.selected.kind === p.kind && this.selected.id === p.id) {
      if (p.kind === 'entity') this.views.get(p.id)?.pop?.(0.5);
      audio.play('tap');
      return;
    }
    this.select(p);
  }

  onDragStart(x, y) {
    if (this.paused) return false;
    if (this.mode === 'place') {
      const g = this.rig.groundAt(x, y);
      const v = this.place.view;
      const s = this.place.def.size / 2 + 0.7;
      if (!(Math.abs(g.x - v.center.x) < s && Math.abs(g.z - v.center.z) < s)) return false;
      this.drag = { kind: 'ghost', off: { x: g.x - v.center.x, z: g.z - v.center.z } };
      this.pointer = { x, y };
      v.setLift(0.3);
      audio.play('lift');
      return true;
    }
    if (this.selected?.kind === 'entity') {
      const v = this.views.get(this.selected.id);
      if (!v || v.instanced || v.def.category === 'nature' || v.def.shop === false) return false;
      const p = this.pick(x, y);
      if (!p || p.id !== v.e.id) return false;
      const g = this.rig.groundAt(x, y);
      this.drag = { kind: 'move', off: { x: g.x - v.center.x, z: g.z - v.center.z }, from: { i: v.e.i, j: v.e.j } };
      this.pointer = { x, y };
      this.mode = 'move';
      v.setLift(0.3);
      this.showGrid(true);
      this.footprint.visible = true;
      this.ring.visible = false;
      this.#updateFootprint(v, true);
      audio.play('lift');
      bus.emit('mode', 'move');
      return true;
    }
    return false;
  }

  onDrag(x, y) {
    if (!this.drag) return;
    this.pointer = { x, y };
    this.#dragTo(x, y);
  }

  #dragTo(x, y) {
    const g = this.rig.groundAt(x, y);
    const d = this.drag;
    const v = d.kind === 'ghost' ? this.place.view : this.views.get(this.selected?.id);
    if (!v) return;
    const size = v.def.size;
    let fp = this.grid.footprintAt(g.x - d.off.x, g.z - d.off.z, size);
    fp = this.grid.clampFootprint(fp.i, fp.j, size);
    if (fp.i === v.e.i && fp.j === v.e.j) return;
    if (d.kind === 'ghost') this.#setGhost(fp.i, fp.j);
    else {
      v.setTile(fp.i, fp.j);
      this.#updateFootprint(v, this.grid.canPlace(fp.i, fp.j, size, v.e.id));
    }
    audio.play('tap', { gap: 70, vol: 0.4 });
  }

  onDragEnd() {
    const d = this.drag;
    this.drag = null;
    this.pointer = null;
    if (!d) return;
    if (d.kind === 'ghost') {
      this.place.view.setLift(0.15);
      return;
    }
    const v = this.views.get(this.selected?.id);
    this.mode = 'idle';
    this.showGrid(false);
    this.footprint.visible = false;
    if (!v) return;
    v.setLift(0);
    if (this.grid.canPlace(v.e.i, v.e.j, v.def.size, v.e.id)) {
      this.grid.release(v.e.id);
      this.grid.occupy(v.e.id, v.e.i, v.e.j, v.def.size, { solid: v.def.solid !== false });
      this.flora.sync(this.grid);
      v.pop(0.8);
      this.fx.dust(v.center.x, v.center.z, v.def.size * 0.45, 10);
      audio.play('drop');
      this.markDirty();
    } else {
      v.setTile(d.from.i, d.from.j);
      audio.play('error');
      bus.emit('toast', { text: 'Buraya sığmıyor', icon: 'move', tone: 'bad' });
    }
    this.select(this.selected);
    bus.emit('mode', 'idle');
  }

  onKey(k, e) {
    if (k === 'escape') {
      if (this.mode === 'place') this.cancelPlacement();
      else if (this.selected) this.select(null);
    } else if (k === 'enter' && this.mode === 'place') this.confirmPlacement();
    else if (k === '+' || k === '=') this.rig.zoomAt(this.stage.width / 2, this.stage.height / 2, 1.25);
    else if (k === '-' || k === '_') this.rig.zoomAt(this.stage.width / 2, this.stage.height / 2, 0.8);
    else if (k === 'b' && this.mode === 'idle' && !e.metaKey && !e.ctrlKey) bus.emit('open-shop');
  }

  #updateFootprint(v, ok) {
    const s = v.def.size;
    this.footprint.scale.set(s, 1, s);
    this.footprint.position.set(v.center.x, 0.03, v.center.z);
    this.footprint.material.color.set(ok ? 0x6ad08a : 0xff5040);
  }

  // --- yerleştirme ---------------------------------------------------------------------------

  startPlacement(id, near = null) {
    const def = getDef(id);
    const check = R.buildCheck(this.state, def, { night: this.cycle.darkness > 0.55 });
    if (!check.ok) {
      this.#explain(check, def);
      return false;
    }
    this.cancelPlacement(true);
    this.select(null);
    const ghostE = { id: -1, type: id, i: 0, j: 0, level: 1, state: 'ghost', variant: Math.floor(Math.random() * 97) };
    const view = new EntityView(this, ghostE, { ghost: true });
    view.setLift(0.15);
    this.place = { def, view, valid: false };
    this.mode = 'place';
    this.showGrid(true);
    this.footprint.visible = true;
    const start = near ?? (() => {
      const g = this.rig.groundAt(this.stage.width / 2, this.stage.height / 2);
      return this.grid.footprintAt(g.x, g.z, def.size);
    })();
    const spot = this.#nearestFree(start.i, start.j, def.size) ?? start;
    this.#setGhost(spot.i, spot.j);
    const sc = this.rig.worldToScreen(view.center);
    if (sc.x < 40 || sc.x > this.stage.width - 40 || sc.y < 120 || sc.y > this.stage.height - 200) this.rig.flyTo({ x: view.center.x, z: view.center.z }, 0.6);
    view.pop(1);
    audio.play('lift');
    bus.emit('mode', 'place');
    return true;
  }

  #nearestFree(i0, j0, size) {
    for (let r = 0; r < 14; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const c = this.grid.clampFootprint(i0 + di, j0 + dj, size);
          if (this.grid.canPlace(c.i, c.j, size)) return c;
        }
      }
    }
    return null;
  }

  #setGhost(i, j) {
    const p = this.place;
    p.view.setTile(i, j);
    p.valid = this.grid.canPlace(i, j, p.def.size);
    this.#updateFootprint(p.view, p.valid);
    this.stage.markShadows();
    bus.emit('placement', { valid: p.valid, def: p.def });
  }

  cancelPlacement(silent = false) {
    if (!this.place) return;
    this.place.view.dispose();
    this.place = null;
    this.drag = null;
    this.mode = 'idle';
    this.showGrid(false);
    this.footprint.visible = false;
    this.stage.markShadows();
    if (!silent) {
      audio.play('close');
      bus.emit('mode', 'idle');
    }
  }

  confirmPlacement() {
    const p = this.place;
    if (!p) return;
    if (!p.valid) {
      audio.play('error');
      bus.emit('toast', { text: 'Burası dolu. Önce ağaçları kes', icon: 'axe', tone: 'bad' });
      return;
    }
    const def = p.def;
    const check = R.buildCheck(this.state, def, { night: this.cycle.darkness > 0.55 });
    if (!check.ok) {
      this.#explain(check, def);
      this.cancelPlacement();
      return;
    }
    const lv = def.levels[0];
    this.spend(lv.cost);
    const { i, j } = p.view.e;
    const e = {
      id: this.state.nextId++, type: def.id, i, j, level: 1, state: lv.work > 0 ? 'building' : 'built',
      variant: p.view.e.variant, progress: 0, lastCollect: this.state.clock.total,
    };
    if (lv.hp) e.hp = lv.hp;
    if (def.id === 'trap') e.armed = true;
    this.state.entities.push(e);
    this.cancelPlacement(true);
    const v = this.#addView(e);
    this.flora.sync(this.grid);
    v.pop(1.1);
    this.fx.dust(v.center.x, v.center.z, def.size * 0.45, 8 + def.size * 4);
    audio.play('place');
    if (e.state === 'building') this.#task('build', e.id, lv.work);
    bus.emit('mode', 'idle');
    bus.emit('objective', this.objectiveInfo());
    this.save();
    if (def.repeat && R.buildCheck(this.state, def).ok) {
      const dir = this.lastRepeat && this.lastRepeat.id === def.id ? { di: i - this.lastRepeat.i, dj: j - this.lastRepeat.j } : { di: 1, dj: 0 };
      if (Math.abs(dir.di) + Math.abs(dir.dj) !== 1) Object.assign(dir, { di: 1, dj: 0 });
      this.lastRepeat = { id: def.id, i, j };
      if (this.grid.canPlace(i + dir.di, j + dir.dj, def.size)) this.startPlacement(def.id, { i: i + dir.di, j: j + dir.dj });
    } else this.lastRepeat = null;
  }

  #attachProgress(v) {
    if (v.progressEl) return;
    const el = document.createElement('div');
    el.className = 'progress';
    el.innerHTML = '<div class="progress-bar"><i></i></div>';
    v.progressEl = this.overlay.add(el, (out) => v.topPoint(out), { dy: -6, z: 10 });
    v.progressBar = el.querySelector('i');
  }

  // --- hasar ve ölüm ---------------------------------------------------------------------------

  damageView(v, dmg, shade) {
    const e = v.e;
    if (!e.hp) return;
    const before = e.hp;
    e.hp = Math.max(0, e.hp - dmg);
    v.hit?.();
    if (e.type === 'cabin') {
      const max = levelStats(v.def, e.level).hp;
      if (before > max * 0.35 && e.hp <= max * 0.35 && e.hp > 0) bus.emit('toast', { text: 'Kulübe dağılmak üzere', icon: 'warning', tone: 'bad' });
      if (before > 0 && e.hp <= 0) bus.emit('toast', { text: 'Kulübe çöktü: içine sığınılamaz. Gündüz onar.', icon: 'warning', tone: 'bad' });
    }
    this.fx.chips(v.center.x, 0.6, v.center.z, 3);
    if (this.#onScreen(v.center)) audio.play('impact', { gap: 150 });
    this.#hpBar(v);
    if (this.nightLog) this.nightLog.damage += dmg;
    if (e.hp <= 0) {
      if (e.type === 'cabin' || e.type === 'campfire') {
        e.hp = 0;
        if (e.type === 'campfire') e.fuel = Math.max(0, (e.fuel ?? 0) - 40);
        if (e.type === 'cabin') for (const s of this.survivors.list) if (s.mode === 'inside') {
          s.mode = 'idle';
          const d = this.cabinDoor();
          if (d) s.pos.set(d.x, d.y + 0.5);
        }
        return;
      }
      bus.emit('toast', { text: `${v.def.name} yıkıldı`, icon: 'warning', tone: 'bad' });
      this.fx.dust(v.center.x, v.center.z, v.def.size * 0.5, 16, 0x2a2a2a);
      audio.play('break');
      this.#removeEntity(e.id);
      this.stage.markShadows();
    }
    void shade;
  }

  #hpBar(v) {
    const max = levelStats(v.def, v.e.level).hp;
    if (!v.hpEl) {
      const el = document.createElement('div');
      el.className = 'hpbar';
      el.innerHTML = '<i></i>';
      v.hpEl = this.overlay.add(el, (out) => v.topPoint(out), { dy: -4, z: 9 });
      v.hpFill = el.querySelector('i');
    }
    v.hpFill.style.transform = `scaleX(${Math.max(0, v.e.hp / max).toFixed(3)})`;
    v.hpT = 3;
  }

  springTrap(v, shade) {
    v.e.armed = false;
    shade.damage(levelStats(v.def, 1).trapDamage);
    shade.lit = 1;
    v.pop(1);
    audio.play('trap');
    this.fx.chips(v.center.x, 0.3, v.center.z, 6);
    this.markDirty();
  }

  onSurvivorHurt(s, dmg) {
    try {
      navigator.vibrate?.(40);
    } catch {
      /* desteklenmiyor */
    }
    if (this.nightLog) this.nightLog.hurt.add(s.id);
    this.stage.post.params.uDamage.value = Math.min(0.6, this.stage.post.params.uDamage.value + dmg / 60);
    audio.play('hurt');
    bus.emit('survivors', this.survivorInfo());
    if (s.data.hp > 0 && s.data.hp < 35 && !this.warned[`low-${s.id}`]) {
      this.warned[`low-${s.id}`] = true;
      bus.emit('toast', { text: `${s.def.name} ağır yaralı`, icon: 'heart', tone: 'bad' });
    }
  }

  killSurvivor(id, cause = 'shade') {
    const s = this.survivors.get(id);
    if (!s || !s.alive) return;
    s.data.alive = false;
    s.data.hp = 0;
    s.die();
    for (const tk of this.state.tasks) if (tk.assignee === id) tk.assignee = null;
    this.state.stats.deaths.push({ id, day: this.cycle.day, cause });
    if (this.nightLog) this.nightLog.deaths.push(id);
    audio.play('death');
    try {
      navigator.vibrate?.([80, 60, 200]);
    } catch {
      /* desteklenmiyor */
    }
    this.cycle.flash = 0.6;
    bus.emit('toast', { text: `${s.def.name} artık yok`, icon: 'skull', tone: 'bad' });
    bus.emit('survivors', this.survivorInfo());
    bus.emit('story', { type: 'death', id, cause });
    this.save();
    if (!this.survivors.alive().length) bus.emit('gameover', this.state.stats);
  }

  onShadeSpawn(s) {
    if (this.#onScreen(new THREE.Vector3(s.pos.x, 1, s.pos.y))) audio.play('whisper');
    bus.emit('clock', this.clockInfo());
  }

  onShadeDeath(s) {
    this.state.stats.shades++;
    if (this.nightLog) this.nightLog.shades++;
    audio.play('shriek');
    bus.emit('clock', this.clockInfo());
    void s;
  }

  // --- gün döngüsü olayları -----------------------------------------------------------------

  #onPhase(ev) {
    const day = this.cycle.day;
    if (ev.after === 'dusk') {
      bus.emit('toast', { text: 'Hava kararıyor. Ateşi besle, ışıklara yakın kalın', icon: 'moon' });
      audio.setMood('dusk');
      bus.emit('story', { type: 'dusk', day });
    } else if (ev.after === 'night') {
      this.shades.planNight(day);
      this.nightLog = { day, shades: 0, damage: 0, hurt: new Set(), deaths: [] };
      audio.setMood('night');
      audio.play('nightfall');
      bus.emit('story', { type: 'night', day });
    } else if (ev.after === 'dawn') {
      this.shades.retreatAll();
      audio.setMood('dawn');
      this.state.stats.nights = Math.max(this.state.stats.nights, day);
      bus.emit('story', { type: 'dawn', day });
    }
    if (ev.newDay) {
      this.#morning();
      audio.setMood('day');
    }
    bus.emit('clock', this.clockInfo());
    bus.emit('objective', this.objectiveInfo());
  }

  #morning() {
    const day = this.cycle.day;
    const alive = this.survivors.alive().filter((s) => s.mode !== 'away');
    const need = alive.length * CONFIG.survival.foodPerSurvivor;
    const have = this.state.resources.food;
    const eat = Math.min(need, have);
    this.state.resources.food -= eat;
    const hungry = need > have;
    if (hungry) {
      const short = Math.ceil((need - have) / CONFIG.survival.foodPerSurvivor);
      for (const s of alive.slice(0, short)) {
        s.data.hp = Math.max(1, s.data.hp - CONFIG.survival.hungerDamage);
      }
    }
    for (const e of this.state.entities) {
      if (e.type === 'berrybush' && e.state === 'picked' && e.regrowDay && day >= e.regrowDay) {
        e.state = 'built';
        delete e.regrowDay;
        this.views.get(e.id)?.build();
      }
    }
    const log = this.nightLog;
    bus.emit('morning', {
      day, ate: eat, hungry, food: this.state.resources.food,
      shades: log?.shades ?? 0, damage: Math.round(log?.damage ?? 0), hurt: log ? [...log.hurt] : [], deaths: log?.deaths ?? [],
    });
    this.nightLog = null;
    this.warned = {};
    bus.emit('resources', this.resourceInfo());
    bus.emit('survivors', this.survivorInfo());
    bus.emit('story', { type: 'day', day });
    this.save();
  }

  skipToNight() {
    if (this.cycle.phase !== 'day') return;
    this.cycle.skipToDusk();
    audio.play('open');
  }

  // --- hikâye sahneleri için eylemler ------------------------------------------------------------

  fireWorld() {
    const f = this.campfire();
    const v = f && this.views.get(f.id);
    return v ? v.center.clone().setY(1) : new THREE.Vector3(0, 1, 3);
  }

  focusSurvivor(id) {
    const s = this.survivors.get(id);
    if (!s || !s.root.visible) return;
    this.rig.flyTo({ x: s.pos.x - 0.5, z: s.pos.y + 0.8, ppu: Math.max(this.rig.ppu, 52) }, 0.7);
  }

  #pathOut(id = 'camp') {
    const p = PATHS.find((x) => x.id === id) ?? PATHS[0];
    const half = this.grid.half;
    const pts = p.samples.filter((q, k) => k % 6 === 0);
    const exit = pts.findIndex((q) => Math.max(Math.abs(q.x), Math.abs(q.z)) > half + 3);
    return pts.slice(0, exit > 0 ? exit + 1 : pts.length);
  }

  // Yeni oyunda grup patikadan açıklığa yürür
  introWalk() {
    const pts = this.#pathOut('camp');
    const route = pts.slice(0, Math.min(pts.length, 22)).reverse();
    const fire = this.fireSpot();
    let arrived = 0;
    const list = this.survivors.present();
    list.forEach((s, k) => {
      const start = route[0];
      s.pos.set(start.x + (k - 1.5) * 0.6 + 2 + k * 0.4, start.z + k * 0.9 + 1.5);
      s.scripted = true;
      const end = { x: fire.x - 1.2 + k * 0.7, z: fire.y + 0.9 + (k % 2) * 0.6 };
      s.walkPoints([...route.slice(1).map((q) => ({ x: q.x + (k - 1.5) * 0.35, z: q.z + (k % 2) * 0.3 })), end], {
        onArrive: () => {
          s.scripted = false;
          s.mode = 'idle';
          s.heading = Math.atan2(-1, -1);
          if (++arrived === list.length) bus.emit('story', { type: 'arrived' });
        },
      });
    });
    this.rig.flyTo({ x: 1.5, z: 3, ppu: this.stage.width < 600 ? 38 : 44 }, 4);
  }

  // Keşif: patikadan ormana yürür, bir süre sonra (oyun zamanı) geri döner
  sendAway(ids, seconds, scene, { into = 'camp', forever = false } = {}) {
    const pts = this.#pathOut(into);
    this.state.expeditions = this.state.expeditions ?? [];
    const exp = { ids, back: this.state.clock.total + seconds + 14, scene, into, forever };
    this.state.expeditions.push(exp);
    for (const id of ids) {
      const s = this.survivors.get(id);
      if (!s?.alive) continue;
      s.task = null;
      s.scripted = true;
      s.walkPoints(pts.map((q) => ({ x: q.x + (Math.random() - 0.5) * 0.4, z: q.z })), {
        run: into === 'deep',
        onArrive: () => {
          s.mode = 'away';
          s.data.mode = 'away';
          s.scripted = false;
        },
      });
    }
    bus.emit('survivors', this.survivorInfo());
  }

  #tickExpeditions() {
    const list = this.state.expeditions;
    if (!list?.length) return;
    for (const exp of [...list]) {
      if (exp.forever || this.state.clock.total < exp.back) continue;
      list.splice(list.indexOf(exp), 1);
      const pts = this.#pathOut(exp.into).reverse();
      const fire = this.fireSpot();
      let n = 0;
      const back = exp.ids.map((id) => this.survivors.get(id)).filter((s) => s?.alive);
      for (const s of back) {
        s.mode = 'walk';
        s.root.visible = true;
        s.pos.set(pts[0].x, pts[0].z);
        s.scripted = true;
        s.walkPoints([...pts.slice(1).map((q) => ({ x: q.x, z: q.z })), { x: fire.x, z: fire.y + 0.5 }], {
          onArrive: () => {
            s.scripted = false;
            s.mode = 'idle';
            if (++n === back.length && exp.scene) bus.emit('story', { type: 'returned', scene: exp.scene });
          },
        });
      }
      if (!back.length && exp.scene) bus.emit('story', { type: 'returned', scene: exp.scene });
    }
  }

  // Kuşatma: bir kişi ışığın dışında kalır, gölgeler sarar
  stageSiege(id) {
    const s = this.survivors.get(id);
    if (!s) return;
    const c = this.state.entities.find((e) => e.type === 'cabin');
    const v = c && this.views.get(c.id);
    const at = v ? { x: v.center.x - 1.2, y: v.center.z - 3.6 } : { x: -1, y: -5 };
    s.task = null;
    s.pos.set(at.x, at.y);
    s.mode = 'idle';
    s.scripted = true;
    this.siegeShades = [];
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.4;
      const sh = this.shades.spawnAt(at.x + Math.cos(a) * 2.2, at.y + Math.sin(a) * 2.2);
      sh.scripted = true;
      this.siegeShades.push(sh);
    }
    this.rig.flyTo({ x: at.x, z: at.y + 1, ppu: Math.max(this.rig.ppu, 50) }, 0.8);
  }

  resolveSiege(outcome) {
    const f = this.state.flags;
    f.siege = outcome;
    const fire = this.fireSpot();
    const def = this.survivors.get('defne');
    const clear = () => {
      for (const sh of this.siegeShades ?? []) if (this.shades.list.includes(sh)) this.shades.onDeath(sh);
      this.siegeShades = [];
    };
    f.siegeDeath = true;
    if (outcome === 'kaanDies') {
      this.killSurvivor('kaan', 'sacrifice');
      if (def) {
        def.pos.set(fire.x, fire.y);
        def.data.hp = Math.min(def.data.hp, 40);
      }
      for (const sh of this.siegeShades ?? []) sh.scripted = false;
      this.siegeShades = [];
    } else if (outcome === 'defneDies') {
      this.killSurvivor('defne', 'abandoned');
      for (const sh of this.siegeShades ?? []) sh.scripted = false;
      this.siegeShades = [];
    } else {
      const hero = this.survivors.get(outcome === 'kaanSaves' ? 'kaan' : 'ece');
      if (hero) hero.data.hp = Math.min(hero.data.hp, outcome === 'kaanSaves' ? 20 : 15);
      if (def) {
        def.pos.set(fire.x, fire.y);
        def.data.hp = Math.min(def.data.hp, 50);
      }
      clear();
    }
    f.siegeDeath = false;
    if (def) def.scripted = false;
    bus.emit('survivors', this.survivorInfo());
  }

  // --- hedefler ---------------------------------------------------------------------------------

  objectiveInfo() {
    const s = this.state;
    const fire = this.campfire();
    const count = (type, built = true) => s.entities.filter((e) => e.type === type && (!built || e.state === 'built')).length;
    const list = [
      { id: 'fire', text: 'Kamp ateşini yak', done: () => (fire?.fuel ?? 0) > 0 || s.flags.fireLit },
      { id: 'chop', text: 'Odun için 2 ağaç kes', done: () => s.stats.chopped >= 2, progress: () => [Math.min(2, s.stats.chopped), 2] },
      { id: 'torch', text: 'Geceye hazırlan: 2 meşale dik', done: () => count('torch') >= 2, progress: () => [Math.min(2, count('torch')), 2] },
      { id: 'night1', text: 'İlk geceyi atlat', done: () => s.stats.nights >= 1 },
      { id: 'cabin2', text: 'Kulübeyi onar', done: () => this.cabinLevel() >= 2 },
      { id: 'snare', text: 'Erzak için av tuzağı kur', done: () => count('snare') >= 1 },
      { id: 'radio', text: 'Telsiz direğini kur', done: () => count('radio') >= 1, hidden: () => !s.flags.radioFound },
      { id: 'hold', text: 'Yardım gelene kadar dayan', done: () => false },
    ];
    for (const o of list) {
      if (o.hidden?.()) continue;
      if (!o.done()) return { text: o.text, progress: o.progress?.() ?? null, id: o.id };
    }
    return null;
  }

  // --- üretim baloncukları ------------------------------------------------------------------------

  #readyToCollect(e) {
    const p = R.production(e);
    return !!p && R.stored(e, this.state.clock.total) >= Math.max(2, p.capacity * 0.25);
  }

  #refreshBubble(v) {
    const e = v.e;
    if (v.instanced) return;
    const p = R.production(e);
    const ready = p && e.state === 'built' && this.#readyToCollect(e);
    if (ready && !v.bubbleEl) {
      const el = document.createElement('button');
      el.className = `bubble bubble-${p.resource}`;
      el.setAttribute('aria-label', 'Topla');
      el.innerHTML = icon(p.resource);
      el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.collect(e.id);
      });
      v.bubbleEl = this.overlay.add(el, (out) => v.topPoint(out), { dy: -8, z: 15 });
    } else if (!ready && v.bubbleEl) {
      v.bubbleEl.remove();
      v.bubbleEl = null;
    }
  }

  #onScreen(p) {
    const s = this.rig.worldToScreen(p);
    return s.visible && s.x > -50 && s.x < this.stage.width + 50 && s.y > -50 && s.y < this.stage.height + 50;
  }

  // --- kare döngüsü ---------------------------------------------------------------------------

  update(dt, t) {
    this.time = t;
    this.uiTick = (this.uiTick + 1) % 10;
    const sim = this.paused || this.modals ? 0 : dt * (this.timeScale ?? 1);

    if (sim === 0) {
      // duraklatılmışken bile nefes alıp dururlar
      for (const s of this.survivors.list) if (s.alive && s.root.visible) s.rig.pose(dt, { t, scared: this.cycle.darkness > 0.5 });
      for (const sh of this.shades.list) sh.pose(dt, t, 0.15);
    }
    if (sim > 0) {
      const ev = this.cycle.advance(sim);
      if (ev.changed) this.#onPhase(ev);
      // ateş yakıtı
      const fire = this.campfire();
      if (fire && fire.fuel > 0) {
        const burn = this.cycle.darkness > 0.5 ? 1 : 0.12;
        fire.fuel = Math.max(0, fire.fuel - sim * burn);
        if (fire.fuel <= 0) {
          bus.emit('toast', { text: 'Ateş söndü!', icon: 'fire', tone: 'bad' });
          audio.play('extinguish');
        } else if (this.cycle.darkness > 0.5 && fire.fuel < 25 && !this.warned.fuel) {
          this.warned.fuel = true;
          bus.emit('toast', { text: 'Ateş sönmek üzere. Odun at!', icon: 'fire', tone: 'bad' });
        }
      }
      // gündüz iyileşme
      if (this.cycle.darkness < 0.3) {
        const shelters = this.state.entities.filter((e) => e.type === 'shelter' && e.state === 'built').map((e) => this.views.get(e.id));
        const ece = this.survivors.get('ece');
        for (const s of this.survivors.list) {
          if (!s.alive || s.mode === 'away' || s.data.hp >= 100) continue;
          let k = CONFIG.survival.healPerSecond;
          if (shelters.some((v) => v && Math.hypot(v.center.x - s.pos.x, v.center.z - s.pos.y) < 3)) k *= 2.6;
          if (ece?.alive && ece !== s && Math.hypot(ece.pos.x - s.pos.x, ece.pos.y - s.pos.y) < 3) k *= ece.def.skills.heal;
          s.data.hp = Math.min(100, s.data.hp + k * sim);
        }
      }
      this.#tickExpeditions();
      this.#assignTasks();
      this.survivors.update(sim, t);
      this.shades.update(sim, t);
    }

    // sürüklerken ekran kenarında kaydır
    if (this.drag && this.pointer) {
      const m = 64;
      const { x, y } = this.pointer;
      let dx = 0;
      let dy = 0;
      if (x < m) dx = -(m - x);
      else if (x > this.stage.width - m) dx = x - (this.stage.width - m);
      if (y < m + 40) dy = -(m + 40 - y);
      else if (y > this.stage.height - m) dy = y - (this.stage.height - m);
      if (dx || dy) {
        this.rig.nudge(dx * dt * 9, dy * dt * 9);
        this.#dragTo(x, y);
      }
    }

    for (const v of this.views.values()) {
      if (!v.instanced) v.update(dt, t);
      if (this.uiTick === 3) this.#refreshBubble(v);
      if (v.hpT > 0) {
        v.hpT -= dt;
        if (v.hpT <= 0) {
          v.hpEl?.remove();
          v.hpEl = null;
        }
      }
      if (v.progressEl && this.uiTick === 0) {
        const tk = this.state.tasks.find((x) => x.target === v.e.id && (x.kind === 'build' || x.kind === 'upgrade'));
        if (tk) v.progressBar.style.transform = `scaleX(${Math.max(0.03, Math.min(1, tk.progress / tk.need)).toFixed(3)})`;
      }
    }
    this.field.update(dt);
    if (this.place) this.place.view.update(dt, t);
    if (this.ring.visible) this.ring.material.opacity = 0.55 + 0.35 * Math.sin(t * 5);
    const gm = this.gridLines.material;
    gm.opacity += ((this.gridGoal ?? 0) - gm.opacity) * Math.min(1, dt * 10);
    if (!this.gridGoal && gm.opacity < 0.01) this.gridLines.visible = false;
    const dmg = this.stage.post.params.uDamage;
    dmg.value = Math.max(0, dmg.value - dt * 0.7);
    // korku: yakındaki gölgeler görüntüyü bozar
    const near = this.shades.nearest(this.rig.target.x, this.rig.target.z);
    const fear = near ? Math.max(0, 1 - near.d / 10) : 0;
    const fp = this.stage.post.params.uFear;
    fp.value += (fear - fp.value) * Math.min(1, dt * 2);
    audio.setFear(fp.value);

    if (this.uiTick === 5) bus.emit('clock', this.clockInfo());
    if (this.dirtyAt && performance.now() - this.dirtyAt > 1200) this.save();
    else if (performance.now() - this.lastSave > CONFIG.save.autosaveMs) this.save();
  }
}

export { byId };
