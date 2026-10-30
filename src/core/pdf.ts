import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Book, SourcePage } from "./model";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export { pdfjs };
export function pdfOptions() {
  const base = new URL(
    import.meta.env.BASE_URL + "pdf-assets/",
    document.baseURI,
  ).href;
  return {
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/",
    wasmUrl: base + "wasm/",
  };
}
export async function extractPdf(
  blob: Blob,
  book: Book,
  signal: AbortSignal,
  onPage: (p: SourcePage, total: number) => Promise<void>,
  onOutline: (o: Book["outline"]) => void,
  onDocument: (n: number) => void,
) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    ...pdfOptions(),
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const doc = await task.promise;
    onDocument(doc.numPages);
    const outline: Book["outline"] = [];
    const walk = async (nodes: Awaited<ReturnType<typeof doc.getOutline>>) => {
      for (const node of nodes || []) {
        try {
          const dest =
            typeof node.dest === "string"
              ? await doc.getDestination(node.dest)
              : node.dest;
          if (dest) {
            const page =
              typeof dest[0] === "number"
                ? dest[0] + 1
                : (await doc.getPageIndex(dest[0])) + 1;
            outline.push({ title: node.title, page });
          }
        } catch {
          /* Unresolvable bookmarks do not interrupt extraction. */
        }
        if (node.items) await walk(node.items);
      }
    };
    await walk(await doc.getOutline());
    onOutline(outline);
    for (let n = book.pages.length + 1; n <= doc.numPages; n++) {
      if (signal.aborted) throw new DOMException("Dibatalkan", "AbortError");
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const ops = await page.getOperatorList();
      const imageOps = [
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintInlineImageXObject,
        pdfjs.OPS.paintImageMaskXObject,
      ];
      const items = content.items.flatMap((item) => {
        if (!("str" in item)) return [];
        const t = pdfjs.Util.transform(viewport.transform, item.transform);
        return [
          {
            text: item.str,
            x: t[4],
            y: t[5] - Math.hypot(t[2], t[3]),
            width: item.width,
            height: Math.hypot(t[2], t[3]),
            font: item.fontName,
          },
        ];
      });
      await onPage(
        {
          number: n,
          width: viewport.width,
          height: viewport.height,
          rotation: viewport.rotation,
          items,
          imageCount: ops.fnArray.filter((op) => imageOps.includes(op)).length,
        },
        doc.numPages,
      );
      page.cleanup();
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await task.destroy();
  }
}
export function analyse(book: Book, signal: AbortSignal): Promise<Book> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
      type: "module",
    });
    const abort = () => {
      worker.terminate();
      reject(new DOMException("Dibatalkan", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e) => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.book);
    };
    worker.onerror = (e) => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage(book);
  });
}
