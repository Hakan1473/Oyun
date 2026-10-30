// Giriş ekranı: sisli gece ormanı arkada yavaşça kayar; "Başla" ile kamera kulübeye iner.

export class Splash {
  constructor() {
    this.el = document.getElementById('splash');
    this.bar = this.el.querySelector('.splash-progress i');
    this.btn = this.el.querySelector('.splash-play');
    this.alt = this.el.querySelector('.splash-new');
    this.note = this.el.querySelector('.splash-note');
  }

  progress(k) {
    this.bar.style.transform = `scaleX(${Math.max(0.03, Math.min(1, k)).toFixed(3)})`;
  }

  ready(returning) {
    this.progress(1);
    this.el.classList.add('ready');
    this.btn.querySelector('span').textContent = returning ? 'Devam et' : 'Başla';
    this.alt.hidden = !returning;
    return new Promise((resolve) => {
      const go = () => {
        this.btn.removeEventListener('click', go);
        window.removeEventListener('keydown', key);
        this.el.classList.add('leaving');
        setTimeout(() => this.el.remove(), 1400);
        resolve();
      };
      const key = (e) => (e.key === 'Enter' || e.key === ' ') && go();
      this.btn.addEventListener('click', go);
      this.alt.addEventListener('click', () => {
        if (!this.alt.classList.contains('confirm')) {
          this.alt.classList.add('confirm');
          this.alt.textContent = 'Emin misin? Dokun ve sil';
          return;
        }
        try {
          localStorage.removeItem('kuytu.save');
        } catch {
          /* yoksay */
        }
        location.reload();
      });
      window.addEventListener('keydown', key);
    });
  }

  fail(message) {
    this.el.classList.add('error');
    this.note.textContent = message;
  }
}
