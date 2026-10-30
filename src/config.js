// Oyunun tüm ayarlanabilir sabitleri tek yerde.
// Yeni bir özellik eklerken önce buraya bakın.

export const CONFIG = {
  version: '0.2.0',
  title: 'Kuytu',

  grid: {
    size: 36, // oynanabilir alan (kare, karo = 1 metre)
    border: 34, // alanın çevresindeki sonsuz hissi veren orman
  },

  camera: {
    elevation: 42, // derece — tepeden, hafif eğik bakış
    azimuth: 45, // derece — sabit yön, sahne dönmez
    ppu: 40, // varsayılan yakınlık (dünya birimi başına CSS pikseli)
    ppuMin: 13,
    ppuMax: 110,
    splashPpu: 18,
  },

  start: {
    wood: 30,
    food: 14,
  },

  baseStorage: {
    wood: 0,
    food: 0,
  },

  survival: {
    foodPerSurvivor: 2, // her şafakta
    hungerDamage: 22,
    fuelPerWood: 9, // bir odun ateşi kaç saniye besler
    feedAmount: 10, // "Ateşi besle" bir seferde kaç odun atar
    healPerSecond: 0.35, // gündüz kendiliğinden iyileşme
  },

  save: {
    key: 'kuytu.save',
    version: 1,
    autosaveMs: 5000,
  },
};
