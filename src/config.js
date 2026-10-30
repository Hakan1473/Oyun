// Oyunun tüm ayarlanabilir sabitleri tek yerde.
// Yeni bir özellik eklerken önce buraya bakın.

export const CONFIG = {
  version: '0.1.0',

  grid: {
    size: 32, // inşa edilebilir alan (kare, karo sayısı)
    border: 18, // alanın çevresindeki orman/nehir kuşağı
  },

  camera: {
    elevation: 34, // derece — "tanrı bakışı" eğimi
    azimuth: 45, // derece — sabit izometrik yön, dönmez
    ppu: 48, // varsayılan yakınlık (dünya birimi başına CSS pikseli)
    ppuMin: 20,
    ppuMax: 150,
    splashPpu: 26,
  },

  builders: 2, // aynı anda yürüyebilecek inşaat sayısı

  start: {
    gold: 800,
    wood: 600,
  },

  baseStorage: {
    gold: 1500,
    wood: 1500,
  },

  save: {
    key: 'yuva.save',
    version: 1,
    autosaveMs: 6000,
  },
};
