// Yuva — giriş noktası. Sahneyi kurar, kaydı yükler, arayüzü bağlar ve döngüyü başlatır.

import { CONFIG } from './config.js';
import { loadSave } from './core/storage.js';
import { bus } from './core/events.js';
import { Stage } from './engine/stage.js';
import { CameraRig } from './engine/camera.js';
import { Input } from './engine/input.js';
import { FX } from './engine/fx.js';
import { Overlay } from './engine/overlay.js';
import { setHighlightPulse } from './engine/materials.js';
import { Terrain } from './world/terrain.js';
import { allDefs } from './buildings/index.js';
import { createFreshState } from './game/state.js';
import { Game } from './game/game.js';
import { Hud } from './ui/hud.js';
import { Sheets } from './ui/sheets.js';
import { Thumbs } from './ui/thumbs.js';
import { Splash } from './ui/splash.js';
import { ICON_DEFS } from './ui/icons.js';
import { audio } from './audio/audio.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function boot() {
  const splash = new Splash();
  document.body.insertAdjacentHTML('afterbegin', ICON_DEFS);
  splash.progress(0.1);
  await nextFrame();

  const canvas = document.getElementById('scene');
  let stage;
  try {
    stage = new Stage(canvas, CONFIG);
  } catch (err) {
    console.error(err);
    splash.fail('Bu cihaz 3B grafikleri (WebGL) desteklemiyor.');
    return;
  }
  const rig = new CameraRig(stage, CONFIG);
  const resize = () => {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const hgt = Math.round(vv?.height ?? window.innerHeight);
    stage.resize(w, hgt);
    rig.ppuGoal = rig.clampPpu(rig.ppuGoal);
    rig.ppu = rig.clampPpu(rig.ppu);
    rig.apply();
  };
  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  splash.progress(0.25);
  await nextFrame();

  const terrain = new Terrain(stage, CONFIG);
  splash.progress(0.5);
  await nextFrame();

  const saved = loadSave();
  const state = saved ?? createFreshState();
  const fx = new FX(stage);
  const overlay = new Overlay(document.getElementById('overlay'), rig);
  const game = new Game({ stage, rig, terrain, fx, overlay, state });
  splash.progress(0.7);
  await nextFrame();

  // Mağaza resimlerini önceden hazırla
  const thumbs = new Thumbs(CONFIG);
  const defs = allDefs().filter((d) => d.shop);
  for (let k = 0; k < defs.length; k++) {
    thumbs.get(defs[k].id, 1, 0);
    if (k % 3 === 2) {
      splash.progress(0.7 + (0.28 * k) / defs.length);
      await nextFrame();
    }
  }

  const sheets = new Sheets(game, thumbs);
  const hud = new Hud(document.getElementById('hud'), game, sheets);
  game.emitAll();

  const input = new Input(canvas, rig, {
    onTap: (x, y) => game.onTap(x, y),
    onDragStart: (x, y) => game.onDragStart(x, y),
    onDrag: (x, y) => game.onDrag(x, y),
    onDragEnd: (x, y) => game.onDragEnd(x, y),
    onHover: (x, y) => game.onHover(x, y),
    onKey: (k, e) => game.onKey(k, e),
    onPress: () => audio.unlock(),
  });
  input.enabled = false;
  bus.on('open-shop', () => sheets.shop());

  // Giriş sahnesi: uzaktan, yavaşça süzülen kamera
  const palace = state.entities.find((e) => e.type === 'palace');
  const focus = palace ? game.grid.center(palace.i, palace.j, 4) : { x: 0, z: 1.5 };
  rig.target.set(focus.x - 4, 0, focus.z - 4);
  rig.ppu = rig.ppuGoal = rig.clampPpu(CONFIG.camera.splashPpu);
  rig.apply();

  let intro = true;
  let last = performance.now();
  let t = 0;
  stage.markShadows();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (intro) {
      rig.target.x += dt * 0.35;
      rig.target.z += dt * 0.35;
      rig.apply();
    }
    input.update(dt);
    rig.update(dt);
    game.update(dt, t);
    terrain.update(dt);
    fx.update(dt, rig.ppu, stage.dpr);
    setHighlightPulse(t);
    stage.render();
    overlay.update();
    hud.update();
    stage.adapt(dt, now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  await splash.ready(!!saved);
  audio.unlock();
  audio.play('open');
  intro = false;
  rig.flyTo({ x: focus.x, z: focus.z, ppu: CONFIG.camera.ppu * (stage.width < 600 ? 0.95 : 1.05) }, 1.6);
  setTimeout(() => {
    hud.show();
    input.enabled = true;
  }, 450);

  // Geliştirme ve hata ayıklama için
  window.yuva = { game, stage, rig, CONFIG };

  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.self === window.top) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
