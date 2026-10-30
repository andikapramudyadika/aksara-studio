import type { Book } from "./model";
export function exportInWorker(book: Book): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./export.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.bytes);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ ...book, pages: [], audit: [], issues: [] });
  });
}
