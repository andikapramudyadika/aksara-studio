import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  LoaderCircle,
} from "lucide-react";
import { pdfjs, pdfOptions } from "../core/pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
export default function PdfPreview({
  blob,
  page,
  onPage,
}: {
  blob?: Blob;
  page: number;
  onPage: (p: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(500);
  useEffect(() => {
    const observer = new ResizeObserver((es) =>
      setWidth(es[0].contentRect.width),
    );
    if (holder.current) observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setError("");
    setDoc(undefined);
    if (!blob) return;
    let stopped = false;
    const task = blob.arrayBuffer().then((data) => {
      if (stopped) return;
      const task = pdfjs.getDocument({
        data: new Uint8Array(data),
        ...pdfOptions(),
      });
      task.promise
        .then((d) => {
          if (stopped) void d.destroy();
          else setDoc(d);
        })
        .catch((e) => {
          if (!stopped) setError(String(e));
        });
      return task;
    });
    return () => {
      stopped = true;
      void task.then((t) => t?.destroy());
    };
  }, [blob]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let stopped = false;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    setLoading(true);
    doc
      .getPage(Math.max(1, Math.min(page, doc.numPages)))
      .then((p) => {
        if (stopped) return;
        const base = p.getViewport({ scale: 1 });
        const view = p.getViewport({
          scale: Math.max(150, width - 48) / base.width,
        });
        const c = canvas.current!;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        c.width = view.width * ratio;
        c.height = view.height * ratio;
        c.style.width = view.width + "px";
        c.style.height = view.height + "px";
        render = p.render({
          canvas: c,
          viewport: view,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        return render.promise;
      })
      .catch((e) => {
        if (!stopped && e.name !== "RenderingCancelledException")
          setError(String(e));
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
      render?.cancel();
    };
  }, [doc, page, width]);
  return (
    <div className="pdf-preview" ref={holder}>
      <div className="pdf-controls">
        <span>PDF Asli</span>
        <div>
          <button
            className="icon-btn"
            aria-label="Halaman sebelumnya"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {page} / {doc?.numPages || "—"}
          </span>
          <button
            className="icon-btn"
            aria-label="Halaman berikutnya"
            disabled={!doc || page >= doc.numPages}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      {!blob ? (
        <div className="empty-state">
          <FileWarning />
          <p>PDF sumber tidak tersedia di proyek ini.</p>
        </div>
      ) : error ? (
        <div className="notice error">{error}</div>
      ) : (
        <div className="canvas-wrap">
          {loading && <LoaderCircle className="spin pdf-loading" />}
          <canvas ref={canvas} aria-label={`Pratinjau PDF halaman ${page}`} />
        </div>
      )}
    </div>
  );
}
