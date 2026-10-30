import type { Book, Block, BlockKind } from "./model";
import { allBlocks } from "./model";
function editableCopy(book: Book): Book {
  return {
    ...book,
    chapters: structuredClone(book.chapters),
    audit: [...book.audit],
  };
}
export function editBlock(
  book: Book,
  id: string,
  patch: Partial<Block>,
  action = "Ubah blok",
): Book {
  const next = editableCopy(book);
  const b = allBlocks(next).find((b) => b.id === id);
  if (!b) return book;
  const before = b.text;
  Object.assign(b, patch);
  if (patch.text !== undefined)
    for (const c of next.chapters)
      if (c.blocks[0]?.id === id && b.kind === "heading") c.title = b.text;
  next.audit.push({
    at: new Date().toISOString(),
    action,
    blockId: id,
    before,
    after: b.text,
  });
  next.updatedAt = new Date().toISOString();
  next.status = "review";
  return next;
}
export function splitBlock(book: Book, id: string, at: number): Book {
  const b = allBlocks(book).find((b) => b.id === id);
  if (!b || at <= 0 || at >= b.text.length) return book;
  const next = editBlock(
    book,
    id,
    { text: b.text.slice(0, at).trim() },
    "Pisah paragraf",
  );
  for (const c of next.chapters) {
    const i = c.blocks.findIndex((b) => b.id === id);
    if (i >= 0)
      c.blocks.splice(i + 1, 0, {
        ...structuredClone(b),
        id: crypto.randomUUID(),
        text: b.text.slice(at).trim(),
        originalText: "",
        flags: ["manual-split"],
      });
  }
  return next;
}
export function mergeBlock(book: Book, id: string): Book {
  const next = editableCopy(book);
  for (const c of next.chapters) {
    const i = c.blocks.findIndex((b) => b.id === id);
    if (i >= 0 && i < c.blocks.length - 1) {
      const a = c.blocks[i],
        b = c.blocks[i + 1];
      a.text += " " + b.text;
      a.originalText += "\n" + b.originalText;
      a.sources.push(...b.sources);
      a.flags = [...new Set([...a.flags, ...b.flags])];
      c.blocks.splice(i + 1, 1);
      next.audit.push({
        at: new Date().toISOString(),
        action: "Gabung paragraf",
        blockId: id,
        before: b.id,
        after: a.text,
      });
      next.updatedAt = new Date().toISOString();
      next.status = "review";
      return next;
    }
  }
  return book;
}
export function startChapter(book: Book, id: string): Book {
  const next = editableCopy(book);
  for (let ci = 0; ci < next.chapters.length; ci++) {
    const c = next.chapters[ci],
      i = c.blocks.findIndex((b) => b.id === id);
    if (i > 0) {
      const blocks = c.blocks.splice(i);
      blocks[0].kind = "heading";
      blocks[0].level = 1;
      next.chapters.splice(ci + 1, 0, {
        id: crypto.randomUUID(),
        title: blocks[0].text,
        blocks,
      });
      next.audit.push({
        at: new Date().toISOString(),
        action: "Buat bab",
        blockId: id,
      });
      next.updatedAt = new Date().toISOString();
      return next;
    }
  }
  return book;
}
export const kindLabels: Record<BlockKind, string> = {
  heading: "Judul",
  paragraph: "Paragraf",
  list: "Daftar",
  quote: "Kutipan / dialog",
  scene: "Pemisah adegan",
  figure: "Gambar (perlu ditinjau)",
};
