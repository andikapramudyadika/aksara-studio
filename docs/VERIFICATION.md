# Pemeriksaan yang benar-benar dijalankan

Lingkungan: Node.js 24, Chromium headless Linux melalui Playwright. Semua data uji sintetis; tidak ada ebook pengguna dimasukkan ke repository.

## Hasil

- `npm run typecheck`: lulus.
- `npm test`: 18 tes lulus, mencakup paragraf terpisah, wrapped lines, paragraf pendek/indentasi, sambungan lintas halaman, dialog/daftar/heading/scene break, header/footer berulang yang tidak dihapus, urutan dua kolom, halaman tanpa teks/gambar, karakter khusus/soft hyphen, cakupan source refs, editor, mimetype/TOC/aset EPUB.
- `npm run build`: production build lulus. Worker PDF.js, layout, pengemasan EPUB, font lokal, CMaps, standard fonts dan WASM tersedia sebagai aset statis.
- `npm run test:e2e`: 5 skenario Chromium lulus:
  1. Layar awal desktop 1440 px, tablet 820 px, mobile 375 px dan 320 px, tema gelap, pengaturan, dialog panduan. Screenshot diperiksa; tidak ada overflow horizontal pada viewport yang diuji.
  2. Unggah PDF nyata sintetis, ekstraksi dua halaman, wrapped paragraph, edit karakter XML, undo/redo, render sumber, mobile PDF/EPUB tabs, metadata, unduhan EPUB, pembaca EPUB.js, reload dan membuka proyek tersimpan. Tidak ada `pageerror` selama skenario ini.
  3. Buku contoh, pisah/gabung, ekspor dan impor arsip proyek, halaman kosong serta peringatan OCR.
  4. Batal dan lanjutkan checkpoint pada PDF sintetis 40 halaman; seluruh 40 heading ditemukan setelah selesai.
  5. Navigasi keyboard, fokus dialog dan pengembaliannya, separator dengan tombol panah, preferensi reduced motion, kegagalan quota IndexedDB yang disimulasikan, PDF rusak dan tombol retry.
- Build `BASE_PATH=/aksara-studio/ npm run build` disajikan melalui HTTP statis di `/aksara-studio/`. Skenario unggah PDF → edit → unduh EPUB → pembaca → reload proyek lulus pada subpath tersebut; membuktikan jalur aset dan worker yang dipakai skenario itu.
- EPUBCheck **5.4.0** dijalankan pada EPUB hasil download browser serta fixture sintetis (karakter khusus dan heading navigasi). Hasil: **0 fatal, 0 error, 0 warning, 0 info**.
- Pemeriksaan ringan browser memvalidasi XML dan referensi, terpisah dari EPUBCheck Java. Workflow Pages juga membuat fixture dan menjalankan EPUBCheck.

## Batas pengujian

Belum diuji pada perangkat Chrome Android fisik, keyboard virtual OS, pembaca EPUB eksternal seperti Apple Books/Kobo, PDF pengguna sesungguhnya, dokumen ribuan halaman, atau seluruh variasi CJK/RTL/rotasi/kolom campuran. Emulasi viewport Chromium bukan jaminan kesetaraan dengan perangkat fisik. Belum dilakukan audit WCAG 2.2 AA menyeluruh. Heuristik tidak menjamin semua isi/urutan PDF sempurna.

Gambar isi, tabel, rumus, catatan kaki, serta OCR belum didukung andal; keterbatasan terlihat dalam UI dan README. Undo/redo riwayat sesi tidak disimpan lintas reload; koreksi terakhir tetap disimpan. Fitur AI belum diimplementasikan dan kompatibilitas OpenRouter pada origin Pages belum diuji.

GitHub Actions workflow sudah disiapkan, tetapi deployment GitHub Pages pada akun pengguna belum dijalankan dari lingkungan ini. Panduan aktivasi tersedia di README.
