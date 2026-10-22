# LUMORA: Son Fener

Three.js ile yazılmış, tarayıcıda ve telefonda çalışan küçük bir açık dünya macera oyunu. Tek bir `index.html` dosyasıdır; kurulum, sunucu ya da harici görsel/ses dosyası gerektirmez. Ada, ağaçlar, dokular, müzik ve ses efektleri açılışta prosedürel olarak üretilir.

## Hikâye

Lumora Adası'nda güneş yüz yıldır doğmuyor. Beş Işık Sunağı söndüğünden beri ada alacakaranlığa ve Sis Ruhları'na teslim olmuş. Sen, son fener bekçisinin çırağı **Ela**'sın. Kamp ateşinin başındaki **Bekçi Ilgaz** ile konuş, beş sunağı uyandır ve kuzeydeki Büyük Fener'i yeniden yak.

Her uyanan sunak güneşi biraz daha yükseltir: sis incelir, ışık ısınır, müzik minörden majöre döner. Final sahnesinde fener yanar ve şafak söker.

## Oynanış

- **Sunak ritüeli:** Sunağa yaklaş, "Uyandır" de. İlerleme çemberi dolarken rune çemberinin içinde kal; Sis Ruhları dalgalar halinde saldırır.
- **Işık patlaması:** Fener enerjisi harcayarak çevrendeki ruhları dağıtır.
- **Işık Tohumları:** Adaya dağılmış 40 altın tohum. Enerji ve can verir.
- **Kamp ateşi güvenli bölgedir.** Ölürsen son uyandırdığın sunakta yeniden doğarsın.
- İlerleme tarayıcıya otomatik kaydedilir ("Devam Et").

## Kontroller

| | Bilgisayar | Telefon |
|---|---|---|
| Hareket | W A S D / ok tuşları | Ekranın sol yarısında sanal joystick |
| Koş | Shift | Joystick'i sonuna kadar it |
| Zıpla | Boşluk | Zıpla düğmesi |
| Işık patlaması | F | Işık (yıldız) düğmesi |
| Etkileşim | E | Beliren "Konuş / Uyandır" düğmesi |
| Kamera | Fareyle sürükle, tekerlek ile yakınlaş | Ekranın sağ yarısında sürükle |
| Duraklat | Esc / P | Sağ üstteki düğme |

## Grafik özellikleri

- Gürültü tabanlı ada yüksekliği, patikalar, kumsal, kayalık ve karlı zirve; köşe renkli ve normal haritalı arazi
- Fresnel yansımalı, kıyı köpüklü, derinliğe göre renk değiştiren su ve sığ suda kostik ışık desenleri
- Fiziksel gökyüzü, prosedürel bulutlar, ilerlemeyle değişen güneş ve yükseklik tabanlı yer sisi
- GPU'da oyuncuyu takip eden 80.000'e kadar rüzgârda sallanan çimen; oyuncu yürüdükçe eğilir
- Rüzgârda sallanan çam, meşe ve kiraz ağaçları; kamera ile oyuncu arasında kalan yapraklar titreşimli şeffaflaşır
- Prosedürel yürüme/koşma/zıplama/yüzme animasyonları, verlet fiziğiyle uçuşan atkı, sallanan fener ışığı
- Bloom, ACES ton eşleme, renk derecelendirme, vinyet ve film greni
- Mobil için otomatik kalite seçimi ve kare hızına göre uyarlanan çözünürlük; duraklatma menüsünden Düşük/Orta/Yüksek

## Çalıştırma

`index.html` dosyasını modern bir tarayıcıda açman yeterli (Three.js jsDelivr CDN'den yüklenir, internet bağlantısı gerekir).

**Google AI Studio'da:** Build modunda yeni bir uygulama açıp `index.html` içeriğini projenin `index.html` dosyasına yapıştırabilirsin. Oyun tek dosya ve harici varlık kullanmadığı için başka bir dosyaya gerek yoktur.

## Geliştirme

Kaynak kod `src/` altında modüllere bölünmüştür; `index.html` bunlardan üretilir:

```
node build.mjs
```

| Dosya | İçerik |
|---|---|
| `src/template.html` | Arayüz, menüler, CSS |
| `src/js/01-core.js` | Yardımcılar, gürültü, prosedürel dokular, renderer, sis |
| `src/js/02-world.js` | Ada şekli, patikalar, arazi, su, gökyüzü ve atmosfer |
| `src/js/03-props.js` | Ağaçlar, çimen, kayalar, sunaklar, fener, kamp, harabeler |
| `src/js/04-entities.js` | Parçacıklar, karakterler, animasyon, Sis Ruhları, tohumlar |
| `src/js/05-audio.js` | WebAudio ile prosedürel müzik ve efektler |
| `src/js/06-game.js` | Kontroller, kamera, arayüz, hikâye akışı, ana döngü |
