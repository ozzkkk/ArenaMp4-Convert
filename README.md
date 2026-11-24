# MP4 Dönüştürücü — VLC Uyumlu (Android PWA)

Videoları **VLC'de sorunsuz açılan MP4 (H.264 + AAC)** dosyalarına çeviren, tarayıcıda çalışan PWA.

- 📱 Android Chrome'da ana ekrana eklenir, çevrimdışı çalışır
- 🎬 MP4, MKV, AVI, MOV, WEBM, FLV, WMV, 3GP destekler
- 📚 **Toplu dönüştürme** — birden fazla video seçin, sırayla işlensin
- ♻️ **Orijinalin üzerine yazar** — Chrome'da dosyalara yazma izni verirseniz dönüştürülen dosya aynı isimle (`.mp4`) orijinalin yerine kaydedilir; izin yoksa "⬇️ MP4" bağlantısıyla indirilir
- 🔒 Dosyalar cihazdan çıkmaz (FFmpeg.wasm)

## GitHub Pages'e yükleme

1. GitHub'da yeni **Public** repo açın (ör. `mp4-donusturucu`).
2. **Add file → Upload files** ile klasördeki **tüm dosyaları** repo köküne yükleyin (klasör oluşturmayın).
3. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**.
4. `https://KULLANICI.github.io/mp4-donusturucu/` adresini Android Chrome'da açın → **⋮ → Uygulamayı yükle**.

## Kullanım

1. **📁 Dosya Ekle** ile bir veya birden çok video seçin (dosya tutamağı izni istenir — üzerine yazmak için "İzin ver" deyin).
2. Kalite/çözünürlük seçin → **🔄 Tümünü Dönüştür**.
3. Dosyalar sırayla işlenir; her satırda durum görünür: `Yazıldı ✅` (orijinalin yerine geçti) veya `⬇️ MP4` (indirme bağlantısı).

## Notlar

- İlk dönüşümde motor (~30 MB) bir kez indirilir.
- Çok büyük videolarda **720p** hızlandırır.
- Üzerine yazma yalnızca Chrome/Edge'de (File System Access API) çalışır; diğer tarayıcılarda indirme bağlantısı verilir.
