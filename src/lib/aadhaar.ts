// Aadhaar is never stored raw. We keep a salted hash (for lookups) + last 4 digits (for display).
import { createHash } from "crypto";

export function normalizeAadhaar(raw?: string | null): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length === 12 ? digits : null;
}

export function hashAadhaar(digits: string): string {
  const salt = process.env.AADHAAR_SALT || "dev-salt-change-me";
  return createHash("sha256").update(`${salt}:${digits}`).digest("hex");
}

/** Replace any 12-digit Aadhaar-like number in text with a masked version. */
export function maskAadhaarInText(text: string): string {
  return text.replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, "XXXX XXXX $3");
}
