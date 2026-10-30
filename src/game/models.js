// Yapı tanımından sahne nesnesi üretir. Statik geometri önbelleğe alınır;
// ışıklar, ateşler ve yanıp sönen parçalar her örnek için ayrıca tanımlanır.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';
import { mulberry32 } from '../core/rng.js';

class NullKit extends Kit {
  add() {
    return this;
  }
}

const cache = new Map();

export function buildModel(def, { level = 1, variant = 0, state = 'built' } = {}) {
  const key = `${def.id}:${level}:${variant}:${state === 'picked' ? 'p' : ''}`;
  const hit = cache.get(key);
  const kit = hit ? new NullKit() : new Kit();
  const dynamics = [];
  const anchors = { smoke: [], lights: [], fires: [], blinks: [] };
  const ctx = {
    kit,
    level,
    variant,
    state,
    rng: mulberry32(variant * 7919 + level * 131 + 17),
    door: null,
    dynamic(obj, update, dispose) {
      obj.castShadow = false;
      dynamics.push({ obj, update, dispose });
    },
    anchor(name, x, y, z) {
      anchors[name].push(new THREE.Vector3(x, y, z));
    },
    light(spec) {
      anchors.lights.push({ ...spec, pos: new THREE.Vector3(spec.x, spec.y, spec.z) });
    },
    fire(spec) {
      anchors.fires.push({ ...spec, pos: new THREE.Vector3(spec.x, spec.y, spec.z) });
    },
    blink(spec) {
      anchors.blinks.push(new THREE.Vector3(spec.x, spec.y, spec.z));
    },
  };
  def.model(ctx);

  let mesh;
  if (hit) {
    mesh = new THREE.Mesh(hit.geometry, hit.material);
    mesh.userData.baseMaterial = hit.material;
  } else {
    mesh = kit.build();
    cache.set(key, { geometry: mesh.geometry, material: mesh.material });
  }
  mesh.castShadow = def.castShadow !== false;
  mesh.receiveShadow = true;

  const root = new THREE.Group();
  root.add(mesh);
  for (const d of dynamics) root.add(d.obj);

  const box = new THREE.Box3().setFromObject(root);
  return {
    root,
    mesh,
    dynamics,
    anchors,
    door: ctx.door,
    height: Math.max(0.3, box.max.y),
    box,
    dispose() {
      for (const d of dynamics) d.dispose?.();
    },
  };
}
