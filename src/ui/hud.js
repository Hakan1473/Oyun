// Oyun üstü arayüz: kaynaklar, seviye, ustalar, görev kartı, mağaza düğmesi,
// seçim eylemleri, yerleştirme onayı, bildirimler.

import { bus } from '../core/events.js';
import { formatCompact, formatNumber } from '../core/format.js';
import { h, tweenNumber, haptic } from './dom.js';
import { icon } from './icons.js';
import { audio } from '../audio/audio.js';
import { getDef } from '../buildings/index.js';
import { canAfford } from '../game/rules.js';

const costChips = (cost, state, { compact = false } = {}) =>
  Object.entries(cost ?? {}).filter(([, n]) => n > 0).map(([r, n]) =>
    h('span', { class: `cost ${state && (state.resources[r] ?? 0) < n ? 'short' : ''}`, html: `${icon(r)}<b>${compact ? formatCompact(n) : formatNumber(n)}</b>` }));

export { costChips };

export class Hud {
  constructor(root, game, sheets) {
    this.root = root;
    this.game = game;
    this.sheets = sheets;
    this.values = { gold: 0, wood: 0 };
    this.#build();
    this.#wire();
  }

  #build() {
    const g = this.game;
    // Sol üst: seviye
    this.lvlNum = h('b', {}, '1');
    this.lvlRing = h('div', { class: 'lvl-ring', html: '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="track"/><circle cx="22" cy="22" r="19" class="fill"/></svg>' });
    this.xpText = h('span', {}, '0 / 40');
    this.profile = h('button', { class: 'glass chip profile', 'aria-label': 'Köyüm ve ayarlar', onClick: () => this.sheets.settings() },
      h('div', { class: 'lvl' }, this.lvlRing, this.lvlNum),
      h('div', { class: 'profile-text' }, h('b', {}, 'Yuva'), this.xpText),
    );

    // Orta üst: ustalar
    this.buildersText = h('b', {}, '0/2');
    this.builders = h('div', { class: 'glass chip builders', title: 'Ustalar' }, h('span', { html: icon('builder') }), this.buildersText);

    // Sağ üst: kaynaklar
    const res = (r) => {
      const num = h('b', { class: 'num' }, '0');
      const bar = h('i');
      const capText = h('small', {}, '');
      const el = h('div', { class: `glass res res-${r}`, dataset: { res: r } },
        h('div', { class: 'res-body' }, num, h('div', { class: 'res-cap' }, bar), capText),
        h('span', { class: 'res-icon', html: icon(r) }),
      );
      return { el, num, bar, capText, icon: el.querySelector('.res-icon') };
    };
    this.res = { gold: res('gold'), wood: res('wood') };

    this.top = h('div', { class: 'hud-top' },
      h('div', { class: 'hud-col left' }, this.profile),
      h('div', { class: 'hud-col center' }, this.builders),
      h('div', { class: 'hud-col right' }, this.res.gold.el, this.res.wood.el),
    );

