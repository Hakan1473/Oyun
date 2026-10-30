// assets/icons/icon.svg dosyasından PWA ve iOS simgelerini üretir.
// Kullanım: node tools/make-icons.cjs   (Playwright + Chromium gerekir)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
// Kare kesim (köşe yuvarlatmayı işletim sistemi yapar)
const square = svg.replace('<g clip-path="url(#sq)">', '<g>');

const jobs = [
  { file: 'apple-touch-icon.png', size: 180, svg: square, pad: 0 },
  { file: 'icon-192.png', size: 192, svg, pad: 0 },
  { file: 'icon-512.png', size: 512, svg, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, svg: square, pad: 0 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const j of jobs) {
    await page.setViewportSize({ width: j.size, height: j.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${j.svg.replace('<svg ', `<svg width="${j.size}" height="${j.size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(dir, j.file), omitBackground: true });
    console.log('wrote', j.file);
  }
  await browser.close();
})();
