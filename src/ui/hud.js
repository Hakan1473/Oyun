// Oyun üstü arayüz: kadro, saat ve yakıt, kaynaklar, hedef, inşa düğmesi,
// seçim eylemleri, yerleştirme onayı, bildirimler, sabah raporu, bölüm ve oyun sonu.

import { bus } from '../core/events.js';
import { formatCompact, formatNumber } from '../core/format.js';
import { h, tweenNumber, haptic } from './dom.js';
import { icon } from './icons.js';
import { audio } from '../audio/audio.js';
import { byId } from '../game/roster.js';

export const costChips = (cost, state, { compact = false } = {}) =>
  Object.entries(cost ?? {}).filter(([, n]) => n > 0).map(([r, n]) =>
    h('span', { class: `cost ${state && (state.resources[r] ?? 0) < n ? 'short' : ''}`, html: `${icon(r)}<b>${compact ? formatCompact(n) : formatNumber(n)}</b>` }));

const mmss = (s) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export class Hud {
  constructor(root, game, sheets, thumbs) {
    this.root = root;
    this.game = game;
    this.sheets = sheets;
    this.thumbs = thumbs;
    this.values = { wood: 0, food: 0 };
    this.#build();
    this.#wire();
  }

  #build() {
    // Kadro
    this.crew = h('div', { class: 'crew' });
    this.crewEls = new Map();
    for (const s of this.game.survivors.list) {
      const ring = h('div', { class: 'crew-ring', html: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21.5" class="track"/><circle cx="24" cy="24" r="21.5" class="fill"/></svg>' });
      const img = h('img', { alt: '', src: this.thumbs.portrait(s.def) });
      const badge = h('span', { class: 'crew-badge' });
      const el = h('button', {
        class: 'crew-m', style: { '--c': s.def.color }, 'aria-label': s.def.name,
        onClick: () => this.#crewTap(s.id),
      }, h('div', { class: 'crew-face' }, img, ring, badge), h('span', { class: 'crew-name' }, s.def.name));
      this.crewEls.set(s.id, { el, ring, badge });
      this.crew.appendChild(el);
    }
    this.settingsBtn = h('button', { class: 'icon-pill', 'aria-label': 'Ayarlar', html: icon('gear'), onClick: () => this.sheets.settings() });

    // Saat
    this.dayEl = h('b', {}, 'Gün 1');
    this.phaseIco = h('span', { class: 'clock-ico', html: icon('sun') });
    this.leftEl = h('span', { class: 'clock-left' }, '');
    this.arc = h('i');
    this.shadeEl = h('span', { class: 'clock-shades', html: `${icon('eye')}<b>0</b>` });
    this.fuelBar = h('i');
    this.fuelEl = h('div', { class: 'fuel', title: 'Ateşin yakıtı' }, h('span', { html: icon('fire') }), h('div', { class: 'fuel-bar' }, this.fuelBar));
    this.skipBtn = h('button', { class: 'skip', 'aria-label': 'Geceyi bekle', html: `${icon('skip')}<span>Geceyi bekle</span>`, onClick: () => { haptic(10); this.game.skipToNight(); } });
    this.clock = h('div', { class: 'glass clock' },
      h('div', { class: 'clock-row' }, this.phaseIco, this.dayEl, this.leftEl, this.shadeEl),
      h('div', { class: 'clock-arc' }, this.arc),
      this.fuelEl,
    );

    // Kaynaklar
    const res = (r, label) => {
      const num = h('b', { class: 'num' }, '0');
      const cap = h('small');
      const el = h('div', { class: `glass res res-${r}`, title: label }, h('span', { class: 'res-icon', html: icon(r) }), h('div', { class: 'res-body' }, num, cap));
      return { el, num, cap, icon: el.querySelector('.res-icon') };
    };
    this.res = { wood: res('wood', 'Odun'), food: res('food', 'Erzak') };

    this.top = h('div', { class: 'hud-top' },
      h('div', { class: 'hud-col left' }, this.crew),
      h('div', { class: 'hud-col center' }, this.clock, this.skipBtn),
      h('div', { class: 'hud-col right' }, this.res.wood.el, this.res.food.el, this.settingsBtn),
    );

    // Hedef ve inşa
    this.objText = h('span', { class: 'obj-text' });
    this.objProg = h('small', { class: 'obj-prog' });
    this.objective = h('div', { class: 'glass objective' }, h('span', { class: 'obj-label' }, 'Hedef'), this.objText, this.objProg);
    this.buildBtn = h('button', { class: 'build-btn', 'aria-label': 'İnşa et', onClick: () => { audio.unlock(); this.sheets.shop(); } },
      h('span', { class: 'build-ico', html: icon('hammer') }), h('span', { class: 'build-label' }, 'İnşa'));
    this.actions = h('div', { class: 'actions' });
    this.placeName = h('b');
    this.placeCost = h('div', { class: 'place-cost' });
    this.placeHint = h('span', { class: 'place-hint' }, 'Taşımak için sürükle');
    this.okBtn = h('button', { class: 'round-btn ok', 'aria-label': 'Onayla', html: icon('check'), onClick: () => { haptic(12); this.game.confirmPlacement(); } });
    this.noBtn = h('button', { class: 'round-btn no', 'aria-label': 'Vazgeç', html: icon('close'), onClick: () => this.game.cancelPlacement() });
    this.placeBar = h('div', { class: 'placebar' },
      h('div', { class: 'glass place-info' }, this.placeName, this.placeCost, this.placeHint),
      h('div', { class: 'place-btns' }, this.noBtn, this.okBtn),
    );
    this.bottom = h('div', { class: 'hud-bottom' },
      h('div', { class: 'hud-col left' }, this.objective),
      h('div', { class: 'hud-col center' }, this.actions, this.placeBar),
      h('div', { class: 'hud-col right' }, this.buildBtn),
    );
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.root.append(this.top, this.bottom, this.toasts);
  }

  #crewTap(id) {
    audio.unlock();
    const g = this.game;
    const s = g.survivors.get(id);
    if (!s) return;
    if (!s.alive || s.mode === 'away' || s.mode === 'inside') {
      this.sheets.profile(id);
      return;
    }
    if (g.selected?.kind === 'survivor' && g.selected.id === id) {
      this.sheets.profile(id);
      return;
    }
    g.select({ kind: 'survivor', id });
    g.focusSurvivor(id);
  }

  #wire() {
    bus.on('resources', (r) => this.#resources(r));
    bus.on('survivors', (list) => this.#crew(list));
    bus.on('clock', (c) => this.#clock(c));
    bus.on('objective', (o) => this.#objective(o));
    bus.on('select', (info) => this.#select(info));
    bus.on('mode', (m) => {
      this.root.classList.toggle('placing', m === 'place');
      this.root.classList.toggle('moving', m === 'move');
    });
    bus.on('placement', ({ valid, def }) => {
      this.okBtn.disabled = !valid;
      this.placeName.textContent = def.name;
      this.placeCost.replaceChildren(...costChips(def.levels[0].cost, this.game.state));
      this.placeHint.textContent = valid ? 'Taşımak için sürükle' : 'Burası dolu';
      this.placeBar.classList.toggle('invalid', !valid);
    });
    bus.on('toast', (t) => this.toast(t));
    bus.on('fly', (f) => this.#fly(f));
    bus.on('morning', (m) => this.#morning(m));
    bus.on('chapter', (c) => this.#chapter(c));
    bus.on('gameover', (s) => this.#gameover(s));
  }

  show() {
    this.root.classList.add('ready');
  }

  hideFor(on) {
    this.root.classList.toggle('cinema', on);
  }

  #resources(r) {
    for (const k of ['wood', 'food']) {
      const o = this.res[k];
      tweenNumber(o.num, this.values[k], r[k], (n) => formatNumber(n));
      this.values[k] = r[k];
      o.cap.textContent = `/ ${formatCompact(r[`${k}Cap`])}`;
      o.el.classList.toggle('low', k === 'food' && r[k] < this.game.survivors.alive().length * 2);
    }
    this.#refreshActions();
  }

  #crew(list) {
    for (const s of list) {
      const o = this.crewEls.get(s.id);
      if (!o) continue;
      const k = Math.max(0, Math.min(1, s.hp / 100));
      o.ring.querySelector('.fill').style.strokeDashoffset = String(135.1 * (1 - k));
      o.el.classList.toggle('low', s.alive && s.hp < 35);
      o.el.classList.toggle('dead', !s.alive);
      o.el.classList.toggle('away', s.alive && s.mode === 'away');
      o.el.classList.toggle('sel', !!s.selected);
      o.badge.innerHTML = !s.alive ? icon('skull') : s.mode === 'away' ? icon('moon') : s.task === 'clear' ? icon('axe') : s.task ? icon('hammer') : '';
    }
  }

  #clock(c) {
    this.dayEl.textContent = `Gün ${c.day}`;
    const night = c.kind === 'night' || c.kind === 'dusk';
    this.phaseIco.innerHTML = icon(night ? 'moon' : 'sun');
    this.leftEl.textContent = c.kind === 'day' ? `gece ${mmss(c.left)}` : c.kind === 'night' ? `şafak ${mmss(c.left)}` : c.kind === 'dusk' ? 'karanlık çöküyor' : 'gün doğuyor';
    this.arc.style.transform = `scaleX(${Math.max(0.02, c.k).toFixed(3)})`;
    this.clock.classList.toggle('night', night);
    this.root.classList.toggle('is-night', night);
    this.shadeEl.classList.toggle('show', c.shades > 0);
    this.shadeEl.querySelector('b').textContent = c.shades;
    const fk = c.fuelMax ? c.fuel / c.fuelMax : 0;
    this.fuelBar.style.transform = `scaleX(${Math.max(0, Math.min(1, fk)).toFixed(3)})`;
    this.fuelEl.classList.toggle('low', fk < 0.2);
    this.fuelEl.classList.toggle('out', c.fuel <= 0);
    this.skipBtn.classList.toggle('show', c.kind === 'day' && c.left > 15);
  }

  #objective(o) {
    this.objective.classList.toggle('gone', !o);
    if (!o) return;
    if (this.objText.textContent && this.objText.textContent !== o.text) {
      this.objective.classList.remove('new');
      void this.objective.offsetWidth;
      this.objective.classList.add('new');
    }
    this.objText.textContent = o.text;
    this.objProg.textContent = o.progress ? `${o.progress[0]}/${o.progress[1]}` : '';
  }

  #select(info) {
    this.selInfo = info;
    this.root.classList.toggle('has-selection', !!info);
    this._sig = null;
    this.#refreshActions();
  }

  #refreshActions() {
    const info = this.selInfo ? this.game.selectedInfo() : null;
    if (!info) {
      this.actions.replaceChildren();
      return;
    }
    const list = this.game.actionsFor(info);
    const sig = JSON.stringify(list.map((a) => [a.id, a.cost, a.tone, a.label, a.hint]));
    if (sig === this._sig) return;
    this._sig = sig;
    this.actions.replaceChildren(...list.map((a) => {
      const extra = a.cost && Object.keys(a.cost).length
        ? h('div', { class: 'act-cost' }, ...costChips(a.cost, this.game.state, { compact: true }))
        : a.gain ? h('div', { class: 'act-cost' }, h('span', { class: 'cost gain', html: `<b>+</b>${a.gain.map((r) => icon(r)).join('')}` }))
          : a.hint ? h('div', { class: 'act-cost' }, h('span', { class: 'cost' }, a.hint)) : null;
      return h('button', {
        class: `act ${a.tone ?? ''}`,
        onClick: () => {
          haptic(8);
          if (a.id === 'info') this.sheets.info(info.id);
          else if (a.id === 'profile') this.sheets.profile(info.id);
          else this.game.order(a.id, info.id);
          this._sig = null;
          this.#refreshActions();
        },
      }, h('span', { class: 'act-circle', html: icon(a.icon) }), h('span', { class: 'act-label' }, a.label), extra);
    }));
  }

  update() {
    if (this.selInfo && Math.random() < 0.1) this.#refreshActions();
  }

  toast({ text, icon: ic = 'info', tone = '' }) {
    const el = h('div', { class: `toast ${tone}` }, h('span', { class: 'toast-ico', html: icon(ic) }), h('span', {}, text));
    this.toasts.prepend(el);
    while (this.toasts.childElementCount > 3) this.toasts.lastChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => el.remove(), 500);
    }, 3200);
  }

  #fly({ res, amount, from }) {
    const target = this.res[res]?.icon;
    if (!target) return;
    const s = this.game.rig.worldToScreen(from);
    const tr = target.getBoundingClientRect();
    const tx = tr.left + tr.width / 2;
    const ty = tr.top + tr.height / 2;
    const n = Math.min(7, 2 + Math.floor(Math.log2(amount + 1)));
    for (let k = 0; k < n; k++) {
      const el = h('div', { class: 'fly', html: icon(res) });
      document.body.appendChild(el);
      const sx = s.x + (Math.random() - 0.5) * 40;
      const sy = s.y + (Math.random() - 0.5) * 30;
      const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 140;
      const my = Math.min(sy, ty) - 40 - Math.random() * 70;
      const anim = el.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 24}px) scale(1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${mx}px, ${my}px) scale(0.95)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.6)`, opacity: 0.8 },
      ], { duration: 850 + k * 40, delay: k * 50, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
      anim.onfinish = () => {
        el.remove();
        const box = this.res[res].el;
        box.classList.remove('bump');
        void box.offsetWidth;
        box.classList.add('bump');
      };
    }
  }

  #modal(content, button, onClose) {
    const btn = h('button', { class: 'cta' }, button);
    const card = h('div', { class: 'modal-card' }, ...content, btn);
    const el = h('div', { class: 'modal' }, card);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    // pencere açıkken oyun ve hikâye bekler (sabah raporunun üstüne sahne açılmasın)
    this.game.modals = (this.game.modals ?? 0) + 1;
    btn.addEventListener('click', () => {
      audio.play('close');
      el.classList.remove('in');
      setTimeout(() => el.remove(), 500);
      this.game.modals = Math.max(0, this.game.modals - 1);
      onClose?.();
    }, { once: true });
    return el;
  }

  #morning(m) {
    if (m.day <= 1) return;
    const names = (ids) => ids.map((id) => byId(id)?.name ?? id).join(', ');
    const rows = [
      [icon('eye'), 'Dağıtılan gölge', String(m.shades)],
      [icon('shield'), 'Yapılara hasar', m.damage ? String(m.damage) : 'yok'],
      [icon('heart'), 'Yaralananlar', m.hurt.length ? names(m.hurt) : 'kimse'],
      [icon('skull'), 'Kayıplar', m.deaths.length ? names(m.deaths) : 'yok'],
      [icon('food'), 'Erzak', m.hungry ? `yetmedi — ${m.ate} yenildi` : `${m.ate} yenildi, ${m.food} kaldı`],
    ];
    this.#modal([
      h('small', { class: 'modal-eyebrow' }, 'Şafak söktü'),
      h('h2', {}, `Gün ${m.day}`),
      h('div', { class: 'report' }, ...rows.map(([ic, k, v]) => h('div', { class: `report-row ${k === 'Kayıplar' && m.deaths.length ? 'bad' : ''}` }, h('span', { html: ic }), h('span', {}, k), h('b', {}, v)))),
      m.hungry ? h('p', { class: 'modal-note' }, 'Açlık herkesi zayıflatıyor. Böğürtlen topla, av tuzağı kur.') : null,
    ].filter(Boolean), 'Güne başla');
  }

  #chapter(c) {
    audio.play('nightfall');
    this.#modal([
      h('small', { class: 'modal-eyebrow' }, `Bölüm ${c.n} sonu`),
      h('h2', { class: 'display' }, c.title),
      h('p', { class: 'modal-note' }, 'Telsizdeki ses patikadan gelmenizi istiyor. Bazılarınız gitmek istiyor, bazılarınız asla. Hikâye devam edecek.'),
    ], 'Ormanda kal');
  }

  #gameover(stats) {
    this.#modal([
      h('small', { class: 'modal-eyebrow' }, 'Orman sessizleşti'),
      h('h2', { class: 'display' }, 'Kimse kalmadı'),
      h('p', { class: 'modal-note' }, `${stats.nights} gece dayandınız, ${stats.chopped} ağaç kestiniz, ${stats.shades} gölgeyi dağıttınız.`),
    ], 'Yeniden başla', () => this.sheets.restart());
  }
}
