import { describe, it, expect } from "vitest";
import { createBook, allBlocks } from "../src/core/model";
import type { SourcePage, TextItem, Book } from "../src/core/model";
import { getLines, reconstruct } from "../src/core/layout";
import { setRunningExcluded, mergeBlock } from "../src/core/editor";
import { listMarker } from "../src/core/structure";
import { qualitySummary, issueNeedsReview } from "../src/core/quality";
import { exportEpub } from "../src/core/epub";
import { validateEpub } from "../src/core/validation";
import { demoBook } from "../src/core/demo";
import { unzipSync, strFromU8 } from "fflate";
const t = (
  text: string,
  x = 60,
  y = 120,
  width = 480,
  height = 12,
): TextItem => ({
  text,
  x,
  y,
  width,
  height,
  font: "serif",
  baseline: y + height,
});
const p = (items: TextItem[], number = 1): SourcePage => ({
  number,
  width: 600,
  height: 800,
  rotation: 0,
  items,
  imageCount: 0,
});
const book = (pages: SourcePage[]) =>
  reconstruct({ ...createBook("synthetic.pdf"), pages });
const body = () => [
  t(
    "Ini contoh paragraf panjang untuk memastikan ukuran huruf isi tidak mengikuti ukuran judul.",
    60,
    300,
  ),
  t("Baris lanjutan menyusun paragraf tanpa kehilangan teks sumber.", 60, 317),
  t(
    "Paragraf kedua tetap memiliki posisi sumber yang dapat diperiksa.",
    60,
    355,
  ),
];
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";
describe("regresi PDF teks", () => {
  it("menyambung drop cap tanpa membuat judul satu huruf", () => {
    const b = book([
      p([
        t("P", 60, 90, 21, 36),
        t("ria membaca sebuah buku panjang dengan tenang", 84, 100, 450),
        t("dan melanjutkan paragraf pada baris berikutnya.", 60, 126, 470),
        ...body(),
      ]),
    ]);
    const blocks = allBlocks(b);
    expect(
      blocks.find((b) => b.flags.includes("drop-cap-joined"))?.text,
    ).toContain("Pria membaca");
    expect(
      blocks.find((b) => b.flags.includes("drop-cap-joined"))?.text,
    ).toContain("dan melanjutkan");
    expect(blocks.some((b) => b.kind === "heading" && b.text === "P")).toBe(
      false,
    );
    expect(b.analysis?.missingItems).toBe(0);
    expect(b.analysis?.duplicateItems).toBe(0);
  });
  it("menyatukan nomor bab dan judul beberapa baris, termasuk label mikro duplikat", () => {
    const b = book([
      p([
        t("10.", 265, 70, 70, 36),
        t("10. Ruang dan Waktu Bersama", 250, 112, 100, 5),
        t("Ruang dan Waktu", 160, 115, 300, 36),
        t("Bersama", 220, 155, 170, 36),
        ...body(),
      ]),
    ]);
    const headings = allBlocks(b).filter((b) => b.kind === "heading");
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe("10. Ruang dan Waktu Bersama");
    expect(
      b.chapters.filter((c) => c.blocks.some((b) => !b.excluded)),
    ).toHaveLength(1);
    expect(
      allBlocks(b).find(
        (b) =>
          b.text === "10. Ruang dan Waktu Bersama" &&
          b.flags.includes("running"),
      )?.excluded,
    ).toBe(true);
    expect(b.analysis?.missingItems).toBe(0);
  });
  it("tidak menjadikan kata Bab atau bagian pada kalimat biasa sebagai heading", () => {
    const b = book([
      p([
        t(
          "Bab berikutnya membahas perjalanan panjang yang akan dibaca.",
          60,
          120,
        ),
        t("bagian penting dari pembahasan ini tetap sebuah paragraf.", 60, 165),
        ...body(),
      ]),
    ]);
    expect(allBlocks(b).some((b) => b.kind === "heading")).toBe(false);
  });
  it("mengenali daftar isi tanpa membuat bab dari setiap entrinya", () => {
    const b = book([
      p([
        t("DAFTAR ISI", 60, 40, 180, 24),
        t("PRAKATA ........................................ i", 60, 100),
        t("1. RUANG DAN WAKTU ............................ 3", 60, 125),
        t("Belajar membaca ................................ 4", 80, 150),
      ]),
      p(
        [
          t("1.", 260, 80, 50, 32),
          t("Ruang dan Waktu", 130, 125, 330, 32),
          ...body(),
        ],
        2,
      ),
    ]);
    expect(b.chapters.some((c) => /\.{3}/.test(c.title))).toBe(false);
    expect(
      allBlocks(b).filter(
        (b) => b.flags.includes("source-toc") && b.kind === "paragraph",
      ),
    ).toHaveLength(3);
    expect(b.chapters.some((c) => c.title === "1. Ruang dan Waktu")).toBe(true);
  });
  it("mempertahankan huruf dan ejaan historis tanpa koreksi bahasa otomatis", () => {
    const b = book([
      p([
        t("Djakarta dan jang tetap ditulis sesuai sumber.", 60, 120),
        ...body(),
      ]),
    ]);
    expect(allBlocks(b)[0].text).toContain("Djakarta dan jang");
  });
  it("header ganjil/genap dan footer lokal dapat dipulihkan dengan satu tindakan", () => {
    const pages = Array.from({ length: 6 }, (_, i) =>
      p(
        [
          t(i % 2 ? "Judul Buku" : "Nama Bab", 60, 28, 160, 10),
          t(
            `Isi paragraf halaman ke-${i + 1} yang tetap dipertahankan.`,
            60,
            120,
          ),
          t(
            i % 2 ? `Penulis - ${i + 1}` : `${i + 1} - Penulis`,
            60,
            750,
            150,
            10,
          ),
        ],
        i + 1,
      ),
    );
    const b = book(pages),
      q = qualitySummary(b);
    expect(q.running).toHaveLength(12);
    expect(q.running.every((b) => b.excluded)).toBe(true);
    const restored = setRunningExcluded(b, false);
    expect(qualitySummary(restored).running.every((b) => !b.excluded)).toBe(
      true,
    );
    expect(restored.audit.length).toBe(b.audit.length + 12);
    expect(b.analysis?.coveredItems).toBe(b.analysis?.sourceItems);
  });
  it("menggabungkan paragraf melewati header/footer yang dikecualikan", () => {
    const pages = [
      p([
        t("Nama Buku", 60, 25, 120),
        t("Paragraf panjang masih berlanjut sampai bagian", 60, 710),
        t("1", 500, 760, 20),
      ]),
      p(
        [
          t("Nama Buku", 60, 25, 120),
          t("berikutnya dan berakhir di sini.", 60, 80),
          t("2", 500, 760, 20),
        ],
        2,
      ),
      p(
        [
          t("Nama Buku", 60, 25, 120),
          t("Paragraf lain tidak digabung.", 60, 120),
          t("3", 500, 760, 20),
        ],
        3,
      ),
    ];
    const b = book(pages);
    const joined = allBlocks(b).find((b) =>
      b.flags.includes("cross-page-joined"),
    );
    expect(joined?.text).toBe(
      "Paragraf panjang masih berlanjut sampai bagian berikutnya dan berakhir di sini.",
    );
    expect(joined?.sources.map((s) => s.page)).toEqual([1, 2]);
    expect(b.analysis?.missingItems).toBe(0);
  });
  it("tidak menggabungkan caption halaman sebelumnya dengan paragraf drop cap", () => {
    const b = book([
      p([t("Keterangan gambar tanpa titik", 60, 720, 450), ...body()]),
      p(
        [
          t("R", 60, 70, 21, 36),
          t("uangan baru memiliki cerita sendiri.", 84, 80, 450),
          ...body(),
        ],
        2,
      ),
    ]);
    const paragraph = allBlocks(b).find((b) => b.text.startsWith("Ruangan"));
    expect(paragraph?.sources.every((s) => s.page === 2)).toBe(true);
  });
  it("dialog pembicara dan ucapannya tetap satu blok", () => {
    const b = book([
      p([
        t("Pembicara", 60, 100, 100),
        t(": Mari kita membaca buku ini bersama.", 60, 117, 350),
        t("dan menjaga kelanjutan ucapannya.", 60, 134, 350),
        ...body(),
      ]),
    ]);
    expect(
      allBlocks(b).find((b) => b.flags.includes("dialogue"))?.text,
    ).toContain("Pembicara: Mari kita membaca buku ini bersama.");
  });
  it("baris lanjutan daftar tetap menjadi bagian dari item", () => {
    const b = book([
      p([
        t("1. Satu butir daftar yang cukup panjang hingga", 60, 100, 480),
        t("berlanjut pada baris berikutnya.", 80, 117, 400),
        t("2. Butir kedua tetap terpisah.", 60, 145, 380),
        ...body(),
      ]),
    ]);
    const lists = allBlocks(b).filter((b) => b.kind === "list");
    expect(lists).toHaveLength(2);
    expect(lists[0].text).toContain("berlanjut pada baris berikutnya");
  });
  it("angka tahun tidak diperlakukan sebagai marker daftar", () => {
    expect(
      listMarker("1999) kutipan tahun tetap dipertahankan."),
    ).toBeUndefined();
    const b = book([
      p([t("1999) kutipan tahun tetap dipertahankan."), ...body()]),
    ]);
    expect(allBlocks(b)[0].kind).toBe("paragraph");
  });
  it("bookmark generik tidak menjadi bab", () => {
    const input = {
      ...createBook("fixture.pdf"),
      pages: [p(body())],
      outline: [{ title: "Screenshot (1).pdf (p.1)", page: 1 }],
    };
    const b = reconstruct(input);
    expect(b.chapters.every((c) => !c.title.includes("Screenshot"))).toBe(true);
    expect(b.issues.some((i) => i.kind === "toc")).toBe(true);
  });
});
describe("ekspor terstruktur", () => {
  it("daftar numerik dan alfabet mempertahankan penomoran", () => {
    const b = demoBook();
    b.chapters[0].blocks[1].kind = "list";
    b.chapters[0].blocks[1].text = "3. Mulai dari tiga";
    b.chapters[0].blocks[2].kind = "list";
    b.chapters[0].blocks[2].text = "4. Lanjut empat";
    b.chapters[1].blocks[1].kind = "list";
    b.chapters[1].blocks[1].text = "b. Mulai dari b";
    const bytes = exportEpub(b),
      z = unzipSync(bytes);
    expect(strFromU8(z["EPUB/chapter-1.xhtml"])).toContain(
      '<ol start="3" type="1">',
    );
    expect(strFromU8(z["EPUB/chapter-1.xhtml"])).toContain('value="4"');
    expect(strFromU8(z["EPUB/chapter-2.xhtml"])).toContain(
      '<ol start="2" type="a">',
    );
    expect(validateEpub(bytes)).toEqual([]);
  });
  it("gambar disertakan di manifest, XHTML dan arsip dengan aset valid", () => {
    const b = demoBook();
    b.pages = [
      {
        ...p([]),
        images: [
          {
            id: "art",
            type: "image/png",
            data: png,
            page: 1,
            x: 60,
            y: 250,
            width: 240,
            height: 160,
          },
        ],
      },
    ];
    b.chapters[0].blocks.splice(2, 0, {
      id: "figure-art",
      kind: "figure",
      assetId: "art",
      text: "Ilustrasi & sumber",
      originalText: "",
      order: 2,
      sources: [{ page: 1, x: 60, y: 250, width: 240, height: 160 }],
      flags: [],
    });
    const bytes = exportEpub(b),
      z = unzipSync(bytes);
    expect(z["EPUB/assets/image-1.png"]).toBeDefined();
    expect(strFromU8(z["EPUB/package.opf"])).toContain(
      'href="assets/image-1.png" media-type="image/png"',
    );
    expect(strFromU8(z["EPUB/chapter-1.xhtml"])).toContain(
      "<figcaption>Ilustrasi &amp; sumber</figcaption>",
    );
    expect(validateEpub(bytes)).toEqual([]);
  });
  it("menolak referensi gambar hilang dan cakupan sumber bermasalah", () => {
    const b = demoBook();
    b.chapters[0].blocks[1].kind = "figure";
    b.chapters[0].blocks[1].assetId = "missing";
    expect(() => exportEpub(b)).toThrow(/gambar/);
    const other = demoBook();
    other.analysis = {
      sourceItems: 4,
      coveredItems: 3,
      missingItems: 1,
      duplicateItems: 0,
      images: 0,
      excludedRunning: 0,
    };
    expect(() => exportEpub(other)).toThrow(/Cakupan/);
  });
  it("gabung manual melewati blok yang dikecualikan tanpa menghapus sumbernya", () => {
    const b = demoBook();
    b.chapters[0].blocks[2].excluded = true;
    const merged = mergeBlock(b, b.chapters[0].blocks[1].id);
    expect(
      allBlocks(merged).some((x) => x.id === b.chapters[0].blocks[2].id),
    ).toBe(true);
    expect(allBlocks(merged).length).toBe(allBlocks(b).length - 1);
  });
});

