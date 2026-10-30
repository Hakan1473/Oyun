// Diyalog: sinematik bantlar, portre, daktilo yazısı, anlatıcı ve kalıcı kararlar.

import { h } from './dom.js';
import { icon } from './icons.js';
import { audio } from '../audio/audio.js';

function tween(obj, key, to, ms) {
  return new Promise((resolve) => {
    const from = obj[key];
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      obj[key] = from + (to - from) * e;
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export class Dialogue {
  constructor(root, stage, thumbs) {
    this.stage = stage;
    this.thumbs = thumbs;
    this.portrait = h('img', { alt: '' });
    this.name = h('b', { class: 'dlg-name' });
    this.text = h('p', { class: 'dlg-text' });
    this.panel = h('div', { class: 'dlg-panel' },
      h('div', { class: 'dlg-portrait' }, this.portrait),
      h('div', { class: 'dlg-body' }, this.name, this.text, h('span', { class: 'dlg-next', 'aria-hidden': 'true' })),
    );
    this.narr = h('p', { class: 'dlg-narr' });
    this.prompt = h('p', { class: 'dlg-prompt' });
    this.perm = h('div', { class: 'dlg-perm', html: `${icon('warning')}<span>Bu karar kalıcıdır</span>` });
    this.timerBar = h('i');
    this.timer = h('div', { class: 'dlg-timer' }, this.timerBar);
    this.opts = h('div', { class: 'dlg-opts' });
    this.choices = h('div', { class: 'dlg-choices' }, this.prompt, this.perm, this.timer, this.opts);
    this.skip = h('button', { class: 'dlg-skip', type: 'button' }, 'Geç');
    this.el = h('div', { class: 'dlg', role: 'dialog', 'aria-live': 'polite' }, this.narr, this.panel, this.choices, this.skip);
    root.appendChild(this.el);
    this.waiter = null;
    this.el.addEventListener('pointerup', (e) => {
      if (e.target.closest('.dlg-opt') || e.target === this.skip) return;
      this.#advance();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.el.classList.contains('open')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.#advance();
      }
    });
    this.skip.addEventListener('click', () => {
      this.skipAll = true;
      this.#advance(true);
    });
  }

  #advance(force = false) {
    if (this.typing && !force) {
      this.typing = false;
      return;
    }
    const w = this.waiter;
    this.waiter = null;
    w?.();
  }

  #wait() {
    return new Promise((r) => {
      this.waiter = r;
    });
  }

  async open({ fade = false } = {}) {
    this.skipAll = false;
    this.el.classList.add('open');
    this.fade = fade;
    const p = this.stage.post.params;
    await Promise.all([
      tween(p.uLetter, 'value', 0.085, 600),
      fade ? tween(p.uFade, 'value', 0.94, 900) : Promise.resolve(),
    ]);
  }

  async close({ fade = false } = {}) {
    this.panel.classList.remove('show');
    this.choices.classList.remove('show');
    this.narr.classList.remove('show');
    const p = this.stage.post.params;
    await Promise.all([tween(p.uLetter, 'value', 0, 700), fade || p.uFade.value > 0 ? tween(p.uFade, 'value', 0, 1400) : Promise.resolve()]);
    this.el.classList.remove('open');
  }

  async #type(el, text) {
    el.textContent = '';
    this.typing = true;
    const chars = [...text];
    let i = 0;
    await new Promise((resolve) => {
      const step = () => {
        if (!this.typing || this.skipAll) {
          el.textContent = text;
          this.typing = false;
          resolve();
          return;
        }
        i = Math.min(chars.length, i + 2);
        el.textContent = chars.slice(0, i).join('');
        if (i % 6 === 0) audio.play('type', { gap: 30 });
        if (i >= chars.length) {
          this.typing = false;
          resolve();
        } else setTimeout(step, 28);
      };
      step();
    });
  }

  async say(c, text) {
    if (this.skipAll) return;
    this.narr.classList.remove('show');
    this.choices.classList.remove('show');
    const isVoice = c.id === 'voice';
    this.panel.classList.toggle('voice', isVoice);
    this.portrait.src = isVoice ? '' : this.thumbs.portrait(c);
    this.panel.querySelector('.dlg-portrait').innerHTML = isVoice ? icon('radio') : '';
    if (!isVoice) this.panel.querySelector('.dlg-portrait').appendChild(this.portrait);
    this.name.textContent = c.name;
    this.name.style.color = c.color;
    this.panel.classList.add('show');
    await this.#type(this.text, text);
    await this.#wait();
  }

  async narrate(text) {
    if (this.skipAll) return;
    this.panel.classList.remove('show');
    this.choices.classList.remove('show');
    this.narr.classList.remove('show');
    void this.narr.offsetWidth;
    this.narr.classList.add('show');
    await this.#type(this.narr, text);
    await this.#wait();
  }

  async choose({ prompt, permanent, timer, options, fallback }) {
    this.skipAll = false;
    this.panel.classList.remove('show');
    this.narr.classList.remove('show');
    this.prompt.textContent = prompt ?? '';
    this.perm.style.display = permanent ? '' : 'none';
    this.timer.style.display = timer ? '' : 'none';
    audio.play('sting');
    return new Promise((resolve) => {
      let done = false;
      const finish = (o) => {
        if (done) return;
        done = true;
        clearInterval(this.tick);
        this.choices.classList.remove('show');
        audio.play('choose');
        setTimeout(() => resolve(o), 250);
      };
      this.opts.replaceChildren(...options.map((o, n) => h('button', {
        class: 'dlg-opt', type: 'button', style: { '--d': `${n * 70}ms` }, onClick: () => finish(o),
      }, h('span', { class: 'dlg-opt-k' }, String(n + 1)), h('span', {}, o.text))));
      this.choices.classList.add('show');
      if (timer) {
        const t0 = performance.now();
        this.tick = setInterval(() => {
          const k = 1 - (performance.now() - t0) / (timer * 1000);
          this.timerBar.style.transform = `scaleX(${Math.max(0, k).toFixed(3)})`;
          if (k <= 0) finish(fallback);
          else if (Math.random() < 0.08) audio.play('heartbeat', { gap: 400 });
        }, 60);
      }
      const key = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) {
          window.removeEventListener('keydown', key);
          finish(options[n - 1]);
        }
      };
      window.addEventListener('keydown', key);
    });
  }
}
