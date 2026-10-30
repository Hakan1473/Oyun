// Bina kayıt defteri. Her bina kendi dosyasında `defineBuilding({...})` ile tanımlanır
// ve buildings/index.js içinden içe aktarılır. Oyunun geri kalanı binaları buradan tanır.
//
// Tanım alanları:
//   id, name, description, category: 'village' | 'resource' | 'decor' | 'obstacle'
//   size            — kare ayak izi (karo)
//   solid           — köylüler üzerinden yürüyemez mi (varsayılan: true)
//   pathCost        — yürünebilir binalarda yol maliyeti (yollar < 1)
//   levels[]        — { cost, time, xp, requires: { palace }, produces, storage, villagers }
//   limit(ctx)      — palaceLevel'e göre izin verilen adet
//   model(m)        — m.kit'e parçalar ekler; m.level, m.variant, m.rng, m.dynamic(obj, fn), m.anchor(ad, x, y, z)
//   clear           — engeller için { cost, reward, xp, label }
//   repeat          — yerleştirdikten sonra yanına bir tane daha önerilsin mi (yollar)

const defs = new Map();

export function defineBuilding(def) {
  if (!def.id || defs.has(def.id)) throw new Error(`Bina kimliği geçersiz ya da tekrar: ${def.id}`);
  const full = {
    solid: true,
    pathCost: 1,
    order: 100,
    shop: def.category !== 'obstacle',
    limit: () => Infinity,
    levels: [{ cost: {}, time: 0, xp: 0 }],
    ...def,
  };
  full.maxLevel = full.levels.length;
  defs.set(full.id, full);
  return full;
}

export const getDef = (id) => defs.get(id);
export const allDefs = () => [...defs.values()];
export const shopDefs = (category) =>
  allDefs().filter((d) => d.shop && (!category || d.category === category)).sort((a, b) => a.order - b.order);

export function levelStats(def, level) {
  return def.levels[Math.max(0, Math.min(def.levels.length, level) - 1)];
}
