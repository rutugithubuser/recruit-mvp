// WhatsApp webhook (Twilio). Users text, send voice notes, or send their resume file.
// We answer Twilio immediately (it times out after 15s), then the agents work in the
// background and the reply is sent back on WhatsApp.
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getContextForUser, type AuthContext } from "@/lib/auth";
import { runAgents } from "@/lib/agents";
import { buildResume } from "@/lib/agents/resume";
import { logAgent } from "@/lib/agents/log";
import { generateText } from "@/lib/gemini";
import type { ChatTurn } from "@/lib/agents/types";
import { downloadMedia, formatForWhatsApp, linkCode, sendWhatsApp, validTwilioSignature, whatsappConfigured } from "@/lib/whatsapp";

export const maxDuration = 60;

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twiml = () => new Response(EMPTY_TWIML, { headers: { "Content-Type": "text/xml" } });

const RESUME_TYPES: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export async function POST(req: Request) {
  if (!whatsappConfigured()) return new Response("WhatsApp not configured", { status: 503 });

  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = String(v); });

  // Rebuild the public URL Twilio signed (works behind Vercel's proxy).
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const publicUrl = `${proto}://${host}${u.pathname}${u.search}`;
  if (!validTwilioSignature(publicUrl, params, req.headers.get("x-twilio-signature"))) {
    console.warn("[whatsapp] bad signature for", publicUrl);
    return new Response("Forbidden", { status: 403 });
  }

  after(() => handle(params).catch((e) => console.error("[whatsapp] handler crashed:", e)));
  return twiml();
}

async function handle(p: Record<string, string>) {
  const to = p.From; // "whatsapp:+91..."
  const phone = to.replace("whatsapp:", "");
  const text = (p.Body ?? "").trim();
  const mediaUrl = p.MediaUrl0;
  const mediaType = (p.MediaContentType0 ?? "").split(";")[0];

  try {
    // 1) Linking: "LINK 123456" (code shown on the dashboard).
    const link = text.match(/^link\s*(\d{6})$/i);
    if (link) return await linkNumber(to, phone, link[1]);

    // 2) Who is this?
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (!prof) {
      return sendWhatsApp(to, "👋 Welcome to HireSpeak! This number isn't linked yet.\n\nOpen your HireSpeak dashboard, find *Connect WhatsApp*, and send the code here like this:\nLINK 123456");
    }
    const ctx = await getContextForUser(prof.id);
    if (!ctx) return sendWhatsApp(to, "Your account could not be found. Please log in on the web app once.");

    // 3) Resume file (PDF / photo) from a candidate.
    if (mediaUrl && RESUME_TYPES[mediaType]) {
      if (ctx.profile.role !== "candidate") return sendWhatsApp(to, "Only candidates can send resume files. Just type or send a voice note instead.");
      const bytes = await downloadMedia(mediaUrl);
      const path = `${ctx.userId}/${Date.now()}-whatsapp.${RESUME_TYPES[mediaType]}`;
      await supabaseAdmin.storage.from("resumes").upload(path, bytes, { contentType: mediaType });
      const result = await buildResume({
        ctx, message: text || "Here is my resume", history: [], source: "whatsapp",
        file: { mimeType: mediaType, base64: bytes.toString("base64"), path, name: "resume sent on WhatsApp" },
      });
      await logAgent("resume", ctx.userId, { message: text, channel: "whatsapp", file: true }, { reply: result.reply });
      return sendWhatsApp(to, formatForWhatsApp(result));
    }

    // 4) Voice note -> transcribe -> agents.
    let message = text;
    let heard = "";
    if (mediaUrl && mediaType.startsWith("audio/")) {
      const bytes = await downloadMedia(mediaUrl);
      heard = (await generateText(
        [{ role: "user", parts: [{ inlineData: { mimeType: mediaType, data: bytes.toString("base64") } }, { text: "Transcribe this voice note exactly. It may be in English, Hindi or Marathi; if it is not English, translate it to English. Return only the text." }] }],
        "You are a speech-to-text agent for a recruiting app in India.",
        { fast: true }
      )).trim();
      await logAgent("transcription", ctx.userId, { channel: "whatsapp", mediaType }, { reply: heard });
      message = [text, heard].filter(Boolean).join(" ");
    } else if (mediaUrl) {
      return sendWhatsApp(to, "I can read text, voice notes, and resume files (PDF or photo). Please send one of those.");
    }

    if (!message) return sendWhatsApp(to, "Send me a text or a voice note with what you need.");

    // 5) Same agents as the web app.
    const result = await runAgents(ctx, message, await recentHistory(ctx), heard ? "voice" : "text");
    return sendWhatsApp(to, (heard ? `🎤 _I heard: "${heard}"_\n\n` : "") + formatForWhatsApp(result));
  } catch (e) {
    console.error("[whatsapp]", e);
    return sendWhatsApp(to, "⚠️ " + ((e as Error).message || "Something went wrong. Please try again."));
  }
}

async function linkNumber(to: string, phone: string, code: string) {
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, role, full_name");
  const match = (profiles ?? []).find((pr) => linkCode(pr.id) === code);
  if (!match) return sendWhatsApp(to, "That code didn't match. Check the code on your dashboard and send: LINK 123456");

  // One number = one account.
  await supabaseAdmin.from("profiles").update({ phone: null }).eq("phone", phone);
  await supabaseAdmin.from("profiles").update({ phone }).eq("id", match.id);
  if (match.role === "candidate") await supabaseAdmin.from("candidates").update({ phone }).eq("user_id", match.id);

  const tips: Record<string, string> = {
    candidate: '• Send a voice note about your experience to build your resume\n• Send your resume PDF or a photo of it\n• "Find me an accountant job in Andheri East for 30k"\n• "Show my offers" / "Accept the offer"',
    employer: '• "Post a job for an accountant, 2 years, Tally, 25-30k, Andheri"\n• "Find me a CA with 2 years in Mumbai"\n• "Send an offer to Priya Shah"\n• "Check score for Aadhaar 1234 5678 9012"',
    recruiter: '• "Find me a CA with 2 years in Mumbai"\n• "Show my pipeline"\n• "Check the score of Mehta Textiles"',
  };
  return sendWhatsApp(to, `✅ Linked! Hi ${match.full_name ?? ""}. You can now use HireSpeak right here by text or voice note.\n\nTry:\n${tips[match.role]}`);
}

/** Last few exchanges, so "accept the first one" works across WhatsApp messages. */
async function recentHistory(ctx: AuthContext): Promise<ChatTurn[]> {
  const { data } = await supabaseAdmin
    .from("agent_logs").select("agent, input, output").eq("user_id", ctx.userId)
    .not("agent", "in", "(intake,transcription)").order("created_at", { ascending: false }).limit(3);
  const turns: ChatTurn[] = [];
  for (const row of (data ?? []).reverse()) {
    const msg = (row.input as { message?: string } | null)?.message;
    const reply = (row.output as { reply?: string } | null)?.reply;
    if (msg) turns.push({ from: "user", text: msg });
    if (reply) turns.push({ from: "agent", text: reply.slice(0, 400) });
  }
  return turns;
}
