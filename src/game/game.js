// Oyun yöneticisi: varlıklar, seçim, yerleştirme, inşaat, üretim ve kayıt burada buluşur.
// Arayüz yalnızca bus olaylarını dinler ve Game'in eylem metotlarını çağırır.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus } from '../core/events.js';
import { writeSave } from '../core/storage.js';
import { formatDuration, formatNumber } from '../core/format.js';
import { getDef, levelStats } from '../buildings/index.js';
import { Grid } from '../engine/grid.js';
import { EntityView } from './entity-view.js';
import * as R from './rules.js';
import { questProgress } from './quests.js';
import { Villagers } from '../world/villagers.js';
import { audio } from '../audio/audio.js';
import { icon } from '../ui/icons.js';

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const RES_NAMES = { gold: 'altın', wood: 'kereste' };

function footprintTexture(kind) {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.beginPath();
  g.roundRect(5, 5, s - 10, s - 10, 18);
  if (kind === 'fill') {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.stroke();
  } else {
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Game {
  constructor({ stage, rig, terrain, fx, overlay, state }) {
    this.stage = stage;
    this.rig = rig;
    this.terrain = terrain;
    this.fx = fx;
    this.overlay = overlay;
    this.state = state;
    this.grid = new Grid(CONFIG.grid.size);
    this.views = new Map();
    this.selected = null;
    this.mode = 'idle';
    this.place = null;
    this.drag = null;
    this.pointer = null;
    this.time = 0;
    this.dirtyAt = 0;
    this.lastSave = performance.now();
    this.uiTick = 0;

    const mk = (kind) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: footprintTexture(kind), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      );
      m.position.y = 0.02;
      m.renderOrder = 2;
      m.visible = false;
      stage.scene.add(m);
      return m;
    };
    this.footprint = mk('fill');
    this.ring = mk('ring');

    for (const e of state.entities) this.#addView(e);
    this.terrain.syncGrass(this.grid);

    this.villagers = new Villagers(stage, this.grid, this.#villagerWorld());
    this.villagers.onHammer = (v) => this.#onHammer(v);
    this.syncVillagers();
    for (const e of state.entities) if (this.#constructing(e)) this.villagers.assign(e.id);

    this.#tickConstructions(Date.now(), true);
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => document.hidden && this.save());
  }

  // --- yardımcılar --------------------------------------------------------

  entity(id) {
    return this.state.entities.find((e) => e.id === id) ?? null;
  }

  #constructing(e) {
    return e.state === 'building' || e.state === 'upgrading';
  }

  #addView(e) {
    const def = getDef(e.type);
    this.grid.occupy(e.id, e.i, e.j, def.size, { solid: def.solid !== false, cost: def.pathCost });
    const v = new EntityView(this, e);
    this.views.set(e.id, v);
    if (this.#constructing(e)) this.#attachProgress(v);
    return v;
  }

  #removeView(id) {
    const v = this.views.get(id);
    if (!v) return;
    v.progressEl?.remove();
    v.bubbleEl?.remove();
    v.dispose();
    this.views.delete(id);
    this.grid.release(id);
  }

  markDirty() {
    this.dirtyAt = performance.now();
  }

  save() {
    this.state.savedAt = Date.now();
    writeSave(this.state);
    this.lastSave = performance.now();
    this.dirtyAt = 0;
  }

  emitAll() {
    bus.emit('resources', this.resourceInfo());
    bus.emit('builders', { busy: R.busyBuilders(this.state), total: CONFIG.builders });
    bus.emit('player', this.playerInfo());
    bus.emit('quest', questProgress(this.state));
    bus.emit('shop-badge', R.shopBadgeCount(this.state));
  }

  resourceInfo() {
    const s = this.state;
    return {
      gold: s.resources.gold,
      wood: s.resources.wood,
      goldCap: R.storageCap(s, 'gold'),
      woodCap: R.storageCap(s, 'wood'),
    };
  }

  playerInfo() {
    const p = this.state.player;
    return { level: p.level, xp: p.xp, need: R.xpForLevel(p.level) };
  }

  addResources(add, from) {
    const s = this.state;
    const got = {};
    for (const r of R.RESOURCES) {
      if (!add[r]) continue;
      const cap = R.storageCap(s, r);
      const before = s.resources[r];
      s.resources[r] = Math.min(cap, before + add[r]);
      got[r] = s.resources[r] - before;
      if (got[r] > 0 && from) bus.emit('fly', { res: r, amount: got[r], from });
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

  addXp(n) {
    if (!n) return;
    const p = this.state.player;
    p.xp += n;
    let leveled = false;
    while (p.xp >= R.xpForLevel(p.level)) {
      p.xp -= R.xpForLevel(p.level);
      p.level++;
      leveled = true;
    }
    bus.emit('player', this.playerInfo());
    if (leveled) {
      audio.play('levelup');
      bus.emit('levelup', p.level);
      const c = this.rig.target;
      this.fx.confetti(c.x, 2, c.z);
    }
  }

  checkQuest() {
    const qp = questProgress(this.state);
    bus.emit('quest', qp);
    bus.emit('shop-badge', R.shopBadgeCount(this.state));
    if (qp?.done && !this.state.quests.done) {
      this.state.quests.done = true;
      audio.play('quest');
      bus.emit('toast', { text: `Görev tamamlandı: ${qp.quest.title}`, icon: 'scroll', tone: 'good' });
      this.markDirty();
    }
  }

  claimQuest() {
    const qp = questProgress(this.state);
    if (!qp?.done) return;
    const center = this.screenCenterWorld();
    this.addResources(qp.quest.reward, center);
    this.addXp(qp.quest.reward.xp ?? 0);
    this.state.quests.index++;
    this.state.quests.done = false;
    audio.play('complete');
    this.checkQuest();
    this.save();
  }

  screenCenterWorld() {
    return this.rig.groundAt(this.stage.width / 2, this.stage.height / 2).clone();
  }

  syncVillagers() {
    const homes = [];
    for (const e of this.state.entities) {
      if (e.state === 'building') continue;
      const n = levelStats(getDef(e.type), e.level)?.villagers ?? 0;
      if (n) homes.push({ id: e.id, count: n });
    }
    this.villagers.sync(homes, CONFIG.builders);
  }

  #villagerWorld() {
    const grid = this.grid;
    return {
      doorOf: (id) => {
        const v = this.views.get(id);
        if (!v || !v.model.door) return null;
        const c = v.center;
        const door = v.model.door;
        const t = grid.tileAt(c.x + door.x, c.z + v.def.size / 2 + 0.5);
        if (!grid.walkable(t.i, t.j)) return null;
        return { i: t.i, j: t.j, point: { x: c.x + door.x, y: c.z + door.z } };
      },
      meetingSpot: (rng) => {
        const spots = this.state.entities.filter((e) => ['well', 'fountain', 'bench', 'palace', 'market'].includes(e.type) && e.state === 'built');
        if (!spots.length) return null;
        const e = rng.pick(spots);
        const v = this.views.get(e.id);
        const ring = this.#ringTiles(e).filter((t) => grid.walkable(t.i, t.j));
        if (!ring.length) return null;
        const t = rng.pick(ring);
        return { i: t.i, j: t.j, look: { x: v.center.x, y: v.center.z } };
      },
      workSpot: (id, vill) => {
        const e = this.entity(id);
        const v = this.views.get(id);
        if (!e || !v) return null;
        const ring = this.#ringTiles(e).filter((t) => grid.walkable(t.i, t.j));
        if (!ring.length) return null;
        const me = vill.tile();
        // Ön yüzleri (kameraya bakan) tercih et ki usta görünsün
        ring.sort((a, b) => {
          const fa = (a.j >= e.j + v.def.size || a.i >= e.i + v.def.size ? -3 : 0) + Math.hypot(a.i - me.i, a.j - me.j) * 0.1;
          const fb = (b.j >= e.j + v.def.size || b.i >= e.i + v.def.size ? -3 : 0) + Math.hypot(b.i - me.i, b.j - me.j) * 0.1;
          return fa - fb;
        });
        const taken = new Set();
        this.villagers.forEach((o) => o !== vill && o.job === id && taken.add(`${o.tile().i},${o.tile().j}`));
        const t = ring.find((r) => !taken.has(`${r.i},${r.j}`)) ?? ring[0];
        return { i: t.i, j: t.j, look: { x: v.center.x, y: v.center.z } };
      },
      centerOf: (id) => {
        const v = this.views.get(id);
        return v ? new THREE.Vector2(v.center.x, v.center.z) : null;
      },
      builderHome: () => {
        const p = this.state.entities.find((e) => e.type === 'palace');
        return p ? { i: p.i + 1, j: p.j + 4 } : { i: 16, j: 22 };
      },
      emote: (vill, text) => {
        const el = document.createElement('div');
        el.className = 'emote';
        el.textContent = text;
        const item = this.overlay.add(el, (out) => out.set(vill.pos.x, 0.62, vill.pos.y), { z: 5 });
        setTimeout(() => item.remove(), 1800);
      },
    };
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

  #onHammer(v) {
    const s = this.rig.worldToScreen(tmpV.set(v.pos.x, 0.3, v.pos.y));
    if (!s.visible) return;
    audio.play('hammer', { gap: 90, vol: 0.7 });
    if (Math.random() < 0.35) {
      this.fx.spawn({ x: v.pos.x + Math.sin(v.heading) * 0.18, y: 0.18, z: v.pos.y + Math.cos(v.heading) * 0.18, vy: 0.5, s0: 0.12, s1: 0.3, life: 0.5, a0: 0.6, color: 0xeadcc4, drag: 2 });
    }
  }

  // --- seçim ve dokunma -----------------------------------------------------

  pick(x, y) {
    const ray = this.rig.ray(x, y);
    let best = null;
    let bestD = Infinity;
    for (const v of this.views.values()) {
      const hit = ray.intersectBox(v.worldBox, tmpV);
      if (!hit) continue;
      // Yerdeki düz parçalar (yollar) arkada kalsın
      const d = hit.distanceTo(ray.origin) + (v.def.solid === false ? 0.6 : 0);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  select(id) {
    if (this.selected === id) return;
    const prev = this.views.get(this.selected);
    prev?.setSelected(false);
    this.selected = id;
    const v = this.views.get(id);
    if (v) {
      v.setSelected(true);
      v.pop(0.8);
      audio.play('select');
      this.#showRing(v);
    } else {
      this.ring.visible = false;
    }
    this.#updateTag();
    bus.emit('select', v ? v.e : null);
  }

  #showRing(v) {
    const s = v.def.size;
    this.ring.scale.set(s + 0.08, 1, s + 0.08);
    this.ring.position.set(v.center.x, 0.02, v.center.z);
    this.ring.material.color.set(0xffffff);
    this.ring.visible = v.def.size > 0;
  }

  #updateTag() {
    this.tag?.remove();
    this.tag = null;
    const v = this.views.get(this.selected);
    if (!v) return;
    const el = document.createElement('div');
    el.className = 'tag';
    const lvl = v.def.category === 'obstacle' || v.def.maxLevel <= 1 ? '' : `<span>Seviye ${v.e.level}</span>`;
    el.innerHTML = `<b>${v.def.name}</b>${lvl}`;
    this.tag = this.overlay.add(el, (out) => v.topPoint(out), { dy: v.constructing ? -62 : -26, z: 20 });
  }

  onHover(x, y) {
    if (x == null) return;
    const v = this.mode === 'idle' ? this.pick(x, y) : null;
    this.stage.canvas.style.cursor = v ? 'pointer' : this.mode === 'place' ? 'move' : '';
  }

  onTap(x, y) {
    audio.unlock();
    if (this.mode === 'place') {
      const g = this.rig.groundAt(x, y);
      const def = this.place.def;
      const fp = this.grid.clampFootprint(...Object.values(this.grid.footprintAt(g.x, g.z, def.size)), def.size);
      this.#setGhost(fp.i, fp.j);
      audio.play('tap');
      return;
    }
    const v = this.pick(x, y);
    if (!v) {
      this.select(null);
      return;
    }
    const e = v.e;
    if (e.state === 'built' && this.#readyToCollect(e)) {
      this.collect(e.id);
      return;
    }
    if (this.selected === e.id) {
      v.pop(0.6);
      audio.play('tap');
      return;
    }
    this.select(e.id);
  }

  onDragStart(x, y) {
    if (this.mode === 'place') {
      const g = this.rig.groundAt(x, y);
      const v = this.place.view;
      const s = this.place.def.size / 2 + 0.6;
      const hit = this.pick(x, y) === v || (Math.abs(g.x - v.center.x) < s && Math.abs(g.z - v.center.z) < s);
      if (!hit) return false;
      this.drag = { kind: 'ghost', off: { x: g.x - v.center.x, z: g.z - v.center.z } };
      this.pointer = { x, y };
      v.setLift(0.35);
      audio.play('lift');
      return true;
    }
    if (this.selected) {
      const v = this.views.get(this.selected);
      if (!v || v.def.category === 'obstacle') return false;
      if (this.pick(x, y) !== v) return false;
      const g = this.rig.groundAt(x, y);
      this.drag = { kind: 'move', off: { x: g.x - v.center.x, z: g.z - v.center.z }, from: { i: v.e.i, j: v.e.j } };
      this.pointer = { x, y };
      this.mode = 'move';
      v.setLift(0.35);
      this.terrain.showGrid(true);
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
    const v = d.kind === 'ghost' ? this.place.view : this.views.get(this.selected);
    if (!v) return;
    const size = v.def.size;
    let fp = this.grid.footprintAt(g.x - d.off.x, g.z - d.off.z, size);
    fp = this.grid.clampFootprint(fp.i, fp.j, size);
    if (fp.i === v.e.i && fp.j === v.e.j) return;
    if (d.kind === 'ghost') {
      this.#setGhost(fp.i, fp.j);
    } else {
      v.setTile(fp.i, fp.j);
      this.#updateFootprint(v, this.grid.canPlace(fp.i, fp.j, size, v.e.id));
    }
    audio.play('tap', { gap: 70, vol: 0.5 });
  }

  onDragEnd() {
    const d = this.drag;
    this.drag = null;
    this.pointer = null;
    if (!d) return;
    if (d.kind === 'ghost') {
      this.place.view.setLift(0.18);
      return;
    }
    const v = this.views.get(this.selected);
    this.mode = 'idle';
    this.terrain.showGrid(false);
    this.footprint.visible = false;
    if (!v) return;
    v.setLift(0);
    const ok = this.grid.canPlace(v.e.i, v.e.j, v.def.size, v.e.id);
    if (ok) {
      this.grid.release(v.e.id);
      this.grid.occupy(v.e.id, v.e.i, v.e.j, v.def.size, { solid: v.def.solid !== false, cost: v.def.pathCost });
      this.terrain.syncGrass(this.grid);
      this.villagers.regrid();
      v.pop(0.8);
      this.fx.dust(v.center.x, v.center.z, v.def.size * 0.45, 10 + v.def.size * 3);
      audio.play('drop');
      this.markDirty();
    } else {
      v.setTile(d.from.i, d.from.j);
      audio.play('error');
      bus.emit('toast', { text: 'Buraya sığmıyor', icon: 'move', tone: 'bad' });
    }
    this.#showRing(v);
    bus.emit('mode', 'idle');
  }

  onKey(k, e) {
    if (k === 'escape') {
      if (this.mode === 'place') this.cancelPlacement();
      else if (this.selected) this.select(null);
      else bus.emit('escape');
    } else if (k === 'enter' && this.mode === 'place') {
      this.confirmPlacement();
    } else if (k === '+' || k === '=') {
      this.rig.zoomAt(this.stage.width / 2, this.stage.height / 2, 1.25);
    } else if (k === '-' || k === '_') {
      this.rig.zoomAt(this.stage.width / 2, this.stage.height / 2, 0.8);
    } else if (k === 'b' && this.mode === 'idle' && !e.metaKey && !e.ctrlKey) {
      bus.emit('open-shop');
    }
  }

  #updateFootprint(v, ok) {
    const s = v.def.size;
    this.footprint.scale.set(s, 1, s);
    this.footprint.position.set(v.center.x, 0.02, v.center.z);
    this.footprint.material.color.set(ok ? 0x34c759 : 0xff3b30);
    this.footprint.material.opacity = ok ? 0.85 : 0.9;
  }

  // --- yerleştirme -------------------------------------------------------------

  startPlacement(id, near = null) {
    const def = getDef(id);
    const check = R.buildCheck(this.state, def);
    if (!check.ok) {
      this.#explain(check, def);
      return false;
    }
    this.cancelPlacement(true);
    this.select(null);
    const ghostE = { id: -1, type: id, i: 0, j: 0, level: 1, state: 'ghost', variant: Math.floor(Math.random() * 997) };
    const view = new EntityView(this, ghostE, { ghost: true });
    view.setLift(0.18);
    this.place = { def, view, valid: false };
    this.mode = 'place';
    this.terrain.showGrid(true);
    this.footprint.visible = true;
    const start = near ?? (() => {
      const g = this.screenCenterWorld();
      return this.grid.footprintAt(g.x, g.z, def.size);
    })();
    const spot = this.#nearestFree(start.i, start.j, def.size) ?? start;
    this.#setGhost(spot.i, spot.j);
    // Hayalet görünür değilse kamerayı ona kaydır
    const sc = this.rig.worldToScreen(view.center);
    if (sc.x < 40 || sc.x > this.stage.width - 40 || sc.y < 120 || sc.y > this.stage.height - 200) {
      this.rig.flyTo({ x: view.center.x, z: view.center.z }, 0.6);
    }
    view.pop(1);
    audio.play('lift');
    bus.emit('mode', 'place');
    return true;
  }

  #nearestFree(i0, j0, size) {
    for (let r = 0; r < CONFIG.grid.size; r++) {
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
    this.terrain.showGrid(false);
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
      p.view.pop(0.5);
      bus.emit('toast', { text: 'Bu alan dolu', icon: 'move', tone: 'bad' });
      return;
    }
    const def = p.def;
    const check = R.buildCheck(this.state, def);
    if (!check.ok) {
      this.#explain(check, def);
      this.cancelPlacement();
      return;
    }
    const lv = def.levels[0];
    this.spend(lv.cost);
    const now = Date.now();
    const { i, j } = p.view.e;
    const e = {
      id: this.state.nextId++,
      type: def.id,
      i,
      j,
      level: 1,
      state: lv.time > 0 ? 'building' : 'built',
      t0: now,
      t1: now + lv.time * 1000,
      variant: p.view.e.variant,
      lastCollect: now,
    };
    this.state.entities.push(e);
    this.cancelPlacement(true);
    const v = this.#addView(e);
    this.terrain.syncGrass(this.grid);
    this.villagers.regrid();
    v.pop(1.1);
    this.fx.dust(v.center.x, v.center.z, def.size * 0.45, 10 + def.size * 4);
    this.rig.shake = 0.05 + def.size * 0.02;
    audio.play('place');
    if (e.state === 'building') {
      this.villagers.assign(e.id);
      audio.play('build');
      bus.emit('builders', { busy: R.busyBuilders(this.state), total: CONFIG.builders });
    } else {
      this.#finishBuilt(e, v, true);
    }
    if (def.category === 'decor') this.state.stats.decor++;
    this.checkQuest();
    this.save();
    bus.emit('mode', 'idle');

    // Yollar gibi tekrarlı parçalarda hemen yanına bir tane daha öner
    if (def.repeat && R.buildCheck(this.state, def).ok) {
      const dir = this.lastRepeat && this.lastRepeat.id === def.id ? { di: i - this.lastRepeat.i, dj: j - this.lastRepeat.j } : { di: 1, dj: 0 };
      if (Math.abs(dir.di) + Math.abs(dir.dj) !== 1) {
        dir.di = 1;
        dir.dj = 0;
      }
      this.lastRepeat = { id: def.id, i, j };
      const ni = i + dir.di;
      const nj = j + dir.dj;
      if (this.grid.canPlace(ni, nj, def.size)) this.startPlacement(def.id, { i: ni, j: nj });
    } else {
      this.lastRepeat = null;
    }
  }

  #explain(check, def) {
    audio.play('error');
    const msg = {
      locked: check.next ? `${def.name} yükseltmesi için Saray ${check.need}. seviye olmalı` : `${def.name} için Saray ${check.need}. seviye olmalı`,
      limit: `En fazla ${check.limit} ${def.name.toLowerCase()} kurabilirsin — Sarayı yükselt`,
      builders: 'Tüm ustalar çalışıyor. Bir inşaatın bitmesini bekle',
      cost: check.missing ? `${Object.entries(check.missing).map(([r, n]) => `${formatNumber(n)} ${RES_NAMES[r]}`).join(' ve ')} eksik` : 'Yeterli kaynak yok',
      max: 'Zaten en yüksek seviyede',
      busy: 'Şu an çalışılıyor',
    }[check.reason] ?? 'Şu an yapılamıyor';
    bus.emit('toast', { text: msg, icon: check.reason === 'builders' ? 'builder' : check.reason === 'cost' ? 'gold' : 'lock', tone: 'bad' });
  }

  // --- inşaat --------------------------------------------------------------

  #attachProgress(v) {
    if (v.progressEl) return;
    const el = document.createElement('div');
    el.className = 'progress';
    el.innerHTML = `<div class="progress-bar"><i></i></div><span class="progress-time"></span>`;
    v.progressEl = this.overlay.add(el, (out) => v.topPoint(out), { dy: -8, z: 10 });
    v.progressBar = el.querySelector('i');
    v.progressTime = el.querySelector('.progress-time');
  }

  #tickConstructions(now, quiet = false) {
    for (const e of this.state.entities) {
      if (!this.#constructing(e)) continue;
      const v = this.views.get(e.id);
      if (now >= e.t1) {
        this.#complete(e, quiet);
      } else if (v?.progressEl && this.uiTick === 0) {
        const p = (now - e.t0) / Math.max(1, e.t1 - e.t0);
        v.progressBar.style.transform = `scaleX(${Math.max(0.02, Math.min(1, p)).toFixed(3)})`;
        v.progressTime.textContent = formatDuration((e.t1 - now) / 1000);
      }
    }
  }

  #complete(e, quiet) {
    const wasNew = e.state === 'building';
    if (!wasNew) e.level++;
    e.state = 'built';
    e.lastCollect = Date.now();
    delete e.t0;
    delete e.t1;
    const v = this.views.get(e.id);
    v.progressEl?.remove();
    v.progressEl = null;
    v.build();
    this.villagers.release(e.id);
    this.#finishBuilt(e, v, quiet);
    const def = getDef(e.type);
    this.addXp(levelStats(def, e.level).xp ?? 0);
    this.state.stats.built[e.type] = (this.state.stats.built[e.type] ?? 0) + 1;
    if (!quiet) {
      audio.play('complete');
      bus.emit('toast', { text: wasNew ? `${def.name} hazır!` : `${def.name} ${e.level}. seviyeye yükseldi`, icon: 'check', tone: 'good' });
    }
    if (this.selected === e.id) {
      this.#updateTag();
      bus.emit('select', e);
    }
    bus.emit('builders', { busy: R.busyBuilders(this.state), total: CONFIG.builders });
    bus.emit('resources', this.resourceInfo());
    this.checkQuest();
    this.markDirty();
  }

  #finishBuilt(e, v, quiet) {
    v.pop(1.2);
    if (!quiet || v.def.category !== 'decor') {
      const top = v.topPoint(tmpV2);
      this.fx.sparkle(top.x, top.y * 0.7, top.z, 14 + v.def.size * 6);
    }
    this.syncVillagers();
  }

  upgrade(id) {
    const e = this.entity(id);
    if (!e) return;
    const check = R.upgradeCheck(this.state, e);
    if (!check.ok) {
      this.#explain(check, getDef(e.type));
      return;
    }
    // Yükseltme sırasında üretim durur; birikeni önce topla
    if (R.stored(e, Date.now()) >= 1) this.collect(id, true);
    this.spend(check.next.cost);
    const now = Date.now();
    e.state = 'upgrading';
    e.t0 = now;
    e.t1 = now + check.next.time * 1000;
    const v = this.views.get(id);
    v.build();
    v.pop(0.9);
    this.#attachProgress(v);
    this.villagers.assign(id);
    audio.play('build');
    bus.emit('builders', { busy: R.busyBuilders(this.state), total: CONFIG.builders });
    bus.emit('select', e);
    this.checkQuest();
    this.save();
  }

  speedCost(e) {
    const left = Math.max(0, (e.t1 - Date.now()) / 1000);
    return { gold: Math.max(5, Math.ceil(left * 1.5)) };
  }

  finishNow(id) {
    const e = this.entity(id);
    if (!e || !this.#constructing(e)) return;
    const cost = this.speedCost(e);
    if (!this.spend(cost)) {
      this.#explain({ reason: 'cost', missing: R.missing(this.state, cost) }, getDef(e.type));
      return;
    }
    e.t1 = Date.now();
    this.#complete(e, false);
    this.save();
  }

  // --- üretim --------------------------------------------------------------

  #readyToCollect(e) {
    const p = R.production(e);
    if (!p) return false;
    return R.stored(e, Date.now()) >= Math.max(3, p.capacity * 0.08);
  }

  collect(id, silent = false) {
    const e = this.entity(id);
    if (!e) return;
    const p = R.production(e);
    if (!p) return;
    const now = Date.now();
    const amount = Math.floor(R.stored(e, now));
    if (amount < 1) return;
    const v = this.views.get(id);
    const room = R.storageCap(this.state, p.resource) - this.state.resources[p.resource];
    if (room <= 0) {
      if (!silent) {
        audio.play('error');
        bus.emit('toast', { text: `${RES_NAMES[p.resource][0].toUpperCase() + RES_NAMES[p.resource].slice(1)} deposu dolu — Saray ya da Ambar yükselt`, icon: p.resource, tone: 'bad' });
      }
      return;
    }
    const take = Math.min(amount, room);
    const left = R.stored(e, now) - take;
    e.lastCollect = now - (left / p.rate) * 60000;
    const top = v.topPoint(tmpV2).clone();
    this.addResources({ [p.resource]: take }, top);
    this.state.stats.collected[p.resource] += take;
    this.overlay.floater(`${icon(p.resource)}<b>+${formatNumber(take)}</b>`, top, { dy: -30 });
    v.pop(0.7);
    audio.play(p.resource === 'gold' ? 'coin' : 'wood');
    this.#refreshBubble(v, now);
    this.checkQuest();
  }

  #refreshBubble(v, now) {
    const e = v.e;
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
        audio.unlock();
        this.collect(e.id);
      });
      v.bubbleEl = this.overlay.add(el, (out) => v.topPoint(out), { dy: -10, z: 15 });
    } else if (!ready && v.bubbleEl) {
      v.bubbleEl.remove();
      v.bubbleEl = null;
    }
    if (v.bubbleEl) {
      const full = R.stored(e, now) >= p.capacity - 0.01;
      v.bubbleEl.el.classList.toggle('full', full);
      v.bubbleEl.el.classList.toggle('muted', this.selected === e.id || this.mode !== 'idle');
    }
  }

  // --- temizleme ve kaldırma ---------------------------------------------------

  clearObstacle(id) {
    const e = this.entity(id);
    if (!e) return;
    const def = getDef(e.type);
    if (!def.clear) return;
    if (!this.spend(def.clear.cost)) {
      this.#explain({ reason: 'cost', missing: R.missing(this.state, def.clear.cost) }, def);
      return;
    }
    const v = this.views.get(id);
    const top = v.topPoint(tmpV2).clone();
    const reward = {};
    for (const [r, [a, b]] of Object.entries(def.clear.reward)) reward[r] = Math.round(a + Math.random() * (b - a));
    this.select(null);
    const isRock = e.type === 'boulder';
    if (isRock) {
      this.fx.dust(v.center.x, v.center.z, def.size * 0.5, 24);
      audio.play('poof');
    } else {
      this.fx.leaves(v.center.x, 0.6, v.center.z, 26);
      audio.play('leaves');
    }
    this.state.entities = this.state.entities.filter((x) => x.id !== id);
    this.#removeView(id);
    this.terrain.syncGrass(this.grid);
    this.villagers.regrid();
    this.stage.markShadows();
    const got = this.addResources(reward, top);
    const parts = Object.entries(got).filter(([, n]) => n > 0).map(([r, n]) => `${icon(r)}<b>+${formatNumber(n)}</b>`);
    if (parts.length) this.overlay.floater(parts.join(' '), top, { dy: -20 });
    this.addXp(def.clear.xp ?? 0);
    this.state.stats.cleared++;
    this.checkQuest();
    this.save();
  }

  removeDecor(id) {
    const e = this.entity(id);
    if (!e) return;
    const def = getDef(e.type);
    if (def.category !== 'decor') return;
    const v = this.views.get(id);
    const refund = {};
    for (const [r, n] of Object.entries(def.levels[0].cost)) refund[r] = Math.floor(n / 2);
    this.select(null);
    this.fx.dust(v.center.x, v.center.z, def.size * 0.4, 12);
    audio.play('poof');
    const top = v.topPoint(tmpV2).clone();
    this.state.entities = this.state.entities.filter((x) => x.id !== id);
    this.#removeView(id);
    this.terrain.syncGrass(this.grid);
    this.villagers.regrid();
    this.syncVillagers();
    this.stage.markShadows();
    this.addResources(refund, top);
    this.save();
  }

  // Seçili varlık için eylem düğmeleri
  actionsFor(e) {
    if (!e) return [];
    const def = getDef(e.type);
    const out = [];
    if (def.category === 'obstacle') {
      const reward = Object.keys(def.clear.reward);
      out.push({ id: 'clear', icon: def.id === 'boulder' ? 'hammer' : 'axe', label: 'Temizle', cost: def.clear.cost, hint: reward.map((r) => icon(r)).join('') });
      return out;
    }
    out.push({ id: 'info', icon: 'info', label: 'Bilgi' });
    if (this.#constructing(e)) {
      out.push({ id: 'finish', icon: 'bolt', label: 'Hemen bitir', cost: this.speedCost(e), live: true });
      return out;
    }
    const p = R.production(e);
    if (p && R.stored(e, Date.now()) >= 1) out.push({ id: 'collect', icon: p.resource, label: 'Topla', tone: 'resource' });
    if (e.level < def.maxLevel) {
      const chk = R.upgradeCheck(this.state, e);
      out.push({ id: 'upgrade', icon: 'up', label: 'Yükselt', cost: def.levels[e.level].cost, tone: !chk.ok && chk.reason !== 'cost' ? 'locked' : 'primary' });
    }
    if (def.category === 'decor') out.push({ id: 'remove', icon: 'trash', label: 'Kaldır', tone: 'danger' });
    return out;
  }

  doAction(name, id) {
    audio.unlock();
    switch (name) {
      case 'upgrade': return this.upgrade(id);
      case 'finish': return this.finishNow(id);
      case 'collect': return this.collect(id);
      case 'clear': return this.clearObstacle(id);
      case 'remove': return this.removeDecor(id);
      default: return null;
    }
  }

  focusOn(type) {
    const e = this.state.entities.find((x) => x.type === type);
    if (!e) return false;
    const v = this.views.get(e.id);
    this.rig.flyTo({ x: v.center.x, z: v.center.z }, 0.8);
    this.select(e.id);
    return true;
  }

  // --- kare döngüsü -----------------------------------------------------------

  update(dt, t) {
    this.time = t;
    const now = Date.now();
    this.uiTick = (this.uiTick + 1) % 6;
    this.#tickConstructions(now);

    // Sürüklerken ekran kenarında kamerayı kaydır
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
      v.update(dt, t, now);
      if (this.uiTick === 3) this.#refreshBubble(v, now);
    }
    if (this.place) this.place.view.update(dt, t, now);
    if (this.selected && this.ring.visible) {
      const v = this.views.get(this.selected);
      if (v) this.ring.material.opacity = 0.65 + 0.35 * Math.sin(t * 5);
    }
    this.villagers.update(dt);

    if (this.dirtyAt && performance.now() - this.dirtyAt > 900) this.save();
    else if (performance.now() - this.lastSave > CONFIG.save.autosaveMs) this.save();
  }
}
