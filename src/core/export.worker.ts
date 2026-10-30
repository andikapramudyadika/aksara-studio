import { exportEpub } from "./epub";
import type { Book } from "./model";
self.onmessage = (e: MessageEvent<Book>) => {
  try {
    const bytes = exportEpub(e.data);
    self.postMessage({ bytes }, { transfer: [bytes.buffer as ArrayBuffer] });
  } catch (e) {
    self.postMessage({ error: String(e) });
  }
};
