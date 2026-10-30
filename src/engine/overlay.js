// Dünyaya iliştirilmiş HTML katmanı: bina etiketleri, zamanlayıcılar, toplama baloncukları.
// HTML kullanmak metni her ekranda jilet gibi keskin tutar. Her öğe konumlandırma için
// bir sarmalayıcıya konur; böylece öğenin kendi CSS animasyonları serbestçe çalışır.

import * as THREE from 'three';

const v = new THREE.Vector3();
const s = { x: 0, y: 0, visible: true };

export class Overlay {
  constructor(root, rig) {
    this.root = root;
    this.rig = rig;
    this.items = new Set();
  }

  // world: Vector3 ya da (out: Vector3) => Vector3
  add(el, world, { dy = 0, z = 0 } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'ov';
    wrap.style.zIndex = String(z);
    wrap.appendChild(el);
    this.root.appendChild(wrap);
    const item = {
      el,
      wrap,
      world,
      dy,
      hidden: false,
      remove: () => {
        wrap.remove();
        this.items.delete(item);
      },
    };
    this.items.add(item);
    this.place(item);
    return item;
  }

  // Yukarı süzülüp kaybolan yazı (+25 gibi)
  floater(html, world, { cls = '', dy = 0 } = {}) {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.innerHTML = html;
    const item = this.add(el, world.clone(), { dy, z: 50 });
    el.addEventListener('animationend', () => item.remove(), { once: true });
    return item;
  }

  place(item) {
    const w = typeof item.world === 'function' ? item.world(v) : item.world;
    this.rig.worldToScreen(w, s);
    if (!s.visible) {
      if (!item.hidden) {
        item.wrap.style.visibility = 'hidden';
        item.hidden = true;
      }
      return;
    }
    if (item.hidden) {
      item.wrap.style.visibility = '';
      item.hidden = false;
    }
    item.wrap.style.transform = `translate3d(${s.x.toFixed(1)}px, ${(s.y + item.dy).toFixed(1)}px, 0)`;
  }

  update() {
    for (const item of this.items) this.place(item);
  }
}
