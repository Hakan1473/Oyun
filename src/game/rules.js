// Oyun kuralları: maliyetler, sınırlar, üretim ve depolar. Saf fonksiyonlar — test etmesi kolay.

import { CONFIG } from '../config.js';
import { getDef, allDefs, levelStats } from '../buildings/index.js';

export const RESOURCES = ['gold', 'wood'];

export function palaceLevel(state) {
  const p = state.entities.find((e) => e.type === 'palace');
  if (!p) return 0;
  return p.state === 'building' ? 0 : p.state === 'upgrading' ? p.level : p.level;
}

export function countOf(state, type) {
  return state.entities.reduce((n, e) => n + (e.type === type ? 1 : 0), 0);
}

export function builtCount(state, type) {
  return state.entities.reduce((n, e) => n + (e.type === type && e.state !== 'building' ? 1 : 0), 0);
}

export function storageCap(state, res) {
  let cap = CONFIG.baseStorage[res] ?? 0;
  for (const e of state.entities) {
    if (e.state === 'building') continue;
    const def = getDef(e.type);
    const st = levelStats(def, e.level)?.storage;
    if (st?.[res]) cap += st[res];
  }
  return cap;
}

export function busyBuilders(state) {
  return state.entities.filter((e) => e.state === 'building' || e.state === 'upgrading').length;
}

export function freeBuilders(state) {
  return CONFIG.builders - busyBuilders(state);
}

export function canAfford(state, cost = {}) {
  return RESOURCES.every((r) => (state.resources[r] ?? 0) >= (cost[r] ?? 0));
}

export function missing(state, cost = {}) {
  const out = {};
  for (const r of RESOURCES) {
    const need = (cost[r] ?? 0) - (state.resources[r] ?? 0);
    if (need > 0) out[r] = need;
  }
  return out;
}

// Mağazada bir binanın durumu
export function buildCheck(state, def) {
  const pl = palaceLevel(state);
  const lv1 = def.levels[0];
  const need = lv1.requires?.palace ?? 0;
  const limit = def.limit({ palaceLevel: pl, state });
  const count = countOf(state, def.id);
  if (need > pl) return { ok: false, reason: 'locked', need, count, limit };
  if (limit <= 0) return { ok: false, reason: 'locked', need: Math.max(need, pl + 1), count, limit };
  if (count >= limit) return { ok: false, reason: 'limit', count, limit };
  if (lv1.time > 0 && freeBuilders(state) <= 0) return { ok: false, reason: 'builders', count, limit };
  if (!canAfford(state, lv1.cost)) return { ok: false, reason: 'cost', count, limit, missing: missing(state, lv1.cost) };
  return { ok: true, count, limit };
}

export function upgradeCheck(state, e) {
  const def = getDef(e.type);
  if (e.state !== 'built') return { ok: false, reason: 'busy' };
  if (e.level >= def.maxLevel) return { ok: false, reason: 'max' };
  const next = def.levels[e.level];
  const need = next.requires?.palace ?? 0;
  if (e.type !== 'palace' && need > palaceLevel(state)) return { ok: false, reason: 'locked', need, next };
  if (next.time > 0 && freeBuilders(state) <= 0) return { ok: false, reason: 'builders', next };
  if (!canAfford(state, next.cost)) return { ok: false, reason: 'cost', next, missing: missing(state, next.cost) };
  return { ok: true, next };
}

// Üretim deposunda biriken miktar (zaman damgasından hesaplanır; çevrimdışıyken de işler)
export function stored(e, now) {
  if (e.state !== 'built') return 0;
  const p = levelStats(getDef(e.type), e.level)?.produces;
  if (!p) return 0;
  const t = Math.max(0, now - (e.lastCollect ?? now)) / 60000;
  return Math.min(p.capacity, t * p.rate);
}

export function production(e) {
  return levelStats(getDef(e.type), e.level)?.produces ?? null;
}

export function xpForLevel(level) {
  // Seviye n'den n+1'e geçmek için gereken deneyim
  return Math.round(40 * Math.pow(level, 1.45));
}

export function villagerCount(state) {
  let n = 0;
  for (const e of state.entities) {
    if (e.state === 'building') continue;
    n += levelStats(getDef(e.type), e.level)?.villagers ?? 0;
  }
  return n;
}

export function shopBadgeCount(state) {
  return allDefs().filter((d) => d.shop && d.category !== 'decor' && buildCheck(state, d).ok).length;
}
