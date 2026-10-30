import { createBook } from "./model";
import type { Book, BlockKind } from "./model";
export function demoBook(): Book {
  const book = createBook("Ruang untuk Bertumbuh.pdf");
  book.id = "aksara-demo";
  book.identifier = "urn:aksara:demo";
  book.title = "Ruang untuk Bertumbuh";
  book.author = "Aksara Studio";
  book.status = "review";
  book.chapters = [
    { id: "demo-ch1", title: "Tentang langkah kecil", blocks: [] },
    { id: "demo-ch2", title: "Menemukan ruang", blocks: [] },
  ];
  const entries: [number, BlockKind, string][] = [
    [0, "heading", "Tentang langkah kecil"],
    [
      0,
      "paragraph",
      "Ada buku yang kita baca dengan cepat. Ada pula buku yang meminta kita berhenti sejenak, melipat sudut halaman, dan memikirkan kembali hal-hal yang selama ini terasa biasa.",
    ],
    [
      0,
      "paragraph",
      "Setiap halaman adalah sebuah ruang. Di dalamnya, kita bertemu gagasan baru, menemukan kata yang tepat, atau sekadar menikmati waktu yang berjalan sedikit lebih pelan.",
    ],
    [
      0,
      "quote",
      "“Kita tidak selalu perlu melangkah jauh. Terkadang, cukup memberi ruang untuk satu hal kecil yang berarti.”",
    ],
    [
      0,
      "paragraph",
      "Buku digital yang baik seharusnya menjaga pengalaman itu. Paragrafnya bernapas, babnya mudah ditemukan, dan hurufnya mengikuti kenyamanan pembaca.",
    ],
    [0, "scene", "* * *"],
    [1, "heading", "Menemukan ruang"],
    [
      1,
      "paragraph",
      "Mulailah dari satu halaman. Baca perlahan, beri perhatian pada kata-katanya, lalu tanyakan apa yang ingin Anda bawa setelah buku ditutup.",
    ],
    [1, "list", "Sediakan waktu untuk membaca."],
    [1, "list", "Catat gagasan yang ingin diingat."],
    [
      1,
      "paragraph",
      "Tidak semua hal perlu diselesaikan hari ini. Yang penting adalah menjaga keingintahuan tetap tumbuh.",
    ],
  ];
  entries.forEach(([ci, kind, text], i) =>
    book.chapters[ci].blocks.push({
      id: `demo-${i}`,
      kind,
      text,
      originalText: text,
      order: i,
      level: kind === "heading" ? 1 : undefined,
      sources: [
        { page: ci + 1, x: 60, y: 100 + i * 30, width: 480, height: 16 },
      ],
      flags: [],
    }),
  );
  book.issues = [];
  return book;
}
export async function demoPdf(): Promise<Blob> {
  // Generated demonstration only; never included as user content in source.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const b = demoBook();
  for (const c of b.chapters) {
    const page = pdf.addPage([600, 800]);
    let y = 700;
    for (const block of c.blocks) {
      const text = block.text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      const words = text.split(" ");
      let line = "";
      const size = block.kind === "heading" ? 24 : 13;
      for (const word of words) {
        if (font.widthOfTextAtSize(line + " " + word, size) > 470) {
          page.drawText(line, {
            x: 65,
            y,
            size,
            font: block.kind === "heading" ? bold : font,
            color: rgb(0.13, 0.19, 0.17),
          });
          y -= 22;
          line = word;
        } else line += (line ? " " : "") + word;
      }
      page.drawText(line, {
        x: 65,
        y,
        size,
        font: block.kind === "heading" ? bold : font,
      });
      y -= 38;
    }
  }
  return new Blob([(await pdf.save()) as BlobPart], {
    type: "application/pdf",
  });
}
