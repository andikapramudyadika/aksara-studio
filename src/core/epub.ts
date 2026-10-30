import { zipSync, strToU8 } from "fflate";
import type { Book, Block } from "./model";
export const escapeXml = (s: string) =>
  s
    .replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const xml = '<?xml version="1.0" encoding="utf-8"?>';
const blockXml = (b: Block) => {
  const t = escapeXml(b.text),
    id = `b-${b.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  switch (b.kind) {
    case "heading": {
      const h = Math.min(6, Math.max(1, b.level || 1));
      return `<h${h} id="${id}">${t}</h${h}>`;
    }
    case "quote":
      return `<blockquote id="${id}"><p>${t}</p></blockquote>`;
    case "list":
      return `<ul id="${id}"><li>${t.replace(/^(?:[•▪●–-]|\d+[.)]|[a-z][.)])\s+/, "")}</li></ul>`;
    case "scene":
      return `<p class="scene" id="${id}">${t}</p>`;
    default:
      return `<p id="${id}">${t}</p>`;
  }
};
export function exportEpub(book: Book): Uint8Array {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
  };
  const put = (path: string, content: string) => {
    files[path] = strToU8(content);
  };
  put(
    "META-INF/container.xml",
    `${xml}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  const lang = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(book.language)
    ? book.language
    : "id";
  const doc = (title: string, body: string) =>
    `${xml}<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}"><head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`;
  const chapters = book.chapters.filter((c) =>
    c.blocks.some((b) => !b.excluded),
  );
  if (!chapters.length)
    throw new Error(
      "Belum ada teks untuk diekspor. PDF pindaian memerlukan OCR terlebih dahulu.",
    );
  let imageName = "cover.svg",
    imageType = "image/svg+xml";
  if (book.cover) {
    imageType = book.cover.type;
    imageName = imageType === "image/jpeg" ? "cover.jpg" : "cover.png";
    files["EPUB/" + imageName] = Uint8Array.from(atob(book.cover.data), (c) =>
      c.charCodeAt(0),
    );
  } else
    put(
      "EPUB/cover.svg",
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="#164f46"/><path d="M80 100H720M80 1100H720" stroke="#d5b788" stroke-width="2"/><text x="80" y="170" fill="#e9e5d9" font-family="serif" font-size="24">AKSARA STUDIO</text>${(
        book.title.match(/.{1,23}(?:\s|$)|.{1,23}/g) || [book.title]
      )
        .slice(0, 7)
        .map(
          (s, i) =>
            `<text x="80" y="${420 + i * 65}" fill="#ffffff" font-family="serif" font-size="48">${escapeXml(s.trim())}</text>`,
        )
        .join(
          "",
        )}<text x="80" y="1020" fill="#e9e5d9" font-family="sans-serif" font-size="25">${escapeXml(book.author.slice(0, 42))}</text></svg>`,
    );
  put(
    "EPUB/cover.xhtml",
    doc(
      "Sampul",
      `<section epub:type="cover"><img class="cover" src="${imageName}" alt="Sampul ${escapeXml(book.title)}"/></section>`,
    ),
  );
  put(
    "EPUB/style.css",
    "body{font-family:Georgia,serif;line-height:1.65;margin:5%;color:#242925}p{margin:0 0 1em}h1,h2,h3,h4,h5,h6{line-height:1.25;break-after:avoid}h1{margin-top:1.5em}img,svg{max-width:100%;height:auto}.cover{display:block;margin:auto;width:100%}.scene{text-align:center;letter-spacing:.3em}blockquote{margin:1em 1.5em}li{margin-bottom:.5em}a{color:inherit}",
  );
  chapters.forEach((c, i) =>
    put(
      `EPUB/chapter-${i + 1}.xhtml`,
      doc(
        c.title,
        `<section epub:type="chapter">${c.blocks
          .filter((b) => !b.excluded)
          .map(blockXml)
          .join("\n")}</section>`,
      ),
    ),
  );
  const nav = chapters
    .map((c, i) => {
      const headings = c.blocks.filter(
        (b) =>
          !b.excluded &&
          b.kind === "heading" &&
          b.id !== c.blocks.find((b) => !b.excluded)?.id,
      );
      return `<li><a href="chapter-${i + 1}.xhtml">${escapeXml(c.title)}</a>${headings.length ? "<ol>" + headings.map((b) => `<li><a href="chapter-${i + 1}.xhtml#b-${b.id.replace(/[^a-zA-Z0-9_-]/g, "")}">${escapeXml(b.text)}</a></li>`).join("") + "</ol>" : ""}</li>`;
    })
    .join("");
  put(
    "EPUB/nav.xhtml",
    doc(
      "Daftar isi",
      `<nav epub:type="toc" id="toc"><h1>Daftar isi</h1><ol>${nav}</ol></nav>`,
    ),
  );
  put(
    "EPUB/package.opf",
    `${xml}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${lang}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeXml(book.identifier)}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title><dc:creator>${escapeXml(book.author || "Tidak diketahui")}</dc:creator><dc:language>${lang}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="cover-image" href="${imageName}" media-type="${imageType}" properties="cover-image"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"${imageType === "image/svg+xml" ? ' properties="svg"' : ""}/>${chapters.map((_, i) => `<item id="c${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine><itemref idref="cover"/>${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join("")}</spine></package>`,
  );
  return zipSync(files, { level: 6 });
}
