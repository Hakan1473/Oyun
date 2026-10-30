// Giriş ekranı: logo nefes alır, köy arkada uyanır, "Oyna" ile kamera köye iner.

export class Splash {
  constructor() {
    this.el = document.getElementById('splash');
    this.bar = this.el.querySelector('.splash-progress i');
    this.btn = this.el.querySelector('.splash-play');
    this.note = this.el.querySelector('.splash-note');
  }

  progress(k) {
    this.bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, k)).toFixed(3)})`;
  }

  ready(returning) {
    this.progress(1);
    this.el.classList.add('ready');
    this.btn.querySelector('span').textContent = returning ? 'Köyüne dön' : 'Oyna';
    this.note.textContent = returning ? 'Sen yokken köylüler çalışmaya devam etti.' : 'Küçük bir köy. Büyük bir hikâye.';
    return new Promise((resolve) => {
      const go = () => {
        this.btn.removeEventListener('click', go);
        window.removeEventListener('keydown', key);
        this.el.classList.add('leaving');
        setTimeout(() => this.el.remove(), 900);
        resolve();
      };
      const key = (e) => (e.key === 'Enter' || e.key === ' ') && go();
      this.btn.addEventListener('click', go);
      window.addEventListener('keydown', key);
    });
  }

  fail(message) {
    this.el.classList.add('error');
    this.note.textContent = message;
  }
}
