export function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
export function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences remain usable for this session when browser storage is blocked. */
  }
}
