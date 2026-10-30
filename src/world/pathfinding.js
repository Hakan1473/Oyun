// Izgara üzerinde A* (8 yön, köşe kesmeden). Taş yollar daha ucuz olduğu için köylüler onları seçer.

const SQ2 = Math.SQRT2;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2],
];

export function findPath(grid, si, sj, ti, tj, maxNodes = 4000) {
  const N = grid.size;
  if (!grid.inside(si, sj) || !grid.walkable(ti, tj)) return null;
  const start = sj * N + si;
  const goal = tj * N + ti;
  const g = new Float32Array(N * N).fill(Infinity);
  const came = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  const heap = [];
  const push = (k, f) => {
    heap.push([f, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top[1];
  };
  const h = (i, j) => {
    const dx = Math.abs(i - ti);
    const dy = Math.abs(j - tj);
    return (dx + dy + (SQ2 - 2) * Math.min(dx, dy)) * 0.35;
  };

  g[start] = 0;
  push(start, h(si, sj));
  let visited = 0;
  while (heap.length) {
    const k = pop();
    if (closed[k]) continue;
    if (k === goal) break;
    closed[k] = 1;
    if (++visited > maxNodes) return null;
    const ci = k % N;
    const cj = (k / N) | 0;
    for (const [dx, dy, len] of DIRS) {
      const ni = ci + dx;
      const nj = cj + dy;
      if (!grid.walkable(ni, nj)) continue;
      if (dx && dy && (!grid.walkable(ci + dx, cj) || !grid.walkable(ci, cj + dy))) continue;
      const nk = nj * N + ni;
      const cost = g[k] + len * grid.cost[nk];
      if (cost < g[nk]) {
        g[nk] = cost;
        came[nk] = k;
        push(nk, cost + h(ni, nj));
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const out = [];
  for (let k = goal; k !== -1; k = came[k]) {
    out.push({ i: k % N, j: (k / N) | 0 });
    if (k === start) break;
  }
  return out.reverse();
}
