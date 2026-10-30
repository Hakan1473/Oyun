// Kayıt: tarayıcıya sürümlü JSON olarak yazılır.
// Kayıt biçimi değişirse MIGRATIONS'a bir adım eklenir; eski kayıtlar kaybolmaz.

import { CONFIG } from '../config.js';

const MIGRATIONS = {
  // Örnek: 1: (data) => { data.yeniAlan = 0; return data; }  // v1 → v2
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return null;
    let data = JSON.parse(raw);
    while (data.version < CONFIG.save.version) {
      const step = MIGRATIONS[data.version];
      if (!step) return null;
      data = step(data);
      data.version += 1;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(CONFIG.save.key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.save.key);
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function loadPref(key, fallback) {
  try {
    const v = localStorage.getItem(`kuytu.pref.${key}`);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function savePref(key, value) {
  try {
    localStorage.setItem(`kuytu.pref.${key}`, JSON.stringify(value));
  } catch {
    /* yoksay */
  }
}