describe("lapisan OCR dan catatan kualitas", () => {
  it("mengenali daftar lsi OCR dan mencocokkan judul terbungkus tanpa mengubah ejaan sumber", () => {
    const b = book([
      p([
        t("Daftar lsi", 60, 40, 170, 24),
        t("Kata Pengantar", 60, 100, 200),
        t("vi", 500, 100, 20),
        t("Langkah Me nuju Rumah", 60, 125, 260),
        t("12", 500, 125, 20),
        t("Cerita Berikutnya", 60, 150, 260),
        t("18", 500, 150, 20),
      ]),
      p(
        [
          t("Langkah Menuju", 60, 50, 280, 18),
          t("Rumah", 60, 76, 150, 18),
          ...body(),
        ],
        2,
      ),
    ]);
    expect(b.chapters.some((c) => c.title === "Langkah Menuju Rumah")).toBe(
      true,
    );
    expect(
      allBlocks(b).some(
        (b) =>
          b.text === "Langkah Me nuju Rumah" && b.flags.includes("source-toc"),
      ),
    ).toBe(true);
    expect(b.analysis?.missingItems).toBe(0);
  });
  it("menyimpan teks sebelum sambungan drop cap dan audit transformasinya", () => {
    const b = book([
      p([
        t("P", 60, 90, 21, 36),
        t("ria membaca buku yang panjang.", 84, 100, 420),
        ...body(),
      ]),
    ]);
    const joined = allBlocks(b).find((b) =>
      b.flags.includes("drop-cap-joined"),
    )!;
    expect(joined.originalText).toContain("P\nria");
    expect(
      b.audit.some(
        (a) => a.blockId === joined.id && a.action.includes("huruf awal"),
      ),
    ).toBe(true);
  });
  it("memisahkan informasi terselesaikan dari peringatan yang perlu ditinjau", () => {
    const pages = Array.from({ length: 3 }, (_, i) =>
      p([t("Nama Buku", 60, 25, 130), ...body()], i + 1),
    );
    const b = book(pages),
      running = b.issues.filter((i) => i.kind === "running");
    expect(running.every((i) => !issueNeedsReview(b, i))).toBe(true);
    const restored = setRunningExcluded(b, false);
    expect(running.every((i) => issueNeedsReview(restored, i))).toBe(true);
    expect(
      issueNeedsReview(b, {
        id: "mask",
        page: 1,
        kind: "image",
        message: "Periksa mask",
      }),
    ).toBe(true);
  });
});

it("menggunakan outline yang valid beserta tingkat subjudulnya", () => {
  const input = {
    ...createBook("outline.pdf"),
    pages: [
      p([
        t("Ruang untuk Belajar", 60, 100),
        t("Sebuah subbagian", 60, 150),
        ...body(),
      ]),
    ],
    outline: [
      { title: "Ruang untuk Belajar", page: 1, level: 1 },
      { title: "Sebuah subbagian", page: 1, level: 2 },
    ],
  };
  const b = reconstruct(input);
  expect(
    allBlocks(b)
      .filter((b) => b.kind === "heading")
      .map((b) => b.level),
  ).toEqual([1, 2]);
  expect(b.chapters).toHaveLength(1);
});
