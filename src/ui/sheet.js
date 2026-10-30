// Alt sayfa (bottom sheet): telefonda alttan kayar, geniş ekranda ortada kart olur.
// Aşağı sürükleyerek ya da arka plana dokunarak kapanır.

import { h } from './dom.js';
import { icon } from './icons.js';
import { audio } from '../audio/audio.js';

let open = null;

export class Sheet {
  constructor({ title, subtitle = '', className = '', onClose = null }) {
    this.onClose = onClose;
    this.backdrop = h('div', { class: 'sheet-backdrop', onClick: () => this.close() });
    this.titleEl = h('h2', { class: 'sheet-title' }, title);
    this.subEl = h('p', { class: 'sheet-sub' }, subtitle);
    this.body = h('div', { class: 'sheet-body' });
    this.closeBtn = h('button', { class: 'icon-btn sheet-close', 'aria-label': 'Kapat', html: icon('close'), onClick: () => this.close() });
    this.grabber = h('div', { class: 'sheet-grabber' });
    this.panel = h('section', { class: `sheet ${className}`, role: 'dialog', 'aria-modal': 'true' },
      this.grabber,
      h('header', { class: 'sheet-head' }, h('div', {}, this.titleEl, this.subEl), this.closeBtn),
      this.body,
    );
    this.root = h('div', { class: 'sheet-root' }, this.backdrop, this.panel);
    this.#dragToDismiss();
  }

  #dragToDismiss() {
    let y0 = null;
    let dy = 0;
    const start = (e) => {
      if (window.innerWidth >= 900) return;
      y0 = e.clientY;
      dy = 0;
      this.panel.style.transition = 'none';
      e.target.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      this.panel.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (y0 == null) return;
      y0 = null;
      this.panel.style.transition = '';
      this.panel.style.transform = '';
      if (dy > 110) this.close();
    };
    for (const el of [this.grabber, this.panel.querySelector('.sheet-head')]) {
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
  }

  show() {
    if (open && open !== this) open.close(true);
    open = this;
    document.getElementById('sheets').appendChild(this.root);
    // bir sonraki karede açılış animasyonu
    requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.add('open')));
    audio.play('open');
    this._key = (e) => e.key === 'Escape' && this.close();
    window.addEventListener('keydown', this._key);
    return this;
  }

  close(instant = false) {
    if (open === this) open = null;
    window.removeEventListener('keydown', this._key);
    this.root.classList.remove('open');
    if (!instant) audio.play('close');
    const done = () => this.root.remove();
    if (instant) done();
    else setTimeout(done, 380);
    this.onClose?.();
  }
}

export const isSheetOpen = () => !!open;
export const closeSheet = () => open?.close();
