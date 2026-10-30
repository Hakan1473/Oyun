// Dokunma, fare ve klavye tek yerden. Oyun mantığı yalnızca anlamlı olayları görür:
// dokunma (tap), sürükleme (bina taşıma) ve üzerine gelme (imleç).

const TAP_MOVE = 9; // px
const TAP_TIME = 420; // ms

export class Input {
  constructor(el, rig, handlers) {
    this.el = el;
    this.rig = rig;
    this.h = handlers;
    this.pointers = new Map();
    this.drag = null; // { captured, x0, y0 }
    this.multi = false;
    this.keys = new Set();
    this.enabled = true;

    el.addEventListener('pointerdown', this.#down);
    el.addEventListener('pointermove', this.#move);
    el.addEventListener('pointerup', this.#up);
    el.addEventListener('pointercancel', this.#up);
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && this.h.onHover?.(null));
    el.addEventListener('wheel', this.#wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.#keydown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    // iOS Safari'nin sayfa yakınlaştırma hareketini engelle
    for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault());
  }

  #pt(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #down = (e) => {
    if (!this.enabled) return;
    const p = this.#pt(e);
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* yoksay */
    }
    this.pointers.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t0: performance.now() });

    if (this.pointers.size === 2 && !(this.drag && this.drag.captured)) {
      this.multi = true;
      if (this.drag) this.rig.endPan();
      this.drag = null;
      const [a, b] = [...this.pointers.values()];
      this.rig.beginPinch((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y));
    } else if (this.pointers.size === 1) {
      this.multi = false;
      this.rig.vel.set(0, 0);
      this.rig.tween = null;
      this.h.onPress?.(p.x, p.y);
    }
  };

  #move = (e) => {
    const p = this.#pt(e);
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) {
      if (e.pointerType === 'mouse') this.h.onHover?.(p.x, p.y);
      return;
    }
    ptr.x = p.x;
    ptr.y = p.y;

    if (this.pointers.size >= 2 && this.multi) {
      const [a, b] = [...this.pointers.values()];
      this.rig.pinchMove((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y));
      return;
    }
    if (this.multi) return;

    if (!this.drag) {
      if (Math.hypot(p.x - ptr.x0, p.y - ptr.y0) < TAP_MOVE) return;
      const captured = !!this.h.onDragStart?.(ptr.x0, ptr.y0);
      this.drag = { captured };
      if (!captured) this.rig.beginPan(ptr.x0, ptr.y0);
    }
    if (this.drag.captured) this.h.onDrag?.(p.x, p.y);
    else this.rig.pan(p.x, p.y);
  };

  #up = (e) => {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    this.pointers.delete(e.pointerId);
    const p = this.#pt(e);

    if (this.multi) {
      if (this.pointers.size < 2) this.rig.endPinch();
      if (this.pointers.size === 1) {
        // Kalan parmakla kaydırmaya devam
        const [rest] = [...this.pointers.values()];
        this.rig.beginPan(rest.x, rest.y);
        this.drag = { captured: false };
        this.multi = false;
      }
      return;
    }

    if (this.drag) {
      if (this.drag.captured) this.h.onDragEnd?.(p.x, p.y);
      else this.rig.endPan();
      this.drag = null;
    } else if (e.type !== 'pointercancel' && performance.now() - ptr.t0 < TAP_TIME) {
      this.h.onTap?.(p.x, p.y, e);
    }
  };

  #wheel = (e) => {
    e.preventDefault();
    if (!this.enabled) return;
    const p = this.#pt(e);
    // Dokunmatik yüzeyde iki parmak kaydırma = kaydır; ctrl+tekerlek (sıkıştırma) = yakınlaştır
    if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > 0.5 && Math.abs(e.deltaY) < 50) {
      this.rig.nudge(e.deltaX, e.deltaY);
      return;
    }
    const scale = e.deltaMode === 1 ? 40 : 1;
    const k = e.ctrlKey ? 0.012 : 0.0016;
    this.rig.zoomAt(p.x, p.y, Math.exp(-e.deltaY * scale * k));
  };

  #keydown = (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    this.keys.add(k);
    this.h.onKey?.(k, e);
  };

  // Klavye ile kaydırma (her karede)
  update(dt) {
    if (!this.enabled || !this.keys.size) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
    if (dx || dy) this.rig.nudge(dx * 700 * dt, dy * 700 * dt);
  }
}
