import { openDB } from "idb";
import type { Book, ProjectRecord } from "./model";
const db = () =>
  openDB("aksara-studio", 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "book.id" });
    },
  });
export async function saveProject(book: Book, pdf?: Blob) {
  const database = await db();
  const previous = pdf
    ? undefined
    : ((await database.get("projects", book.id)) as ProjectRecord | undefined);
  await database.put("projects", { book, pdf: pdf ?? previous?.pdf });
}
export async function listProjects(): Promise<Book[]> {
  const database = await db();
  const all = (await database.getAll("projects")) as ProjectRecord[];
  return all
    .map((p) => p.book)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadProject(
  id: string,
): Promise<ProjectRecord | undefined> {
  return (await db()).get("projects", id);
}
export async function deleteProject(id: string) {
  await (await db()).delete("projects", id);
}
export function storageError(e: unknown) {
  return e instanceof DOMException && e.name === "QuotaExceededError"
    ? "Penyimpanan browser penuh. Ekspor proyek lokal, lalu hapus proyek yang tidak diperlukan."
    : "Proyek belum tersimpan di browser. Ekspor proyek lokal agar pekerjaan tetap aman. " +
        String(e);
}
