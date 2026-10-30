# Dependensi & keputusan

Dokumentasi API dan lisensi dibaca dari paket terpasang dan dokumentasi README-nya.

- React / React DOM — MIT. Antarmuka.
- Vite — MIT; TypeScript — Apache-2.0.
- PDF.js (`pdfjs-dist`) — Apache-2.0. `getDocument`, `getTextContent`, viewport transforms, outline dan operator list. Worker dibundel dengan Vite URL import; halaman sumber dirender sesuai kebutuhan dan render lama dibatalkan. Operator gambar beserta transformasinya dipakai untuk menentukan area PNG; satu canvas halaman dilepas setelah ekstraksi.
- `fflate` — MIT. ZIP ringan dengan `zipSync` dan level per entri: mimetype EPUB pertama dan disimpan tanpa kompresi. Batas tahap pertama 200 MB untuk input; Pengemasan EPUB dijalankan pada Web Worker terpisah.
- `epubjs` — BSD-2-Clause. Pembaca EPUB browser, lazy-loaded; `renderTo`, `display`, `prev`, `next`, lifecycle destroy. EPUB pratinjau berasal dari exporter yang melakukan XML escaping; scripted content tidak diizinkan.
- `idb` — ISC. Wrapper IndexedDB.
- `lucide-react` — ISC. Ikon outline konsisten.
- `pdf-lib` — MIT. Hanya untuk membuat buku contoh sintetis/fixture; tidak digunakan untuk mengubah PDF pengguna.
- Vitest — MIT; Playwright — Apache-2.0. Pengujian.

Semua dependensi runtime dan worker dibundel. Font DM Sans dan Lora dibundel lokal melalui fontsource, dengan fallback sistem/Georgia.
