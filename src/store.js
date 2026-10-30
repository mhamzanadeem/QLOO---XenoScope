import { resultSchema } from "../shared/schema.js";
const KEY = "xenoscope.explorations.v1";
const NAV_KEY = "xenoscope.navigation.v1";
const NAV_TTL = 24 * 60 * 60 * 1000;
function navigationEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(NAV_KEY) || "[]");
    return Array.isArray(entries) ? entries.filter(entry => entry.expires > Date.now() && resultSchema.safeParse(entry.result).success) : [];
  } catch { return []; }
}
export function cacheNavigationResult(result) {
  if (!resultSchema.safeParse(result).success) return false;
  let entries = [{ result, expires: Date.now() + NAV_TTL }, ...navigationEntries().filter(entry => entry.result.id !== result.id)].slice(0, 3);
  while (entries.length) {
    try { localStorage.setItem(NAV_KEY, JSON.stringify(entries)); return true; }
    catch { entries = entries.slice(0, -1); }
  }
  return false;
}
export function readNavigationResult(id) {
  return navigationEntries().find(entry => entry.result.id === id)?.result || readSaved().find(result => result.id === id) || null;
}
export function readSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (r) => r.source === "live" && resultSchema.safeParse(r).success,
          )
          .slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
export function saveResult(result) {
  const saved = readSaved();
  localStorage.setItem(
    KEY,
    JSON.stringify(
      [result, ...saved.filter((r) => r.id !== result.id)].slice(0, 30),
    ),
  );
}
export function deleteSaved(id) {
  localStorage.setItem(
    KEY,
    JSON.stringify(readSaved().filter((r) => r.id !== id)),
  );
}
export async function api(path, payload, signal) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : {},
      body: payload ? JSON.stringify(payload) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name !== "AbortError")
      notifyUnavailable(
        "The server could not be reached. Check your connection and retry.",
      );
    throw error;
  }
  let data;
  try {
    data = await response.json();
  } catch {
    notifyUnavailable(
      "The server returned an unreadable response. Please retry the connection.",
    );
    throw new Error(
      "The server returned an unreadable response. Please retry.",
    );
  }
  if (!response.ok) {
    if ((response.status >= 500 && data.error?.code !== "QLOO_TIMEOUT") || response.status === 429)
      notifyUnavailable(
        data.error?.message || "Qloo is currently unavailable.",
      );
    throw new Error(data.error?.message || "Request failed. Please retry.");
  }
  return data;
}
export function notifyUnavailable(message) {
  window.dispatchEvent(
    new CustomEvent("qloo-unavailable", { detail: { message } }),
  );
}
export function download(content, extension) {
  const url = URL.createObjectURL(
    new Blob([content], {
      type: extension === "csv" ? "text/csv;charset=utf-8" : "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `xenoscope-report.${extension}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
