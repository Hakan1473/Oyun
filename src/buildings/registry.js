// Bina kayıt defteri. Her bina kendi dosyasında `defineBuilding({...})` ile tanımlanır
// ve buildings/index.js içinden içe aktarılır. Oyunun geri kalanı binaları buradan tanır.
//
// Tanım alanları:
//   id, name, description, category: 'defense' | 'shelter' | 'survival' | 'nature'
//   size            — kare ayak izi (karo = 1 metre)
//   levels[]        — { name, cost: { wood, food }, work (saniye), hp, light: { radius, intensity },
//                       storage, produces: { resource, rate (dakikada), capacity }, requires: { cabin } }
//   limit(ctx)      — ctx.cabinLevel ve ctx.flags'e göre izin verilen adet
//   model(m)        — m.kit'e parçalar ekler; m.light(), m.fire(), m.anchor('smoke', …), m.blink()
//   clear / harvest — doğa nesneleri için { verb, work, reward }
//   instanced       — örnekli çizilen (ağaçlar)
//   blocksCreatures — gölgeler önce bunu kırmak zorunda (barikat)
//   repeat          — yerleştirdikten sonra yanına bir tane daha önerilsin mi

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