    // Alt: görev kartı, mağaza
    this.questTitle = h('b', {}, '');
    this.questText = h('span', { class: 'q-text' }, '');
    this.questBar = h('i');
    this.questCount = h('small', {}, '');
    this.questClaim = h('span', { class: 'q-claim' }, 'Ödülü al');
    this.quest = h('button', { class: 'glass quest', onClick: () => this.#questTap() },
      h('span', { class: 'q-icon', html: icon('scroll') }),
      h('div', { class: 'q-body' }, this.questTitle, this.questText, h('div', { class: 'q-progress' }, h('div', { class: 'q-bar' }, this.questBar), this.questCount)),
      this.questClaim,
    );

    this.shopBadge = h('span', { class: 'badge' }, '');
    this.shopBtn = h('button', { class: 'shop-btn', 'aria-label': 'İnşa et', onClick: () => { audio.unlock(); this.sheets.shop(); } },
      h('span', { class: 'shop-ico', html: icon('hammer') }),
      h('span', { class: 'shop-label' }, 'İnşa Et'),
      this.shopBadge,
    );

    // Seçim eylemleri
    this.actions = h('div', { class: 'actions' });
    // Yerleştirme onayı
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
      h('div', { class: 'hud-col left' }, this.quest),
      h('div', { class: 'hud-col center' }, this.actions, this.placeBar),
      h('div', { class: 'hud-col right' }, this.shopBtn),
    );

    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.root.append(this.top, this.bottom, this.toasts);
  }

  #wire() {
    bus.on('resources', (r) => this.#resources(r));
    bus.on('builders', ({ busy, total }) => {
      this.buildersText.textContent = `${total - busy}/${total}`;
      this.builders.classList.toggle('none', total - busy <= 0);
    });
    bus.on('player', (p) => this.#player(p));
    bus.on('quest', (q) => this.#quest(q));
    bus.on('shop-badge', (n) => {
      this.shopBadge.textContent = n > 0 ? String(n) : '';
      this.shopBadge.classList.toggle('show', n > 0);
    });
    bus.on('select', (e) => this.#select(e));
    bus.on('mode', (m) => this.#mode(m));
    bus.on('placement', ({ valid, def }) => {
      this.okBtn.disabled = !valid;
      this.placeName.textContent = def.name;
      this.placeCost.replaceChildren(...costChips(def.levels[0].cost, this.game.state));
      this.placeHint.textContent = valid ? 'Taşımak için sürükle' : 'Burası dolu';
      this.placeBar.classList.toggle('invalid', !valid);
    });
    bus.on('toast', (t) => this.toast(t));
    bus.on('fly', (f) => this.#fly(f));
    bus.on('levelup', (lvl) => this.#levelUp(lvl));
  }

  show() {
    this.root.classList.add('ready');
  }

  #resources(r) {
    for (const k of ['gold', 'wood']) {
      const o = this.res[k];
      tweenNumber(o.num, this.values[k], r[k], (n) => formatNumber(n));
      this.values[k] = r[k];
      const cap = r[`${k}Cap`];
      o.bar.style.transform = `scaleX(${Math.min(1, r[k] / cap).toFixed(3)})`;
      o.capText.textContent = `en çok ${formatCompact(cap)}`;
      o.el.classList.toggle('full', r[k] >= cap);
    }
    this.#refreshActions();
  }

  #player(p) {
    this.lvlNum.textContent = p.level;
    const k = Math.min(1, p.xp / p.need);
    this.lvlRing.querySelector('.fill').style.strokeDashoffset = String(119.4 * (1 - k));
    this.xpText.textContent = `${formatNumber(p.xp)} / ${formatNumber(p.need)} deneyim`;
  }

  #quest(q) {
    this.questData = q;
    if (!q) {
      this.quest.classList.add('gone');
      return;
    }
    this.quest.classList.remove('gone');
    this.questTitle.textContent = q.quest.title;
    this.questText.textContent = q.quest.text;
    this.questBar.style.transform = `scaleX(${Math.min(1, q.value / q.target).toFixed(3)})`;
    this.questCount.textContent = `${q.value}/${q.target}`;
    this.quest.classList.toggle('done', q.done);
    // İlk görevde mağaza düğmesi nazikçe dikkat çeker
    this.shopBtn.classList.toggle('nudge', !q.done && !!q.quest.hint && q.value === 0 && this.game.state.quests.index < 2);
  }

  #questTap() {
    audio.unlock();
    const q = this.questData;
    if (!q) return;
    if (q.done) {
      haptic(15);
      this.game.claimQuest();
      return;
    }
    audio.play('tap');
    this.quest.classList.toggle('expanded');
    if (q.quest.hint && getDef(q.quest.hint)) this.sheets.shop(getDef(q.quest.hint).category, q.quest.hint);
  }

  #select(e) {
    this.selectedId = e?.id ?? null;
    this.root.classList.toggle('has-selection', !!e);
    this.#refreshActions();
  }

  #refreshActions() {
    const e = this.selectedId ? this.game.entity(this.selectedId) : null;
    if (!e) {
      this.actions.replaceChildren();
      return;
    }
    const list = this.game.actionsFor(e);
    const sig = JSON.stringify(list.map((a) => [a.id, a.cost, a.disabled, a.live ? 0 : 1])) + canAfford(this.game.state, {});
    if (sig === this._sig && this.actions.childElementCount) return;
    this._sig = sig;
    this.actions.replaceChildren(...list.map((a) => {
      const cost = a.cost && Object.keys(a.cost).length
        ? h('div', { class: 'act-cost' }, ...costChips(a.cost, this.game.state, { compact: true }))
        : a.hint ? h('div', { class: 'act-cost' }, h('span', { class: 'cost gain', html: `<b>+</b>${a.hint}` })) : null;
      const btn = h('button', {
        class: `act ${a.tone ?? ''}`,
        disabled: a.disabled,
        onClick: () => {
          haptic(8);
          if (a.id === 'info') this.sheets.info(e.id);
          else this.game.doAction(a.id, e.id);
        },
      },
      h('span', { class: 'act-circle', html: icon(a.icon) }),
      h('span', { class: 'act-label' }, a.label),
      cost);
      return btn;
    }));
  }

  #mode(m) {
    this.root.classList.toggle('placing', m === 'place');
    this.root.classList.toggle('moving', m === 'move');
  }

  update() {
    // "Hemen bitir" maliyeti saniye saniye değişir
    if (this.selectedId && this.actions.querySelector('.act')) {
      const e = this.game.entity(this.selectedId);
      if (e && (e.state === 'building' || e.state === 'upgrading')) {
        const cost = this.game.speedCost(e);
        const el = this.actions.querySelector('.act .act-cost b');
        if (el) el.textContent = formatCompact(cost.gold);
      } else if (e && this._wasBusy) {
        this._sig = null;
        this.#refreshActions();
      }
      this._wasBusy = e && (e.state === 'building' || e.state === 'upgrading');
    }
  }

  toast({ text, icon: ic = 'info', tone = '' }) {
    const el = h('div', { class: `toast glass ${tone}` }, h('span', { class: 'toast-ico', html: icon(ic) }), h('span', {}, text));
    this.toasts.prepend(el);
    while (this.toasts.childElementCount > 3) this.toasts.lastChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, 2600);
  }

  // Toplanan kaynak simgeleri HUD'daki sayaca uçar
  #fly({ res, amount, from }) {
    const target = this.res[res]?.icon;
    if (!target) return;
    const s = this.game.rig.worldToScreen(from);
    const tr = target.getBoundingClientRect();
    const tx = tr.left + tr.width / 2;
    const ty = tr.top + tr.height / 2;
    const n = Math.min(8, 2 + Math.floor(Math.log2(amount + 1)));
    for (let k = 0; k < n; k++) {
      const el = h('div', { class: 'fly', html: icon(res) });
      document.body.appendChild(el);
      const sx = s.x + (Math.random() - 0.5) * 40;
      const sy = s.y + (Math.random() - 0.5) * 30;
      const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 160;
      const my = Math.min(sy, ty) - 60 - Math.random() * 80;
      const anim = el.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 30}px) scale(1.1)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.7)`, opacity: 0.9 },
      ], { duration: 820 + k * 45, delay: k * 55, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
      anim.onfinish = () => {
        el.remove();
        const box = this.res[res].el;
        box.classList.remove('bump');
        void box.offsetWidth;
        box.classList.add('bump');
        if (k === n - 1) audio.play(res === 'gold' ? 'coin' : 'wood', { gap: 0, vol: 0.5 });
      };
    }
  }

  #levelUp(level) {
    const el = h('div', { class: 'levelup' },
      h('div', { class: 'levelup-card glass' },
        h('span', { class: 'levelup-star', html: icon('xp') }),
        h('small', {}, 'Yeni köy seviyesi'),
        h('b', {}, String(level)),
      ));
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 500);
    }, 2200);
  }
}
