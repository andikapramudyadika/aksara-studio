export const normalizeTitle = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^(?:(?:bab|chapter|bagian)\s+)?(?:\d+|[ivxlcdm]+)[.)\s:-]+/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export const frontMatter =
  /^(?:prakata|kata pengantar|pendahuluan|prolog|epilog|pengantar|ucapan terima kasih|terima kasih|referensi|daftar pustaka|glosarium|indeks|introduction|preface|acknowledg(?:e)?ments|references)$/i;
export const chapterLabel = /^(?:bab|chapter|bagian)\s+(?:\d+|[ivxlcdm]+)\b/i;
export interface ListMarker {
  marker: string;
  body: string;
  ordered: boolean;
  ordinal?: number;
  style?: "1" | "a" | "A";
}
export function listMarker(text: string): ListMarker | undefined {
  const bullet = text.match(/^([•▪●–-])\s+(.+)$/s);
  if (bullet) return { marker: bullet[1], body: bullet[2], ordered: false };
  const number = text.match(/^(\d{1,2})[.)]\s+(.+)$/s);
  if (number)
    return {
      marker: text.slice(0, text.indexOf(number[2])).trim(),
      body: number[2],
      ordered: true,
      ordinal: +number[1],
      style: "1",
    };
  const alpha = text.match(/^([a-zA-Z])[.)]\s+(.+)$/s);
  if (alpha)
    return {
      marker: text.slice(0, text.indexOf(alpha[2])).trim(),
      body: alpha[2],
      ordered: true,
      ordinal: alpha[1].toLowerCase().charCodeAt(0) - 96,
      style: alpha[1] === alpha[1].toUpperCase() ? "A" : "a",
    };
}
export const isGenericBookmark = (s: string) =>
  /^(?:screenshot|page|halaman|scan|img)[\s_(\d.-]/i.test(s) ||
  /\.pdf\s*\(p\.\d+\)$/i.test(s);
