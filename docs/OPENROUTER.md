# Rancangan tahap 2: OpenRouter

Belum diimplementasikan dan tidak ada request AI pada tahap pertama.

- Key dimasukkan pengguna pada UI hanya ketika fitur AI tersedia. Default disimpan di memori sesi; jangan masukkan ke source, VITE_*, log, build, URL atau IndexedDB. Penyimpanan key permanen harus opt-in dengan penjelasan risiko.
- Adapter browser melakukan POST langsung ke OpenRouter. Sebelum menyatakan didukung, uji CORS, preflight, Authorization, stream, abort, dan error dari origin GitHub Pages yang sesungguhnya. Pengujian ini belum dilakukan.
- GET katalog model API; cache hanya metadata, favorit lokal, fallback input ID manual. Model terjemahan dan model ringkasan dipilih terpisah. Hormati batas konteks, output, harga dan kapabilitas model yang dapat berubah.
- Teks buku dikirim sebagai data dalam envelope terstruktur. Instruksi dalam isi buku tidak dipercaya. Prompt sistem hanya meminta transformasi data; tidak ada tool execution berdasarkan isi buku.
- Sebelum request, tampilkan persetujuan pengiriman teks ke layanan eksternal dan cakupan blok yang dikirim.
- Terjemahkan per batch block ID stabil. Schema respons: `{blocks:[{id,translation}]}`. Validasi ID hilang, tidak dikenal, duplikat, teks kosong. Jangan mengganti sumber asli; simpan translasi terpisah menurut ID, model, bahasa, hash sumber, versi glosarium.
- Glosarium per proyek; perubahan glosarium menandai translasi lama untuk ditinjau. Batasi batch dengan anggaran token konservatif dan tumpang tindih konteks yang tidak diekspor.
- Deteksi finish_reason length, JSON terpotong, response kosong; pecah batch, retry hanya blok gagal. Timeout AbortController, pembatalan, antrean terbatas, Retry-After dan exponential backoff dengan jitter untuk 429/5xx. Jangan retry otomatis kegagalan otorisasi.
- Checkpoint hasil tervalidasi di IndexedDB setelah setiap batch; status pending/running/complete/failed untuk tiap block ID. Resume tidak mengirim ulang blok valid. Key harus dimasukkan lagi setelah sesi berakhir.
- Estimasi biaya diberi label perkiraan dan dihitung dari katalog harga serta estimasi token; tampilkan usage/cost aktual bila API mengembalikannya. Jangan menjamin biaya sebelum respons.
- Ringkas per bagian lalu sintesis berdasarkan rangkuman bagian. Gaya naratif, poin penting, catatan belajar, akademik. Laporan mencatat bagian/blok tercakup, gagal, dilewati; ringkasan selalu menjadi artefak terpisah dari isi buku utuh.

## PDF terjemahan dengan tata letak mendekati sumber

Tahap lanjutan terpisah. Panjang teks terjemahan menimbulkan overflow; perlu pengukuran font, fallback glyph, shaping RTL/CJK, pemecahan baris, ukuran minimum, relayout kotak, dan rekonstruksi urutan/kolom. Penggantian teks harus menghapus konten lama secara benar, menjaga gambar dan hak akses dokumen. Overlay putih sederhana tidak dianggap penggantian teks sempurna. Tidak menjanjikan tampilan identik.
