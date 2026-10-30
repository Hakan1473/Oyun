# Kuytu

**Ormanda bir gece daha.**

Kuytu, tarayıcıda çalışan, tepeden sabit açıyla bakılan bir hayatta kalma ve korku oyunudur. Dört arkadaş kamp yaparken ormanda bir şeyle karşılaşır, kaçar ve sisin ortasında, sık ağaçlarla çevrili harabe bir kulübe bulur. Gündüz ağaç keser, kulübeyi onarır, ışık ve barikat kurarsın. Gece ormandan gölgeler çıkar. Işıktan korkarlar ama karanlıkta kalanı alırlar. Grubu sen yönetirsin; verdiğin bazı kararlar geri alınamaz.

Telefonda dokunarak, bilgisayarda fareyle oynanır. Kurulum gerekmez.

## Hikâye — Bölüm 1

- **Ece:** Tıp öğrencisi. Sakin, grubun vicdanı. Yanındakiler daha hızlı iyileşir.
- **Kaan:** Rugbi oyuncusu. Güçlü, aceleci. Kayıp arkadaşları Bora'yı ormanda bırakmayı kendine yediremiyor.
- **Defne:** Fotoğrafçı. O uzun şekli ilk gören oydu. Feneri daha uzağa vurur.
- **Mert:** Mühendislik öğrencisi. Gergin oldukça espri yapar. Her şeyi tamir eder.

Önsöz, kulübeye varış, Bora'yı arayıp aramama kararı, gece duyulan "Bora'nın sesi", kulübede bulunan eski telsiz ve ikinci gece süreli bir feda kararı vardır. Kararlar bayrak bırakır; erken verilen bir karar sonraki sahnede kimin yaşayacağını değiştirebilir.

## Oynanış

- **Gün döngüsü:** Gündüz, alacakaranlık, gece ve şafak. Gündüzü erken bitirmek için "Geceyi bekle".
- **Ağaç kes:** Bir ağaca dokun, "Kes". En yakın boştaki kişi gider ve keser. Ağaç devrilir, odun kazanırsın, açıklık genişler. Bir kişiyi seçip ağaca dokunursan işi o yapar.
- **Kamp ateşi:** Gecenin tek dostudur. Odunla beslenir; sönerse karanlık gelir.
- **Yapılar:** meşale, fener direği, barikat, kapan, branda barınak, odunluk, av tuzağı, telsiz direği. Kulübeyi onarıp güçlendirdikçe daha fazlası açılır.
- **Gölgeler:** Işığın kıyısında dolaşır, önce ışıkları söndürmeye çalışır, karanlıkta kalanı avlar. Barikatları kırar, kapanlara basar. Gece bir gölgeye dokunursan fenerler ona çevrilir.
- **Hayatta kalma:** Her şafakta herkes erzak yer. Erzak yetmezse açlık herkesi zayıflatır. Yaralılar gündüz, özellikle barınak yanında iyileşir. Ölüm kalıcıdır.

## Kontroller

| | Telefon / tablet | Bilgisayar |
|---|---|---|
| Gezinmek | Bir parmakla sürükle | Sürükle, WASD ya da ok tuşları |
| Yakınlaşmak | İki parmakla sıkıştır | Fare tekerleği, + / − |
| Seçmek, emir vermek | Dokun | Tıkla |
| İnşa menüsü | "İnşa" düğmesi | B |
| Diyalog | Dokun | Boşluk / Enter, seçimler için 1–3 |

## Çalıştırma

Derleme gerekmez:

```bash
node tools/serve.mjs        # http://localhost:5173 — aynı ağdaki telefondan da açılır
```

Tek dosyalık sürüm (`dist/kuytu.html`):

```bash
npm install
npm run build
```

Görüntü kalitesi oyundaki Ayarlar sayfasından seçilir (Akıcı / Dengeli / En iyi) ya da adrese eklenir: `?q=low`, `?q=medium`, `?q=high`. Telefon ve tabletler kendiliğinden "Dengeli" ile başlar.

## Görüntü teknolojisi

