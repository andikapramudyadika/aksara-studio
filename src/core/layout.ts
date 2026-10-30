import type {
  SourcePage,
  TextItem,
  Block,
  Book,
  Issue,
  SourceRef,
} from "./model";
import {
  normalizeTitle,
  frontMatter,
  chapterLabel,
  listMarker,
  isGenericBookmark,
} from "./structure";
interface IndexedItem extends TextItem {
  index: number;
}
export interface Line {
  items: IndexedItem[];
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font: number;
  baseline: number;
  column: number;
  bold: boolean;
  dropCap: boolean;
  originalText?: string;
}
const median = (a: number[], fallback = 12) =>
  a.length ? [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)] : fallback;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
function typicalFont(items: TextItem[], fallback = 12) {
  const bins = new Map<number, number>();
  for (const i of items) {
    if (!i.text.trim()) continue;
    const k = Math.round(i.height * 2) / 2;
    bins.set(k, (bins.get(k) || 0) + Math.min(80, i.text.trim().length));
  }
  return [...bins].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
}
const baseline = (i: TextItem) => i.baseline ?? i.y + i.height;
function makeLine(items: IndexedItem[], column = 0): Line {
  items.sort((a, b) => a.x - b.x);
  const font = typicalFont(items);
  let text = "",
    previous: IndexedItem | undefined;
  for (const i of items) {
    const gap = previous ? i.x - previous.x - previous.width : 0;
    text +=
      (previous && !/\s$/.test(text) && !/^\s/.test(i.text) && gap > font * 0.15
        ? " "
        : "") + i.text;
    previous = i;
  }
  return {
    items,
    text: clean(text),
    originalText: items.map((i) => i.text).join(" "),
    x: Math.min(...items.map((i) => i.x)),
    y: Math.min(...items.map((i) => i.y)),
    width:
      Math.max(...items.map((i) => i.x + i.width)) -
      Math.min(...items.map((i) => i.x)),
    height: Math.max(...items.map((i) => i.height)),
    baseline: median(items.map(baseline)),
    font,
    column,
    bold:
      items
        .filter((i) => i.bold || /bold|black|heavy/i.test(i.font))
        .reduce((n, i) => n + i.text.length, 0) >
      text.length * 0.55,
    dropCap: false,
  };
}
export function getLines(page: SourcePage): {
  lines: Line[];
  complex: boolean;
} {
  const items = page.items
    .map((i, index) => ({ ...i, index }))
    .filter((i) => i.text.trim());
  const body = typicalFont(items);
  const caps = items.filter(
    (i) => /^[A-ZÀ-Þ]$/.test(i.text.trim()) && i.height > body * 1.65,
  );
  const normal = items
    .filter((i) => !caps.includes(i))
    .sort((a, b) => baseline(a) - baseline(b) || a.x - b.x);
  const rows: IndexedItem[][] = [];
  for (const i of normal) {
    let r = rows.find(
      (r) =>
        Math.abs(median(r.map(baseline)) - baseline(i)) <
          Math.max(2, Math.min(body, i.height) * 0.32) ||
        Math.abs(r[0].y - i.y) < Math.max(1.8, body * 0.16),
    );
    if (!r) {
      r = [];
      rows.push(r);
    }
    r.push(i);
  }
  const lines: Line[] = [];
  for (const r of rows) {
    r.sort((a, b) => a.x - b.x);
    const groups: IndexedItem[][] = [[]];
    for (const i of r) {
      const g = groups.at(-1)!,
        prev = g.at(-1);
      if (prev && i.x - prev.x - prev.width > Math.max(34, body * 3.6))
        groups.push([i]);
      else g.push(i);
    }
    for (const g of groups) lines.push(makeLine(g));
  }
  for (const cap of caps) {
    const target = lines
      .filter(
        (l) =>
          /^[a-zà-ÿ]/.test(l.text) &&
          l.y >= cap.y - body * 0.4 &&
          l.y < cap.y + cap.height * 0.85 &&
          l.x >= cap.x + cap.width - body * 0.35 &&
          l.x - cap.x - cap.width < body * 1.4,
      )
      .sort((a, b) => a.y - b.y)[0];
    if (target) {
      const original = target.text;
      target.items.unshift(cap);
      target.originalText = cap.text + "\n" + (target.originalText || original);
      target.text = cap.text.trim() + original;
      target.x = Math.min(cap.x, target.x);
      target.width =
        Math.max(...target.items.map((i) => i.x + i.width)) - target.x;
      target.dropCap = true;
    } else lines.push(makeLine([cap]));
  }
  const middle = lines.filter(
    (l) => l.y > page.height * 0.12 && l.y < page.height * 0.87,
  );
  const left = middle.filter(
      (l) =>
        l.x < page.width * 0.44 &&
        l.x + l.width < page.width * 0.55 &&
        l.width > page.width * 0.18,
    ),
    right = middle.filter(
      (l) => l.x > page.width * 0.47 && l.width > page.width * 0.18,
    );
  const complex = left.length >= 3 && right.length >= 3;
  lines.sort((a, b) => a.y - b.y || a.x - b.x);
  if (complex) {
    const ordered: Line[] = [];
    let band: Line[] = [];
    const flush = () => {
      band.forEach((l) => (l.column = l.x > page.width * 0.47 ? 1 : 0));
      ordered.push(
        ...band.sort((a, b) => a.column - b.column || a.y - b.y || a.x - b.x),
      );
      band = [];
    };
    for (const l of lines) {
      if (l.width > page.width * 0.65) {
        flush();
        ordered.push(l);
      } else band.push(l);
    }
    flush();
    return { lines: ordered, complex };
  }
  return { lines, complex };
}
interface PageLines {
  page: SourcePage;
  lines: Line[];
  complex: boolean;
  toc: boolean;
  font: number;
}
interface TocEntry {
  title: string;
  key: string;
  level: number;
}
const source = (p: SourcePage, l: Line): SourceRef => ({
  page: p.number,
  x: l.x,
  y: l.y,
  width: l.width,
  height: l.height,
  itemIndices: l.items.map((i) => i.index),
});
const endSentence = (s: string) =>
  /[.!?]["”’']?$/.test(s) &&
  !/(?:\b(?:Dr|Ir|Prof|Mr|Mrs|Moh|H|No|St))\.$/i.test(s);
function similarTitle(a: string, b: string) {
  if (a === b) return true;
  if (
    Math.min(a.length, b.length) < 16 ||
    Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.12
  )
    return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    prev = next;
  }
  return prev[b.length] <= Math.max(a.length, b.length) * 0.12;
}
function runningKey(p: SourcePage, l: Line) {
  const edge =
    l.y < p.height * 0.12 ? "top" : l.y > p.height * 0.88 ? "bottom" : "";
  if (!edge) return;
  const text = (
    edge === "top" && /\p{L}/u.test(l.text)
      ? l.text.replace(/^\d{1,2}[.)]?\s+/, "")
      : l.text
  )
    .replace(/^\s*[ivxlcdm]+\s*$/i, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return edge + ":" + text;
}
function tocEntries(a: PageLines[]): TocEntry[] {
  const found: { title: string; x: number; font: number }[] = [];
  for (const { lines, toc } of a) {
    if (!toc) continue;
    const rows = new Map<number, Line[]>();
    for (const l of lines) {
      const y = Math.round(l.baseline / 4);
      rows.set(y, [...(rows.get(y) || []), l]);
    }
    for (const row of rows.values()) {
      const text = row
        .sort((a, b) => a.x - b.x)
        .map((l) => l.text)
        .join(" ");
      const m = text.match(
        /^(.+?)(?:\s*\.{2,}\s*|\s+)(\d{1,4}|[ivxlcdm]{1,8})\s*$/i,
      );
      if (
        m &&
        m[1].length > 3 &&
        !/^(?:isi buku|daftar isi)$/i.test(m[1].trim())
      )
        found.push({
          title: m[1].replace(/\.{2,}/g, "").trim(),
          x: row[0].x,
          font: row[0].font,
        });
    }
  }
  const minX = Math.min(...found.map((e) => e.x));
  const numbered = found.some(
    (e) =>
      /^\d{1,2}(?:[.)]\s*|\s+)/.test(e.title) || chapterLabel.test(e.title),
  );
  return found.map((e) => ({
    title: e.title,
    key: normalizeTitle(e.title),
    level:
      frontMatter.test(e.title) ||
      chapterLabel.test(e.title) ||
      /^\d{1,2}(?:[.)]\s*|\s+)/.test(e.title)
        ? 1
        : numbered
          ? 2
          : e.x > minX + e.font * 0.8
            ? 2
            : 1,
  }));
}
function headingCandidate(
  l: Line,
  font: number,
  toc: TocEntry[],
  rootByFont = true,
): number | undefined {
  const text = l.text;
  if (
    l.dropCap ||
    text.length > 170 ||
    /^[A-ZÀ-Þ]$/.test(text) ||
    /^[“"‘]/.test(text)
  )
    return;
  if (/^\d{1,3}[.)]?$/.test(text)) return;
  const key = normalizeTitle(text);
  const match =
    toc.find((t) => t.key === key) ||
    (l.font >= font * 1.08 || l.bold
      ? toc.find((t) => similarTitle(t.key, key))
      : undefined);
  if (match) return match.level;
  if (frontMatter.test(text) || chapterLabel.test(text)) return 1;
  if (/^(?:daftar [il]si|[il]si buku|contents|table of contents)$/i.test(text))
    return 1;
  if (/^[A-Z][.)]\s+[A-ZÀ-Þ][A-ZÀ-Þ\s-]{4,}$/.test(text)) return 2;
  if (
    l.font >= font * 1.45 &&
    text.length < 150 &&
    !/[.!?;]$/.test(text) &&
    !/^\d+[.)]?$/.test(text)
  )
    return rootByFont ? 1 : 2;
  if (
    l.bold &&
    l.font >= font * 1.08 &&
    text.length < 95 &&
    !/[.!?;]$/.test(text) &&
    text.split(/\s+/).length < 14
  )
    return 2;
}
export function reconstruct(book: Book): Book {
  const result: Book = {
    ...book,
    engineVersion: 2,
    chapters: [],
    issues: [],
    audit: book.audit.filter((a) => !a.action.startsWith("Otomatis:")),
    status: "review",
  };
  const globalFont = typicalFont(book.pages.flatMap((p) => p.items));
  const analyses: PageLines[] = book.pages.map((page) => {
    const { lines, complex } = getLines(page);
    const f = typicalFont(
      page.items.filter(
        (i) => i.y > page.height * 0.12 && i.y < page.height * 0.87,
      ),
      globalFont,
    );
    const title = lines.some((l) =>
      /^(?:daftar [il]si|[il]si buku|table of contents|contents)$/i.test(
        l.text,
      ),
    );
    const leaders = lines.filter((l) =>
      /\.{3,}.*(?:\d|[ivxlcdm])\s*$/i.test(l.text),
    ).length;
    const rightNumbers = lines.filter(
      (l) => l.x > page.width * 0.7 && /^\d+$|^[ivxlcdm]+$/i.test(l.text),
    ).length;
    return {
      page,
      lines,
      complex,
      toc: leaders >= 3 || (title && rightNumbers >= 3),
      font: f > globalFont * 1.35 || f < globalFont * 0.68 ? globalFont : f,
    };
  });
  const toc = tocEntries(analyses);
  for (const outline of book.outline) {
    if (
      !isGenericBookmark(outline.title) &&
      normalizeTitle(outline.title).length > 3 &&
      !toc.some((t) => t.key === normalizeTitle(outline.title))
    )
      toc.push({
        title: outline.title,
        key: normalizeTitle(outline.title),
        level: outline.level || 1,
      });
  }
  const firstTocPage = analyses.find((a) => a.toc)?.page.number || Infinity;
  const repeats = new Map<string, Set<number>>();
  for (const { page, lines, font } of analyses)
    for (const l of lines) {
      const k = runningKey(page, l);
      if (k && l.font <= font * 1.22) {
        if (!repeats.has(k)) repeats.set(k, new Set());
        repeats.get(k)!.add(page.number);
      }
    }
  const blocks: Block[] = [];
  let order = 0;
  const addIssue = (
    page: number,
    kind: Issue["kind"],
    message: string,
    blockId?: string,
  ) =>
    result.issues.push({
      id: `issue-${result.issues.length}`,
      page,
      kind,
      message,
      blockId,
    });
  const add = (p: SourcePage, l: Line, kind: Block["kind"], level?: number) => {
    const b: Block = {
      id: `p${p.number}-i${Math.min(...l.items.map((i) => i.index))}`,
      kind,
      text: l.text,
      originalText: l.originalText || l.text,
      order: order++,
      sources: [source(p, l)],
      flags: [],
      ...(level ? { level } : {}),
    };
    if (l.dropCap) {
      b.flags.push("drop-cap-joined");
      result.audit.push({
        at: new Date().toISOString(),
        action: "Otomatis: sambung huruf awal paragraf",
        blockId: b.id,
        before: b.originalText,
        after: b.text,
      });
    }
    blocks.push(b);
    return b;
  };
  for (const a of analyses) {
    const { page, lines, font } = a;
    if (!lines.length && !page.images?.some((i) => i.role === "cover"))
      addIssue(
        page.number,
        "empty",
        "Halaman tanpa teks. Periksa gambar sumber; teks pindaian memerlukan OCR.",
      );
    if (page.ocrLayer)
      addIssue(
        page.number,
        "ocr",
        "Lapisan teks di atas gambar halaman terdeteksi. Periksa ejaan dan urutannya; foto/grafik yang menyatu di dalam halaman belum dipisah.",
      );
    if (page.rotation)
      addIssue(
        page.number,
        "layout",
        "Halaman diputar; periksa arah dan urutan bacaan.",
      );
    if (a.complex && !a.toc)
      addIssue(
        page.number,
        "layout",
        "Beberapa area/kolom terdeteksi. Urutan disusun per area; tabel dan layout campuran perlu diperiksa.",
      );
    for (const message of page.imageWarnings || [])
      addIssue(page.number, "image", message);
    if (
      page.imageCount &&
      !page.images?.length &&
      !page.ocrLayer &&
      !page.imageWarnings?.length
    )
      addIssue(
        page.number,
        "image",
        `${page.imageCount} operasi gambar belum memiliki aset yang dapat diekspor. Periksa sumber.`,
      );
    if (a.toc)
      addIssue(
        page.number,
        "toc",
        "Daftar isi sumber dikenali. Entri membantu pencocokan judul dan tidak membuat bab sendiri.",
      );
    const running = new Set<Line>();
    for (const l of lines) {
      const key = runningKey(page, l),
        count = key ? repeats.get(key)?.size || 0 : 0;
      const numeric =
        /^\d{1,4}$|^[ivxlcdm]{1,8}$/i.test(l.text) && l.y > page.height * 0.88;
      const nearbyTitle = lines
        .filter(
          (q) =>
            q.font >= font * 1.4 &&
            Math.abs(q.y - l.y) < Math.max(font * 16, page.height * 0.25),
        )
        .map((q) => q.text)
        .join(" ");
      const duplicateTitle =
        l.font < font * 0.65 &&
        normalizeTitle(l.text).length > 8 &&
        similarTitle(normalizeTitle(l.text), normalizeTitle(nearbyTitle));
      const candidate =
        (count >= 2 && l.font <= font * 1.22) || numeric || duplicateTitle;
      if (candidate) {
        running.add(l);
        const b = add(page, l, "paragraph");
        b.flags.push("running");
        b.confidence = count >= 3 || duplicateTitle ? 0.98 : 0.7;
        b.excluded = count >= 3 || duplicateTitle;
        b.flags.push(b.excluded ? "running-confirmed" : "running-candidate");
        addIssue(
          page.number,
          "running",
          b.excluded
            ? "Header/footer berulang dikecualikan secara dapat dipulihkan. Periksa sumber atau pulihkan."
            : "Kandidat header/footer tetap disertakan sampai Anda meninjaunya.",
          b.id,
        );
        if (b.excluded)
          result.audit.push({
            at: new Date().toISOString(),
            action: "Otomatis: kecualikan header/footer berulang",
            blockId: b.id,
            before: b.text,
            after: "Dikecualikan; teks asli tersimpan",
          });
      }
    }
    const flow = lines.filter((l) => !running.has(l));
    const distances = flow
      .slice(1)
      .map((l, i) => l.baseline - flow[i].baseline)
      .filter((n) => n > font * 0.8 && n < font * 2);
    const leading = median(distances, font * 1.4);
    const widths = flow
      .filter((l) => l.font < font * 1.3 && l.width > page.width * 0.25)
      .map((l) => l.width);
    const areaWidth = Math.max(font * 4, ...widths);
    const minX = Math.min(
      ...flow.filter((l) => l.width > areaWidth * 0.5).map((l) => l.x),
    );
    let previous: Line | undefined, current: Block | undefined;
    for (let i = 0; i < flow.length; i++) {
      let line = flow[i];
      let level = a.toc
        ? /^(?:daftar [il]si|[il]si buku|contents|table of contents)$/i.test(
            line.text,
          )
          ? 1
          : undefined
        : headingCandidate(
            line,
            font,
            toc,
            page.number < firstTocPage || !toc.length,
          );
      let consumed = 1;
      if (
        !a.toc &&
        !line.dropCap &&
        (line.font >= font * 1.18 ||
          chapterLabel.test(line.text) ||
          /^\d{1,2}[.)]?$/.test(line.text))
      ) {
        let joined = line.text;
        let chosen: { level: number; end: number; text: string } | undefined;
        for (let j = i; j < Math.min(flow.length, i + 6); j++) {
          const next = flow[j];
          if (j > i) {
            const prev = flow[j - 1];
            if (
              next.column !== line.column ||
              next.y - prev.y > Math.max(prev.font * 2.5, leading * 2.5) ||
              next.font < font * 1.18
            )
              break;
            joined +=
              (/\p{L}-$/u.test(joined) && /^\p{L}/u.test(next.text)
                ? ""
                : " ") + next.text;
          }
          const joinedKey = normalizeTitle(joined);
          const match =
            toc.find((t) => t.key === joinedKey) ||
            toc.find((t) => similarTitle(t.key, joinedKey));
          if (match) chosen = { level: match.level, end: j, text: joined };
          else if (
            (chapterLabel.test(joined) ||
              /^\d{1,2}[.)]?\s+[A-ZÀ-Þ]/.test(joined)) &&
            joined.length < 160 &&
            j > i
          )
            chosen = { level: 1, end: j, text: joined };
          else if (
            j > i &&
            level &&
            next.font >= font * 1.35 &&
            Math.abs(next.font - line.font) < font * 0.5 &&
            joined.length < 150
          )
            chosen = { level, end: j, text: joined };
        }
        if (chosen) {
          consumed = chosen.end - i + 1;
          level = chosen.level;
          line = { ...line, text: chosen.text };
        }
      }
      if (level) {
        const b = add(page, line, "heading", level);
        if (consumed > 1) {
          b.sources = flow.slice(i, i + consumed).map((l) => source(page, l));
          b.originalText = flow
            .slice(i, i + consumed)
            .map((l) => l.originalText || l.text)
            .join("\n");
          b.flags.push("heading-lines-joined");
          result.audit.push({
            at: new Date().toISOString(),
            action: "Otomatis: gabung baris judul",
            blockId: b.id,
            before: b.originalText,
            after: b.text,
          });
        }
        b.confidence = toc.some((t) => t.key === normalizeTitle(b.text))
          ? 0.98
          : 0.8;
        if (a.toc) b.flags.push("source-toc");
        addIssue(
          page.number,
          "heading",
          "Judul dikenali dari struktur/tipografi. Tinjau tingkat dan pemetaan bab.",
          b.id,
        );
        i += consumed - 1;
        current = undefined;
        previous = undefined;
        continue;
      }
      if (
        !a.toc &&
        i + 1 < flow.length &&
        /^[\p{Lu}][\p{L} .'-]{1,40}$/u.test(line.text) &&
        /^:/.test(flow[i + 1].text) &&
        flow[i + 1].y - line.y < leading * 2.2
      ) {
        const b = add(page, line, "quote");
        b.originalText += "\n" + (flow[i + 1].originalText || flow[i + 1].text);
        b.text = line.text + flow[i + 1].text;
        b.sources.push(source(page, flow[i + 1]));
        b.flags.push("dialogue");
        current = b;
        previous = flow[++i];
        continue;
      }
      const kind: Block["kind"] = /^([*•·]\s*){3,}$|^[-—_]{3,}$|^⁂$/.test(
        line.text,
      )
        ? "scene"
        : !a.toc && listMarker(line.text)
          ? "list"
          : /^[“"‘]/.test(line.text)
            ? "quote"
            : "paragraph";
      const gap = previous ? line.baseline - previous.baseline : Infinity;
      const indent = previous ? line.x - previous.x : 0;
      const hanging =
        (current?.kind === "list" ||
          (current?.kind === "quote" &&
            !endSentence(current.text) &&
            !/[”"’']$/.test(current.text))) &&
        line.x >= current.sources[0].x &&
        gap < leading * 1.4;
      const separate =
        !current ||
        a.toc ||
        kind === "list" ||
        kind === "scene" ||
        kind === "quote" ||
        current.kind === "scene" ||
        (previous &&
          (line.column !== previous.column ||
            (gap > leading * 1.42 &&
              !(previous.dropCap && gap < leading * 2.1)) ||
            gap < 0 ||
            (!hanging && indent > font * 0.85 && line.x > minX + font * 0.65) ||
            (!hanging &&
              previous.width < areaWidth * 0.6 &&
              endSentence(current!.text))));
      if (separate) {
        current = add(page, line, kind);
        if (a.toc) current.flags.push("source-toc");
        if (/^[A-ZÀ-Þ]$/.test(line.text) && line.font > font * 1.4) {
          current.flags.push("unresolved-drop-cap");
          addIssue(
            page.number,
            "quality",
            "Huruf besar tunggal belum tersambung. Periksa apakah ini huruf awal paragraf.",
            current.id,
          );
        }
      } else {
        current!.text = joinLines(current!.text, line.text);
        current!.originalText += "\n" + (line.originalText || line.text);
        current!.sources.push(source(page, line));
        if (line.dropCap) current!.flags.push("drop-cap-joined");
      }
      previous = line;
    }
    for (const image of page.images || []) {
      if (image.role === "cover") {
        if (!result.cover)
          result.cover = { data: image.data, type: image.type };
        continue;
      }
      blocks.push({
        id: "figure-" + image.id,
        kind: "figure",
        assetId: image.id,
        text: "",
        originalText: "",
        order: order++,
        sources: [
          {
            page: page.number,
            x: image.x,
            y: image.y,
            width: image.width,
            height: image.height,
          },
        ],
        flags: ["image-position-review"],
      });
    }
  }
  // Sort physical source order, keeping every running block recoverable.
  blocks.sort(
    (a, b) =>
      a.sources[0].page - b.sources[0].page ||
      (() => {
        const p = analyses.find((p) => p.page.number === a.sources[0].page)!;
        if (p.complex && !p.toc) {
          const ac = a.sources[0].x > p.page.width * 0.47 ? 1 : 0,
            bc = b.sources[0].x > p.page.width * 0.47 ? 1 : 0;
          return ac - bc || a.sources[0].y - b.sources[0].y;
        }
        return a.sources[0].y - b.sources[0].y;
      })(),
  );
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i];
    if (
      a.excluded ||
      !["paragraph", "quote", "list"].includes(a.kind) ||
      a.flags.includes("source-toc")
    )
      continue;
    let j = i + 1;
    while (blocks[j]?.excluded) j++;
    const b = blocks[j];
    if (
      !b ||
      !["paragraph", "quote"].includes(b.kind) ||
      b.flags.includes("source-toc") ||
      b.flags.includes("running") ||
      b.flags.includes("drop-cap-joined") ||
      a.flags.includes("running")
    )
      continue;
    const ar = a.sources.at(-1)!,
      br = b.sources[0],
      ap = analyses.find((p) => p.page.number === ar.page)!,
      bp = analyses.find((p) => p.page.number === br.page)!;
    if (
      br.page === ar.page + 1 &&
      !endSentence(a.text) &&
      /^[a-zà-ÿ]|^(?:[A-ZÀ-Þ][\p{L}-]+\b)/u.test(b.text) &&
      ar.y > ap.page.height * 0.68 &&
      br.y < bp.page.height * 0.25 &&
      ar.width > ap.page.width * (ap.complex ? 0.28 : 0.5) &&
      !/^\d+[.)]/.test(b.text)
    ) {
      a.text = joinLines(a.text, b.text);
      a.originalText += "\n\f\n" + b.originalText;
      a.sources.push(...b.sources);
      a.flags.push("cross-page-joined");
      result.audit.push({
        at: new Date().toISOString(),
        action: "Otomatis: sambung paragraf lintas halaman",
        blockId: a.id,
        before: a.originalText,
        after: a.text,
      });
      blocks.splice(j, 1);
      i--;
    }
  }
  blocks.forEach((b, i) => (b.order = i));
  let chapter = { id: "ch-front", title: "Awal buku", blocks: [] as Block[] };
  result.chapters.push(chapter);
  for (const b of blocks) {
    if (!b.excluded && b.kind === "heading" && b.level === 1) {
      const useful = chapter.blocks.some((b) => !b.excluded);
      if (useful) {
        chapter = {
          id: "ch-" + b.id,
          title: b.flags.includes("source-toc")
            ? "Daftar isi (sumber)"
            : b.text,
          blocks: [],
        };
        result.chapters.push(chapter);
      } else chapter.title = b.text;
    }
    chapter.blocks.push(b);
  }
  result.chapters = result.chapters.filter((c) => c.blocks.length);
  const seen = new Set<string>();
  let duplicates = 0;
  for (const b of blocks)
    for (const ref of b.sources)
      for (const i of ref.itemIndices || []) {
        const key = ref.page + ":" + i;
        if (seen.has(key)) duplicates++;
        seen.add(key);
      }
  const total = book.pages.reduce(
    (n, p) => n + p.items.filter((i) => i.text.trim()).length,
    0,
  );
  result.analysis = {
    sourceItems: total,
    coveredItems: seen.size,
    duplicateItems: duplicates,
    missingItems: Math.max(0, total - seen.size),
    images: blocks.filter((b) => b.kind === "figure").length,
    excludedRunning: blocks.filter(
      (b) => b.excluded && b.flags.includes("running"),
    ).length,
  };
  if (result.analysis.missingItems || duplicates)
    addIssue(
      1,
      "quality",
      `Cakupan sumber perlu diperiksa: ${result.analysis.missingItems} item belum terwakili, ${duplicates} referensi ganda.`,
    );
  for (const o of book.outline)
    if (isGenericBookmark(o.title)) {
      addIssue(
        o.page,
        "toc",
        "Bookmark generik diabaikan sebagai judul bab; teks dan daftar isi sumber tetap dianalisis.",
      );
      break;
    }
  return result;
}
export function joinLines(a: string, b: string): string {
  if (a.endsWith("\u00ad")) return a.slice(0, -1) + b;
  if (a.endsWith("-") && /^[a-zà-ÿ]/.test(b)) return a + b;
  return a + " " + b;
}
