// Hikâye: Bölüm 1 — "Kuytu".
// Sahneler olaylarla tetiklenir (varış, akşam, gece, şafak, inşa, ölüm). Kararlar bayrak bırakır;
// bayraklar sonraki sahnelerin kimin için nasıl biteceğini belirler. Bazı kararlar geri alınamaz.
//
// Sahne biçimi:
//   { id, when(ev, s, g) → bool, delay?, pause?, steps: [ adım... ] }
// Adımlar:
//   { who, text }                  — konuşma (who: karakter kimliği ya da 'voice')
//   { narrate }                    — anlatıcı
//   { choice: { prompt, permanent, timer, fallback, options: [{ text, requires(s,g), effect(g, api) }] } }
//   { do: (g, api) => ... }        — sahne içi eylem
//   { if: (s, g) => bool, then: [adımlar], else: [adımlar] }

import { bus } from '../core/events.js';
import { byId } from './roster.js';

const alive = (g, id) => !!g.survivors.get(id)?.alive && g.survivors.get(id).mode !== 'away';

export const SCENES = [
  {
    id: 'prologue',
    when: (ev) => ev.type === 'newgame',
    steps: [
      { narrate: 'Kampın üçüncü gecesiydi.' },
      { narrate: 'Bora ateşi harlıyor, Mert her zamanki gibi saçma bir korku hikâyesi anlatıyordu.' },
      { narrate: 'Sonra Defne sustu. Ağaçların arasını gösterdi.' },
      { narrate: 'Orada biri duruyordu. Uzun. Çok uzun. Yüzü yoktu.' },
      { narrate: 'Koştuk. Sabaha kadar koştuk.' },
      { narrate: 'Bora\'yı kaybettik.' },
      { do: (g) => g.introWalk() },
    ],
    fade: true,
  },
  {
    id: 'arrival',
    when: (ev) => ev.type === 'arrived',
    steps: [
      { who: 'defne', text: 'Durun... şuraya bakın. Bir kulübe.' },
      { who: 'mert', text: 'Ormanın tam ortasında mı? Kim burada yaşar ki?' },
      { who: 'ece', text: 'Kimse. Çatısı çökmüş. Ama dört duvar, hiç yoktan iyidir.' },
      { who: 'kaan', text: 'Bora hâlâ orada bir yerde! Burada oturup kulübe mi seyredeceğiz?' },
      { who: 'ece', text: 'Kaan. Mert\'in bileği şişmiş. Bu hâlde kimse bir yere gidemez.' },
      { who: 'defne', text: 'O şeyler ateşe yaklaşmadı. Işığın başındayken yanımıza gelmediler. Gördüm.' },
      { who: 'mert', text: 'Yani... gece olmadan bir ateş yakmamız lazım. Ve bol bol odun.' },
      {
        choice: {
          prompt: 'Grup sana bakıyor. Ne yapacağız?',
          permanent: true,
          options: [
            {
              text: 'Kaan ve Defne patikayı kontrol etsin. Hava kararmadan dönün.',
              effect: (g) => {
                g.state.flags.searchedDay1 = true;
                g.sendAway(['kaan', 'defne'], 80, 'searchReturn');
              },
            },
            {
              text: 'Önce burayı güvenli hâle getiriyoruz. Bora\'yı yarın ararız.',
              effect: (g) => {
                g.state.flags.kaanResent = true;
              },
              then: [{ who: 'kaan', text: '...Peki. Ama yarın gidiyorum. Kimse beni durduramaz.' }],
            },
          ],
        },
      },
      { do: (g) => bus.emit('toast', { text: 'Önce ateşi yak: ateşe dokun', icon: 'fire' }) },
    ],
  },
  {
    id: 'searchReturn',
    when: (ev) => ev.type === 'returned' && ev.scene === 'searchReturn',
    steps: [
      { who: 'kaan', text: 'Kamp yerine kadar gittik. Çadırlar... paramparça olmuş.' },
      { who: 'defne', text: 'Bora\'nın çantasını bulduk. İçinde konserveler vardı.' },
      { do: (g) => g.addResources({ food: 8 }, g.fireWorld()) },
      { who: 'defne', text: 'Ağaçlara da bir şeyler kazınmıştı. Aynı işaret, tekrar tekrar.' },
      { who: 'kaan', text: 'Ayak izleri vardı. Çıplak ayak. Ama adımlar... insan adımı değildi. Çok uzundu.' },
    ],
  },
  {
    id: 'firstDusk',
    when: (ev) => ev.type === 'dusk' && ev.day === 1,
    steps: [
      { who: 'ece', text: 'Güneş batıyor. Herkes ateşin yanına.', if: (s, g) => alive(g, 'ece') },
      { who: 'mert', text: 'Odunumuz yeter mi? Ateş sönerse...', if: (s, g) => alive(g, 'mert') },
      { narrate: 'Ateşe dokunup "Besle" ile odun at. Bir gölgeye dokunursan fenerler ona çevrilir.' },
    ],
  },
  {
    id: 'firstNight',
    when: (ev) => ev.type === 'night' && ev.day === 1,
    delay: 6,
    steps: [
      { who: 'defne', text: 'Oradalar. Ağaçların arasında... Bir. İki. Üç.', if: (s, g) => alive(g, 'defne') },
      { who: 'kaan', text: 'Gelsinler. Bu sefer kaçmıyorum.', if: (s, g) => alive(g, 'kaan') },
    ],
  },
  {
    id: 'voice',
    when: (ev, s) => ev.type === 'day' && ev.day === 2,
    delay: 3,
    steps: [
      { if: (s) => s.stats.deaths.length > 0, then: [{ narrate: 'Sabah oldu. Ama hiçbirimiz aynı değildik artık.' }] },
      { who: 'kaan', text: 'Gece Bora\'nın sesini duydum. Adımı söylüyordu. Ormanın içinden.', if: (s, g) => alive(g, 'kaan') },
      { who: 'ece', text: 'Ben de duydum. Kaan... o Bora değildi.', if: (s, g) => alive(g, 'ece') },
      { who: 'mert', text: 'Bir şey, birinin sesini taklit ediyorsa... bu daha da kötü.', if: (s, g) => alive(g, 'mert') },
      {
        if: (s, g) => alive(g, 'kaan'),
        then: [{
          choice: {
            prompt: 'Bu gece o ses yine çağıracak.',
            permanent: true,
            options: [
              {
                text: 'Kimse sese gitmeyecek. Işığın dışına tek adım yok.',
                effect: (g) => {
                  g.state.flags.ruleLight = true;
                  if (g.state.flags.kaanResent) g.state.flags.kaanAngry = true;
                },
                then: [{ if: (s) => s.flags.kaanResent, then: [{ who: 'kaan', text: 'Yine sen karar verdin. Bunu unutmayacağım.' }], else: [{ who: 'kaan', text: 'Tamam. Ama sesi bir daha duyarsam...' }] }],
              },
              {
                text: 'Bu gece sesi takip edeceğiz. Kaan, feneri al.',
                effect: (g) => {
                  g.state.flags.followVoice = true;
                },
                then: [{ who: 'ece', text: 'Bu bir hata. Hepinizin bildiği bir hata.' }],
              },
            ],
          },
        }],
      },
    ],
  },
  {
    id: 'radioFound',
    when: (ev, s) => (ev.type === 'upgraded' && ev.id === 'cabin') || (ev.type === 'tick' && s.clock.day >= 2 && s.clock.t > 70),
    steps: [
      { who: 'mert', text: 'Kulübenin dolabında bir şey buldum. Eski bir telsiz! Pili paslanmış ama...', if: (s, g) => alive(g, 'mert') },
      { narrate: 'Kulübenin dolabında eski bir telsiz bulundu.', if: (s, g) => !alive(g, 'mert') },
      { who: 'mert', text: 'Yüksek bir anten kurarsak belki ormancılara ulaşırız.', if: (s, g) => alive(g, 'mert') },
      { do: (g) => { g.state.flags.radioFound = true; bus.emit('objective', g.objectiveInfo()); } },
    ],
  },
  {
    id: 'night2Voice',
    when: (ev) => ev.type === 'night' && ev.day === 2,
    delay: 8,
    steps: [
      {
        if: (s, g) => s.flags.followVoice && alive(g, 'kaan'),
        then: [
          { narrate: 'Ormanın içinden bir ses: "Kaan... Kaan, buradayım..."' },
          { who: 'kaan', text: 'Bu o. Gidiyorum.' },
          { do: (g) => g.sendAway(['kaan'], 14, 'kaanBack', { into: 'deep' }) },
        ],
        else: [{
          if: (s, g) => s.flags.kaanAngry && alive(g, 'kaan'),
          then: [
            { narrate: 'Kaan gece yarısı ateşin başından kalktı. Kimseye bakmadan karanlığa yürüdü.' },
            { who: 'ece', text: 'Kaan! Kaan, geri dön!', if: (s, g) => alive(g, 'ece') },
            { do: (g) => { g.state.flags.kaanLeft = true; g.sendAway(['kaan'], 0, null, { into: 'deep', forever: true }); } },
          ],
          else: [{ who: 'defne', text: 'Sesler... bu gece daha çoklar.', if: (s, g) => alive(g, 'defne') }],
        }],
      },
    ],
  },
  {
    id: 'kaanBack',
    when: (ev) => ev.type === 'returned' && ev.scene === 'kaanBack',
    steps: [
      { narrate: 'Kaan döndü. Konuşmuyor. Elinde Bora\'nın feneri var. Üstünde tek damla kan yok.' },
      { do: (g) => { g.state.flags.boraLight = true; const k = g.survivors.get('kaan'); if (k) { k.data.hp = Math.min(k.data.hp, 30); k.def.skills.light = 1.6; } } },
      { who: 'defne', text: 'Kaan... Bora nerede?', if: (s, g) => alive(g, 'defne') },
      { who: 'kaan', text: 'Bilmiyorum. Fener yerdeydi. Hâlâ yanıyordu.' },
    ],
  },
  {
    id: 'siege',
    when: (ev) => ev.type === 'night' && ev.day === 2,
    delay: 64,
    requires: (s, g) => alive(g, 'defne'),
    steps: [
      { narrate: 'Defne odun almak için kulübenin arkasına gitti. Işığın dışına.' },
      { do: (g) => g.stageSiege('defne') },
      { who: 'defne', text: 'Yardım edin! Etrafımı sardılar!' },
      {
        choice: {
          prompt: 'Saniyeler var.',
          permanent: true,
          timer: 12,
          fallback: 2,
          options: [
            {
              text: 'Kaan, Defne\'yi getir!',
              requires: (s, g) => alive(g, 'kaan'),
              effect: (g) => g.resolveSiege(g.state.flags.boraLight ? 'kaanSaves' : 'kaanDies'),
            },
            {
              text: 'Ece, feneri al ve yolu aç!',
              requires: (s, g) => alive(g, 'ece'),
              effect: (g) => g.resolveSiege('eceSaves'),
            },
            {
              text: 'Kimse ışığın dışına çıkmasın.',
              effect: (g) => g.resolveSiege('defneDies'),
            },
          ],
        },
      },
      { if: (s) => s.flags.siege === 'kaanDies', then: [{ narrate: 'Kaan, Defne\'yi ışığa itti. Sonra karanlık onu içine çekti.' }, { who: 'defne', text: 'Hayır... Hayır! KAAN!' }] },
      { if: (s) => s.flags.siege === 'kaanSaves', then: [{ narrate: 'Kaan, Bora\'nın fenerini karanlığa doğrulttu. Gölgeler çığlık atarak dağıldı.' }, { who: 'defne', text: 'Teşekkür ederim... teşekkür ederim.' }] },
      { if: (s) => s.flags.siege === 'eceSaves', then: [{ narrate: 'Ece ışığı önüne tutarak koştu. Geri döndüklerinde Ece\'nin kolu kan içindeydi.' }, { who: 'ece', text: 'İyiyim. İyiyim... Sadece baskı yapın.' }] },
      { if: (s) => s.flags.siege === 'defneDies', then: [{ narrate: 'Defne\'nin çığlığı birden kesildi. Sonra sadece rüzgâr.' }, { who: 'mert', text: 'Biz... biz onu öylece bıraktık.', if: (s, g) => alive(g, 'mert') }] },
    ],
  },
  {
    id: 'radioBuilt',
    when: (ev) => ev.type === 'built' && ev.id === 'radio',
    steps: [
      { narrate: 'Telsizden önce yalnızca cızırtı geldi.' },
      { who: 'mert', text: 'Hadi... hadi... Burası ormanın ortasındaki kulübe. Beni duyan var mı?', if: (s, g) => alive(g, 'mert') },
      { who: 'voice', text: '...duyuyoruz. Neredesiniz? Kaç kişisiniz?' },
      { who: 'defne', text: 'Biri cevap verdi! Gerçekten biri var!', if: (s, g) => alive(g, 'defne') },
      { who: 'voice', text: 'Bora burada. Bora sizi bekliyor. Patikadan gelin. Hepiniz.' },
      { who: 'ece', text: 'Kapat onu. Mert, hemen kapat şunu.', if: (s, g) => alive(g, 'ece') },
      { do: (g) => { g.state.flags.chapter1 = true; bus.emit('chapter', { n: 1, title: 'Kuytu' }); } },
    ],
  },
  {
    id: 'death',
    repeat: true,
    when: (ev, s) => ev.type === 'death' && !s.flags.siegeDeath,
    steps: [{ do: (g, api) => api.deathLine() }],
  },
];

