# MP4 Dönüştürücü — VLC Uyumlu (Android PWA)

Videoları **VLC'de sorunsuz açılan MP4 (H.264 + AAC)** dosyalarına çeviren, tarayıcıda çalışan PWA.

- 📱 Android Chrome'da ana ekrana eklenir, çevrimdışı çalışır
- 🎬 MP4, MKV, AVI, MOV, WEBM, FLV, WMV, 3GP destekler
- 📚 **Toplu dönüştürme** — birden fazla video seçin, sırayla işlensin
- 💾 **Otomatik kayıt:** dönüştürülen videolar **İndirilenler/mp4** klasörüne orijinal adıyla kaydedilir (bir kez klasör seçmeniz yeterli); klasör seçimi yoksa doğrudan İndirilenler'e iner — elle indirme yok
- 🎞️ **Format seçenekleri:** MP4 (H.264+AAC ⭐), MP4 (H.265+AAC), MKV, WEBM (VP9+Opus), AVI (MPEG-4+MP3), MP3 (ses), GIF (animasyon)
- 🔍 **Format tespiti:** seçilen videonun mevcut formatı satırında görünür (ör. `AVI · MPEG-4 + MP3 • 640x480`), dönüşüm sonrası `→ MP4 · H.264 + AAC` yazar
- 🎯 **Hedef boyut:** "100 MB'a sığdır" gibi bir hedef girin, bit hızı ona göre hesaplanır
- ⚡ **Kodekleri koru:** zaten uyumlu dosyalar saniyeler içinde yeniden paketlenir (kayıpsız)
- 🧵 Dönüşüm **Web Worker**'da yapılır — ekran kilitlenmez, ilerleme çubuğu canlı akar
- 🔒 Dosyalar cihazdan çıkmaz (FFmpeg.wasm)

## GitHub Pages'e yükleme

1. GitHub'da yeni **Public** repo açın (ör. `mp4-donusturucu`).
2. **Add file → Upload files** ile klasördeki **tüm dosyaları** repo köküne yükleyin (klasör oluşturmayın).
3. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**.
4. `https://KULLANICI.github.io/mp4-donusturucu/` adresini Android Chrome'da açın → **⋮ → Uygulamayı yükle**.

## Kullanım

1. Üstteki alana dokunarak bir veya birden çok video seçin. (İlk kez: "📁 mp4 klasörü" düğmesiyle İndirilenler klasörünü seçin — uygulama `mp4` klasörünü açar.)
2. Kalite/çözünürlük seçin (isteğe bağlı hedef boyut, örn. 100) → **🔄 Tümünü Dönüştür**.
3. Dosyalar sırayla işlenir ve **otomatik kaydedilir**: `Kaydedildi ✅` (İndirilenler/mp4) veya `İndirildi ✅` (İndirilenler).

## VLC/libVLC için en iyi format?

**H.264 + AAC (MP4)** — Android'de donanım hızlandırmalı oynatım, her cihazda açılır. H.265/VP9 daha küçük dosya üretir ama eski cihazlarda yazılım çözücü kullanılır (yavaş dönüşüm + pil tüketimi). VLC her şeyi açar; varsayılan olarak H.264 en akıcısıdır.

## Notlar

- İlk dönüşümde motor (~30 MB) bir kez indirilir. Motor **tek çekirdekli**dir (@ffmpeg/core-st) — SharedArrayBuffer gerektirmez, bu yüzden GitHub Pages'te ve PWA'da sorunsuz çalışır.
- Tek çekirdek nedeniyle kodlama yavaştır; büyük videolarda **720p + Hızlı** seçin (ör. 340 MB'lık bölüm telefonda uzun sürebilir).
- Hedef boyut için kesin sonuç garanti değildir (yaklaşık hedef); video içeriğine göre ±%10 sapabilir.
- GIF çıktısında ses yoktur; çözünürlük "Orijinal" ise 480p'ye sınırlanır.
- Klasöre kaydetme File System Access API ister (Chrome 132+ Android, masaüstü Chrome/Edge); desteklemeyen tarayıcılarda dosyalar otomatik olarak İndirilenler'e iner.
