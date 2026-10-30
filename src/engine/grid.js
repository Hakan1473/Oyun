// Izgara: karo ↔ dünya dönüşümleri ve doluluk haritası.
// Karo (i, j) dünya üzerinde x∈[i, i+1], z∈[j, j+1] aralığını kaplar (merkez kaydırmalı).

export class Grid {
  constructor(size) {
    this.size = size;
    this.half = size / 2;
    this.cells = new Int32Array(size * size).fill(0); // 0 = boş, aksi halde varlık kimliği
    this.solid = new Uint8Array(size * size); // köylüler için yürünemez mi?
    this.cost = new Float32Array(size * size).fill(1); // yollarda daha ucuz
    this.version = 0;
  }

  inside(i, j) {
    return i >= 0 && j >= 0 && i < this.size && j < this.size;
  }

  idx(i, j) {
    return j * this.size + i;
  }

  at(i, j) {
    return this.inside(i, j) ? this.cells[this.idx(i, j)] : -1;
  }

  // Ayak izinin merkezini dünya koordinatına çevirir
  center(i, j, size, out = { x: 0, z: 0 }) {
    out.x = i + size / 2 - this.half;
    out.z = j + size / 2 - this.half;
    return out;
  }

  tileCenter(i, j) {
    return { x: i + 0.5 - this.half, z: j + 0.5 - this.half };
  }

  // Dünya noktasından, verilen boyuttaki ayak izinin en yakın sol-üst karosu
  footprintAt(x, z, size) {
    return {
      i: Math.round(x + this.half - size / 2),
      j: Math.round(z + this.half - size / 2),
    };
  }

  tileAt(x, z) {
    return { i: Math.floor(x + this.half), j: Math.floor(z + this.half) };
  }

  clampFootprint(i, j, size) {
    return {
      i: Math.max(0, Math.min(this.size - size, i)),
      j: Math.max(0, Math.min(this.size - size, j)),
    };
  }

  canPlace(i, j, size, ignoreId = 0) {
    if (i < 0 || j < 0 || i + size > this.size || j + size > this.size) return false;
    for (let y = j; y < j + size; y++) {
      for (let x = i; x < i + size; x++) {
        const v = this.cells[this.idx(x, y)];
        if (v !== 0 && v !== ignoreId) return false;
      }
    }
    return true;
  }

  occupy(id, i, j, size, { solid = true, cost = 1 } = {}) {
    for (let y = j; y < j + size; y++) {
      for (let x = i; x < i + size; x++) {
        if (!this.inside(x, y)) continue;
        const k = this.idx(x, y);
        this.cells[k] = id;
        this.solid[k] = solid ? 1 : 0;
        this.cost[k] = cost;
      }
    }
    this.version++;
  }

  release(id) {
    for (let k = 0; k < this.cells.length; k++) {
      if (this.cells[k] === id) {
        this.cells[k] = 0;
        this.solid[k] = 0;
        this.cost[k] = 1;
      }
    }
    this.version++;
  }

  walkable(i, j) {
    return this.inside(i, j) && !this.solid[this.idx(i, j)];
  }
}
