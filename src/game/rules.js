// Oyun kuralları: maliyetler, sınırlar, depolar, üretim. Saf fonksiyonlar.

import { CONFIG } from '../config.js';
import { getDef, levelStats } from '../buildings/index.js';

export const RESOURCES = ['wood', 'food'];

export function cabinLevel(state) {
  const c = state.entities.find((e) => e.type === 'cabin');
  return c ? c.level : 0;
}

export function countOf(state, type) {
  return state.entities.reduce((n, e) => n + (e.type === type ? 1 : 0), 0);
}

export function storageCap(state, res) {
  let cap = CONFIG.baseStorage[res] ?? 0;
  for (const e of state.entities) {
    if (e.state === 'building') continue;
    const st = levelStats(getDef(e.type), e.level)?.storage;
    if (st?.[res]) cap += st[res];
  }
  return Math.max(cap, 20);
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

export function buildCheck(state, def, { night = false } = {}) {
  const cl = cabinLevel(state);
  const lv1 = def.levels[0];
  const need = lv1.requires?.cabin ?? 0;
  const limit = def.limit({ cabinLevel: cl, state, flags: state.flags });
  const count = countOf(state, def.id);
  if (need > cl) return { ok: false, reason: 'locked', need, count, limit };
  if (limit <= 0) return { ok: false, reason: 'locked', need: Math.max(need, cl + 1), count, limit };
  if (count >= limit) return { ok: false, reason: 'limit', count, limit };
  if (night && lv1.work > 0 && def.category !== 'defense') return { ok: false, reason: 'night', count, limit };
  if (!canAfford(state, lv1.cost)) return { ok: false, reason: 'cost', count, limit, missing: missing(state, lv1.cost) };
  return { ok: true, count, limit };
}

export function upgradeCheck(state, e) {
  const def = getDef(e.type);
  if (e.state !== 'built') return { ok: false, reason: 'busy' };
  if (e.level >= def.maxLevel) return { ok: false, reason: 'max' };
  const next = def.levels[e.level];
  const need = next.requires?.cabin ?? 0;
  if (e.type !== 'cabin' && need > cabinLevel(state)) return { ok: false, reason: 'locked', need, next };
  if (e.type !== 'cabin' && e.type !== 'campfire' && e.level >= cabinLevel(state)) return { ok: false, reason: 'locked', need: e.level + 1, next };
  if (!canAfford(state, next.cost)) return { ok: false, reason: 'cost', next, missing: missing(state, next.cost) };
  return { ok: true, next };
}

export function production(e) {
  return levelStats(getDef(e.type), e.level)?.produces ?? null;
}

// Üretim deposunda biriken (oyun zamanı ile; oyun kapalıyken orman beklemez)
export function stored(e, total) {
  if (e.state !== 'built') return 0;
  const p = production(e);
  if (!p) return 0;
  const t = Math.max(0, total - (e.lastCollect ?? total)) / 60;
  return Math.min(p.capacity, t * p.rate);
}
