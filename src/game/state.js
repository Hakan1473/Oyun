// Yeni köyün başlangıç durumu. Kayıt dosyası bu şekli taşır.

import { CONFIG } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { getDef } from '../buildings/index.js';
import { Grid } from '../engine/grid.js';

export function createFreshState(now = Date.now()) {
  const state = {
    version: CONFIG.save.version,
    createdAt: now,
    savedAt: now,
    nextId: 1,
    resources: { gold: CONFIG.start.gold, wood: CONFIG.start.wood },
    player: { xp: 0, level: 1 },
    quests: { index: 0, done: false },
    stats: { collected: { gold: 0, wood: 0 }, cleared: 0, decor: 0, built: {} },
    entities: [],
  };

  const grid = new Grid(CONFIG.grid.size);
  const put = (type, i, j, extra = {}) => {
    const def = getDef(type);
    if (!grid.canPlace(i, j, def.size)) return null;
    const e = {
      id: state.nextId++,
      type,
      i,
      j,
      level: 1,
      state: 'built',
      variant: extra.variant ?? (state.nextId * 37) % 997,
      lastCollect: now - 4 * 60000,
    };
    grid.occupy(e.id, i, j, def.size);
    state.entities.push(e);
    return e;
  };

  // Başlangıç köyü: bir ev, bir kuyu, taş yollar ve saray için boş bırakılmış meydan (14..17)
  put('house', 18, 19, { variant: 0 });
  put('well', 12, 19);
  for (const [i, j] of [[18, 21], [17, 21], [16, 21], [15, 21], [14, 21], [13, 21], [15, 20], [15, 19], [15, 18]]) put('path', i, j);
  put('flowerbed', 17, 19);
  put('flowerbed', 20, 21);
  put('lamp', 16, 20);
  put('bench', 14, 20);
  put('tree', 11, 17);
  put('tree', 20, 17);
  put('tree', 21, 18);

  // Doğal engeller: ortadaki meydanın dışına serpiştirilir
  const rng = mulberry32(20261030);
  const reserved = (i, j, s) => i + s > 9 && i < 23 && j + s > 10 && j < 24;
  const scatter = (type, count) => {
    const s = getDef(type).size;
    let n = 0;
    let guard = 0;
    while (n < count && guard++ < 500) {
      const i = rng.int(0, CONFIG.grid.size - s);
      const j = rng.int(0, CONFIG.grid.size - s);
      if (reserved(i, j, s)) continue;
      // Engeller arasında nefes alacak boşluk bırak
      if (!grid.canPlace(i - 1, j - 1, s + 2) && !(i === 0 || j === 0)) continue;
      if (put(type, i, j, { variant: rng.int(0, 999) })) n++;
    }
  };
  scatter('oak', 6);
  scatter('boulder', 3);
  scatter('pine', 10);
  scatter('shrub', 8);
  return state;
}
