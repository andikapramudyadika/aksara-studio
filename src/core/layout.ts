import type { SourcePage, TextItem, Block, Book, Issue } from "./model";
interface Line {
  items: TextItem[];
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font: number;
  column: number;
}
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const median = (a: number[]) =>
  a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 12;
export function getLines(page: SourcePage): {
  lines: Line[];
  complex: boolean;
} {
  const items = page.items
    .filter((i) => i.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const i of items) {
    let row = rows.find(
      (r) =>
        Math.abs(r[0].y - i.y) <
        Math.max(2, Math.min(r[0].height, i.height) * 0.35),
    );
    if (!row) {
      row = [];
      rows.push(row);
    }
    row.push(i);
  }
  const lines: Line[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const groups: TextItem[][] = [[]];
    for (const i of row) {
      const g = groups.at(-1)!;
      const last = g.at(-1);
      if (last && i.x - (last.x + last.width) > Math.max(30, i.height * 3))
        groups.push([i]);
      else g.push(i);
    }
    for (const group of groups) {
      let text = "";
      let last: TextItem | undefined;
      for (const i of group) {
        text +=
          (last &&
          !text.endsWith(" ") &&
          i.x - last.x - last.width > i.height * 0.12
            ? " "
            : "") + i.text;
        last = i;
      }
      const x = group[0].x;
      lines.push({
        items: group,
        text: clean(text),
        x,
        y: group[0].y,
        width: Math.max(...group.map((i) => i.x + i.width)) - x,
        height: Math.max(...group.map((i) => i.height)),
        font: median(group.map((i) => i.height)),
        column: 0,
      });
    }
  }
  const body = lines.filter(
    (l) => l.y > page.height * 0.1 && l.y < page.height * 0.9,
  );
  const left = body.filter(
    (l) => l.x < page.width * 0.45 && l.x + l.width < page.width * 0.55,
  );
  const right = body.filter((l) => l.x > page.width * 0.47);
  const columns = left.length >= 3 && right.length >= 3;
  if (columns) {
    for (const l of lines) l.column = l.x > page.width * 0.47 ? 1 : 0;
    lines.sort((a, b) => a.column - b.column || a.y - b.y || a.x - b.x);
  } else lines.sort((a, b) => a.y - b.y || a.x - b.x);
  return { lines, complex: columns };
}
function classify(l: Line, bodyFont: number): Block["kind"] {
  if (/^([*•·]\s*){3,}$|^[-—_]{3,}$|^⁂$/.test(l.text)) return "scene";
  if (/^(?:[•▪●–-]|\d+[.)]|[a-z][.)])\s+/.test(l.text)) return "list";
  if (
    /^(?:bab|chapter|bagian|pendahuluan|prakata|epilog|prolog)\b/i.test(
      l.text,
    ) ||
    l.font > bodyFont * 1.22
  )
    return "heading";
  if (/^[“"‘]/.test(l.text)) return "quote";
  return "paragraph";
}
export function reconstruct(book: Book): Book {
  const result: Book = { ...book, chapters: [], issues: [], status: "review" };
  const analyses = book.pages.map((p) => ({ page: p, ...getLines(p) }));
  const running = new Map<string, Set<number>>();
  const key = (t: string) => t.replace(/\d+/g, "#").toLowerCase().trim();
  for (const { page, lines } of analyses)
    for (const l of lines)
      if (l.y < page.height * 0.09 || l.y > page.height * 0.91) {
        const k = key(l.text);
        if (!running.has(k)) running.set(k, new Set());
        running.get(k)!.add(page.number);
      }
  const blocks: Block[] = [];
  let order = 0;
  const issue = (
    p: number,
    kind: Issue["kind"],
    message: string,
    blockId?: string,
  ) =>
    result.issues.push({
      id: `i${result.issues.length}`,
      page: p,
      kind,
      message,
      blockId,
    });
  for (const { page, lines, complex } of analyses) {
    if (!lines.length)
      issue(
        page.number,
        "empty",
        "Halaman tanpa teks. Mungkin berupa gambar atau memerlukan OCR; halaman ini belum terwakili dalam EPUB.",
      );
    if (page.rotation !== 0)
      issue(
        page.number,
        "layout",
        "Halaman diputar. Koordinat mengikuti viewport PDF; periksa urutan dan arah teks terhadap sumber.",
      );
    if (complex)
      issue(
        page.number,
        "layout",
        "Terdeteksi beberapa kolom. Urutan disusun per kolom; periksa terhadap PDF asli.",
      );
    if (page.imageCount)
      issue(
        page.number,
        "image",
        `${page.imageCount} operasi gambar ditemukan. Gambar belum diekstrak; tambahkan atau tinjau sumber sebelum membagikan EPUB.`,
      );
    const bodyFont = median(
      lines
        .filter((l) => l.y > page.height * 0.1 && l.y < page.height * 0.9)
        .map((l) => l.font),
    );
    const leading = median(
      lines
        .slice(1)
        .map((l, i) => l.y - lines[i].y)
        .filter((d) => d > bodyFont * 0.7 && d < bodyFont * 2),
    );
    const areaWidth = Math.max(
      1,
      ...lines.filter((l) => l.font <= bodyFont * 1.2).map((l) => l.width),
    );
    let previous: Line | undefined;
    let current: Block | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const k = key(line.text);
      const repeated =
        (line.y < page.height * 0.09 || line.y > page.height * 0.91) &&
        (running.get(k)?.size ?? 0) >=
          Math.max(2, Math.ceil(book.pages.length * 0.5));
      const pageNumber =
        (line.y < page.height * 0.08 || line.y > page.height * 0.92) &&
        /^\d+$/.test(line.text);
      const kind = classify(line, bodyFont);
      const source = {
        page: page.number,
        x: line.x,
        y: line.y,
        width: line.width,
        height: line.height,
      };
      const prevKind = previous ? classify(previous, bodyFont) : undefined;
      const separate =
        !current ||
        repeated ||
        pageNumber ||
        current.flags.includes("running") ||
        current.kind === "heading" ||
        kind === "heading" ||
        kind === "list" ||
        kind === "scene" ||
        kind === "quote" ||
        prevKind === "scene" ||
        (previous &&
          (line.column !== previous.column ||
            line.y - previous.y > Math.max(leading * 1.42, bodyFont * 1.9) ||
            line.x - previous.x > bodyFont * 0.9 ||
            previous.width < areaWidth * 0.65 ||
            Math.abs(line.font - previous.font) > bodyFont * 0.15));
      if (separate) {
        current = {
          id: `p${page.number}-b${i}`,
          kind,
          text: line.text,
          originalText: line.text,
          order: order++,
          sources: [source],
          flags: [],
          ...(kind === "heading" ? { level: 1 } : {}),
        };
        blocks.push(current);
      } else {
        current!.originalText += "\n" + line.text;
        current!.text = joinLines(current!.text, line.text);
        current!.sources.push(source);
      }
      if (repeated || pageNumber) {
        current!.flags.push("running");
        issue(
          page.number,
          "running",
          "Kandidat header, footer, atau nomor halaman. Tetap disertakan sampai Anda memilih untuk menghapusnya.",
          current!.id,
        );
      }
      if (kind === "heading")
        issue(
          page.number,
          "heading",
          "Judul bab terdeteksi. Periksa tingkat dan penempatannya.",
          current!.id,
        );
      previous = line;
    }
  }
  // Only merge across pages with several independent signals; retain both source references.
  for (let i = 1; i < blocks.length; i++) {
    const a = blocks[i - 1],
      b = blocks[i];
    const ap = a.sources.at(-1)!,
      bp = b.sources[0];
    const page = book.pages.find((p) => p.number === ap.page)!;
    if (
      a.kind === "paragraph" &&
      b.kind === "paragraph" &&
      !a.flags.length &&
      !b.flags.length &&
      bp.page === ap.page + 1 &&
      !/[.!?:;”"]$/.test(a.text) &&
      /^[a-zà-ÿ]/.test(b.text) &&
      ap.y > page.height * 0.76 &&
      bp.y < book.pages.find((p) => p.number === bp.page)!.height * 0.24 &&
      ap.width > page.width * 0.58
    ) {
      a.text = joinLines(a.text, b.text);
      a.originalText += "\n\f\n" + b.originalText;
      a.sources.push(...b.sources);
      blocks.splice(i, 1);
      i--;
    }
  }
  let chapter = { id: "ch-0", title: "Awal buku", blocks: [] as Block[] };
  result.chapters.push(chapter);
  for (const b of blocks) {
    const outline = book.outline.find(
      (o) => o.page === b.sources[0].page && b.kind === "heading",
    );
    if (b.kind === "heading" && b.level === 1) {
      if (chapter.blocks.length) {
        chapter = {
          id: `ch-${b.id}`,
          title: outline?.title || b.text,
          blocks: [],
        };
        result.chapters.push(chapter);
      } else chapter.title = outline?.title || b.text;
    }
    chapter.blocks.push(b);
  }
  if (!blocks.length) result.chapters = [];
  return result;
}
export function joinLines(a: string, b: string): string {
  // Only discard a soft hyphen; visible hyphens may be semantically meaningful.
  if (a.endsWith("\u00ad")) return a.slice(0, -1) + b;
  if (a.endsWith("-") && /^[a-zà-ÿ]/.test(b)) return a + b;
  return a + " " + b;
}
