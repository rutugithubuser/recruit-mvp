import type { ChatTurn } from "./types";

export function historyText(history: ChatTurn[]): string {
  if (!history.length) return "";
  return "Recent conversation:\n" + history.map((t) => `${t.from === "user" ? "User" : "App"}: ${t.text}`).join("\n") + "\n\n";
}

export function inr(n?: number | null): string | null {
  return n ? "₹" + Math.round(n).toLocaleString("en-IN") : null;
}

export function salaryRange(min?: number | null, max?: number | null): string | null {
  if (min && max && min !== max) return `${inr(min)} – ${inr(max)}/month`;
  if (min || max) return `${inr(min || max)}/month`;
  return null;
}

/** Keep only keys with real values (drops null, "", 0, empty arrays). */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== 0 && !(Array.isArray(v) && v.length === 0))
  ) as Partial<T>;
}
