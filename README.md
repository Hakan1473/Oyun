# Yuva

**Küçük bir köy. Büyük bir hikâye.**

Yuva, tarayıcıda çalışan izometrik bir köy kurma oyunudur. Kamera tepeden, sabit bir "tanrı bakışı" açısıyla bakar; binalar üç boyutlu modellenir ama sahne dönmez. Telefonda dokunarak, bilgisayarda fareyle oynanır. Kurulum gerekmez.

## Oynanış

- **Saray kur.** Meydan sarayın için boş bırakıldı. Saray köyün kalbidir: seviyesi arttıkça yeni yapılar açılır, depolar genişler.
- **Ev yap.** Her ev köye yeni köylüler getirir ve küçük bir vergi (altın) üretir.
- **Kaynak topla.** Oduncu kereste, Pazar altın üretir. Binanın üstünde baloncuk belirince ona dokun.
- **Ustalar.** Aynı anda iki inşaat yürür. Sarı baretli ustalar şantiyeye koşar ve çekiç sallar.
- **Temizle ve süsle.** Yaşlı meşeleri, çamları, kayaları temizle; çiçeklik, fener, bank, çeşme ve taş yollarla köyünü güzelleştir. Köylüler taş yolları sever.
- **Görevler** seni adım adım yönlendirir ve ödül verir.
- İlerleme cihaza otomatik kaydedilir. Sen yokken üretim ve inşaatlar devam eder.

## Kontroller

| | Telefon / tablet | Bilgisayar |
|---|---|---|
| Gezinmek | Bir parmakla sürükle | Sürükle, WASD ya da ok tuşları |
| Yakınlaşmak | İki parmakla sıkıştır | Fare tekerleği, + / − |
| Seçmek | Dokun | Tıkla |
| Bina taşımak | Seçili binayı sürükle | Seçili binayı sürükle |
| İnşa menüsü | "İnşa Et" düğmesi | B |
| Vazgeçmek | ✕ | Esc |

## Çalıştırma

Oyun derleme gerektirmez; herhangi bir statik sunucu yeter.

```bash
node tools/serve.mjs        # http://localhost:5173 — aynı ağdaki telefondan da açılır
```

Tek dosyalık, paylaşılabilir sürüm (`dist/yuva.html`):

```bash
npm install
npm run build
```

GitHub Pages'te yayınlamak için depo ayarlarından *Pages → Deploy from branch* seçip kök klasörü göstermek yeterli. Telefonda "Ana Ekrana Ekle" ile tam ekran uygulama gibi açılır.

## Mimari

```
index.html              giriş ekranı ve sayfa iskeleti
styles/main.css         arayüz tasarım dili (cam yüzeyler, yuvarlak yazı, yaylı hareket)
src/
  config.js             tüm ayarlanabilir sabitler
  main.js               açılış: sahne → kayıt → arayüz → döngü
  core/                 olay yolu, kayıt (sürümlü), tohumlu rastgele, biçimlendirme
  engine/
    stage.js            çizici, ışıklar, önbellekli gölgeler, uyarlanır çözünürlük
    camera.js           sabit açılı ortografik kamera; kaydırma, sıkıştırma, atalet
    input.js            dokunma / fare / klavye → tap, sürükle, yakınlaştır
    kit.js              modelleme kiti: ilkel şekilleri tek ağa birleştirir
    grid.js             ızgara ve doluluk haritası
    fx.js               parçacıklar (duman, toz, kıvılcım, yaprak, konfeti)
    overlay.js          dünyaya iliştirilmiş HTML (etiket, sayaç, baloncuk)
  world/                arazi, orman, nehir, köylüler, yol bulma (A*)
  buildings/            her bina kendi dosyasında; registry.js kayıt defteri
  game/                 oyun yöneticisi, kurallar, görevler, başlangıç köyü
  ui/                   HUD, mağaza, bilgi ve ayar sayfaları, simgeler, küçük resimler
  audio/                Web Audio ile anında üretilen sesler ve müzik kutusu
vendor/three/           Three.js r170 (MIT)
tools/                  yerel sunucu, tek dosya derleyici, simge üretici
```

Tüm modeller kodla, köşe renkleriyle üretilir; her bina tek çizim çağrısına birleştirilir. Görsel dosya ya da ses dosyası yoktur.

## Yeni bir bina eklemek

1. `src/buildings/` altına bir dosya açın:

```js
import { defineBuilding } from './registry.js';
import { C } from '../engine/palette.js';
import { pad, gableRoof, door, onFace } from './parts.js';

defineBuilding({
  id: 'bakery',
  name: 'Fırın',
  description: 'Mis gibi ekmek kokusu köyü sarar.',
  category: 'resource',            // village | resource | decor | obstacle
  size: 2,
  limit: ({ palaceLevel }) => palaceLevel,
  levels: [
    { cost: { gold: 300, wood: 200 }, time: 20, xp: 25, requires: { palace: 1 },
      produces: { resource: 'gold', rate: 10, capacity: 100 } },
  ],
  model({ kit, level, rng, anchor }) {
    const y0 = pad(kit, 2);
    kit.box(1.2, 0.8, 1.0, C.wallButter, { y: y0 + 0.4, r: 0.03 });
    gableRoof(kit, { len: 1.2, depth: 1.0, rise: 0.45, y: y0 + 0.8, color: C.roofOrange, gable: C.wallButter });
    onFace(kit, '+z', 0.5, 0, y0, () => door(kit));
    anchor('smoke', 0.3, y0 + 1.5, -0.2); // bacadan duman
  },
});
```

2. `src/buildings/index.js` dosyasına `import './bakery.js';` satırını ekleyin.

Mağaza kartı, 3B küçük resim, yerleştirme, inşaat, üretim, kayıt ve köylüler yeni binayı kendiliğinden tanır. Yeni görev eklemek için `src/game/quests.js` listesine bir öğe eklemek yeterlidir.

## Yol haritası

- Hikâye bölümleri ve köy karakterleri (muhtar, demirci, gezgin tüccar)
- Gece–gündüz döngüsü, mevsimler ve hava durumu
- Yeni yapılar: fırın, demirci, değirmen, kütüphane, liman
- Arazi genişletme ve köy düzeni kaydetme
- Başarılar ve günlük ödüller
