# MP4 Dönüştürücü — VLC Uyumlu (Android PWA)

Videoları **VLC'de sorunsuz açılan MP4 (H.264 + AAC)** dosyalarına çeviren, tarayıcıda çalışan PWA.

- 📱 Android Chrome'da ana ekrana eklenir, çevrimdışı çalışır
- 🎬 MP4, MKV, AVI, MOV, WEBM, FLV, WMV, 3GP destekler
- 📚 **Toplu dönüştürme** — birden fazla video seçin, sırayla işlensin
- ♻️ **Orijinalin üzerine yazar** — Chrome'da dosyalara yazma izni verirseniz dönüştürülen dosya aynı isimle (`.mp4`) orijinalin yerine kaydedilir; izin yoksa "⬇️ MP4" bağlantısıyla indirilir
- 🎞️ **Format seçenekleri:** MP4 (H.264+AAC ⭐), MP4 (H.265+AAC), MKV, WEBM (VP9+Opus), AVI (MPEG-4+MP3), MP3 (ses), GIF (animasyon)
- 🔍 **Format tespiti:** seçilen videonun mevcut formatı satırında görünür (ör. `AVI · MPEG-4 + MP3 • 640x480`), dönüşüm sonrası `→ MP4 · H.264 + AAC` yazar
- 🎯 **Hedef boyut:** "100 MB'a sığdır" gibi bir hedef girin, bit hızı ona göre hesaplanır
- 🔒 Dosyalar cihazdan çıkmaz (FFmpeg.wasm)

## GitHub Pages'e yükleme

1. GitHub'da yeni **Public** repo açın (ör. `mp4-donusturucu`).
2. **Add file → Upload files** ile klasördeki **tüm dosyaları** repo köküne yükleyin (klasör oluşturmayın).
3. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**.
4. `https://KULLANICI.github.io/mp4-donusturucu/` adresini Android Chrome'da açın → **⋮ → Uygulamayı yükle**.

## Kullanım

1. **📁 Dosya Ekle** ile bir veya birden çok video seçin (dosya tutamağı izni istenir — üzerine yazmak için "İzin ver" deyin).
2. Kalite/çözünürlük seçin (isteğe bağlı hedef boyut, örn. 100) → **🔄 Tümünü Dönüştür**.
3. Dosyalar sırayla işlenir; her satırda durum görünür: `Yazıldı ✅` (orijinalin yerine geçti) veya `⬇️ MP4` (indirme bağlantısı).

## VLC/libVLC için en iyi format?

**H.264 + AAC (MP4)** — Android'de donanım hızlandırmalı oynatım, her cihazda açılır. H.265/VP9 daha küçük dosya üretir ama eski cihazlarda yazılım çözücü kullanılır (yavaş dönüşüm + pil tüketimi). VLC her şeyi açar; varsayılan olarak H.264 en akıcısıdır.

## Notlar

- İlk dönüşümde motor (~30 MB) bir kez indirilir.
- Çok büyük videolarda **720p** hızlandırır.
- Hedef boyut için kesin sonuç garanti değildir (yaklaşık hedef); video içeriğine göre ±%10 sapabilir.
- GIF çıktısında ses yoktur; çözünürlük "Orijinal" ise 480p'ye sınırlanır.
- Üzerine yazma yalnızca Chrome/Edge'de (File System Access API) çalışır ve uzantı eşleşiyorsa yapılır (ör. MP4→MP4); aksi halde indirme bağlantısı verilir.
