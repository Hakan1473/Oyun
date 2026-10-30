// Mağaza, bina bilgisi ve ayarlar sayfaları.

import { CONFIG } from '../config.js';
import { formatDuration, formatNumber } from '../core/format.js';
import { clearSave } from '../core/storage.js';
import { h, haptic } from './dom.js';
import { icon } from './icons.js';
import { Sheet } from './sheet.js';
import { costChips } from './hud.js';
import { audio } from '../audio/audio.js';
import { getDef, shopDefs, levelStats } from '../buildings/index.js';
import * as R from '../game/rules.js';

const TABS = [
  { id: 'village', label: 'Köy' },
  { id: 'resource', label: 'Kaynaklar' },
  { id: 'decor', label: 'Süsler' },
];
const RES_LABEL = { gold: 'Altın', wood: 'Kereste' };

export class Sheets {
  constructor(game, thumbs) {
    this.game = game;
    this.thumbs = thumbs;
    this.tab = 'village';
  }

  // --- mağaza --------------------------------------------------------------------

  shop(tab = null, highlight = null) {
    if (this.game.mode === 'place') this.game.cancelPlacement(true);
    this.game.select(null);
    if (tab) this.tab = tab;
    const sheet = new Sheet({ title: 'İnşa Et', subtitle: 'Köyüne yeni bir şey kat', className: 'shop' });
    const seg = h('div', { class: 'segmented', role: 'tablist' });
    const grid = h('div', { class: 'cards' });
    const render = () => {
      seg.replaceChildren(...TABS.map((t) => h('button', {
        class: `seg ${t.id === this.tab ? 'on' : ''}`,
        role: 'tab',
        'aria-selected': t.id === this.tab ? 'true' : 'false',
        onClick: () => {
          if (this.tab === t.id) return;
          this.tab = t.id;
          audio.play('tap');
          render();
        },
      }, t.label)));
      seg.style.setProperty('--i', TABS.findIndex((t) => t.id === this.tab));
      grid.replaceChildren(...shopDefs(this.tab).map((def, n) => this.#card(def, sheet, highlight, n)));
    };
    render();
    sheet.body.append(seg, grid);
    sheet.show();
    const hi = grid.querySelector('.card.hi');
    if (hi) setTimeout(() => hi.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 350);
  }

  #card(def, sheet, highlight, n) {
    const state = this.game.state;
    const chk = R.buildCheck(state, def);
    const lv = def.levels[0];
    const locked = chk.reason === 'locked';
    const img = h('img', { alt: '', src: this.thumbs.get(def.id, 1, 0), draggable: 'false' });
    const meta = [];
    if (lv.produces) meta.push(h('span', { class: 'meta', html: `${icon(lv.produces.resource)} ${lv.produces.rate}/dk` }));
    if (lv.villagers) meta.push(h('span', { class: 'meta', html: `${icon('people')} +${lv.villagers}` }));
    if (lv.time > 0) meta.push(h('span', { class: 'meta', html: `${icon('clock')} ${formatDuration(lv.time)}` }));
    const count = Number.isFinite(chk.limit) ? h('span', { class: 'count' }, `${chk.count}/${chk.limit}`) : null;
    const foot = locked
      ? h('div', { class: 'card-foot locked', html: `${icon('lock')} Saray ${chk.need}. seviye` })
      : h('div', { class: 'card-foot' }, ...(Object.keys(lv.cost).length ? costChips(lv.cost, state) : [h('span', { class: 'cost free' }, 'Ücretsiz')]));
    const card = h('button', {
      class: `card ${chk.ok ? '' : 'dim'} ${locked ? 'is-locked' : ''} ${highlight === def.id ? 'hi' : ''}`,
      style: { '--d': `${n * 28}ms` },
      onClick: () => {
        audio.unlock();
        if (!chk.ok) {
          this.game.startPlacement(def.id); // açıklayıcı bildirimi gösterir
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          return;
        }
        haptic(10);
        sheet.close(true);
        this.game.startPlacement(def.id);
      },
    },
    h('div', { class: 'card-art' }, img, count, h('span', { class: 'size' }, `${def.size}×${def.size}`)),
    h('div', { class: 'card-text' }, h('b', {}, def.name), h('p', {}, def.description), h('div', { class: 'metas' }, ...meta)),
    foot);
    return card;
  }

  // --- bina bilgisi ----------------------------------------------------------------

  info(id) {
    const e = this.game.entity(id);
    if (!e) return;
    const def = getDef(e.type);
    const cur = levelStats(def, e.level);
    const next = e.level < def.maxLevel ? def.levels[e.level] : null;
    const sheet = new Sheet({ title: def.name, subtitle: def.maxLevel > 1 ? `Seviye ${e.level} / ${def.maxLevel}` : def.category === 'decor' ? 'Süs' : '', className: 'info' });

    const rows = [];
    const row = (ic, label, now, then) => rows.push(h('div', { class: 'stat' },
      h('span', { class: 'stat-ico', html: icon(ic) }),
      h('span', { class: 'stat-label' }, label),
      h('b', {}, now),
      then != null && then !== now ? h('span', { class: 'stat-next' }, `→ ${then}`) : null,
    ));
    if (cur.produces) {
      const p = cur.produces;
      row(p.resource, `${RES_LABEL[p.resource]} üretimi`, `${p.rate}/dk`, next?.produces ? `${next.produces.rate}/dk` : null);
      row('box', 'Biriktirme', formatNumber(p.capacity), next?.produces ? formatNumber(next.produces.capacity) : null);
    }
    if (cur.villagers) row('people', 'Köylü', `${cur.villagers}`, next?.villagers ? `${next.villagers}` : null);
    if (cur.storage) {
      row('gold', 'Altın deposu', `+${formatNumber(cur.storage.gold)}`, next?.storage ? `+${formatNumber(next.storage.gold)}` : null);
      row('wood', 'Kereste deposu', `+${formatNumber(cur.storage.wood)}`, next?.storage ? `+${formatNumber(next.storage.wood)}` : null);
    }
    if (e.type === 'palace') {
      row('hammer', 'Açılan yapılar', unlocksAt(e.level), next ? unlocksAt(e.level + 1) : null);
    }

    const art = h('div', { class: 'info-art' }, h('img', { alt: '', src: this.thumbs.get(def.id, e.level, e.variant ?? 0) }));
    sheet.body.append(
      h('div', { class: 'info-top' }, art, h('p', { class: 'info-desc' }, def.description)),
      rows.length ? h('div', { class: 'stats' }, ...rows) : null,
    );

    if (next) {
      const chk = R.upgradeCheck(this.game.state, e);
      const busy = e.state !== 'built';
      const why = busy ? 'İnşaat sürüyor' : chk.reason === 'locked' ? `Saray ${chk.need}. seviye gerekli` : chk.reason === 'builders' ? 'Boş usta yok' : '';
      const btn = h('button', {
        class: 'cta',
        disabled: busy || (!chk.ok && chk.reason !== 'cost'),
        onClick: () => {
          haptic(14);
          this.game.upgrade(id);
          if (this.game.entity(id)?.state === 'upgrading') sheet.close();
        },
      },
      h('span', { class: 'cta-label', html: `${icon('up')}<span><b>Yükselt</b><small>${e.level + 1}. seviyeye</small></span>` }),
      h('span', { class: 'cta-cost' }, ...costChips(next.cost, this.game.state), h('span', { class: 'cost time', html: `${icon('clock')}<b>${formatDuration(next.time)}</b>` })),
      );
      sheet.body.append(h('div', { class: 'cta-wrap' }, btn, why ? h('p', { class: 'cta-why' }, why) : null));
    } else if (def.maxLevel > 1) {
      sheet.body.append(h('p', { class: 'maxed', html: `${icon('xp')} En yüksek seviyede` }));
    }
    sheet.show();
  }

  // --- ayarlar ----------------------------------------------------------------------

  settings() {
    audio.unlock();
    this.game.select(null);
    const s = this.game.state;
    const sheet = new Sheet({ title: 'Yuva', subtitle: `Köy seviyesi ${s.player.level}`, className: 'settings' });
    const toggle = (label, ic, on, fn) => {
      const input = h('input', { type: 'checkbox', role: 'switch', checked: on });
      input.addEventListener('change', () => {
        fn(input.checked);
        audio.play('tap');
      });
      return h('label', { class: 'row' }, h('span', { class: 'row-ico', html: icon(ic) }), h('span', { class: 'row-label' }, label), h('span', { class: 'switch' }, input, h('i')));
    };
    const houses = s.entities.filter((e) => e.type === 'house' && e.state !== 'building').length;
    const built = s.entities.filter((e) => getDef(e.type).category !== 'obstacle').length;
    sheet.body.append(
      h('div', { class: 'summary' },
        h('div', {}, h('b', {}, formatNumber(R.villagerCount(s))), h('span', {}, 'Köylü')),
        h('div', {}, h('b', {}, formatNumber(houses)), h('span', {}, 'Ev')),
        h('div', {}, h('b', {}, formatNumber(built)), h('span', {}, 'Yapı')),
      ),
      h('div', { class: 'group' },
        toggle('Ses efektleri', 'sound', audio.sfxOn, (v) => audio.setSfx(v)),
        toggle('Müzik', 'music', audio.musicOn, (v) => audio.setMusic(v)),
      ),
      h('div', { class: 'group' },
        document.fullscreenEnabled ? h('button', { class: 'row', onClick: () => toggleFullscreen() }, h('span', { class: 'row-ico', html: icon('expand') }), h('span', { class: 'row-label' }, 'Tam ekran')) : null,
        h('button', {
          class: 'row danger',
          onClick: (ev) => {
            const b = ev.currentTarget;
            if (!b.classList.contains('confirm')) {
              b.classList.add('confirm');
              b.querySelector('.row-label').textContent = 'Emin misin? Tekrar dokun';
              audio.play('error');
              return;
            }
            clearSave();
            this.game.save = () => {};
            location.reload();
          },
        }, h('span', { class: 'row-ico', html: icon('reset') }), h('span', { class: 'row-label' }, 'Köyü baştan kur')),
      ),
      h('p', { class: 'fine' }, `Yuva ${CONFIG.version} · İlerlemen bu cihaza kaydedilir.`),
      h('p', { class: 'fine keys' }, 'Bilgisayarda: sürükle ya da WASD ile gez · tekerlek ile yakınlaş · B ile inşa · Esc ile vazgeç'),
    );
    sheet.show();
  }
}

function unlocksAt(level) {
  const names = shopDefs().filter((d) => (d.levels[0].requires?.palace ?? 0) === level && d.id !== 'palace').map((d) => d.name);
  return names.length ? names.join(', ') : '—';
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch {
    /* desteklenmiyor */
  }
}
