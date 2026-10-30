export type BlockKind =
  "heading" | "paragraph" | "list" | "quote" | "scene" | "figure";
export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font: string;
}
export interface SourcePage {
  number: number;
  width: number;
  height: number;
  rotation: number;
  items: TextItem[];
  imageCount: number;
}
export interface SourceRef {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Block {
  id: string;
  kind: BlockKind;
  text: string;
  originalText: string;
  order: number;
  sources: SourceRef[];
  level?: number;
  excluded?: boolean;
  flags: string[];
}
export interface Chapter {
  id: string;
  title: string;
  blocks: Block[];
}
export interface Issue {
  id: string;
  page: number;
  blockId?: string;
  kind: "empty" | "layout" | "image" | "running" | "heading";
  message: string;
}
export interface Audit {
  at: string;
  action: string;
  blockId: string;
  before?: string;
  after?: string;
}
export interface Book {
  version: 1;
  id: string;
  title: string;
  author: string;
  language: string;
  identifier: string;
  filename: string;
  updatedAt: string;
  status: "analysing" | "review" | "exported";
  pages: SourcePage[];
  chapters: Chapter[];
  issues: Issue[];
  audit: Audit[];
  outline: { title: string; page: number }[];
  cover?: { data: string; type: string };
}
export interface ProjectRecord {
  book: Book;
  pdf?: Blob;
}
export const uid = () => crypto.randomUUID();
export const allBlocks = (book: Book) => book.chapters.flatMap((c) => c.blocks);
export function createBook(filename: string): Book {
  const id = uid();
  return {
    version: 1,
    id,
    title: filename.replace(/\.pdf$/i, ""),
    author: "",
    language: "id",
    identifier: `urn:uuid:${id}`,
    filename,
    updatedAt: new Date().toISOString(),
    status: "analysing",
    pages: [],
    chapters: [],
    issues: [],
    audit: [],
    outline: [],
  };
}
