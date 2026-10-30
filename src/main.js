// Kuytu — giriş noktası. Dokuları boyar, dünyayı kurar, kaydı yükler, arayüzü bağlar ve döngüyü başlatır.

import { CONFIG } from './config.js';
import { loadSave } from './core/storage.js';
import { bus } from './core/events.js';
import { Stage } from './engine/stage.js';
import { CameraRig } from './engine/camera.js';
import { Input } from './engine/input.js';
import { FX } from './engine/fx.js';
import { Overlay } from './engine/overlay.js';
import { createTextures } from './engine/textures.js';
import { initMaterials, setHighlightPulse } from './engine/materials.js';
import { Ground, Flora } from './world/ground.js';
import { Forest, TreeField } from './world/forest.js';
import { Lights } from './world/lights.js';
import { Cycle } from './world/cycle.js';
import { allDefs } from './buildings/index.js';
import { createFreshState } from './game/state.js';
import { Game } from './game/game.js';
import { Story } from './game/story.js';
import { Hud } from './ui/hud.js';
import { Sheets } from './ui/sheets.js';
import { Thumbs } from './ui/thumbs.js';
import { Dialogue } from './ui/dialogue.js';
import { Splash } from './ui/splash.js';
import { ICON_DEFS } from './ui/icons.js';
import { audio } from './audio/audio.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function boot() {
  const splash = new Splash();
  document.body.insertAdjacentHTML('afterbegin', ICON_DEFS);
  splash.progress(0.04);
  await nextFrame();

  const canvas = document.getElementById('scene');
  let stage;
  try {
    stage = new Stage(canvas, CONFIG);
  } catch (err) {
    console.error(err);
    splash.fail('Bu cihaz 3B grafikleri (WebGL 2) desteklemiyor.');
    return;
  }
  const T = await createTextures({ quality: stage.quality, onProgress: (k) => splash.progress(0.05 + k * 0.4) });
  initMaterials(T, { msaa: stage.msaa });

  const rig = new CameraRig(stage, CONFIG);
  const resize = () => {
    const vv = window.visualViewport;
    stage.resize(Math.round(vv?.width ?? window.innerWidth), Math.round(vv?.height ?? window.innerHeight));
    rig.ppuGoal = rig.clampPpu(rig.ppuGoal);
    rig.ppu = rig.clampPpu(rig.ppu);
    rig.apply();
  };
  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  await nextFrame();

  const ground = new Ground(stage, CONFIG, T);
  const flora = new Flora(stage, CONFIG, ground, stage.quality);
  splash.progress(0.55);
  await nextFrame();
  new Forest(stage, CONFIG, ground, stage.quality);
  splash.progress(0.72);
  await nextFrame();

  const saved = loadSave();
  const state = saved ?? createFreshState();
  const fx = new FX(stage);
  const lights = new Lights(stage, stage.post);
  const overlay = new Overlay(document.getElementById('overlay'), rig);
  // Giriş ekranında orman gece görünür
  const splashClock = { clock: { day: 1, t: 210, total: 0 } };
  const cycle = new Cycle(stage, splashClock);
  const field = new TreeField(stage, null);
  const game = new Game({ stage, rig, fx, overlay, lights, cycle, ground, flora, field, state });
  field.grid = game.grid;
  splash.progress(0.82);
  await nextFrame();

  const thumbs = new Thumbs(CONFIG);
  for (const d of allDefs().filter((x) => x.shop)) thumbs.get(d.id, 1, 0);
  for (const s of game.survivors.list) thumbs.portrait(s.def);
  splash.progress(0.95);
  await nextFrame();

  const sheets = new Sheets(game, thumbs);
  const hud = new Hud(document.getElementById('hud'), game, sheets, thumbs);
  const dialogue = new Dialogue(document.getElementById('dialogue'), stage, thumbs);
  const story = new Story(game, {
    open: async (o) => { hud.hideFor(true); await dialogue.open(o); },
    close: async (o) => { await dialogue.close(o); hud.hideFor(false); },
    say: (c, t) => dialogue.say(c, t),
    narrate: (t) => dialogue.narrate(t),
    choose: (o) => dialogue.choose(o),
  });
  bus.on('open-shop', () => sheets.shop());

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

  // Giriş: ormanın üstünde süzülen kamera
  rig.target.set(-6, 0, -5);
  rig.ppu = rig.ppuGoal = rig.clampPpu(CONFIG.camera.splashPpu);
  rig.apply();
  let intro = true;
  game.paused = true;
  let last = performance.now();
  let t = 0;
  stage.markShadows();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (intro) {
      rig.target.x += dt * 0.3;
      rig.target.z += dt * 0.3;
      rig.apply();
    }
    input.update(dt);
    rig.update(dt);
    game.update(dt, t);
    story.update(dt);
    cycle.apply(dt);
    flora.update(dt);
    lights.update(dt, rig.target, cycle.darkness);
    fx.update(dt, rig.ppu, stage.dpr, t);
    setHighlightPulse(t);
    stage.render(t);
    overlay.update();
    hud.update();
    stage.adapt(dt, now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  await splash.ready(!!saved && state.started);
  audio.unlock();
  intro = false;
  game.paused = false;
  cycle.state = state;
  game.emitAll();
  input.enabled = true;
  const dev = new URLSearchParams(location.search).has('dev');
  if (!state.started && dev) {
    // Geliştirme: girişi atla, grup ateşin başında
    state.started = true;
    state.story.seen.push('prologue', 'arrival');
    const f = game.fireSpot();
    game.survivors.list.forEach((s, k) => s.pos.set(f.x - 1 + k * 0.8, f.y + 0.8));
    rig.flyTo({ x: 0, z: 2.5, ppu: 40 }, 0.5);
    hud.show();
  } else if (!state.started) {
    state.started = true;
    rig.flyTo({ x: 6, z: 7, ppu: 34 }, 2.2);
    bus.emit('story', { type: 'newgame' });
    setTimeout(() => hud.show(), 1500);
  } else {
    rig.flyTo({ x: 0, z: 2.5, ppu: stage.width < 600 ? 36 : 42 }, 1.8);
    setTimeout(() => hud.show(), 600);
    audio.setMood(cycle.phase);
  }
  window.kuytu = { game, stage, rig, cycle, story, CONFIG };
}

boot();
