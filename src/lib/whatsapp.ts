// WhatsApp channel (Twilio). Same AI agents as the web app, reached by text, voice note or file.
import { createHmac } from "crypto";
import type { AgentResult } from "./agents/types";

const SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
// Twilio sandbox number by default.
const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

export const whatsappConfigured = () => Boolean(SID && TOKEN);

/** 6-digit code a logged-in user sends on WhatsApp ("LINK 123456") to connect their number. */
export function linkCode(userId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "link";
  const n = parseInt(createHmac("sha256", secret).update(`wa-link:${userId}`).digest("hex").slice(0, 8), 16);
  return String(n % 1_000_000).padStart(6, "0");
}

/** Check that the request really came from Twilio (X-Twilio-Signature). */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  if (process.env.TWILIO_SKIP_SIGNATURE === "true") return true;
  if (!signature || !TOKEN) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", TOKEN).update(data).digest("base64");
  return expected === signature;
}

/** Send a WhatsApp message (split into 1500-char parts; WhatsApp's limit is 1600). */
export async function sendWhatsApp(to: string, text: string) {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > 1500) {
    const cut = rest.lastIndexOf("\n", 1500) > 500 ? rest.lastIndexOf("\n", 1500) : 1500;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);

  for (const body of parts.slice(0, 4)) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: FROM, To: to, Body: body }),
    });
    if (!res.ok) console.error("[whatsapp] send failed:", res.status, (await res.text()).slice(0, 200));
  }
}

/** Download a media file the user sent (voice note, PDF, photo). */
export async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64") },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not download the file (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

/** Turn an agent result (reply + cards) into a WhatsApp-friendly text message. */
export function formatForWhatsApp(r: AgentResult): string {
  const out: string[] = [r.reply];
  const cards = r.cards ?? [];
  cards.slice(0, 5).forEach((c, i) => {
    const lines = [`*${cards.length > 1 ? `${i + 1}. ` : ""}${c.title}*`];
    if (c.subtitle) lines.push(`_${c.subtitle}_`);
    for (const [k, v] of Object.entries(c.meta ?? {})) {
      if (v !== null && v !== undefined && v !== "") lines.push(`• ${k.replace(/_/g, " ")}: ${v}`);
    }
    if (c.body) {
      const long = c.type === "offer" || c.type === "acceptance" || c.type === "resume" || cards.length === 1;
      const limit = long ? 1200 : 200;
      lines.push(c.body.length > limit ? c.body.slice(0, limit) + "…" : c.body);
    }
    if (c.actions?.length) lines.push(`↪ Reply: "${c.actions[0].prompt}"`);
    out.push(lines.join("\n"));
  });
  if (cards.length > 5) out.push(`…and ${cards.length - 5} more on your dashboard.`);
  return out.join("\n\n");
}
