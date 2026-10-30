import { reconstruct } from "./layout";
import type { Book } from "./model";
self.onmessage = (e: MessageEvent<Book>) => {
  try {
    self.postMessage({ book: reconstruct(e.data) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
