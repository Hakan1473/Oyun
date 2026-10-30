// Tek dosyalık sürüm üretir: dist/kuytu.html (tüm kod, stil ve logo içine gömülü).
// Paylaşmak ya da herhangi bir statik barındırmaya koymak için. Kullanım: npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const threePlugin = {
  name: 'three-vendor',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(root, 'vendor/three/three.module.min.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(root, 'vendor/three/addons', a.path.slice('three/addons/'.length)) }));
  },
};

const out = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2022',
  legalComments: 'none',
  plugins: [threePlugin],
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'styles/main.css'), 'utf8');
const icon = `data:image/svg+xml;base64,${Buffer.from(readFileSync(join(root, 'assets/icons/icon.svg'))).toString('base64')}`;

let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet" href="styles\/main.css">/, () => `<style>${css}</style>`)
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/src="assets\/icons\/icon.svg"/, `src="${icon}"`)
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script type="module">${js}</script>`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/kuytu.html'), html);
console.log(`dist/kuytu.html  ${(html.length / 1024).toFixed(0)} KB`);
