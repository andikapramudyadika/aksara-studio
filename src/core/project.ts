import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { Book, ProjectRecord } from "./model";
export async function exportProject(book: Book, pdf?: Blob) {
  const entries: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify(book)),
  };
  if (pdf) entries["source.pdf"] = new Uint8Array(await pdf.arrayBuffer());
  return zipSync(entries);
}
export async function importProject(file: File): Promise<ProjectRecord> {
  if (file.size > 250 * 1024 * 1024)
    throw new Error("Arsip proyek melebihi batas 250 MB.");
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (e) =>
      ["project.json", "source.pdf"].includes(e.name) &&
      e.originalSize < 300 * 1024 * 1024,
  });
  if (!files["project.json"])
    throw new Error("Arsip proyek tidak memiliki project.json.");
  const book = JSON.parse(strFromU8(files["project.json"]));
  if (
    book.version !== 1 ||
    typeof book.id !== "string" ||
    typeof book.title !== "string" ||
    !Array.isArray(book.chapters) ||
    !Array.isArray(book.pages) ||
    !Array.isArray(book.audit) ||
    !Array.isArray(book.issues) ||
    !Array.isArray(book.outline)
  )
    throw new Error("Format proyek Aksara tidak valid.");
  for (const c of book.chapters) {
    if (
      typeof c.id !== "string" ||
      typeof c.title !== "string" ||
      !Array.isArray(c.blocks)
    )
      throw new Error("Struktur bab tidak valid.");
    for (const b of c.blocks)
      if (
        typeof b.id !== "string" ||
        typeof b.text !== "string" ||
        typeof b.originalText !== "string" ||
        !Array.isArray(b.sources) ||
        !Array.isArray(b.flags)
      )
        throw new Error("Struktur blok tidak valid.");
  }
  return {
    book,
    pdf: files["source.pdf"]
      ? new Blob([files["source.pdf"] as BlobPart], { type: "application/pdf" })
      : undefined,
  };
}
