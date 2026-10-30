import { describe, it, expect } from "vitest";
import { reconstruct, getLines, joinLines } from "../src/core/layout";
import { createBook, allBlocks } from "../src/core/model";
import type { SourcePage, TextItem } from "../src/core/model";
import { exportEpub, escapeXml } from "../src/core/epub";
import { validateEpub } from "../src/core/validation";
import { demoBook } from "../src/core/demo";
import {
  editBlock,
  splitBlock,
  mergeBlock,
  startChapter,
} from "../src/core/editor";
import { unzipSync, strFromU8 } from "fflate";
const item = (
  text: string,
  y: number,
  x = 60,
  width = 480,
  height = 12,
): TextItem => ({ text, y, x, width, height, font: "serif" });
const page = (items: TextItem[], number = 1): SourcePage => ({
  number,
  width: 600,
  height: 800,
  rotation: 0,
  items,
  imageCount: 0,
});
const fixture = (pages: SourcePage[]) =>
  reconstruct({ ...createBook("fixture.pdf"), pages });
describe("rekonstruksi", () => {
  it("menjaga dua paragraf terpisah dengan jarak vertikal", () => {
    const b = fixture([
      page([
        item("Paragraf pertama lengkap.", 100),
        item("Paragraf kedua lengkap.", 145),
      ]),
    ]);
    expect(allBlocks(b)).toHaveLength(2);
  });
  it("menggabungkan baris terbungkus dalam paragraf", () => {
    const b = fixture([
      page([
        item("Kalimat panjang yang membungkus ke", 100),
        item("baris berikutnya dengan benar.", 117),
      ]),
    ]);
    expect(allBlocks(b)).toHaveLength(1);
    expect(allBlocks(b)[0].text).toBe(
      "Kalimat panjang yang membungkus ke baris berikutnya dengan benar.",
    );
    expect(allBlocks(b)[0].sources).toHaveLength(2);
  });
  it("menjaga paragraf pendek dan indentasi", () => {
    const b = fixture([
      page([
        item("Pendek.", 100, 60, 70),
        item("Paragraf baru.", 117, 80, 200),
      ]),
    ]);
    expect(allBlocks(b)).toHaveLength(2);
  });
  it("menggabungkan lintas halaman hanya dengan bukti", () => {
    const b = fixture([
      page([item("Kalimat yang berlanjut melewati halaman", 720)]),
      page([item("berikutnya tanpa kehilangan sumber.", 90)], 2),
    ]);
    expect(allBlocks(b)).toHaveLength(1);
    expect(allBlocks(b)[0].sources.map((s) => s.page)).toEqual([1, 2]);
  });
  it("tidak menggabungkan paragraf selesai lintas halaman", () => {
    const b = fixture([
      page([item("Kalimat sudah selesai.", 720)]),
      page([item("paragraf baru tetap terpisah.", 90)], 2),
    ]);
    expect(allBlocks(b)).toHaveLength(2);
  });
  it("mempertahankan dialog, daftar, heading, pemisah adegan", () => {
    const b = fixture([
      page([
        item("BAB I", 100, 60, 100, 22),
        item("“Mari membaca.”", 150, 60, 150),
        item("• Daftar satu", 190, 60, 120),
        item("• Daftar dua", 215, 60, 120),
        item("* * *", 260, 250, 70),
      ]),
    ]);
    expect(allBlocks(b).map((b) => b.kind)).toEqual([
      "heading",
      "quote",
      "list",
      "list",
      "scene",
    ]);
  });
  it("header/footer berulang ditandai dan tidak dihapus otomatis", () => {
    const b = fixture([
      page([item("Nama Buku", 30, 60, 130), item("Isi pertama.", 100)]),
      page([item("Nama Buku", 30, 60, 130), item("Isi kedua.", 100)], 2),
    ]);
    expect(
      allBlocks(b).filter((b) => b.flags.includes("running")),
    ).toHaveLength(2);
    expect(allBlocks(b).every((b) => !b.excluded)).toBe(true);
    expect(b.issues.some((i) => i.kind === "running")).toBe(true);
  });
  it("membaca seluruh kolom kiri sebelum kolom kanan", () => {
    const p = page([
      item("Kiri 1", 110, 40, 210),
      item("Kanan 1", 110, 320, 210),
      item("Kiri 2", 140, 40, 210),
      item("Kanan 2", 140, 320, 210),
      item("Kiri 3", 170, 40, 210),
      item("Kanan 3", 170, 320, 210),
    ]);
    const { lines, complex } = getLines(p);
    expect(complex).toBe(true);
    expect(lines.map((l) => l.text)).toEqual([
      "Kiri 1",
      "Kiri 2",
      "Kiri 3",
      "Kanan 1",
      "Kanan 2",
      "Kanan 3",
    ]);
    expect(fixture([p]).issues.some((i) => i.kind === "layout")).toBe(true);
  });
  it("melaporkan halaman tanpa teks dan operasi gambar", () => {
    const b = fixture([{ ...page([]), imageCount: 1 }]);
    expect(b.issues.map((i) => i.kind)).toEqual(["empty", "image"]);
    expect(b.chapters).toHaveLength(0);
  });
  it("pemenggalan konservatif dan karakter khusus", () => {
    expect(joinLines("meng\u00ad", "alir")).toBe("mengalir");
    expect(joinLines("anak-", "anak")).toBe("anak-anak");
    expect(escapeXml('<b>&"')).toBe("&lt;b&gt;&amp;&quot;");
  });
  it("cakupan sumber tetap terjaga tanpa mengandalkan jumlah kata", () => {
    const source = [
      item("BAB 1", 100, 60, 150, 24),
      item("Teks pertama panjang hingga", 150),
      item("baris kedua selesai.", 168),
      item("Lainnya.", 220, 60, 90),
    ];
    const b = fixture([page(source)]);
    expect(allBlocks(b).reduce((n, b) => n + b.sources.length, 0)).toBe(
      source.length,
    );
    expect(allBlocks(b).every((b) => b.originalText)).toBe(true);
  });
});
describe("editor", () => {
  it("edit tidak mengubah teks asli", () => {
    const b = demoBook(),
      id = allBlocks(b)[1].id;
    const next = editBlock(b, id, { text: "Koreksi" });
    expect(allBlocks(next)[1].originalText).toBe(allBlocks(b)[1].text);
    expect(next.audit).toHaveLength(1);
    expect(allBlocks(b)[1].text).not.toBe("Koreksi");
  });
  it("pisah lalu gabung menyimpan sumber dan perubahan", () => {
    const b = demoBook(),
      id = allBlocks(b)[1].id;
    const next = splitBlock(b, id, 20);
    expect(allBlocks(next).length).toBe(allBlocks(b).length + 1);
    expect(allBlocks(mergeBlock(next, id)).length).toBe(allBlocks(b).length);
  });
  it("membuat bab dari blok", () => {
    const b = demoBook();
    expect(startChapter(b, allBlocks(b)[2].id).chapters).toHaveLength(3);
  });
});
describe("EPUB", () => {
  it("mimetype pertama tanpa kompresi, seluruh TOC dan aset valid", () => {
    const bytes = exportEpub(demoBook());
    expect(validateEpub(bytes)).toEqual([]);
    const files = unzipSync(bytes);
    expect(strFromU8(files.mimetype)).toBe("application/epub+zip");
    expect(files["META-INF/container.xml"]).toBeDefined();
    expect(strFromU8(files["EPUB/package.opf"])).toContain('version="3.0"');
  });
  it("escape teks, paragraf terpisah, tujuan heading valid", () => {
    const b = demoBook();
    b.title = "Buku <&>";
    b.chapters[0].blocks[1].text = 'Satu <dua> & "tiga"';
    b.chapters[0].blocks[2].kind = "heading";
    b.chapters[0].blocks[2].level = 2;
    const bytes = exportEpub(b),
      f = unzipSync(bytes);
    expect(validateEpub(bytes)).toEqual([]);
    expect(strFromU8(f["EPUB/chapter-1.xhtml"])).toContain(
      "Satu &lt;dua&gt; &amp; &quot;tiga&quot;",
    );
    expect(strFromU8(f["EPUB/nav.xhtml"])).toContain("#b-demo-2");
    expect(
      strFromU8(f["EPUB/chapter-1.xhtml"]).match(/<p\b/g)!.length,
    ).toBeGreaterThan(2);
  });
  it("blok dikecualikan tidak masuk ekspor dan audit tetap ada", () => {
    const b = demoBook();
    b.chapters[0].blocks[1].excluded = true;
    const f = unzipSync(exportEpub(b));
    expect(strFromU8(f["EPUB/chapter-1.xhtml"])).not.toContain("Ada buku yang");
    expect(allBlocks(b)).toHaveLength(11);
  });
  it("menolak EPUB tanpa teks", () => {
    expect(() => exportEpub(createBook("kosong.pdf"))).toThrow();
  });
});
