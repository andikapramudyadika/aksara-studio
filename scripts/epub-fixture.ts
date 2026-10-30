import { writeFile, mkdir } from "node:fs/promises";
import { exportEpub } from "../src/core/epub";
import { validateEpub } from "../src/core/validation";
import { demoBook } from "../src/core/demo";
const book = demoBook();
book.chapters[0].blocks[1].text += ' Karakter: < > & " ‘ ’ é —.';
book.chapters[0].blocks[2].kind = "heading";
book.chapters[0].blocks[2].level = 2;
book.pages = [
  {
    number: 1,
    width: 600,
    height: 800,
    rotation: 0,
    items: [],
    imageCount: 1,
    images: [
      {
        id: "fixture-art",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
        type: "image/png",
        page: 1,
        x: 60,
        y: 200,
        width: 200,
        height: 150,
      },
    ],
  },
];
book.chapters[0].blocks.splice(3, 0, {
  id: "fixture-figure",
  kind: "figure",
  assetId: "fixture-art",
  text: "Ilustrasi sintetis & caption",
  originalText: "",
  order: 3,
  sources: [{ page: 1, x: 60, y: 200, width: 200, height: 150 }],
  flags: [],
});
book.chapters[1].blocks[1].kind = "list";
book.chapters[1].blocks[1].text = "3. Butir bernomor tiga";
const bytes = exportEpub(book);
const errors = validateEpub(bytes);
if (errors.length) throw new Error(errors.join("\n"));
await mkdir(".tmp", { recursive: true });
await writeFile(".tmp/fixture.epub", bytes);
console.log("Synthetic EPUB fixture: .tmp/fixture.epub");
