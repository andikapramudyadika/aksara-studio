import { unzipSync, strFromU8 } from "fflate";
export function validateEpub(bytes: Uint8Array): string[] {
  const errors: string[] = [];
  const files = unzipSync(bytes);
  if (strFromU8(files.mimetype || new Uint8Array()) !== "application/epub+zip")
    errors.push("Mimetype tidak valid.");
  if (
    bytes[8] !== 0 ||
    bytes[9] !== 0 ||
    strFromU8(bytes.slice(30, 38)) !== "mimetype"
  )
    errors.push("Mimetype harus menjadi entri pertama tanpa kompresi.");
  for (const [name, data] of Object.entries(files)) {
    if (!/\.(xhtml|opf|xml)$/.test(name)) continue;
    const text = strFromU8(data);
    if (typeof DOMParser !== "undefined") {
      const dom = new DOMParser().parseFromString(text, "application/xml");
      if (dom.querySelector("parsererror"))
        errors.push(`${name}: XML tidak valid.`);
    }
    for (const match of text.matchAll(
      /(?:href|src)="([^"#]+)(?:#([^"]+))?"/g,
    )) {
      if (/^[a-z]+:/i.test(match[1])) continue;
      const target = name.slice(0, name.lastIndexOf("/") + 1) + match[1];
      if (!files[target])
        errors.push(`${name}: aset ${match[1]} tidak ditemukan.`);
      else if (
        match[2] &&
        !strFromU8(files[target]).includes(`id="${match[2]}"`)
      )
        errors.push(`${name}: tujuan navigasi tidak ditemukan.`);
    }
  }
  return errors;
}
