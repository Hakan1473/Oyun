// Concatenates src/js/*.js into the single-file game (index.html).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const dir = new URL('./src/js/', import.meta.url);
const js = readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
const tpl = readFileSync(new URL('./src/template.html', import.meta.url), 'utf8');
writeFileSync(new URL('./index.html', import.meta.url), tpl.replace('/*GAME_JS*/', () => js));
console.log('index.html written', (js.length / 1024).toFixed(1) + ' KB js');