- **Dokular:** Kabuk, eskimiş tahta, yosunlu ahşap pullar, taş, orman toprağı, patika, ladin iğneleri, eğrelti ve yapraklar açılışta prosedürel olarak boyanır. Hiç görsel dosya yoktur.
- **Yumuşak geometri:** Sarkık dal katmanlı ladinler, eğri tüplerden dallanan ölü ağaçlar, gürültüyle şekillenen kayalar.
- **Render hattı:** HDR sahne ve derinlik üzerinden yere çöken, hareket eden sis. Ateşlerin sise saçılan ışığı, bloom, kenarlarda bulanıklık ve renk sapması, ACES ton eşleme, gün saatine göre renk derecelendirmesi, film greni, sinematik bantlar.
- **Işık:** Ateşler ve meşaleler titreyen nokta ışıklardır. Gece fener hüzmeleri ve gerçek spot ışıklar devreye girer. Gölgeler önbellekte tutulur.
- **Uyarlanabilir kalite:** Kare hızı düşerse çözünürlük kendiliğinden düşer, cihaz hızlıysa yükselir; büyük tablet ekranlarında toplam piksel sayısı sınırlanır.
- **Telefon kademesi:** PBR yerine Lambert ışık modeli, daha az nokta ışık, MSAA yerine FXAA, sadeleştirilmiş sis ve bloom, seyrek bitki örtüsü, arayüzde canlı bulanıklık yok. Tüm gölgelendiriciler açılışta önceden derlenir; ilk gece ya da ilk inşaatta takılma olmaz.

## Mimari

```
src/
  config.js              ayarlar (ızgara, kamera, hayatta kalma sabitleri)
  main.js                açılış
  engine/
    textures.js          prosedürel doku stüdyosu
    materials.js         malzeme kütüphanesi (anahtar adlarla)
    kit.js, geo.js       modelleme kiti, eğri tüp, kaya, kumaş
    post.js              sis, bloom, kenar bulanıklığı, son geçiş
    stage.js, camera.js, input.js, grid.js, fx.js, overlay.js
  world/
    trees.js, forest.js  ağaç geometrileri; orman ve kesilebilir ağaçlar (örnekli)
    ground.js, layout.js zemin, çimen, eğrelti, mantar; patikalar ve açıklık
    cycle.js, lights.js  gün döngüsü, ışık havuzu
    rigs.js              insan ve gölge iskeletleri, prosedürel animasyon
    survivors.js         görevler, nöbet, fener, kaçma, sığınma
    creatures.js         gölge yapay zekâsı
  buildings/             kulübe, kamp yapıları, doğa; registry.js kayıt defteri
  game/
    game.js              görevler, inşa, hasar, ölüm, gün olayları, kayıt
    story.js             Bölüm 1 sahneleri ve kararlar
    roster.js            karakterler
    rules.js, state.js, models.js, entity-view.js
  ui/                    HUD, diyalog, sayfalar, portreler, simgeler
  audio/audio.js         dron, rüzgâr, kalp atışı, fısıltılar ve tüm efektler
```

## Genişletmek

**Yeni yapı:** `src/buildings/` altında `defineBuilding({...})` tanımı yazıp `buildings/index.js` dosyasına bir `import` satırı eklemek yeterli. `light`, `hp`, `storage`, `produces`, `blocksCreatures` alanlarını oyun kendiliğinden tanır.

**Yeni sahne:** `src/game/story.js` içindeki `SCENES` listesine bir öğe ekle. Tetikleyiciler `newgame`, `arrived`, `dusk`, `night`, `dawn`, `day`, `built`, `upgraded`, `chopped`, `death`, `returned` ve `tick` olaylarıdır. Adım türleri konuşma, anlatıcı, seçim (`permanent`, `timer`) ve eylemdir. Eylemler `sendAway`, `killSurvivor`, `stageSiege` gibi `game` metotlarını kullanır.

**Yeni karakter:** `src/game/roster.js` içine görünüş ve yeteneklerle bir kayıt ekle.

## Yol haritası

- Bölüm 2: telsizdeki ses, patikanın sonu, Bora'nın izi
- Yeni gölge türleri (sürünen, taklitçi), sis yoğunlaşması olayları
- Akıl sağlığı ve moral; karakterler arası güven
- Keşif seferleri, erzak ve parça toplama
- Seslendirilmiş diyaloglar
