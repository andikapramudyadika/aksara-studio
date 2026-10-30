# Pemeriksaan yang benar-benar dijalankan

Lingkungan: Node.js 24, Chromium headless Linux melalui Playwright. Tes repository dan CI menggunakan fixture sintetis. Dokumen pengguna hanya diuji secara lokal dan tidak dimasukkan ke repository.

## Hasil

- `npm run typecheck`: lulus.
- `npm test`: 38 tes lulus, mencakup paragraf terpisah, wrapped lines, paragraf pendek/indentasi, sambungan lintas halaman, dialog/daftar/heading/scene break, header/footer berulang yang dapat dipulihkan, urutan dua kolom, halaman tanpa teks/gambar, karakter khusus/soft hyphen, cakupan source refs, editor, mimetype/TOC/aset EPUB.
- `npm run build`: production build lulus. Worker PDF.js, layout, pengemasan EPUB, font lokal, CMaps, standard fonts dan WASM tersedia sebagai aset statis.
- `npm run test:e2e`: 6 skenario Chromium lulus:
  1. Layar awal desktop 1440 px, tablet 820 px, mobile 375 px dan 320 px, tema gelap, pengaturan, dialog panduan. Screenshot diperiksa; tidak ada overflow horizontal pada viewport yang diuji.
  2. Unggah PDF nyata sintetis, ekstraksi dua halaman, wrapped paragraph, edit karakter XML, undo/redo, render sumber, mobile PDF/EPUB tabs, metadata, unduhan EPUB, pembaca EPUB.js, reload dan membuka proyek tersimpan. Tidak ada `pageerror` selama skenario ini.
  3. Buku contoh, pisah/gabung, ekspor dan impor arsip proyek, halaman kosong serta peringatan OCR.
  4. Batal dan lanjutkan checkpoint pada PDF sintetis 40 halaman; seluruh 40 heading ditemukan setelah selesai.
  5. Ilustrasi PDF asli sintetis diekstrak ke PNG, tersedia pada editor/manifest/ZIP, judul beberapa baris dan drop cap disambung, pemulihan massal dan undo berfungsi.
  6. Navigasi keyboard, fokus dialog dan pengembaliannya, separator dengan tombol panah, preferensi reduced motion, kegagalan quota IndexedDB yang disimulasikan, PDF rusak dan tombol retry.
- Build `BASE_PATH=/aksara-studio/ npm run build` disajikan melalui HTTP statis di `/aksara-studio/`. Skenario unggah PDF → edit → unduh EPUB → pembaca → reload proyek lulus pada subpath tersebut; membuktikan jalur aset dan worker yang dipakai skenario itu.
- EPUBCheck **5.4.0** dijalankan pada EPUB hasil download browser serta fixture sintetis (karakter khusus dan heading navigasi). Hasil: **0 fatal, 0 error, 0 warning, 0 info**.
- Pemeriksaan ringan browser memvalidasi XML dan referensi, terpisah dari EPUBCheck Java. Workflow Pages juga membuat fixture dan menjalankan EPUBCheck.
- Deployment publik GitHub Pages berhasil: https://andikapramudyadika.github.io/aksara-studio/. HTTP halaman, JavaScript, dan CSS mengembalikan 200. Job **build**, **deploy**, dan **Verify public Pages** lulus pada [workflow run 41008028758](https://github.com/andikapramudyadika/aksara-studio/actions/runs/41008028758). Smoke test Chromium pada origin produksi memverifikasi unggah PDF sintetis, rekonstruksi, edit/undo/redo, tab mobile, unduhan EPUB, pembaca EPUB.js, reload dan proyek tersimpan.

## Uji dokumen nyata secara lokal

- PDF teks 356 halaman diuji melalui antarmuka browser dari unggah hingga unduh EPUB. Seluruh 37.859 item teks memiliki referensi sumber, dengan 0 referensi hilang dan 0 referensi ganda pada model sebelum edit manual. Cakupan ini termasuk blok yang dikecualikan; ini bukan jaminan semua teks harus disertakan dalam EPUB atau semua interpretasi layout sudah benar.
- Sebelas bab utama dikenali bersama bagian awal/referensi. Tidak ada judul bab satu huruf. Ilustrasi menghasilkan 52 blok gambar serta satu sampul asli. Dua operasi kecil/mask belum ditangani; area yang bersinggungan dengan teks diberi peringatan. Posisi dan isi diperiksa pada halaman perwakilan, bukan audit manual setiap halaman.
- PDF screenshot + lapisan teks 74 halaman juga diuji lokal. Lapisan teks tersedia untuk disusun ulang; foto yang menyatu dengan gambar halaman tidak dipisah dan batas tersebut dilaporkan. Referensi 4.406 item teks tetap tercakup tanpa hilang atau ganda.
- Dokumen dan hasil pengguna disimpan hanya sebagai artefak lokal, tidak dimasukkan ke Git/repository/artefak CI. Tes publik menggunakan fixture sintetis yang meniru jenis layout, bukan salinan buku.
- EPUB hasil konversi dokumen 356 halaman dan fixture struktur bergambar lolos EPUBCheck 5.4.0 dengan 0 error dan 0 warning.

## Batas pengujian

Belum diuji pada perangkat Chrome Android fisik, keyboard virtual OS, pembaca EPUB eksternal seperti Apple Books/Kobo, dokumen ribuan halaman, atau seluruh variasi CJK/RTL/rotasi/kolom campuran. Emulasi viewport Chromium bukan jaminan kesetaraan dengan perangkat fisik. Belum dilakukan audit WCAG 2.2 AA menyeluruh. Heuristik tidak menjamin semua isi/urutan PDF sempurna.

Gambar umum didukung dan diuji; mask, pengulangan, teks bertumpuk, tabel, rumus, catatan kaki, serta OCR baru masih memiliki batas; keterbatasan terlihat dalam UI dan README. Undo/redo riwayat sesi tidak disimpan lintas reload; koreksi terakhir tetap disimpan. Fitur AI belum diimplementasikan dan kompatibilitas OpenRouter pada origin Pages belum diuji.

GitHub Pages sudah aktif dengan Source: GitHub Actions. Push perubahan aplikasi ke branch `main` menjalankan build, deployment, dan verifikasi publik otomatis. Panduan pengelolaan tersedia di README.
