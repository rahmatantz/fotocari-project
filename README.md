# FotoCari — editor foto rumahcari

Aplikasi edit foto pribadi (mirip Evoto) untuk **foto listing properti** dan **potret**.
Semua proses berjalan langsung di HP: tanpa upload, tanpa kuota, dan tetap bisa dipakai offline.

## Fitur
- **Mode Properti**: Auto Listing, Interior Terang, Langit Biru, HDR Natural (jendela tidak gosong), Senja Hangat, Bersih Putih
- **Mode Potret**: Natural Glow, Studio Clean, Hangat Lembut, Wisuda Cerah, Hitam Putih, Moody
- **Atur manual**: auto enhance, eksposur, kontras, highlight, bayangan, putih/hitam, suhu warna, tint, saturasi, vibrance, kejernihan, ketajaman, vignette
- **Retouch**: haluskan & cerahkan kulit (deteksi kulit otomatis), langit biru, luruskan, tegakkan vertikal (dinding miring)
- **Bingkai**: rasio 4:3 / 3:2 / 16:9 / 1:1 / 4:5 IG / 9:16, watermark `rumahcari.com` + nama/WA
- **Batch**: impor banyak foto, terapkan pengaturan ke semua, ekspor ZIP (Listing 1600px / HD / Penuh)
- Preset pribadi bisa disimpan, ada tombol undo dan perbandingan sebelum/sesudah, plus tema gelap/terang

## Cara dapat file APK (GitHub Actions, gratis)
1. Buka https://github.com/new, buat repo baru bernama `fotocari` (boleh **Private**).
2. Upload isi folder ini ke repo tersebut. Cara termudah:
   - Pakai Git di PC:
     ```bash
     cd fotocari
     git init && git add . && git commit -m "FotoCari v1"
     git branch -M main
     git remote add origin https://github.com/USERNAME/fotocari.git
     git push -u origin main
     ```
   - Atau lewat web: **Add file → Upload files**, lalu seret semua isi folder.
     Folder `.github` kadang tidak ikut terunggah lewat web. Kalau begitu, buka tab **Actions → set up a workflow yourself**,
     beri nama `build-apk.yml`, lalu tempel isi file `.github/workflows/build-apk.yml`.
3. Buka tab **Actions** dan tunggu proses **Build APK** selesai (±5–8 menit, tanda centang hijau).
4. Klik proses tersebut, lalu di bagian **Artifacts** unduh **FotoCari-apk** (berupa ZIP berisi `FotoCari.apk`).
5. Kirim `FotoCari.apk` ke HP, buka, lalu izinkan **Instal dari sumber tidak dikenal**.

Tip: kalau ingin APK langsung muncul di halaman *Releases*, buat tag lewat `git tag v1.0 && git push --tags`.

## Build di PC sendiri (opsional)
Butuh Node 22, JDK 21, dan Android SDK (Android Studio):
```bash
npm ci
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# hasil: android/app/build/outputs/apk/debug/app-debug.apk
```

## Ubah dan kembangkan
- Tampilan & alur aplikasi: `src/App.jsx`
- Mesin pengolah foto & preset: `src/engine.js` (tambah preset di `PRESETS`)
- Simpan/bagikan file di Android: `src/platform.js`
- Coba di browser: `npm run dev`

Hasil ekspor di Android akan membuka menu **Bagikan**, jadi foto bisa langsung disimpan ke Galeri atau Drive, atau dikirim lewat WhatsApp.
Salinannya juga tersimpan di folder `Documents/FotoCari`.
