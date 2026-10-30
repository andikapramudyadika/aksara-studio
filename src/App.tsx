import { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  BookOpen,
  ArrowRight,
  ArrowUpRight,
  FileUp,
  FolderOpen,
  Settings,
  ShieldCheck,
  Check,
  Plus,
  ChevronRight,
  ChevronDown,
  Download,
  Upload,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
  X,
  FileText,
  ScanText,
  ListTree,
  PanelLeftClose,
  PanelLeft,
  Undo2,
  Redo2,
  Scissors,
  Combine,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Search,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Clock,
  ArrowLeft,
  GripVertical,
  Save,
  RotateCcw,
  BookMarked,
  AlignLeft,
  Type,
  MoveRight,
  Info,
} from "lucide-react";
import type { Book, Block, BlockKind, ProjectSummary } from "./core/model";
import { allBlocks, createBook } from "./core/model";
import {
  listProjects,
  saveProject,
  loadProject,
  deleteProject,
  storageError,
} from "./core/storage";
import {
  editBlock,
  splitBlock,
  mergeBlock,
  startChapter,
  kindLabels,
  setRunningExcluded,
} from "./core/editor";
import { qualitySummary, issueNeedsReview } from "./core/quality";
import { download, safeName } from "./core/files";
const PdfPreview = lazy(() => import("./components/PdfPreview"));
const EpubReader = lazy(() => import("./components/EpubReader"));
import { preference, savePreference } from "./core/preferences";
type Route = "convert" | "projects" | "settings";
type Stage = "analyse" | "edit" | "export";
const getRoute = (): Route =>
  location.hash === "#/proyek"
    ? "projects"
    : location.hash === "#/pengaturan"
      ? "settings"
      : "convert";
