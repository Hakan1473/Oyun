// Işık kaynakları: ateşler, meşaleler, fenerler. Oyun mantığı (gölgeler ışıktan kaçar) tüm
// kaynakları kullanır; çizimde ise kameraya en yakın birkaç tanesi gerçek ışığa atanır.

import * as THREE from 'three';

let nextId = 1;
const tmp = new THREE.Vector3();

export class Lights {
  constructor(stage, post) {
    this.stage = stage;
    this.post = post;
    this.sources = new Map();
    this.t = 0;
  }

  // spec: { pos: Vector3, color, radius, intensity, flicker, owner }
  add(spec) {
    const id = nextId++;
    const s = {
      id, pos: spec.pos.clone(), color: new THREE.Color(spec.color ?? 0xff9a50), radius: spec.radius ?? 4,
      intensity: spec.intensity ?? 2, flicker: spec.flicker ?? 0.2, scale: 1, on: true, owner: spec.owner ?? null,
      phase: Math.random() * 100, glow: spec.glow ?? 1,
    };
    this.sources.set(id, s);
    return s;
  }

  remove(s) {
    if (s) this.sources.delete(s.id);
  }

  // Bir noktadaki ışık kapsaması (0 karanlık, 1 tam aydınlık)
  coverage(x, z, darkness = 1) {
    let best = 0;
    for (const s of this.sources.values()) {
      if (!s.on || s.scale <= 0.01) continue;
      const r = s.radius * s.scale;
      const d = Math.hypot(s.pos.x - x, s.pos.z - z);
      if (d > r) continue;
      const k = 1 - Math.max(0, (d - r * 0.55) / (r * 0.45));
      if (k > best) best = k;
    }
    return darkness < 0.2 ? 1 : best;
  }

  nearest(x, z, filter) {
    let best = null;
    let bd = Infinity;
    for (const s of this.sources.values()) {
      if (!s.on || (filter && !filter(s))) continue;
      const d = Math.hypot(s.pos.x - x, s.pos.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best ? { source: best, d: bd } : null;
  }

  update(dt, focus, darkness) {
    this.t += dt;
    const list = [...this.sources.values()].filter((s) => s.on && s.scale > 0.01);
    for (const s of list) {
      const f = s.flicker;
      const n = Math.sin(this.t * 13.1 + s.phase) * 0.5 + Math.sin(this.t * 23.7 + s.phase * 1.7) * 0.3 + Math.sin(this.t * 5.3 + s.phase * 0.3) * 0.2;
      s.live = s.intensity * s.scale * (1 - f * 0.5 + f * 0.5 * n);
      s.d2 = tmp.copy(s.pos).sub(focus).setY(0).lengthSq();
    }
    list.sort((a, b) => a.d2 - b.d2);
    const vis = 0.35 + darkness * 0.65;
    this.stage.points.forEach((l, i) => {
      const s = list[i];
      if (!s) {
        l.intensity = 0;
        return;
      }
      l.position.copy(s.pos);
      l.color.copy(s.color);
      l.distance = s.radius * s.scale * 1.9;
      l.intensity = s.live * vis * 1.6;
    });
    const glows = list.slice(0, 6).map((s) => ({
      pos: s.pos, color: s.color, radius: Math.max(1, s.radius * s.scale * 0.55), strength: s.live * s.glow * (0.05 + darkness * 0.22),
    }));
    this.post.setGlows(glows);
  }
}
