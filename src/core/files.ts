export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export const safeName = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .slice(0, 90) || "buku";
