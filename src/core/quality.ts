import { allBlocks } from "./model";
import type { Book, Block } from "./model";
export function qualitySummary(book: Book) {
  const blocks = allBlocks(book);
  const figures = blocks.filter((b) => b.kind === "figure" && !b.excluded);
  const assets = new Set(
    book.pages.flatMap((p) => p.images || []).map((i) => i.id),
  );
  return {
    running: blocks.filter((b) => b.flags.includes("running")),
    headings: blocks.filter((b) => b.kind === "heading" && !b.excluded),
    figures,
    missingAssets: figures.filter((b) => !b.assetId || !assets.has(b.assetId)),
    unresolved: blocks.filter(
      (b) =>
        !b.excluded &&
        (b.flags.includes("unresolved-drop-cap") ||
          (b.kind === "heading" && /^[A-ZÀ-Þ]$/.test(b.text))),
    ),
    sourceItems: book.analysis?.sourceItems,
    missingItems: book.analysis?.missingItems || 0,
    duplicateItems: book.analysis?.duplicateItems || 0,
  };
}

export function issueNeedsReview(
  book: Book,
  issue: Book["issues"][number],
  blockMap?: Map<string, Block>,
): boolean {
  const b = issue.blockId
    ? blockMap
      ? blockMap.get(issue.blockId)
      : allBlocks(book).find((b) => b.id === issue.blockId)
    : undefined;
  if (issue.kind === "toc") return false;
  if (issue.kind === "running") return !b?.excluded;
  if (issue.kind === "heading")
    return !b?.excluded && (b?.confidence || 0) < 0.95;
  return true;
}
