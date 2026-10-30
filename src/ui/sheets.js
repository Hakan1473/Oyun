// Sayfalar: inşa menüsü, yapı bilgisi, karakter profili, ayarlar.

import { CONFIG } from '../config.js';
import { formatNumber } from '../core/format.js';
import { clearSave, savePref } from '../core/storage.js';
import { h, haptic } from './dom.js';
import { icon } from './icons.js';
import { Sheet } from './sheet.js';
import { costChips } from './hud.js';
import { audio } from '../audio/audio.js';
import { getDef, shopDefs, levelStats } from '../buildings/index.js';
import * as R from '../game/rules.js';

const TABS = [
  { id: 'defense', label: 'Savunma' },
  { id: 'shelter', label: 'Barınak' },
  { id: 'survival', label: 'Hayatta kalma' },
];

export class Sheets {
  constructor(game, thumbs) {
    this.game = game;
    this.thumbs = thumbs;
    this.tab = 'defense';
  }

  shop(tab = null) {
    const g = this.game;
    if (g.paused) return;
    if (g.mode === 'place') g.cancelPlacement(true);
    g.select(null);
    if (tab) this.tab = tab;
    const sheet = new Sheet({ title: 'İnşa et', subtitle: g.cycle.darkness > 0.55 ? 'Gece yalnızca savunma kurulabilir' : 'Kimin elinde ne varsa', className: 'shop' });
    const seg = h('div', { class: 'segmented', role: 'tablist' });
    const grid = h('div', { class: 'cards' });
    const render = () => {
      seg.replaceChildren(...TABS.map((t) => h('button', {
        class: `seg ${t.id === this.tab ? 'on' : ''}`, role: 'tab',
        onClick: () => {
          if (this.tab === t.id) return;
          this.tab = t.id;
          audio.play('tap');
          render();
        },
      }, t.label)));
      seg.style.setProperty('--i', TABS.findIndex((t) => t.id === this.tab));
      grid.replaceChildren(...shopDefs(this.tab).map((def, n) => this.#card(def, sheet, n)));
    };
    render();
    sheet.body.append(seg, grid);
    sheet.show();
  }

  #card(def, sheet, n) {
    const g = this.game;
    const state = g.state;
    const chk = R.buildCheck(state, def, { night: g.cycle.darkness > 0.55 });
    const lv = def.levels[0];
    const locked = chk.reason === 'locked';
    const meta = [];
    if (lv.light) meta.push(h('span', { class: 'meta', html: `${icon('fire')} ${lv.light.radius} m ışık` }));
    if (lv.hp) meta.push(h('span', { class: 'meta', html: `${icon('shield')} ${lv.hp}` }));
    if (lv.produces) meta.push(h('span', { class: 'meta', html: `${icon(lv.produces.resource)} ${lv.produces.rate}/dk` }));
    if (lv.storage) meta.push(h('span', { class: 'meta', html: `${icon('wood')} +${lv.storage.wood}` }));
    if (lv.work) meta.push(h('span', { class: 'meta', html: `${icon('hammer')} ${lv.work} sn iş` }));
    const count = Number.isFinite(chk.limit) && chk.limit > 0 ? h('span', { class: 'count' }, `${chk.count}/${chk.limit}`) : null;
    const foot = locked
      ? h('div', { class: 'card-foot locked', html: `${icon('lock')} ${def.id === 'radio' ? 'Önce bir telsiz bulmalısın' : `Kulübe ${chk.need}. seviye`}` })
      : h('div', { class: 'card-foot' }, ...costChips(lv.cost, state));
    const card = h('button', {
      class: `card ${chk.ok ? '' : 'dim'} ${locked ? 'is-locked' : ''}`,
      style: { '--d': `${n * 30}ms` },
      onClick: () => {
        audio.unlock();
        if (!chk.ok) {
          g.startPlacement(def.id);
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          return;
        }
        haptic(10);
        sheet.close(true);
        g.startPlacement(def.id);
      },
    },
    h('div', { class: 'card-art' }, h('img', { alt: '', src: this.thumbs.get(def.id, 1, 0), draggable: 'false' }), count),
    h('div', { class: 'card-text' }, h('b', {}, def.name), h('p', {}, def.description), h('div', { class: 'metas' }, ...meta)),
    foot);
    return card;
  }

  info(id) {
    const g = this.game;
    const e = g.entity(id);
    if (!e) return;
    const def = getDef(e.type);
    const cur = levelStats(def, e.level);
    const next = e.level < def.maxLevel ? def.levels[e.level] : null;
    const sheet = new Sheet({ title: def.name, subtitle: cur.name ?? '', className: 'info' });
    const rows = [];
    const row = (ic, label, now, then) => rows.push(h('div', { class: 'stat' },
      h('span', { class: 'stat-ico', html: icon(ic) }), h('span', { class: 'stat-label' }, label), h('b', {}, now),
      then != null && then !== now ? h('span', { class: 'stat-next' }, `→ ${then}`) : null));
    if (cur.hp) row('shield', 'Dayanıklılık', `${Math.round(e.hp ?? cur.hp)} / ${cur.hp}`, next?.hp ? `${next.hp}` : null);
    if (cur.light) row('fire', 'Işık yarıçapı', `${cur.light.radius} m`, next?.light ? `${next.light.radius} m` : null);
    if (cur.fuelMax) row('clock', 'Yakıt', `${Math.round(e.fuel ?? 0)} / ${cur.fuelMax} sn`, next?.fuelMax ? `${next.fuelMax} sn` : null);
    if (cur.storage) {
      row('wood', 'Odun deposu', `+${formatNumber(cur.storage.wood ?? 0)}`, next?.storage ? `+${formatNumber(next.storage.wood)}` : null);
      if (cur.storage.food) row('food', 'Erzak deposu', `+${formatNumber(cur.storage.food)}`, next?.storage?.food ? `+${formatNumber(next.storage.food)}` : null);
    }
    if (cur.produces) row(cur.produces.resource, 'Üretim', `${cur.produces.rate}/dk`, null);
    if (cur.heal) row('heart', 'İyileştirme', `×${(1 + cur.heal).toFixed(1)}`, null);
    if (cur.trapDamage) row('trap', 'Hasar', `${cur.trapDamage}`, null);
    sheet.body.append(
      h('div', { class: 'info-top' }, h('div', { class: 'info-art' }, h('img', { alt: '', src: this.thumbs.get(def.id, e.level, e.variant ?? 0) })), h('p', { class: 'info-desc' }, def.description)),
      rows.length ? h('div', { class: 'stats' }, ...rows) : null,
    );
    if (next) {
      const chk = R.upgradeCheck(g.state, e);
      const why = e.state !== 'built' ? 'Üzerinde çalışılıyor' : chk.reason === 'locked' ? `Kulübe ${chk.need}. seviye olmalı` : '';
      const btn = h('button', {
        class: 'cta', disabled: e.state !== 'built' || (!chk.ok && chk.reason !== 'cost'),
        onClick: () => {
          haptic(14);
          g.upgrade(id);
          if (g.entity(id)?.state === 'upgrading') sheet.close();
        },
      }, h('span', { class: 'cta-label', html: `${icon('up')}<span><b>${def.id === 'cabin' ? 'Onar ve güçlendir' : 'Güçlendir'}</b><small>${next.name ?? `${e.level + 1}. seviye`}</small></span>` }),
      h('span', { class: 'cta-cost' }, ...costChips(next.cost, g.state), h('span', { class: 'cost time', html: `${icon('hammer')}<b>${next.work} sn</b>` })));
      sheet.body.append(h('div', { class: 'cta-wrap' }, btn, why ? h('p', { class: 'cta-why' }, why) : null));
    }
    sheet.show();
  }

  profile(id) {
    const g = this.game;
    const s = g.survivors.get(id);
    if (!s) return;
    const d = s.def;
    const status = !s.alive ? 'Öldü' : s.mode === 'away' ? 'Ormanda' : s.mode === 'inside' ? 'Kulübede saklanıyor' : s.task ? { clear: 'Ağaç kesiyor', harvest: 'Topluyor', build: 'İnşa ediyor', upgrade: 'Onarıyor', repair: 'Onarıyor', rearm: 'Kapan kuruyor' }[s.task.kind] : g.cycle.darkness > 0.45 ? 'Nöbette' : 'Boşta';
    const death = g.state.stats.deaths.find((x) => x.id === id);
    const sheet = new Sheet({ title: d.name, subtitle: d.role, className: 'profile' });
    const hp = Math.round(s.data.hp);
    sheet.body.append(
      h('div', { class: `profile-top ${s.alive ? '' : 'dead'}` },
        h('div', { class: 'profile-face', style: { '--c': d.color } }, h('img', { alt: '', src: this.thumbs.portrait(d) })),
        h('div', {},
          h('p', { class: 'info-desc' }, d.bio),
          h('p', { class: 'trait', html: `${icon('eye')} ${d.trait}` }),
        )),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', { class: 'stat-ico', html: icon('heart') }), h('span', { class: 'stat-label' }, 'Sağlık'),
          h('div', { class: `hp-line ${hp < 35 ? 'low' : ''}` }, h('i', { style: { transform: `scaleX(${hp / 100})` } })), h('b', {}, s.alive ? `${hp}` : '—')),
        h('div', { class: 'stat' }, h('span', { class: 'stat-ico', html: icon('person') }), h('span', { class: 'stat-label' }, 'Durum'), h('b', {}, death ? `Öldü · Gün ${death.day}` : status)),
      ),
      s.alive && s.mode !== 'away' ? h('p', { class: 'fine' }, `${d.name} seçiliyken bir ağaca ya da çalıya dokunursan işi o yapar.`) : null,
    );
    sheet.show();
  }

  settings() {
    audio.unlock();
    const g = this.game;
    g.select(null);
    const s = g.state;
    const sheet = new Sheet({ title: 'Kuytu', subtitle: `Gün ${s.clock.day} · ${g.survivors.alive().length} kişi hayatta`, className: 'settings' });
    const toggle = (label, ic, on, fn) => {
      const input = h('input', { type: 'checkbox', role: 'switch', checked: on });
      input.addEventListener('change', () => {
        fn(input.checked);
        audio.play('tap');
      });
      return h('label', { class: 'row' }, h('span', { class: 'row-ico', html: icon(ic) }), h('span', { class: 'row-label' }, label), h('span', { class: 'switch' }, input, h('i')));
    };
    const confirmRow = (label, ic, fn) => h('button', {
      class: 'row danger',
      onClick: (ev) => {
        const b = ev.currentTarget;
        if (!b.classList.contains('confirm')) {
          b.classList.add('confirm');
          b.querySelector('.row-label').textContent = 'Emin misin? Tüm ilerleme silinir';
          audio.play('error');
          return;
        }
        fn();
      },
    }, h('span', { class: 'row-ico', html: icon(ic) }), h('span', { class: 'row-label' }, label));
    sheet.body.append(
      h('div', { class: 'summary' },
        h('div', {}, h('b', {}, String(s.stats.nights)), h('span', {}, 'Gece')),
        h('div', {}, h('b', {}, String(s.stats.chopped)), h('span', {}, 'Ağaç')),
        h('div', {}, h('b', {}, String(s.stats.shades)), h('span', {}, 'Gölge')),
      ),
      h('div', { class: 'group' },
        toggle('Ses efektleri', 'sound', audio.sfxOn, (v) => audio.setSfx(v)),
        toggle('Müzik ve ortam', 'music', audio.musicOn, (v) => audio.setMusic(v)),
      ),
      this.#qualityPicker(),
      h('div', { class: 'group' },
        document.fullscreenEnabled ? h('button', { class: 'row', onClick: () => toggleFullscreen() }, h('span', { class: 'row-ico', html: icon('expand') }), h('span', { class: 'row-label' }, 'Tam ekran')) : null,
        confirmRow('Baştan başla', 'reset', () => this.restart()),
      ),
      h('p', { class: 'fine' }, `Kuytu ${CONFIG.version} · İlerleme bu cihaza kaydedilir.`),
      h('p', { class: 'fine keys' }, 'Bilgisayarda: sürükle ya da WASD ile gez · tekerlek ile yakınlaş · B ile inşa · Esc ile vazgeç · diyalogda Boşluk'),
    );
    sheet.show();
  }

  // Görüntü kalitesi: seçim cihaza kaydedilir, oyun kaldığı yerden yeniden yüklenir
  #qualityPicker() {
    const g = this.game;
    const opts = [['low', 'Akıcı'], ['medium', 'Dengeli'], ['high', 'En iyi']];
    const cur = g.stage.quality;
    const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Görüntü kalitesi' },
      ...opts.map(([id, label]) => h('button', {
        class: `seg ${id === cur ? 'on' : ''}`, role: 'radio', 'aria-checked': String(id === cur),
        onClick: () => {
          if (id === cur) return;
          audio.play('tap');
          g.save();
          savePref('quality', id);
          location.reload();
        },
      }, label)));
    seg.style.setProperty('--i', opts.findIndex(([id]) => id === cur));
    return h('div', { class: 'quality' }, h('p', { class: 'quality-label' }, 'Görüntü'), seg,
      h('p', { class: 'fine' }, 'Telefonda takılma olursa "Akıcı"yı seç. Güçlü cihazlarda "En iyi" en yumuşak görüntüyü verir.'));
  }

  restart() {
    clearSave();
    this.game.noSave = true;
    location.reload();
  }
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch {
    /* desteklenmiyor */
  }
}
