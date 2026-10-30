import { useEffect, useRef, useState } from "react";
import ePub from "epubjs";
import type { Rendition } from "epubjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
export default function EpubReader({ bytes }: { bytes: Uint8Array }) {
  const target = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | undefined>(undefined);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!target.current) return;
    const book = ePub(bytes.slice().buffer as ArrayBuffer);
    const r = book.renderTo(target.current, {
      width: "100%",
      height: 500,
      flow: "paginated",
      allowScriptedContent: false,
    });
    rendition.current = r;
    r.display().catch((e) => setError(String(e)));
    return () => {
      r.destroy();
      book.destroy();
    };
  }, [bytes]);
  return (
    <div className="epub-reader">
      <div className="reader-nav">
        <button
          className="btn secondary"
          onClick={() => rendition.current?.prev()}
        >
          <ChevronLeft size={16} />
          Sebelumnya
        </button>
        <button
          className="btn secondary"
          onClick={() => rendition.current?.next()}
        >
          Berikutnya
          <ChevronRight size={16} />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div ref={target} />
    </div>
  );
}
