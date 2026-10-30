import path from "node:path";
import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import fs from "node:fs/promises";
const artifactRoot =
  process.env.AKSARA_ARTIFACT_DIR || path.resolve("test-results/artifacts");
test.beforeAll(async () => {
  await fs.mkdir(artifactRoot, { recursive: true });
});
async function makePdf(pages = 2, empty = false) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman),
    bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  for (let i = 0; i < pages; i++) {
    const p = pdf.addPage([600, 800]);
    if (!empty) {
      p.drawText("BAB " + (i + 1), { x: 60, y: 700, size: 24, font: bold });
      p.drawText("This paragraph wraps across the next line and should stay", {
        x: 60,
        y: 650,
        size: 13,
        font,
      });
      p.drawText("together as one paragraph when reconstructed.", {
        x: 60,
        y: 632,
        size: 13,
        font,
      });
      p.drawText("A separate paragraph remains separate.", {
        x: 60,
        y: 580,
        size: 13,
        font,
      });
      p.drawText("Book fixture", { x: 60, y: 30, size: 10, font });
    }
  }
  return Buffer.from(await pdf.save());
}
async function noOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("desktop, tablet, mobile and dark visual layouts", async ({ page }) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /Dari halaman statis/ }),
  ).toBeVisible();
  for (const [name, w, h] of [
    ["desktop", 1440, 1100],
    ["tablet", 820, 1180],
    ["mobile", 375, 812],
    ["small", 320, 740],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await noOverflow(page);
    await page.screenshot({
      path: `${artifactRoot}/home-${name}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Ubah tema" }).click();
  await page.screenshot({
    path: `${artifactRoot}/home-dark.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Navigasi seluler" })
    .getByRole("button", { name: "Pengaturan" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pengaturan", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `${artifactRoot}/settings-mobile.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Buka panduan" })
    .count()
    .then(() => {});
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Buka panduan" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("real PDF upload, edit, undo redo, source, EPUB export and reader", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByLabel("Pilih file PDF").setInputFiles({
    name: "Fixture dengan judul yang sangat panjang untuk pengujian responsif.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(),
  });
  await expect(
    page.getByRole("button", { name: "Lanjut ke ekspor" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".book-block.paragraph").first()).toContainText(
    "together as one paragraph",
  );
  await expect(page.locator(".book-block.paragraph")).toHaveCount(6);
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator(".book-block.paragraph").first().click();
  await page.getByRole("button", { name: "Ubah teks", exact: true }).click();
  await page
    .getByLabel("Teks hasil (sumber asli tetap disimpan)")
    .fill("Edited text <safe> & intact.");
  await page.getByRole("button", { name: "Simpan teks" }).click();
  await expect(page.locator(".book-block.selected")).toContainText(
    "Edited text <safe> & intact.",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".book-block.selected")).not.toContainText(
    "Edited text",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".book-block.selected")).toContainText(
    "Edited text",
  );
  await page.screenshot({
    path: `${artifactRoot}/editor-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow(page);
  await page.getByRole("button", { name: "PDF Asli", exact: true }).click();
  await expect(page.locator(".source-pane")).toBeVisible();
  await page.getByRole("button", { name: "Hasil EPUB", exact: true }).click();
  await expect(page.locator(".book-block.selected")).toContainText(
    "Edited text",
  );
  await page.screenshot({
    path: `${artifactRoot}/editor-mobile.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lanjut ke ekspor" }).click();
  await page.getByRole("button", { name: "Buat EPUB", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "EPUB Anda siap." }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh EPUB" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const zip = unzipSync(new Uint8Array(await fs.readFile(path!)));
  expect(strFromU8(zip["EPUB/chapter-1.xhtml"])).toContain(
    "Edited text &lt;safe&gt; &amp; intact.",
  );
  await fs.copyFile(path!, `${artifactRoot}/fixture.epub`);
  await page.getByRole("button", { name: "Buka pembaca EPUB" }).click();
  await expect(page.locator(".epub-reader iframe")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await expect(
    page.frameLocator(".epub-reader iframe").locator("body"),
  ).toContainText("Edited text", { timeout: 10000 });
  await noOverflow(page);
  await page.screenshot({
    path: `${artifactRoot}/export-mobile.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.reload();
  await page
    .getByRole("navigation", { name: "Navigasi seluler" })
    .getByRole("button", { name: "Proyek", exact: true })
    .click();
  await expect(page.locator(".project-main")).toHaveCount(1);
  await page.locator(".project-main").click();
  await expect(page.locator(".book-block")).toContainText(["BAB 1"]);
  await expect(page.locator(".book-reading")).toContainText("Edited text");
});
test("demo project backup and reimport, split/merge and empty PDF warning", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Belum ada PDF/ }).click();
  await expect(
    page.getByRole("button", { name: "Lanjut ke ekspor" }),
  ).toBeVisible();
  await page.locator(".book-block.paragraph").first().click();
  await page.getByRole("button", { name: "Ubah teks", exact: true }).click();
  const area = page.getByLabel("Teks hasil (sumber asli tetap disimpan)");
  await area.evaluate((e: HTMLTextAreaElement) => {
    e.focus();
    e.setSelectionRange(30, 30);
  });
  await page.getByRole("button", { name: "Pisah di kursor" }).click();
  await expect(page.locator(".book-block")).toHaveCount(12);
  await page.getByRole("button", { name: "Gabung berikutnya" }).click();
  await expect(page.locator(".book-block")).toHaveCount(11);
  const p = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Ekspor proyek", exact: true })
    .click();
  const d = await p;
  const file = await d.path();
  await page
    .getByRole("button", { name: "Konversi baru", exact: true })
    .click();
  await page.getByLabel("Impor proyek Aksara").setInputFiles(file!);
  await expect(page.locator(".book-block")).toHaveCount(11);
  await page
    .getByRole("button", { name: "Konversi baru", exact: true })
    .click();
  await page.getByLabel("Pilih file PDF").setInputFiles({
    name: "pindaian.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(1, true),
  });
  await expect(
    page.getByText("Belum ada teks yang dapat disusun"),
  ).toBeVisible();
  await page.getByRole("button", { name: /catatan tinjauan/ }).click();
  await expect(
    page.getByRole("button", { name: /Halaman tanpa teks/ }),
  ).toBeVisible();
});
test("cancel and resume extraction from checkpoint", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Pilih file PDF").setInputFiles({
    name: "panjang.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(40),
  });
  await page.getByRole("button", { name: "Batalkan analisis" }).click();
  await expect(
    page.getByRole("button", { name: "Lanjutkan analisis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan analisis" }).click();
  await expect(
    page.getByRole("button", { name: "Lanjut ke ekspor" }),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".book-block.heading")).toHaveCount(40);
});

test("keyboard, reduced motion and storage failure feedback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await page.getByRole("button", { name: "Buka panduan" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Buka panduan" }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Belum ada PDF/ }).click();
  await page.locator(".book-block.paragraph").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".block-inspector")).toBeVisible();
  await page.locator(".panel-divider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".panel-divider")).toHaveAttribute(
    "aria-valuenow",
    "55",
  );
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Penyimpanan browser penuh",
  );
  await page.getByLabel("Pilih file PDF").setInputFiles({
    name: "rusak.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("This is not a PDF"),
  });
  await expect(
    page.getByRole("button", { name: "Lanjutkan analisis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Coba dari awal" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "PDF belum dapat diproses",
  );
});

test("conversion retains images, joins drop caps and chapter titles, and restores running matter", async ({
  page,
}) => {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.TimesRoman),
    bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const toc = pdf.addPage([600, 800]);
  toc.drawText("DAFTAR ISI", { x: 60, y: 730, size: 24, font: bold });
  for (const [i, text] of [
    "PRAKATA .......................... i",
    "1. RUANG DAN WAKTU BERSAMA ............ 2",
    "Catatan .................................. 4",
  ].entries())
    toc.drawText(text, { x: 60, y: 680 - i * 25, size: 12, font });
  const opening = pdf.addPage([600, 800]);
  opening.drawText("1.", { x: 265, y: 700, size: 32, font: bold });
  opening.drawText("Ruang dan Waktu", { x: 150, y: 650, size: 32, font: bold });
  opening.drawText("Bersama", { x: 220, y: 610, size: 32, font: bold });
  const image = await pdf.embedPng(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  for (let i = 0; i < 3; i++) {
    const p = pdf.addPage([600, 800]);
    p.drawText("Nama Buku Sintetis", { x: 60, y: 775, size: 10, font });
    p.drawText(`${i + 1} - Penulis`, { x: 60, y: 30, size: 10, font });
    if (i === 0) {
      p.drawText("P", { x: 60, y: 700, size: 36, font: bold });
      p.drawText("ria membaca buku panjang dengan tenang", {
        x: 85,
        y: 700,
        size: 12,
        font,
      });
      p.drawText("dan meneruskan kalimat pada baris selanjutnya.", {
        x: 60,
        y: 683,
        size: 12,
        font,
      });
    } else
      p.drawText("Ini paragraf lain yang tetap terpisah dengan benar.", {
        x: 60,
        y: 700,
        size: 12,
        font,
      });
    if (i === 1) {
      p.drawImage(image, { x: 100, y: 350, width: 200, height: 120 });
      p.drawText("Keterangan ilustrasi sintetis.", {
        x: 100,
        y: 330,
        size: 12,
        font,
      });
    }
  }
  await page.goto("./");
  await page.getByLabel("Pilih file PDF").setInputFiles({
    name: "synthetic-structure.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page
    .getByRole("button", { name: "Lanjut ke ekspor" })
    .waitFor({ timeout: 30000 });
  await expect(
    page
      .locator(".book-block.heading")
      .filter({ hasText: "1. Ruang dan Waktu Bersama" }),
  ).toHaveCount(1);
  await expect(page.locator(".book-reading")).toContainText(
    "Pria membaca buku panjang dengan tenang dan meneruskan",
  );
  await expect(page.locator(".book-block.figure img")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator(".book-block.figure img")
        .evaluate((e: HTMLImageElement) => e.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByLabel("Opsi bacaan").click();
  await page.getByLabel("Tampilkan blok dikecualikan").check();
  await page.getByLabel("Opsi bacaan").click();
  const excluded = await page.locator(".book-block.excluded").count();
  expect(excluded).toBeGreaterThanOrEqual(6);
  await page.getByRole("button", { name: /catatan tinjauan/ }).click();
  await expect(page.locator(".quality-grid")).toContainText(
    "item sumber belum terwakili",
  );
  await page
    .getByRole("button", { name: "Pulihkan semua header/footer", exact: true })
    .click();
  await expect(page.locator(".book-block.excluded")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".book-block.excluded")).toHaveCount(excluded);
  await page.getByRole("button", { name: "Tutup laporan" }).click();
  await page.getByRole("button", { name: "Lanjut ke ekspor" }).click();
  await page.getByRole("button", { name: "Buat EPUB", exact: true }).click();
  await page.getByRole("heading", { name: "EPUB Anda siap." }).waitFor();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh EPUB" }).click();
  const d = await promise,
    z = unzipSync(new Uint8Array(await fs.readFile((await d.path())!)));
  expect(
    Object.keys(z).filter((n) => n.startsWith("EPUB/assets/")),
  ).toHaveLength(1);
  await fs.copyFile((await d.path())!, `${artifactRoot}/structure.epub`);
  expect(strFromU8(z["EPUB/nav.xhtml"])).not.toContain(
    "........................",
  );
});
