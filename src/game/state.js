// Yeni oyunun başlangıç durumu: ormanın ortasındaki açıklık, harabe kulübe, sönmüş ateş,
// açıklığı saran sık orman ve patikada kulübeye doğru yürüyen dört arkadaş.

import { CONFIG } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { getDef, levelStats } from '../buildings/index.js';
import { Grid } from '../engine/grid.js';
import { CABIN, CAMPFIRE, CLEARING, pathDistance } from '../world/layout.js';
import { ROSTER } from './roster.js';

export function createFreshState(now = Date.now()) {
  const state = {
    version: CONFIG.save.version,
    createdAt: now,
    savedAt: now,
    nextId: 1,
    clock: { day: 1, t: 10, total: 0 },
    resources: { wood: CONFIG.start.wood, food: CONFIG.start.food },
    survivors: ROSTER.map((r, k) => ({ id: r.id, hp: 100, alive: true, mode: 'idle', x: 9.5 + k * 0.7, z: 9.2 + k * 0.5 })),
    entities: [],
    tasks: [],
    flags: {},
    story: { seen: [], objective: 0 },
    stats: { chopped: 0, built: 0, nights: 0, shades: 0, deaths: [] },
    started: false,
  };
  const grid = new Grid(CONFIG.grid.size);
  const put = (type, i, j, extra = {}) => {
    const def = getDef(type);
    if (!grid.canPlace(i, j, def.size)) return null;
    const e = { id: state.nextId++, type, i, j, level: 1, state: 'built', variant: extra.variant ?? state.nextId % 97, ...extra };
    const lv = levelStats(def, 1);
    if (lv?.hp) e.hp = lv.hp;
    grid.occupy(e.id, i, j, def.size);
    state.entities.push(e);
    return e;
  };

  put('cabin', CABIN.i, CABIN.j, { variant: 1 });
  put('campfire', CAMPFIRE.i, CAMPFIRE.j, { fuel: 0 });

  const rng = mulberry32(19840);
  const N = CONFIG.grid.size;
  const free = (x, z, pad) => {
    if (Math.hypot(x - CLEARING.x, z - CLEARING.z) < CLEARING.r + pad) return true;
    const pd = pathDistance(x, z);
    return pd.d < pd.path.width / 2 + 0.7 + pad;
  };
  // Açıklıktaki birkaç çalı ve kaya
  for (const [type, i, j] of [['berrybush', 12, 15], ['berrybush', 21, 13], ['berrybush', 13, 21], ['boulder', 20, 22], ['boulder', 12, 12]]) {
    put(type, i, j, { variant: rng.int(0, 50) });
  }
  // 2×2 hücrelere ağaçlar
  for (let i = 0; i < N; i += 2) {
    for (let j = 0; j < N; j += 2) {
      const c = grid.center(i, j, 2);
      if (free(c.x, c.z, 0.2)) continue;
      const edge = Math.hypot(c.x - CLEARING.x, c.z - CLEARING.z) < CLEARING.r + 3;
      const r = rng();
      if (r < 0.06) {
        put(rng() < 0.6 ? 'berrybush' : 'boulder', i + rng.int(0, 1), j + rng.int(0, 1), { variant: rng.int(0, 50) });
        continue;
      }
      const tr = rng();
      const type = tr < (edge ? 0.45 : 0.6) ? 'spruce' : tr < 0.82 ? 'deadtree' : 'birch';
      put(type, i, j, {
        variant: rng.int(0, type === 'spruce' ? 2 : 1),
        ox: (rng() - 0.5) * 0.5, oz: (rng() - 0.5) * 0.5, rot: rng() * Math.PI * 2, sc: 0.82 + rng() * 0.3,
      });
    }
  }
  return state;
}
