// Grubun üyeleri. Hikâyedeki adlar, görünüşler ve yetenekler burada tanımlanır.

export const ROSTER = [
  {
    id: 'ece',
    name: 'Ece',
    role: 'Tıp öğrencisi',
    bio: 'Sakin ve soğukkanlı. Panik anında bile ilk yardım çantasını unutmaz. Grubun vicdanı.',
    trait: 'Şifacı — yanındaki yaralılar daha hızlı iyileşir.',
    color: '#e0615a',
    look: { jacket: 0x7c2622, pants: 0x26262c, shoes: 0x1a1a1c, hair: 0x2a1a12, skin: 0xe8c4a4, hair2: 'long' },
    skills: { chop: 0.9, build: 1.0, heal: 2.2, light: 1.0, tough: 1.0 },
  },
  {
    id: 'kaan',
    name: 'Kaan',
    role: 'Rugbi oyuncusu',
    bio: 'Güçlü ve aceleci. Bora onun çocukluk arkadaşı; onu ormanda bırakmayı kendine yediremiyor.',
    trait: 'Güçlü — ağaçları hızlı keser, darbelere dayanıklıdır.',
    color: '#8fbf6a',
    look: { jacket: 0x34402a, pants: 0x3a3226, shoes: 0x22201c, hair: 0x15110e, skin: 0xd2a080, hair2: 'short' },
    skills: { chop: 1.5, build: 1.0, heal: 1.0, light: 1.0, tough: 0.7 },
  },
  {
    id: 'defne',
    name: 'Defne',
    role: 'Fotoğrafçı',
    bio: 'Gözü her şeyi yakalar. Ağaçların arasındaki o uzun şekli ilk gören oydu; hâlâ fotoğrafını kimseye göstermedi.',
    trait: 'Gözcü — feneri daha uzağa vurur, gölgeleri erken görür.',
    color: '#e9b84a',
    look: { jacket: 0xa8842a, pants: 0x2c3442, shoes: 0x1c1c20, hair: 0x6a3a1e, skin: 0xf0d0b4, hair2: 'bob', hood: true },
    skills: { chop: 0.85, build: 0.95, heal: 1.0, light: 1.5, tough: 1.0 },
  },
  {
    id: 'mert',
    name: 'Mert',
    role: 'Mühendislik öğrencisi',
    bio: 'Gergin olunca espri yapar, ki şu sıralar çok gergin. Eline geçen her şeyi tamir edebilir.',
    trait: 'Tamirci — yapıları hızlı kurar ve onarır.',
    color: '#6ab4d8',
    look: { jacket: 0x283c58, pants: 0x242424, shoes: 0x2a2018, hair: 0x3a2a1a, skin: 0xe0b898, hair2: 'short', beanie: 0x6a2626, pack: true },
    skills: { chop: 1.0, build: 1.5, heal: 1.0, light: 1.0, tough: 1.0 },
  },
];

export const MISSING = { id: 'bora', name: 'Bora', color: '#b0a090' };

export const byId = (id) => ROSTER.find((r) => r.id === id) ?? null;
