import type { PDFPageProxy } from "pdfjs-dist";
import type { ImageAsset, TextItem } from "./model";
import { OPS, Util } from "pdfjs-dist";
type Matrix = [number, number, number, number, number, number];
export async function extractImages(
  page: PDFPageProxy,
  ops: Awaited<ReturnType<PDFPageProxy["getOperatorList"]>>,
  pageNumber: number,
  items: TextItem[],
  signal: AbortSignal,
): Promise<{ images: ImageAsset[]; warnings: string[]; ocrLayer: boolean }> {
  const viewport = page.getViewport({ scale: 1 });
  const characters = items.reduce((n, i) => n + i.text.trim().length, 0);
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  let hiddenText = false,
    unsupported = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const op = ops.fnArray[i],
      args = ops.argsArray[i];
    if (op === OPS.save) stack.push([...ctm]);
    else if (op === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (op === OPS.transform) ctm = Util.transform(ctm, args) as Matrix;
    else if (op === OPS.paintFormXObjectBegin) {
      stack.push([...ctm]);
      if (args[0]) ctm = Util.transform(ctm, args[0]) as Matrix;
    } else if (op === OPS.paintFormXObjectEnd)
      ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (op === OPS.setTextRenderingMode && args[0] === 3)
      hiddenText = true;
    else if (
      op === OPS.paintImageXObject ||
      op === OPS.paintInlineImageXObject
    ) {
      const m = Util.transform(viewport.transform, ctm);
      const corners = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ].map((p) => {
        const point: [number, number] = [p[0], p[1]];
        Util.applyTransform(point, m);
        return point;
      });
      const x = Math.max(0, Math.min(...corners.map((p) => p[0]))),
        y = Math.max(0, Math.min(...corners.map((p) => p[1])));
      const width = Math.min(
          viewport.width - x,
          Math.max(...corners.map((p) => p[0])) - x,
        ),
        height = Math.min(
          viewport.height - y,
          Math.max(...corners.map((p) => p[1])) - y,
        );
      if (width >= 20 && height >= 20) boxes.push({ x, y, width, height });
      else unsupported++;
    } else if (
      [
        OPS.paintImageMaskXObject,
        OPS.paintImageMaskXObjectGroup,
        OPS.paintImageXObjectRepeat,
        OPS.paintInlineImageXObjectGroup,
      ].includes(op)
    )
      unsupported++;
  }
  const full = (b: (typeof boxes)[number]) =>
    b.width * b.height > viewport.width * viewport.height * 0.82;
  const ocrLayer = characters > 30 && hiddenText && boxes.some(full);
  const candidates = boxes.filter((b) => !(full(b) && characters > 30));
  const warnings: string[] = [];
  if (boxes.some((b) => full(b) && characters > 30) && !ocrLayer)
    warnings.push(
      "Gambar latar satu halaman tidak diekspor sebagai ilustrasi agar teks tidak terduplikasi. Periksa sumber.",
    );
  if (unsupported)
    warnings.push(
      `${unsupported} operasi gambar kecil, mask, atau pengulangan belum diekstrak secara andal.`,
    );
  if (candidates.length > 12)
    warnings.push(
      "Lebih dari 12 gambar pada halaman ini; hanya 12 area pertama diekstrak. Periksa sumber.",
    );
  if (!candidates.length) return { images: [], warnings, ocrLayer };
  const scale = Math.min(1.6, 1800 / Math.max(viewport.width, viewport.height));
  const view = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(view.width);
  canvas.height = Math.ceil(view.height);
  const render = page.render({ canvas, viewport: view });
  const abort = () => render.cancel();
  signal.addEventListener("abort", abort, { once: true });
  const images: ImageAsset[] = [];
  try {
    await render.promise;
    for (let i = 0; i < Math.min(12, candidates.length); i++) {
      if (signal.aborted) throw new DOMException("Dibatalkan", "AbortError");
      const box = candidates[i];
      const textInside = items.reduce(
        (n, t) =>
          n +
          (t.x + t.width / 2 >= box.x &&
          t.x + t.width / 2 <= box.x + box.width &&
          t.y + t.height / 2 >= box.y &&
          t.y + t.height / 2 <= box.y + box.height
            ? t.text.trim().length
            : 0),
        0,
      );
      if (textInside > 20)
        warnings.push(
          "Area gambar bersinggungan dengan teks PDF. Periksa potensi pengulangan teks dan penempatan ilustrasinya.",
        );
      const crop = document.createElement("canvas");
      crop.width = Math.max(1, Math.round(box.width * scale));
      crop.height = Math.max(1, Math.round(box.height * scale));
      const ctx = crop.getContext("2d");
      if (!ctx) throw new Error("Canvas gambar tidak tersedia");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, crop.width, crop.height);
      ctx.drawImage(
        canvas,
        Math.round(box.x * scale),
        Math.round(box.y * scale),
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        crop.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Gambar tidak dapat dikemas");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca"));
        reader.readAsDataURL(blob);
      });
      images.push({
        id: `image-p${pageNumber}-${i}`,
        data,
        type: "image/png",
        page: pageNumber,
        ...box,
        role:
          pageNumber === 1 && characters < 30 && full(box) ? "cover" : "figure",
      });
      crop.width = 0;
      crop.height = 0;
    }
  } catch (e) {
    if (signal.aborted) throw e;
    warnings.push(
      "Ekstraksi gambar gagal pada halaman ini. Periksa PDF sumber; gambar belum seluruhnya disertakan.",
    );
  } finally {
    signal.removeEventListener("abort", abort);
    canvas.width = 0;
    canvas.height = 0;
  }
  return { images, warnings, ocrLayer };
}