export class Story {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.queue = [];
    this.active = false;
    this.timed = [];
    bus.on('story', (ev) => this.hook(ev));
    this.tickT = 0;
  }

  get seen() {
    return this.game.state.story.seen;
  }

  hook(ev) {
    const g = this.game;
    for (const sc of SCENES) {
      if (!sc.repeat && this.seen.includes(sc.id)) continue;
      if (this.queue.some((q) => q.scene === sc) || this.timed.some((q) => q.scene === sc)) continue;
      if (!sc.when(ev, g.state, g)) continue;
      if (sc.requires && !sc.requires(g.state, g)) continue;
      if (!sc.repeat) this.seen.push(sc.id);
      const item = { scene: sc, ev };
      if (sc.delay) this.timed.push({ ...item, left: sc.delay });
      else this.queue.push(item);
    }
  }

  update(dt) {
    const g = this.game;
    if (!g.paused) {
      // gecikmeler oyun saatine göre işler (hızlandırılmış zamanda da sahneler doğru sırada gelir)
      const sdt = dt * (g.timeScale ?? 1);
      for (const t of [...this.timed]) {
        t.left -= sdt;
        if (t.left <= 0) {
          this.timed.splice(this.timed.indexOf(t), 1);
          this.queue.push(t);
        }
      }
      this.tickT += sdt;
      if (this.tickT > 1) {
        this.tickT = 0;
        this.hook({ type: 'tick' });
      }
    }
    if (!this.active && this.queue.length && !g.place) this.#play(this.queue.shift());
  }

  async #play({ scene, ev }) {
    const g = this.game;
    this.active = true;
    g.paused = true;
    g.select(null);
    await this.ui.open({ fade: scene.fade });
    await this.#run(scene.steps, ev);
    await this.ui.close({ fade: scene.fade });
    g.paused = false;
    this.active = false;
    g.save();
  }

  async #run(steps, ev) {
    const g = this.game;
    const s = g.state;
    const api = { deathLine: () => this.#deathLine(ev) };
    for (const st of steps) {
      if (st.if && !st.then && !st.if(s, g)) continue;
      if (st.then || st.else) {
        if (st.if(s, g)) await this.#run(st.then ?? [], ev);
        else await this.#run(st.else ?? [], ev);
        continue;
      }
      if (st.narrate) await this.ui.narrate(st.narrate);
      else if (st.who) {
        const c = st.who === 'voice' ? { id: 'voice', name: 'Telsiz', color: '#9aa7b4' } : byId(st.who);
        if (st.who !== 'voice' && !alive(g, st.who)) continue;
        if (st.who !== 'voice') g.focusSurvivor(st.who);
        await this.ui.say(c, st.text);
      } else if (st.choice) {
        const ch = st.choice;
        const opts = ch.options.map((o, k) => ({ ...o, k, enabled: !o.requires || o.requires(s, g) }));
        const avail = opts.filter((o) => o.enabled);
        const fallback = opts[ch.fallback ?? avail.length - 1] ?? avail[avail.length - 1];
        const pick = await this.ui.choose({ prompt: ch.prompt, permanent: ch.permanent, timer: ch.timer, options: avail, fallback });
        s.flags[`choice:${pick.k}`] = true;
        pick.effect?.(g, api);
        if (pick.then) await this.#run(pick.then, ev);
      } else if (st.do) {
        await st.do(g, api);
      }
    }
  }

  async #deathLine(ev) {
    const g = this.game;
    const dead = byId(ev.id);
    const witness = g.survivors.alive().find((x) => x.mode !== 'away');
    if (!dead || !witness) return;
    const lines = {
      ece: [`${dead.name}... Hayır. Nabzı yok. Nabzı yok!`, `Yapabileceğim bir şey yoktu. Hiçbir şey.`],
      kaan: [`${dead.name}! Bırakın onu! BIRAKIN!`, `Bunu ödeyecekler. Hepsi.`],
      defne: [`Gözlerimi kapatamıyorum. ${dead.name}'i alırken gördüm...`],
      mert: [`Bu... bu bir şaka değil. ${dead.name} gerçekten gitti.`],
    }[witness.id] ?? [`${dead.name}...`];
    g.focusSurvivor(witness.id);
    await this.ui.say(witness.def, lines[Math.floor(Math.random() * lines.length)]);
  }
}