function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <div className="brand-mark">
        <BookOpen size={24} strokeWidth={1.7} />
      </div>
      <div>
        Aksara<span>STUDIO</span>
      </div>
    </div>
  );
}
function BookArt() {
  return (
    <svg
      className="book-art"
      viewBox="0 0 320 310"
      role="img"
      aria-label="Ilustrasi buku hijau yang terbuka menjadi bacaan digital"
    >
      <defs>
        <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".45" fill="#fff" opacity=".18" />
        </pattern>
      </defs>
      <ellipse
        cx="166"
        cy="278"
        rx="115"
        ry="15"
        fill="#184f45"
        opacity=".07"
      />
      <path d="M48 85L216 47L264 244L94 281Z" fill="#d9d6c6" />
      <path d="M53 80L220 42L266 239L99 276Z" fill="#f8f5e9" stroke="#d1cdbc" />
      <path
        d="M58 79L224 41L268 232L104 270Z"
        fill="#fffdf3"
        stroke="#d1cdbc"
      />
      <path d="M58 74L225 36L269 227L103 265Z" fill="#195c50" />
      <path d="M58 74L70 71L115 262L103 265Z" fill="#104b41" />
      <path d="M58 74L225 36L269 227L103 265Z" fill="url(#grain)" />
      <path
        d="M87 91L208 64M121 237L244 209"
        stroke="#a8c0a1"
        strokeWidth=".8"
      />
      <g transform="rotate(-13 158 145)" fill="#f3efdc">
        <text
          x="107"
          y="112"
          fontSize="8"
          letterSpacing="3"
          fontFamily="sans-serif"
        >
          AKSARA STUDIO
        </text>
        <text x="102" y="151" fontSize="25" fontFamily="Georgia,serif">
          Sebuah ruang
        </text>
        <text x="102" y="180" fontSize="25" fontFamily="Georgia,serif">
          untuk setiap
        </text>
        <text
          x="102"
          y="209"
          fontSize="25"
          fontStyle="italic"
          fontFamily="Georgia,serif"
        >
          cerita.
        </text>
      </g>
      <path d="M210 41L216 39L228 89L215 82L222 83Z" fill="#d1ae71" />
      <g transform="rotate(8 243 153)">
        <rect
          x="219"
          y="119"
          width="64"
          height="86"
          rx="7"
          fill="#fffdf6"
          stroke="#d0dace"
        />
        <path
          d="M231 138H271M231 147H267M231 156H271M231 165H259"
          stroke="#9cafa3"
          strokeWidth="2"
        />
        <rect x="231" y="179" width="28" height="12" rx="3" fill="#dfece4" />
        <text
          x="236"
          y="187"
          fill="#276255"
          fontSize="6"
          fontFamily="sans-serif"
        >
          EPUB
        </text>
      </g>
      <path
        d="M46 206L42 215L33 219L42 223L46 232L50 223L59 219L50 215Z"
        fill="#b1bd94"
      />
      <path
        d="M261 62L258 68L252 71L258 74L261 80L264 74L270 71L264 68Z"
        fill="#a7b99d"
      />
    </svg>
  );
}
function Steps({ stage }: { stage: Stage }) {
  return (
    <div className="steps" aria-label="Tahap konversi">
      {(["analyse", "edit", "export"] as Stage[]).map((s, i) => (
        <div
          key={s}
          className={`step ${stage === s ? "active" : ""} ${["analyse", "edit", "export"].indexOf(stage) > i ? "done" : ""}`}
        >
          <span>
            {["analyse", "edit", "export"].indexOf(stage) > i ? (
              <Check size={14} />
            ) : (
              i + 1
            )}
          </span>
          <div>{["Analisis", "Rapikan", "Ekspor"][i]}</div>
          {i < 2 && <ChevronRight size={14} />}
        </div>
      ))}
    </div>
  );
}
function App() {
  const [route, setRoute] = useState<Route>(getRoute),
    [stage, setStage] = useState<Stage>("analyse"),
    [projects, setProjects] = useState<ProjectSummary[]>([]),
    [book, setBook] = useState<Book>(),
    [pdf, setPdf] = useState<Blob>(),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({
      page: 0,
      total: 0,
      label: "Membaca dokumen",
    }),
    [error, setError] = useState(""),
    [saveStatus, setSaveStatus] = useState(""),
    [help, setHelp] = useState(false),
    [drag, setDrag] = useState(false),
    [theme, setTheme] = useState(() => preference("aksara-theme", "light")),
    [resolvedTheme, setResolvedTheme] = useState("light"),
    [fontSize, setFontSize] = useState(
      () => Number(preference("aksara-font", "18")) || 18,
    ),
    [lineHeight, setLineHeight] = useState(1.8),
    [readWidth, setReadWidth] = useState(660),
    [readTheme, setReadTheme] = useState("paper"),
    [page, setPage] = useState(1),
    [mobileTab, setMobileTab] = useState<"pdf" | "epub">("epub"),
    [structure, setStructure] = useState(true),
    [selected, setSelected] = useState<string>(),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(""),
    [showSource, setShowSource] = useState(false),
    [issues, setIssues] = useState(false),
    [history, setHistory] = useState<Book[]>([]),
    [future, setFuture] = useState<Book[]>([]),
    [search, setSearch] = useState(""),
    [ratio, setRatio] = useState(50),
    [exportBytes, setExportBytes] = useState<Uint8Array>(),
    [reader, setReader] = useState(false),
    [exportBusy, setExportBusy] = useState(false),
    [exportOk, setExportOk] = useState(false),
    [deleteId, setDeleteId] = useState<string>(),
    [issueFilter, setIssueFilter] = useState("attention"),
    [shownChapter, setShownChapter] = useState<string>(),
    [showExcluded, setShowExcluded] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    cancel = useRef<AbortController | undefined>(undefined),
    textArea = useRef<HTMLTextAreaElement>(null),
    activeId = useRef<string | undefined>(undefined),
    saveQueue = useRef<Promise<unknown>>(Promise.resolve()),
    dialog = useRef<HTMLDialogElement>(null),
    helpOpener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const listener = () => setRoute(getRoute());
    window.addEventListener("hashchange", listener);
    refresh();
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    activeId.current = book?.id;
  }, [book?.id]);
  useEffect(() => {
    const q = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const value = theme === "system" ? (q.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = value;
      setResolvedTheme(value);
    };
    apply();
    q.addEventListener("change", apply);
    savePreference("aksara-theme", theme);
    return () => q.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    savePreference("aksara-font", String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    if (help) {
      helpOpener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      helpOpener.current?.focus();
    }
  }, [help]);
  const refresh = () =>
    listProjects()
      .then(setProjects)
      .catch((e) => setError(storageError(e)));
  const persist = (next: Book, blob?: Blob) => {
    setSaveStatus("Menyimpan…");
    const pending = saveQueue.current
      .catch(() => {})
      .then(() => saveProject(next, blob));
    saveQueue.current = pending;
    return pending
      .then(() => {
        if (activeId.current === next.id)
          setSaveStatus("Tersimpan di perangkat");
        if (next.status !== "analysing") void refresh();
      })
      .catch((e) => {
        setSaveStatus("Belum tersimpan");
        setError(storageError(e));
      });
  };
  const update = (next: Book, record = true) => {
    if (book && record) {
      setHistory((h) => [...h.slice(-29), book]);
      setFuture([]);
    }
    setBook(next);
    setExportBytes(undefined);
    setExportOk(false);
    void persist(next);
  };
  const undo = () => {
    if (!book || !history.length) return;
    const b = history.at(-1)!;
    setFuture((f) => [book, ...f]);
    setHistory((h) => h.slice(0, -1));
    update(b, false);
  };
  const redo = () => {
    if (!book || !future.length) return;
    const b = future[0];
    setHistory((h) => [...h, book]);
    setFuture((f) => f.slice(1));
    update(b, false);
  };
  const navigate = (r: Route) => {
    location.hash =
      r === "projects"
        ? "/proyek"
        : r === "settings"
          ? "/pengaturan"
          : "/konversi";
    setRoute(r);
  };
  const reset = () => {
    if (busy) {
      setError(
        "Batalkan atau selesaikan analisis aktif sebelum memulai konversi baru.",
      );
      return;
    }
    cancel.current?.abort();
    setBook(undefined);
    setPdf(undefined);
    setStage("analyse");
    setSelected(undefined);
    setEditing(false);
    setHistory([]);
    setFuture([]);
    setError("");
    setExportBytes(undefined);
    setExportOk(false);
    navigate("convert");
  };
  async function run(file: Blob, current: Book) {
    setError("");
    setBusy(true);
    setStage("analyse");
    setBook(current);
    setPdf(file);
    setSelected(undefined);
    setEditing(false);
    setHistory([]);
    setFuture([]);
    setExportBytes(undefined);
    setExportOk(false);
    activeId.current = current.id;
    navigate("convert");
    const controller = new AbortController();
    cancel.current = controller;
    let checkpoint = structuredClone(current);
    if (checkpoint.engineVersion !== 2) {
      checkpoint.pages = [];
      checkpoint.engineVersion = 2;
    }
    setProgress({
      page: checkpoint.pages.length,
      total: 0,
      label: "Membaca dokumen",
    });
    try {
      await persist(checkpoint, file);
      const { extractPdf, analyse } = await import("./core/pdf");
      if (controller.signal.aborted)
        throw new DOMException("Dibatalkan", "AbortError");
      await extractPdf(
        file,
        checkpoint,
        controller.signal,
        async (p, total) => {
          checkpoint.pages.push(p);
          setProgress({
            page: p.number,
            total,
            label: "Mengekstrak teks dan gambar",
          });
          setBook({ ...checkpoint, pages: [...checkpoint.pages] });
          await persist(checkpoint, file);
        },
        (outline) => {
          checkpoint.outline = outline;
        },
        (total) => setProgress((p) => ({ ...p, total })),
      );
      setProgress((p) => ({ ...p, label: "Menyusun paragraf dan bab" }));
      const result = await analyse(checkpoint, controller.signal);
      setBook(result);
      setShownChapter(undefined);
      await persist(result, file);
      setStage("edit");
    } catch (e) {
      setBook(checkpoint);
      await persist(checkpoint, file);
      setError(
        controller.signal.aborted
          ? "Analisis dibatalkan. Checkpoint tersimpan; pilih “Lanjutkan analisis” untuk melanjutkan."
          : `PDF belum dapat diproses. ${e instanceof Error ? e.message : String(e)}. Pastikan PDF tidak terkunci dan memiliki teks.`,
      );
    } finally {
      setBusy(false);
    }
  }
  const choose = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Pilih file PDF dengan ekstensi .pdf.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError(
        "Batas file tahap pertama adalah 200 MB agar penggunaan memori browser terjaga.",
      );
      return;
    }
    void run(file, createBook(file.name));
  };
  async function openProject(id: string) {
    if (busy) {
      setError(
        "Batalkan atau selesaikan analisis aktif sebelum membuka proyek lain.",
      );
      return;
    }
    try {
      await saveQueue.current;
      const p = await loadProject(id);
      if (!p) throw new Error("Proyek tidak ditemukan.");
      setBook(p.book);
      activeId.current = id;
      setPdf(p.pdf);
      setStage(p.book.status === "analysing" ? "analyse" : "edit");
      setError("");
      setSelected(undefined);
      setEditing(false);
      setPage(1);
      setHistory([]);
      setFuture([]);
      setExportBytes(undefined);
      setExportOk(false);
      navigate("convert");
    } catch (e) {
      setError(String(e));
    }
  }
  async function importLocal(file?: File) {
    if (!file) return;
    try {
      const { importProject } = await import("./core/project");
      const p = await importProject(file);
      if (projects.some((b) => b.id === p.book.id)) {
        p.book.id = crypto.randomUUID();
        p.book.title += " (impor)";
      }
      await persist(p.book, p.pdf);
      await openProject(p.book.id);
    } catch (e) {
      setError("Tidak dapat mengimpor proyek: " + String(e));
    }
  }
  async function saveLocal() {
    if (!book) return;
    try {
      const { exportProject } = await import("./core/project");
      const data = await exportProject(book, pdf);
      download(
        data as BlobPart,
        safeName(book.title) + ".aksara",
        "application/zip",
      );
    } catch (e) {
      setError("Ekspor proyek gagal: " + String(e));
    }
  }
  async function makeExport() {
    if (!book) return;
    setExportBusy(true);
    setError("");
    try {
      const { validateEpub } = await import("./core/validation");
      const { exportInWorker } = await import("./core/export-worker");
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const data = await exportInWorker(book);
      const errors = validateEpub(data);
      if (errors.length) throw new Error(errors.join(" "));
      setExportBytes(data);
      setExportOk(true);
      const next = { ...book, status: "exported" as const };
      setBook(next);
      await persist(next);
    } catch (e) {
      setError("Ekspor gagal: " + String(e));
    } finally {
      setExportBusy(false);
    }
  }
  const blocks = book ? allBlocks(book) : [];
  const selectedBlock = blocks.find((b) => b.id === selected);
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  const quality = book ? qualitySummary(book) : undefined;
  const pendingIssues = book
    ? book.issues.filter((i) => issueNeedsReview(book, i, blockMap))
    : [];
  const assets = new Map(
    book?.pages.flatMap((p) => p.images || []).map((a) => [a.id, a]) || [],
  );
  const visibleChapters = book
    ? blocks.length > 500
      ? [
          book.chapters.find(
            (c) =>
              c.id === shownChapter ||
              (!shownChapter && c.blocks.some((b) => b.id === selected)),
          ) || book.chapters[0],
        ].filter(Boolean)
      : book.chapters
    : [];
  const wordCount = blocks
    .filter((b) => !b.excluded && b.kind !== "figure")
    .reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
  const selectBlock = (b: Block) => {
    setSelected(b.id);
    setPage(b.sources[0]?.page || 1);
    setEditing(false);
  };
  const jump = (id?: string, p?: number) => {
    if (p) setPage(p);
    if (id) {
      setShownChapter(
        book?.chapters.find((c) => c.blocks.some((b) => b.id === id))?.id,
      );
      setSelected(id);
      if (blocks.find((b) => b.id === id)?.excluded) setShowExcluded(true);
      setStage("edit");
      setMobileTab("epub");
      setTimeout(
        () =>
          document.getElementById("block-" + id)?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "center",
          }),
        70,
      );
    }
  };
  const blockView = (b: Block) => {
    if (b.excluded && !showExcluded) return null;
    const props = {
      id: "block-" + b.id,
      key: b.id,
      className: `book-block ${b.kind} ${selected === b.id ? "selected" : ""} ${b.excluded ? "excluded" : ""}`,
      tabIndex: 0,
      role: "button",
      onClick: () => selectBlock(b),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectBlock(b);
        }
      },
      "aria-label": `${kindLabels[b.kind]}: ${b.text.slice(0, 70)}, halaman ${b.sources[0]?.page || 1}`,
    };
    return (
      <div {...props}>
        {b.kind === "figure" ? (
          <figure>
            {b.assetId && assets.has(b.assetId) ? (
              <img
                loading="lazy"
                src={`data:${assets.get(b.assetId)!.type};base64,${assets.get(b.assetId)!.data}`}
                alt={b.text || `Ilustrasi halaman ${b.sources[0]?.page}`}
              />
            ) : (
              <p className="notice warning">Aset gambar belum tersedia</p>
            )}
            {b.text && <figcaption>{b.text}</figcaption>}
          </figure>
        ) : b.kind === "heading" ? (
          <h2 className={"level-" + (b.level || 1)}>{b.text}</h2>
        ) : b.kind === "quote" ? (
          <blockquote>{b.text}</blockquote>
        ) : b.kind === "list" ? (
          <p className="list-block">{b.text}</p>
        ) : (
          <p>{b.text}</p>
        )}
        {b.excluded && (
          <span className="excluded-label">Dikecualikan dari EPUB</span>
        )}
      </div>
    );
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">RUANG KERJA</div>
        <nav aria-label="Navigasi utama">
          {(
            [
              { id: "convert", icon: FileUp, label: "Konversi" },
              { id: "projects", icon: FolderOpen, label: "Proyek" },
              { id: "settings", icon: Settings, label: "Pengaturan" },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={`nav-item ${route === n.id ? "active" : ""}`}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "projects" && projects.length > 0 && (
                <span className="count">{projects.length}</span>
              )}
              {route === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={21} />
            <strong>Hanya di perangkat Anda</strong>
            <p>
              Buku dan catatan Anda tetap milik Anda. Tanpa unggahan ke server.
            </p>
            <span>
              <span className="status-dot" /> Pemrosesan lokal
            </span>
          </div>
          <button className="help-link" onClick={() => setHelp(true)}>
            <HelpCircle size={17} />
            Panduan singkat
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-footer">
            <span>AKSARA STUDIO</span>
            <span>v1.1.1</span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand small />
          </div>
          <div className="breadcrumb">
            <span>Ruang kerja</span>
            <ChevronRight size={14} />
            <strong>
              {route === "projects"
                ? "Proyek"
                : route === "settings"
                  ? "Pengaturan"
                  : "Konversi"}
            </strong>
          </div>
          <div className="top-actions">
            <span className="private-pill">
              <span className="status-dot" />
              Lokal & privat
            </span>
            <span className="top-divider" />
            <button
              className="icon-btn"
              aria-label="Ubah tema"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
            <button
              className="icon-btn"
              aria-label="Buka panduan"
              onClick={() => setHelp(true)}
            >
              <HelpCircle size={19} />
            </button>
          </div>
        </header>
        <input
          className="sr-only"
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
          aria-label="Pilih file PDF"
        />
        <input
          className="sr-only"
          ref={projectInput}
          type="file"
          accept=".aksara,.zip"
          aria-label="Impor proyek Aksara"
          onChange={(e) => {
            void importLocal(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {error && (
          <div className="global-error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button
              className="icon-btn"
              aria-label="Tutup pesan"
              onClick={() => setError("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {route === "convert" && !book && (
          <div className="home content">
            <div className="page-heading">
              <div className="eyebrow">
                <span />
                DARI PDF KE EPUB
              </div>
              <h1>
                Dari halaman statis,
                <br />
                ke cerita yang <em>mengalir.</em>
              </h1>
              <p>
                Ruang untuk mengolah dan memahami buku.
                <br className="mobile-break" /> Ubah PDF Anda menjadi bacaan
                yang lebih nyaman.
              </p>
            </div>
            <div className="home-workspace">
              <div className="upload-column">
                <div className="workspace-caption">
                  <span>Mulai konversi baru</span>
                  <span>01 — 03</span>
                </div>
                <Steps stage="analyse" />
                <div
                  className={`dropzone ${drag ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    choose(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="upload-icon">
                    <FileUp size={30} strokeWidth={1.4} />
                    <span>
                      <Plus size={12} />
                    </span>
                  </div>
                  <h2>Buku yang baik, format yang tepat.</h2>
                  <p>
                    Tarik PDF ke sini untuk memulai,
                    <br />
                    atau pilih file dari perangkat Anda.
                  </p>
                  <button
                    className="btn primary"
                    onClick={() => input.current?.click()}
                  >
                    <Plus size={18} />
                    Pilih PDF
                    <ArrowRight size={17} />
                  </button>
                  <span className="file-hint">
                    PDF berbasis teks · Maks. 200 MB
                  </span>
                </div>
                <div className="upload-note">
                  <ShieldCheck size={15} />
                  <span>
                    File diproses langsung di browser. Tidak pernah meninggalkan
                    perangkat Anda.
                  </span>
                </div>
                <button
                  className="sample-link"
                  onClick={async () => {
                    try {
                      if (projects.some((p) => p.id === "aksara-demo")) {
                        await openProject("aksara-demo");
                        return;
                      }
                      const { demoBook, demoPdf } = await import("./core/demo");
                      const b = demoBook();
                      const p = await demoPdf();
                      await persist(b, p);
                      await openProject(b.id);
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  <BookOpen size={16} />
                  Belum ada PDF? <strong>Coba buku contoh</strong>
                  <ArrowRight size={15} />
                </button>
              </div>
              <aside className="editorial-card">
                <div className="editorial-top">
                  <span>DIBUAT UNTUK DIBACA</span>
                  <BookMarked size={18} strokeWidth={1.4} />
                </div>
                <BookArt />
                <h2>
                  Buku Anda.
                  <br />
                  <em>Ruang baru.</em>
                </h2>
                <p>
                  Teks yang menyesuaikan layar.
                  <br />
                  Paragraf yang bernapas.
                  <br />
                  Pengalaman membaca yang utuh.
                </p>
                <div className="format-badge">
                  <span>PDF</span>
                  <MoveRight size={24} />
                  <span>EPUB</span>
                  <span className="reflow">
                    Reflowable
                    <Check size={12} />
                  </span>
                </div>
              </aside>
            </div>
            <div className="benefit-row">
              <div>
                <ScanText size={21} />
                <span>
                  <strong>Isi tetap jadi prioritas</strong>
                  <small>Periksa teks dan urutan bacaan.</small>
                </span>
              </div>
              <div>
                <AlignLeft size={21} />
                <span>
                  <strong>Rapikan dengan kendali</strong>
                  <small>Edit paragraf, judul, dan struktur bab.</small>
                </span>
              </div>
              <div>
                <BookOpen size={21} />
                <span>
                  <strong>Nyaman di setiap layar</strong>
                  <small>EPUB yang mengikuti cara Anda membaca.</small>
                </span>
              </div>
            </div>
            <section className="recent-section">
              <div className="section-head">
                <h2>
                  Proyek terakhir <span>{projects.length}</span>
                </h2>
                <button
                  className="text-btn"
                  onClick={() => navigate("projects")}
                >
                  Lihat semua
                  <ArrowRight size={15} />
                </button>
              </div>
              {projects.length ? (
                projects.slice(0, 3).map((p) => (
                  <button
                    className="project-row"
                    key={p.id}
                    onClick={() => openProject(p.id)}
                  >
                    <div className="project-icon">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <strong>{p.title}</strong>
                      <span>
                        {p.pageCount} halaman ·{" "}
                        {p.status === "analysing"
                          ? "Analisis belum selesai"
                          : "Siap dirapikan"}
                      </span>
                    </div>
                    <time>
                      {new Date(p.updatedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                    <ArrowUpRight size={18} />
                  </button>
                ))
              ) : (
                <div className="recent-empty">
                  <FolderOpen size={20} />
                  <span>Perjalanan buku Anda dimulai di sini.</span>
                  <button
                    className="text-btn"
                    onClick={() => projectInput.current?.click()}
                  >
                    Impor proyek
                    <Upload size={14} />
                  </button>
                </div>
              )}
            </section>
            <footer className="home-footer">
              <span>Dibuat dengan perhatian pada setiap paragraf.</span>
              <span>
                TAHAP 1 <span>·</span> PDF TEKS → EPUB
              </span>
            </footer>
          </div>
        )}
        {route === "projects" && (
          <div className="content projects-page">
            <div className="title-row">
              <div>
                <div className="eyebrow">PERPUSTAKAAN LOKAL</div>
                <h1>Proyek Anda</h1>
                <p>
                  Semua buku, koreksi, dan langkah kecil Anda tersimpan di sini.
                </p>
              </div>
              <button className="btn primary" onClick={reset}>
                <Plus size={18} />
                Konversi baru
              </button>
            </div>
            <div className="projects-toolbar">
              <label className="search-box">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari judul buku…"
                />
              </label>
              <button
                className="btn secondary"
                onClick={() => projectInput.current?.click()}
              >
                <Upload size={16} />
                Impor proyek
              </button>
            </div>
            {projects.filter((p) =>
              p.title.toLowerCase().includes(search.toLowerCase()),
            ).length ? (
              projects
                .filter((p) =>
                  p.title.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <div className="project-row" key={p.id}>
                    <button
                      className="project-main"
                      onClick={() => openProject(p.id)}
                    >
                      <div className="project-icon">
                        <BookOpen size={22} />
                      </div>
                      <div>
                        <strong>{p.title}</strong>
                        <span>
                          {p.pageCount} halaman · {p.chapterCount} bab ·{" "}
                          {new Date(p.updatedAt).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                    </button>
                    <span className="tag">
                      {p.status === "analysing"
                        ? "Belum selesai"
                        : p.status === "exported"
                          ? "Sudah diekspor"
                          : "Perlu ditinjau"}
                    </span>
                    {deleteId === p.id ? (
                      <div className="delete-confirm">
                        <span>Hapus proyek?</span>
                        <button
                          className="btn danger"
                          onClick={async () => {
                            await deleteProject(p.id);
                            if (book?.id === p.id) reset();
                            setDeleteId(undefined);
                            void refresh();
                          }}
                        >
                          Ya, hapus
                        </button>
                        <button
                          className="icon-btn"
                          aria-label="Batal hapus"
                          onClick={() => setDeleteId(undefined)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="icon-btn"
                        aria-label={`Hapus ${p.title}`}
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                ))
            ) : (
              <div className="empty-state">
                <FolderOpen size={42} strokeWidth={1} />
                <h2>
                  {search ? "Tidak ada judul yang cocok" : "Belum ada proyek"}
                </h2>
                <p>Pilih PDF pertama Anda atau impor proyek Aksara.</p>
                <button className="btn primary" onClick={reset}>
                  Mulai konversi
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            <div className="notice">
              <Info size={18} />
              <span>
                Proyek tersimpan di browser ini. Menghapus data situs juga
                menghapus proyek. Gunakan ekspor proyek lokal untuk membuat
                cadangan.
              </span>
            </div>
          </div>
        )}
        {route === "settings" && (
          <div className="content settings-page">
            <div className="eyebrow">SESUAI CARA ANDA</div>
            <h1>Pengaturan</h1>
            <p>Ruang kerja yang tenang, bacaan yang nyaman.</p>
            <section className="settings-section">
              <h2>Tampilan ruang kerja</h2>
              <p>Pilih tema yang nyaman untuk mata Anda.</p>
              <div className="theme-options">
                {[
                  { id: "light", icon: Sun, label: "Terang" },
                  { id: "dark", icon: Moon, label: "Gelap" },
                  { id: "system", icon: Monitor, label: "Sistem" },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={`theme-option ${theme === t.id ? "chosen" : ""}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <t.icon size={22} />
                    {t.label}
                    {theme === t.id && <Check size={16} />}
                  </button>
                ))}
              </div>
            </section>
            <section className="settings-section">
              <h2>Kenyamanan membaca</h2>
              <div className="setting-row">
                <label htmlFor="font-size">Ukuran huruf pratinjau</label>
                <input
                  id="font-size"
                  type="range"
                  min="14"
                  max="28"
                  value={fontSize}
                  onChange={(e) => setFontSize(+e.target.value)}
                />
                <span>{fontSize} px</span>
              </div>
              <div className="setting-row">
                <label htmlFor="line-height">Jarak antarbaris</label>
                <input
                  id="line-height"
                  type="range"
                  min="1.3"
                  max="2.2"
                  step="0.1"
                  value={lineHeight}
                  onChange={(e) => setLineHeight(+e.target.value)}
                />
                <span>{lineHeight}</span>
              </div>
              <div className="setting-row">
                <label htmlFor="read-width">Lebar area baca</label>
                <input
                  id="read-width"
                  type="range"
                  min="380"
                  max="800"
                  step="20"
                  value={readWidth}
                  onChange={(e) => setReadWidth(+e.target.value)}
                />
                <span>{readWidth} px</span>
              </div>
              <div className="setting-row">
                <label htmlFor="read-theme">Tema bacaan</label>
                <select
                  id="read-theme"
                  value={readTheme}
                  onChange={(e) => setReadTheme(e.target.value)}
                >
                  <option value="paper">Kertas</option>
                  <option value="white">Putih</option>
                  <option value="night">Malam</option>
                </select>
              </div>
              <div
                className={`reading-sample ${readTheme}`}
                style={{ fontSize, lineHeight }}
              >
                <p>
                  Ada buku yang meminta kita berhenti sejenak, dan memberi ruang
                  untuk gagasan baru.
                </p>
              </div>
            </section>
            <section className="settings-section">
              <h2>Privasi & penyimpanan</h2>
              <div className="notice">
                <ShieldCheck size={22} />
                <p>
                  PDF diproses di perangkat Anda, tanpa API key atau backend
                  konversi. Proses dapat berhenti saat tab ditutup. Data lokal
                  bukan cadangan permanen; ekspor proyek Anda secara berkala.
                </p>
              </div>
              <button
                className="btn secondary"
                onClick={() =>
                  navigator.storage
                    ?.persist?.()
                    .then((granted) =>
                      setSaveStatus(
                        granted
                          ? "Penyimpanan persisten diizinkan browser."
                          : "Browser belum memberikan penyimpanan persisten. Tetap buat cadangan proyek.",
                      ),
                    )
                    .catch(() =>
                      setSaveStatus("Penyimpanan persisten tidak tersedia."),
                    )
                }
              >
                <Save size={16} />
                Minta penyimpanan persisten
              </button>
              {saveStatus && (
                <p className="muted" role="status">
                  {saveStatus}
                </p>
              )}
            </section>
            <section className="settings-section">
              <h2>Tahap berikutnya</h2>
              <p>
                Terjemahan dan ringkasan AI belum tersedia pada tahap ini.
                Rancangan OpenRouter terdokumentasi dalam source proyek. Tidak
                ada teks yang dikirim ke layanan AI.
              </p>
            </section>
          </div>
        )}
        {route === "convert" && book && (
          <div
            className={`project-workspace ${stage === "edit" ? "editing-workspace" : "content"}`}
          >
            <div className="project-heading">
              <div>
                <button
                  className="text-btn back"
                  disabled={busy}
                  onClick={reset}
                >
                  <ArrowLeft size={14} />
                  Konversi baru
                </button>
                <h1>{book.title}</h1>
                <p>
                  <span className="status-dot" />
                  {saveStatus || "Proyek lokal"}
                  <span>·</span>
                  {book.filename}
                </p>
              </div>
              <div className="project-heading-actions">
                <button
                  className="btn secondary"
                  onClick={saveLocal}
                  disabled={busy}
                >
                  <Download size={16} />
                  <span>Ekspor proyek</span>
                </button>
                {stage === "edit" && (
                  <button
                    className="btn primary"
                    onClick={() => {
                      setEditing(false);
                      setStage("export");
                    }}
                  >
                    Lanjut ke ekspor
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="project-stages">
              <Steps stage={stage} />
              {stage !== "analyse" && (
                <button className="text-btn" onClick={() => setIssues(!issues)}>
                  <AlertTriangle size={15} />
                  {pendingIssues.length} catatan tinjauan
                  <ChevronDown size={14} />
                </button>
              )}
            </div>
            {stage !== "analyse" && (book.engineVersion || 1) < 2 && pdf && (
              <div className="notice upgrade-notice">
                <Info size={20} />
                <div>
                  <strong>Mesin rekonstruksi baru tersedia</strong>
                  <p>
                    Buat salinan dengan analisis baru untuk memperbaiki bab,
                    paragraf, dan gambar. Koreksi proyek ini tetap tersimpan.
                  </p>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      const next = createBook(book.filename);
                      next.title = book.title;
                      next.author = book.author;
                      next.language = book.language;
                      next.cover = book.cover;
                      void run(pdf, next);
                    }}
                  >
                    Analisis ulang sebagai salinan
                  </button>
                </div>
              </div>
            )}
            {stage === "analyse" && (
              <div className="analysis-panel">
                <div className="analysis-icon">
                  {busy ? (
                    <LoaderCircle size={32} className="spin" />
                  ) : (
                    <ScanText size={32} />
                  )}
                </div>
                <h2>
                  {busy
                    ? "Memberi ruang untuk setiap kata."
                    : "Analisis belum selesai"}
                </h2>
                <p>
                  {busy
                    ? "Tetap buka tab ini. Kami menyimpan checkpoint setiap halaman."
                    : "Pekerjaan yang tersimpan dapat dilanjutkan dari halaman terakhir."}
                </p>
                <div className="progress-label" role="status">
                  {progress.label}
                  {progress.total > 0
                    ? ` · Halaman ${progress.page}/${progress.total}`
                    : ""}
                </div>
                {progress.total > 0 ? (
                  <progress value={progress.page} max={progress.total} />
                ) : busy ? (
                  <div className="indeterminate">Membuka PDF…</div>
                ) : null}
                <div className="analysis-actions">
                  {busy ? (
                    <button
                      className="btn secondary"
                      onClick={() => cancel.current?.abort()}
                    >
                      <X size={16} />
                      Batalkan analisis
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn primary"
                        disabled={!pdf}
                        onClick={() => pdf && run(pdf, book)}
                      >
                        <RotateCcw size={16} />
                        Lanjutkan analisis
                      </button>
                      <button
                        className="btn secondary"
                        disabled={!pdf}
                        onClick={() =>
                          pdf && run(pdf, createBook(book.filename))
                        }
                      >
                        Coba dari awal
                      </button>
                    </>
                  )}
                </div>
                <small>
                  PDF teks satu kolom didukung utama. OCR baru belum tersedia.
                  Gambar yang dapat ditempatkan diekstrak; periksa laporan
                  keterbatasan.
                </small>
              </div>
            )}
            {issues && stage !== "analyse" && (
              <section className="issues-panel">
                <div className="section-head">
                  <h2>Catatan yang perlu ditinjau</h2>
                  <button
                    className="icon-btn"
                    aria-label="Tutup laporan"
                    onClick={() => setIssues(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <p>
                  Header/footer berulang yang kuat terdeteksi dikecualikan
                  dengan catatan dan dapat dipulihkan. Kandidat meragukan tetap
                  disertakan. Tinjau posisi gambar dan pemetaan judul terhadap
                  sumber.
                </p>
                {quality && (
                  <>
                    <div className="quality-grid">
                      <div>
                        <strong>{book.chapters.length}</strong>
                        <span>bagian / bab</span>
                      </div>
                      <div>
                        <strong>{quality.figures.length}</strong>
                        <span>gambar disertakan</span>
                      </div>
                      <div>
                        <strong>
                          {quality.running.filter((b) => b.excluded).length}
                        </strong>
                        <span>header/footer dikecualikan</span>
                      </div>
                      <div>
                        <strong>{quality.missingItems}</strong>
                        <span>item sumber belum terwakili</span>
                      </div>
                    </div>
                    <p className="muted">
                      Cakupan saat analisis:{" "}
                      {book.analysis
                        ? `${book.analysis.coveredItems.toLocaleString("id-ID")} dari ${book.analysis.sourceItems.toLocaleString("id-ID")} item teks sumber`
                        : "belum tersedia pada proyek lama"}
                      . Angka ini memeriksa referensi sumber, bukan jaminan
                      kesempurnaan isi.
                    </p>
                    {quality.running.length > 0 && (
                      <div className="review-actions">
                        <button
                          className="btn secondary"
                          onClick={() => update(setRunningExcluded(book, true))}
                        >
                          Kecualikan semua kandidat header/footer
                        </button>
                        <button
                          className="btn secondary"
                          onClick={() =>
                            update(setRunningExcluded(book, false))
                          }
                        >
                          Pulihkan semua header/footer
                        </button>
                      </div>
                    )}
                  </>
                )}
                <label className="issue-filter">
                  Tampilkan catatan
                  <select
                    value={issueFilter}
                    onChange={(e) => setIssueFilter(e.target.value)}
                  >
                    <option value="attention">Perlu ditinjau</option>
                    <option value="all">
                      Semua catatan (termasuk informasi)
                    </option>
                    <option value="running">Header / footer</option>
                    <option value="heading">Judul dan bab</option>
                    <option value="image">Gambar</option>
                    <option value="toc">Daftar isi</option>
                    <option value="quality">Kualitas teks</option>
                    <option value="ocr">Lapisan OCR</option>
                    <option value="layout">Layout</option>
                    <option value="empty">Tanpa teks</option>
                  </select>
                </label>
                {quality && quality.figures.length > 0 && (
                  <details className="figure-review">
                    <summary>
                      {quality.figures.length} gambar dari PDF sumber
                    </summary>
                    {quality.figures.map((b) => (
                      <button
                        key={b.id}
                        className="issue-row"
                        onClick={() => jump(b.id, b.sources[0]?.page)}
                      >
                        <span className="tag">Hlm. {b.sources[0]?.page}</span>
                        <span>{b.text || "Ilustrasi dari halaman sumber"}</span>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </details>
                )}
                {issueFilter === "attention" && !pendingIssues.length && (
                  <div className="notice">
                    <CheckCircle2 size={18} />
                    Tidak ada peringatan struktural tersisa. Tetap tinjau isi
                    dan gambar terhadap PDF sumber.
                  </div>
                )}
                {!book.issues.length ? (
                  <div className="notice">
                    <CheckCircle2 size={18} />
                    Tidak ada masalah otomatis terdeteksi. Tetap bandingkan teks
                    dengan sumber.
                  </div>
                ) : (
                  book.issues
                    .filter(
                      (i) =>
                        issueFilter === "all" ||
                        (issueFilter === "attention"
                          ? issueNeedsReview(book, i, blockMap)
                          : i.kind === issueFilter),
                    )
                    .map((i) => (
                      <button
                        key={i.id}
                        className="issue-row"
                        onClick={() => jump(i.blockId, i.page)}
                      >
                        <span className="tag">Hlm. {i.page}</span>
                        <span>
                          {i.message}
                          {i.blockId &&
                          blocks.find((b) => b.id === i.blockId)?.excluded
                            ? " (Dikecualikan)"
                            : ""}
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                    ))
                )}
              </section>
            )}
            {stage === "edit" && (
              <>
                <div className="editor-toolbar">
                  <div>
                    <button
                      className="icon-btn"
                      aria-label="Tampilkan atau tutup struktur bab"
                      onClick={() => setStructure(!structure)}
                    >
                      {structure ? (
                        <PanelLeftClose size={19} />
                      ) : (
                        <PanelLeft size={19} />
                      )}
                    </button>
                    <span className="toolbar-divider" />
                    <button
                      className="icon-btn"
                      aria-label="Undo"
                      disabled={!history.length}
                      onClick={undo}
                    >
                      <Undo2 size={18} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Redo"
                      disabled={!future.length}
                      onClick={redo}
                    >
                      <Redo2 size={18} />
                    </button>
                  </div>
                  <div>
                    <Type size={17} />
                    <label className="sr-only" htmlFor="editor-font">
                      Ukuran huruf
                    </label>
                    <select
                      id="editor-font"
                      value={fontSize}
                      onChange={(e) => setFontSize(+e.target.value)}
                    >
                      {[14, 16, 18, 20, 22, 24, 26, 28].map((n) => (
                        <option key={n} value={n}>
                          {n} px
                        </option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor="editor-theme">
                      Tema baca
                    </label>
                    <select
                      id="editor-theme"
                      value={readTheme}
                      onChange={(e) => setReadTheme(e.target.value)}
                    >
                      <option value="paper">Kertas</option>
                      <option value="white">Putih</option>
                      <option value="night">Malam</option>
                    </select>
                    <details className="reading-options">
                      <summary aria-label="Opsi bacaan">
                        <MoreHorizontal size={19} />
                      </summary>
                      <div>
                        <label className="review-checkbox">
                          <input
                            type="checkbox"
                            checked={showExcluded}
                            onChange={(e) => setShowExcluded(e.target.checked)}
                          />
                          Tampilkan blok dikecualikan
                        </label>
                        <label>
                          Jarak baris
                          <input
                            type="range"
                            min="1.3"
                            max="2.2"
                            step=".1"
                            value={lineHeight}
                            onChange={(e) => setLineHeight(+e.target.value)}
                          />
                        </label>
                        <label>
                          Lebar baca
                          <input
                            type="range"
                            min="380"
                            max="800"
                            value={readWidth}
                            onChange={(e) => setReadWidth(+e.target.value)}
                          />
                        </label>
                        <label>
                          Pembagian panel
                          <input
                            aria-label="Pembagian panel"
                            type="range"
                            min="30"
                            max="65"
                            value={ratio}
                            onChange={(e) => setRatio(+e.target.value)}
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                  <span className="toolbar-stats">
                    {book.chapters.length} bab ·{" "}
                    {wordCount.toLocaleString("id-ID")} kata
                  </span>
                </div>
                <div className="mobile-editor-tabs">
                  <button
                    className={mobileTab === "pdf" ? "active" : ""}
                    onClick={() => setMobileTab("pdf")}
                  >
                    <FileText size={16} />
                    PDF Asli
                  </button>
                  <button
                    className={mobileTab === "epub" ? "active" : ""}
                    onClick={() => setMobileTab("epub")}
                  >
                    <BookOpen size={16} />
                    Hasil EPUB
                  </button>
                </div>
                <div
                  className={`editor-layout ${structure ? "" : "no-structure"}`}
                >
                  {structure && (
                    <aside className="chapter-panel">
                      <div className="chapter-heading">
                        <ListTree size={16} />
                        <strong>Struktur buku</strong>
                      </div>
                      {book.chapters.map((c, i) => (
                        <button
                          key={c.id}
                          className={
                            c.blocks.some((b) => b.id === selected)
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            jump(c.blocks[0]?.id, c.blocks[0]?.sources[0]?.page)
                          }
                        >
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <div>
                            {c.title}
                            <small>
                              {c.blocks.filter((b) => !b.excluded).length} blok
                            </small>
                          </div>
                        </button>
                      ))}
                      {!book.chapters.length && (
                        <p>Belum ada teks. Periksa laporan OCR.</p>
                      )}
                      <div className="chapter-foot">
                        <Info size={14} />
                        <span>
                          Pilih blok untuk meninjau dan mengubah struktur.
                        </span>
                      </div>
                    </aside>
                  )}
                  <div
                    className="comparison"
                    style={
                      { "--pdf-ratio": ratio + "%" } as React.CSSProperties
                    }
                  >
                    <section
                      className={`source-pane ${mobileTab === "pdf" ? "mobile-active" : ""}`}
                    >
                      <Suspense
                        fallback={
                          <div className="empty-state">
                            <LoaderCircle className="spin" />
                            Memuat PDF…
                          </div>
                        }
                      >
                        <PdfPreview blob={pdf} page={page} onPage={setPage} />
                      </Suspense>
                    </section>
                    <div
                      className="panel-divider"
                      role="separator"
                      aria-label="Lebar panel sumber"
                      aria-valuenow={ratio}
                      aria-valuemin={30}
                      aria-valuemax={65}
                      aria-orientation="vertical"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft")
                          setRatio((r) => Math.max(30, r - 5));
                        if (e.key === "ArrowRight")
                          setRatio((r) => Math.min(65, r + 5));
                      }}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons === 1) {
                          const rect =
                            e.currentTarget.parentElement!.getBoundingClientRect();
                          setRatio(
                            Math.max(
                              30,
                              Math.min(
                                65,
                                ((e.clientX - rect.left) / rect.width) * 100,
                              ),
                            ),
                          );
                        }
                      }}
                    >
                      <GripVertical size={13} />
                    </div>
                    <section
                      className={`result-pane ${mobileTab === "epub" ? "mobile-active" : ""}`}
                    >
                      <div className="result-heading">
                        <BookOpen size={15} />
                        <span>Hasil EPUB</span>
                        <small>Klik paragraf untuk meninjau</small>
                      </div>
                      <div
                        className={`book-reading ${readTheme}`}
                        style={{ fontSize, lineHeight }}
                      >
                        <div
                          className="reading-inner"
                          style={{ maxWidth: readWidth }}
                        >
                          {blocks.length > 500 && (
                            <div className="chapter-reader-nav">
                              <label>
                                Bagian yang ditinjau
                                <select
                                  value={visibleChapters[0]?.id || ""}
                                  onChange={(e) => {
                                    setShownChapter(e.target.value);
                                    setSelected(undefined);
                                  }}
                                >
                                  {book.chapters.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <small>
                                Satu bagian ditampilkan agar buku panjang tetap
                                responsif.
                              </small>
                            </div>
                          )}
                          {visibleChapters.map((c) => (
                            <section key={c.id}>
                              {c.blocks.map(blockView)}
                            </section>
                          ))}
                          {!blocks.length && (
                            <div className="empty-state">
                              <FileText />
                              <h2>Belum ada teks yang dapat disusun</h2>
                              <p>
                                Periksa PDF asli dan laporan halaman. PDF
                                pindaian memerlukan OCR di aplikasi lain.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
                {selectedBlock && (
                  <div
                    className={`block-inspector ${editing ? "is-editing" : ""}`}
                  >
                    <div className="inspector-title">
                      <div>
                        <span className="eyebrow">BLOK TERPILIH</span>
                        <strong>
                          {kindLabels[selectedBlock.kind]}{" "}
                          <span>
                            · Hlm.{" "}
                            {[
                              ...new Set(
                                selectedBlock.sources.map((s) => s.page),
                              ),
                            ].join(", ")}
                          </span>
                        </strong>
                      </div>
                      <button
                        className="icon-btn"
                        aria-label="Tutup panel blok"
                        onClick={() => {
                          setSelected(undefined);
                          setEditing(false);
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="inspector-controls">
                      <label>
                        Jenis blok
                        <select
                          value={selectedBlock.kind}
                          onChange={(e) =>
                            update(
                              editBlock(book, selectedBlock.id, {
                                kind: e.target.value as BlockKind,
                                level: 1,
                              }),
                            )
                          }
                        >
                          {Object.entries(kindLabels).map(([k, v]) => (
                            <option
                              value={k}
                              key={k}
                              disabled={
                                k === "figure" && !selectedBlock.assetId
                              }
                            >
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedBlock.kind === "heading" && (
                        <label>
                          Tingkat
                          <select
                            value={selectedBlock.level || 1}
                            onChange={(e) =>
                              update(
                                editBlock(book, selectedBlock.id, {
                                  level: +e.target.value,
                                }),
                              )
                            }
                          >
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <option key={n} value={n}>
                                H{n}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setEditing(true);
                          setDraft(selectedBlock.text);
                          setTimeout(() => textArea.current?.focus(), 30);
                        }}
                      >
                        <Type size={15} />
                        Ubah teks
                      </button>
                      <button
                        className="btn secondary"
                        onClick={() =>
                          update(mergeBlock(book, selectedBlock.id))
                        }
                        disabled={book.chapters.some(
                          (c) => c.blocks.at(-1)?.id === selectedBlock.id,
                        )}
                      >
                        <Combine size={15} />
                        Gabung berikutnya
                      </button>
                      <button
                        className="btn secondary"
                        disabled={book.chapters.some(
                          (c) => c.blocks[0]?.id === selectedBlock.id,
                        )}
                        onClick={() =>
                          update(startChapter(book, selectedBlock.id))
                        }
                      >
                        <Plus size={15} />
                        Jadikan bab baru
                      </button>
                      <button
                        className="text-btn"
                        onClick={() =>
                          update(
                            editBlock(
                              book,
                              selectedBlock.id,
                              { excluded: !selectedBlock.excluded },
                              selectedBlock.excluded
                                ? "Pulihkan blok"
                                : "Kecualikan blok",
                            ),
                          )
                        }
                      >
                        {selectedBlock.excluded ? (
                          <RotateCcw size={15} />
                        ) : (
                          <Trash2 size={15} />
                        )}{" "}
                        {selectedBlock.excluded ? "Pulihkan" : "Kecualikan"}
                      </button>
                    </div>
                    {editing && (
                      <div className="text-edit">
                        <label htmlFor="block-text">
                          Teks hasil (sumber asli tetap disimpan)
                        </label>
                        <textarea
                          id="block-text"
                          ref={textArea}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={5}
                        />
                        <div>
                          <button
                            className="btn primary"
                            onClick={() => {
                              update(
                                editBlock(book, selectedBlock.id, {
                                  text: draft,
                                }),
                              );
                              setEditing(false);
                            }}
                          >
                            <Check size={16} />
                            Simpan teks
                          </button>
                          <button
                            className="btn secondary"
                            onClick={() => {
                              const at = textArea.current?.selectionStart || 0;
                              if (at > 0 && at < draft.length) {
                                const edited = editBlock(
                                  book,
                                  selectedBlock.id,
                                  { text: draft },
                                );
                                update(
                                  splitBlock(edited, selectedBlock.id, at),
                                );
                                setEditing(false);
                              } else
                                setError(
                                  "Letakkan kursor di tengah teks pada posisi paragraf akan dipisah.",
                                );
                            }}
                          >
                            <Scissors size={16} />
                            Pisah di kursor
                          </button>
                          <button
                            className="text-btn"
                            onClick={() => setEditing(false)}
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      className="text-btn original-toggle"
                      onClick={() => setShowSource(!showSource)}
                    >
                      Teks sumber sebelum pembersihan
                      <ChevronDown size={14} />
                    </button>
                    {showSource && (
                      <pre className="original-text">
                        {selectedBlock.originalText ||
                          "Blok hasil pemisahan manual. Sumber asli ada pada blok sebelumnya."}
                      </pre>
                    )}
                  </div>
                )}
              </>
            )}
            {stage === "export" && (
              <div className="export-layout">
                <section className="metadata-panel">
                  <button className="text-btn" onClick={() => setStage("edit")}>
                    <ArrowLeft size={15} />
                    Kembali ke editor
                  </button>
                  <h2>Sentuhan terakhir untuk buku Anda.</h2>
                  <p>Lengkapi identitas buku sebelum membuat EPUB.</p>
                  <label>
                    Judul buku
                    <input
                      value={book.title}
                      onChange={(e) =>
                        update({
                          ...book,
                          title: e.target.value,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                    />
                  </label>
                  <label>
                    Penulis
                    <input
                      placeholder="Nama penulis"
                      value={book.author}
                      onChange={(e) =>
                        update({ ...book, author: e.target.value })
                      }
                    />
                  </label>
                  <div className="metadata-row">
                    <label>
                      Bahasa
                      <select
                        value={book.language}
                        onChange={(e) =>
                          update({ ...book, language: e.target.value })
                        }
                      >
                        <option value="id">Indonesia</option>
                        <option value="en">English</option>
                        <option value="ms">Melayu</option>
                        <option value="ar">Arab</option>
                        <option value="ja">Jepang</option>
                        <option value="zh">Mandarin</option>
                        <option value="de">Jerman</option>
                        <option value="fr">Prancis</option>
                      </select>
                    </label>
                    <label>
                      Format
                      <input disabled value="EPUB 3 · Reflowable" />
                    </label>
                  </div>
                  <details className="advanced">
                    <summary>
                      Pengaturan lanjutan
                      <ChevronDown size={15} />
                    </summary>
                    <label>
                      Identifier
                      <input
                        value={book.identifier}
                        onChange={(e) =>
                          update({ ...book, identifier: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Sampul (PNG / JPEG, maks. 5 MB)
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (
                            f.size > 5 * 1024 * 1024 ||
                            !["image/png", "image/jpeg"].includes(f.type)
                          ) {
                            setError("Pilih sampul PNG/JPEG di bawah 5 MB.");
                            return;
                          }
                          const r = new FileReader();
                          r.onload = () =>
                            update({
                              ...book,
                              cover: {
                                data: (r.result as string).split(",")[1],
                                type: f.type,
                              },
                            });
                          r.readAsDataURL(f);
                        }}
                      />
                    </label>
                    {book.cover && (
                      <button
                        className="text-btn"
                        onClick={() => update({ ...book, cover: undefined })}
                      >
                        Gunakan sampul otomatis
                      </button>
                    )}
                    <p>Tanpa unggahan, sampul tipografi dibuat otomatis.</p>
                  </details>
                  <button
                    className="btn primary export-primary"
                    onClick={makeExport}
                    disabled={
                      exportBusy ||
                      !book.title.trim() ||
                      !book.identifier.trim() ||
                      !blocks.some((b) => !b.excluded)
                    }
                  >
                    {exportBusy ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <BookOpen size={18} />
                    )}
                    Buat EPUB
                    <ArrowRight size={17} />
                  </button>
                </section>
                <aside className="export-summary">
                  <div className="eyebrow">SIAP UNTUK BAB BERIKUTNYA</div>
                  <h2>Bacaan yang mengalir.</h2>
                  <div className="summary-numbers">
                    <div>
                      <strong>{book.chapters.length}</strong>
                      <span>bab</span>
                    </div>
                    <div>
                      <strong>
                        {blocks.filter((b) => !b.excluded).length}
                      </strong>
                      <span>blok disertakan</span>
                    </div>
                    <div>
                      <strong>{blocks.filter((b) => b.excluded).length}</strong>
                      <span>dikecualikan</span>
                    </div>
                  </div>
                  <div className="summary-checks">
                    <p>
                      <CheckCircle2 size={17} />
                      Teks dapat menyesuaikan ukuran layar
                    </p>
                    <p>
                      <CheckCircle2 size={17} />
                      Navigasi bab & judul terhubung
                    </p>
                    <p>
                      <CheckCircle2 size={17} />
                      Sumber dan koreksi tersimpan di proyek
                    </p>
                  </div>
                  {book.issues.length > 0 && (
                    <div className="notice warning">
                      <AlertTriangle size={18} />
                      <span>
                        {pendingIssues.length} catatan tinjauan masih tercatat.
                        Periksa pemetaan bab, gambar, dan halaman tanpa teks
                        pada laporan sebelum membagikan.
                      </span>
                    </div>
                  )}
                  <p className="muted">
                    Pemeriksaan EPUB di browser bersifat ringan. EPUBCheck penuh
                    disediakan pada workflow pengembangan/CI.
                  </p>
                  {exportOk && exportBytes && (
                    <div className="export-success" role="status">
                      <CheckCircle2 size={24} />
                      <h3>EPUB Anda siap.</h3>
                      <p>Struktur dan referensi lolos pemeriksaan browser.</p>
                      <button
                        className="btn primary"
                        onClick={() =>
                          download(
                            exportBytes as BlobPart,
                            safeName(book.title) + ".epub",
                            "application/epub+zip",
                          )
                        }
                      >
                        <Download size={17} />
                        Unduh EPUB
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => setReader(!reader)}
                      >
                        <BookOpen size={16} />
                        {reader ? "Tutup" : "Buka"} pembaca EPUB
                      </button>
                    </div>
                  )}
                  <details className="audit-details">
                    <summary>Catatan perubahan ({book.audit.length})</summary>
                    {book.audit.slice(-30).map((a, i) => (
                      <p key={i}>
                        {a.action} · {a.blockId}
                      </p>
                    ))}
                    {!book.audit.length && <p>Belum ada perubahan manual.</p>}
                  </details>
                </aside>
                {reader && exportBytes && (
                  <div className="reader-panel">
                    <h2>Pratinjau file EPUB</h2>
                    <Suspense fallback={<p>Memuat pembaca…</p>}>
                      <EpubReader bytes={exportBytes} />
                    </Suspense>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <nav className="bottom-nav" aria-label="Navigasi seluler">
        {[
          { id: "convert", icon: FileUp, label: "Konversi" },
          { id: "projects", icon: FolderOpen, label: "Proyek" },
          { id: "settings", icon: Settings, label: "Pengaturan" },
        ].map((n) => (
          <button
            key={n.id}
            className={route === n.id ? "active" : ""}
            onClick={() => navigate(n.id as Route)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <dialog
        ref={dialog}
        className="help-dialog"
        onCancel={() => setHelp(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setHelp(false);
        }}
      >
        <div className="dialog-head">
          <Brand small />
          <button
            className="icon-btn"
            aria-label="Tutup panduan"
            onClick={() => setHelp(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="eyebrow">PANDUAN SINGKAT</div>
        <h2>Dari PDF ke waktu membaca.</h2>
        <ol className="help-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Pilih PDF berbasis teks</strong>
              <p>
                Teks harus dapat dipilih. PDF pindaian memerlukan OCR di
                aplikasi lain terlebih dahulu.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Bandingkan, lalu rapikan</strong>
              <p>
                Klik blok untuk melihat halaman sumber. Ubah teks, pisah di
                kursor, gabung paragraf, atau susun bab. Undo/redo tersedia
                selama sesi.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Unduh EPUB & cadangkan proyek</strong>
              <p>
                Lengkapi metadata dan periksa catatan. Ekspor proyek .aksara
                menyertakan PDF asli dan koreksi agar dapat dipulihkan.
              </p>
            </div>
          </li>
        </ol>
        <div className="notice warning">
          <Info size={18} />
          <span>
            Dukungan utama: PDF teks satu kolom. Kolom kompleks perlu ditinjau.
            Gambar yang dapat ditempatkan diekstrak. Tabel, rumus, catatan kaki,
            dan gambar kompleks tetap perlu ditinjau.
          </span>
        </div>
        <button className="btn primary" onClick={() => setHelp(false)}>
          Saya mengerti
          <ArrowRight size={16} />
        </button>
      </dialog>
    </div>
  );
}
export default App;
