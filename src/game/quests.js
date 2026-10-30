// Görevler: hikâyenin omurgası. Yeni bölümler bu listeye eklenerek yazılır.
// progress(state) → [şu an, hedef]; reward: { gold, wood, xp }; hint: mağazada vurgulanacak bina

import { builtCount } from './rules.js';

const levelOf = (state, type) => state.entities.find((e) => e.type === type && e.state !== 'building')?.level ?? 0;
const totalBuilt = (state, type) => state.entities.filter((e) => e.type === type && e.state !== 'building').length;

export const QUESTS = [
  {
    id: 'palace',
    title: 'Köyün kalbi',
    text: 'Meydana bir Saray kur. Köyün ondan sonra büyümeye başlar.',
    hint: 'palace',
    progress: (s) => [Math.min(1, builtCount(s, 'palace')), 1],
    reward: { gold: 250, wood: 150, xp: 20 },
  },
  {
    id: 'houses',
    title: 'Yeni komşular',
    text: 'Köyde toplam 3 ev olsun. Her ev yeni köylüler getirir.',
    hint: 'house',
    progress: (s) => [Math.min(3, totalBuilt(s, 'house')), 3],
    reward: { gold: 200, xp: 20 },
  },
  {
    id: 'lumber',
    title: 'Ormanın sesi',
    text: 'Bir Oduncu kur ve ilk keresteni topla.',
    hint: 'lumber',
    progress: (s) => [Math.min(1, builtCount(s, 'lumber')) + (s.stats.collected.wood > 0 ? 1 : 0), 2],
    reward: { gold: 150, wood: 200, xp: 25 },
  },
  {
    id: 'market',
    title: 'Pazar kuruldu',
    text: 'Bir Pazar kur. Tezgâhlar altın kazandırır.',
    hint: 'market',
    progress: (s) => [Math.min(1, builtCount(s, 'market')), 1],
    reward: { wood: 250, xp: 30 },
  },
  {
    id: 'clear',
    title: 'Ferah bir köy',
    text: 'Köyün çevresindeki 3 engeli temizle.',
    progress: (s) => [Math.min(3, s.stats.cleared), 3],
    reward: { gold: 200, xp: 25 },
  },
  {
    id: 'decor',
    title: 'Güzellik meselesi',
    text: '5 süs yerleştir: çiçeklik, fener, bank, ağaç ya da taş yol.',
    hint: 'flowerbed',
    progress: (s) => [Math.min(5, s.stats.decor), 5],
    reward: { gold: 300, xp: 30 },
  },
  {
    id: 'palace2',
    title: 'Büyüyen saray',
    text: 'Sarayı 2. seviyeye yükselt. Yeni yapılar açılır.',
    progress: (s) => [Math.min(2, levelOf(s, 'palace')), 2],
    reward: { gold: 500, wood: 500, xp: 60 },
  },
  {
    id: 'storehouse',
    title: 'Dolu ambarlar',
    text: 'Bir Ambar kur; depoların genişlesin.',
    hint: 'storehouse',
    progress: (s) => [Math.min(1, builtCount(s, 'storehouse')), 1],
    reward: { gold: 400, wood: 400, xp: 60 },
  },
  {
    id: 'town',
    title: 'Kasaba olma yolunda',
    text: 'Köyde 6 ev olsun.',
    hint: 'house',
    progress: (s) => [Math.min(6, totalBuilt(s, 'house')), 6],
    reward: { gold: 800, wood: 600, xp: 90 },
  },
  {
    id: 'palace3',
    title: 'Görkemli saray',
    text: 'Sarayı 3. seviyeye yükselt.',
    progress: (s) => [Math.min(3, levelOf(s, 'palace')), 3],
    reward: { gold: 1500, wood: 1500, xp: 150 },
  },
];

export function currentQuest(state) {
  return QUESTS[state.quests.index] ?? null;
}

export function questProgress(state) {
  const q = currentQuest(state);
  if (!q) return null;
  const [value, target] = q.progress(state);
  return { quest: q, value, target, done: value >= target };
}
