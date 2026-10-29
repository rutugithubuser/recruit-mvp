// RESUME AGENT: builds a resume from voice/text, or reads an uploaded resume file,
// then fills the candidate's profile automatically (no forms).
import { supabaseAdmin } from "../supabase/admin";
import { generateJSON } from "../gemini";
import { hashAadhaar, normalizeAadhaar } from "../aadhaar";
import type { AuthContext } from "../auth";
import type { AgentHandler, AgentResult, Card, ChatTurn } from "./types";
import { compact, historyText, inr } from "./util";

type ResumeOut = {
  full_name?: string;
  phone?: string;
  email?: string;
  location?: string;
  current_title?: string;
  experience_years?: number;
  skills?: string[];
  industries?: string[];
  expected_salary?: number;
  aadhaar?: string;
  resume_text: string;
  missing_info?: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    full_name: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    location: { type: "string", description: "City and area, e.g. 'Andheri East, Mumbai'" },
    current_title: { type: "string", description: "Current or most recent job title" },
    experience_years: { type: "number", description: "Total years of work experience" },
    skills: { type: "array", items: { type: "string" } },
    industries: { type: "array", items: { type: "string" }, description: "Industries worked in, e.g. manufacturing, retail" },
    expected_salary: { type: "number", description: "Expected monthly salary in INR" },
    aadhaar: { type: "string", description: "12-digit Aadhaar number only if the user explicitly gave it" },
    resume_text: { type: "string", description: "The complete, formatted resume" },
    missing_info: { type: "string", description: "One short sentence listing the most useful details still missing, or empty" },
  },
  required: ["resume_text"],
};

const SYSTEM = `You are the Resume Agent of a recruiting app for Indian SMEs.
Create a clean, professional resume in simple English with sections, each on its own line:
NAME / contact line / PROFESSIONAL SUMMARY / WORK EXPERIENCE / SKILLS / EDUCATION.
Use "•" bullets. No markdown symbols like # or **.
Use ONLY facts given by the candidate or found in their file. Never invent employers, degrees, dates or numbers.
If a section has no information, leave it out. Salaries are monthly INR.`;

export function resumeCard(candidate: Record<string, unknown>, resumeText: string): Card {
  return {
    type: "resume",
    id: candidate.id as string,
    title: (candidate.full_name as string) || "Your resume",
    subtitle: [candidate.current_title, candidate.location].filter(Boolean).join(" · "),
    meta: {
      experience: candidate.experience_years ? `${candidate.experience_years} years` : null,
      expected_salary: inr(candidate.expected_salary as number),
      skills: ((candidate.skills as string[]) ?? []).slice(0, 6).join(", "),
      aadhaar: candidate.aadhaar_last4 ? `XXXX XXXX ${candidate.aadhaar_last4}` : null,
      trust_score: candidate.score as number,
    },
    body: resumeText,
    actions: [{ label: "Find matching jobs", prompt: "Find jobs that match my resume" }],
  };
}

export async function buildResume(opts: {
  ctx: AuthContext;
  message: string;
  history: ChatTurn[];
  source: "voice" | "text" | "upload" | "whatsapp";
  file?: { mimeType: string; base64: string; path: string; name: string };
}): Promise<AgentResult> {
  const { ctx, message, history, source, file } = opts;

  const { data: candidate } = await supabaseAdmin
    .from("candidates").select("*").eq("user_id", ctx.userId).maybeSingle();
  if (!candidate) throw new Error("Candidate profile not found. Please sign up as a candidate.");

  const { data: lastResume } = await supabaseAdmin
    .from("resumes").select("content").eq("candidate_id", candidate.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const known = compact({
    full_name: candidate.full_name, email: candidate.email, phone: candidate.phone, location: candidate.location,
    current_title: candidate.current_title, experience_years: candidate.experience_years, skills: candidate.skills,
    industries: candidate.industries, expected_salary: candidate.expected_salary,
  });

  const textPrompt = `What we already know (keep unless the candidate changes it): ${JSON.stringify(known)}
${lastResume?.content && !file ? `\nPrevious resume (update it, don't lose details):\n${lastResume.content}\n` : ""}
${historyText(history)}${file ? `The candidate uploaded their resume file "${file.name}". Read it fully, extract the details and rewrite it cleanly.` : ""}
Candidate's message: ${message}`;

  const contents = file
    ? [{ role: "user", parts: [{ inlineData: { mimeType: file.mimeType, data: file.base64 } }, { text: textPrompt }] }]
    : textPrompt;

  const out = await generateJSON<ResumeOut>(contents, SCHEMA, SYSTEM);

  // Update the candidate profile automatically.
  const updates: Record<string, unknown> = compact({
    full_name: out.full_name,
    phone: out.phone,
    location: out.location,
    current_title: out.current_title,
    experience_years: out.experience_years,
    skills: out.skills,
    industries: out.industries,
    expected_salary: out.expected_salary,
  });

  const aadhaar = normalizeAadhaar(out.aadhaar);
  if (aadhaar) {
    const hash = hashAadhaar(aadhaar);
    const { data: other } = await supabaseAdmin
      .from("candidates").select("id").eq("aadhaar_hash", hash).neq("id", candidate.id).maybeSingle();
    if (other) throw new Error("This Aadhaar number is already linked to another candidate.");
    updates.aadhaar_hash = hash;
    updates.aadhaar_last4 = aadhaar.slice(-4);
  }

  const { data: updated, error } = await supabaseAdmin
    .from("candidates").update(updates).eq("id", candidate.id).select().single();
  if (error) throw new Error(error.message);

  // Save the resume to the data lake. Never store the raw Aadhaar in parsed data.
  const { aadhaar: _omit, ...parsed } = out;
  void _omit;
  await supabaseAdmin.from("resumes").insert({
    candidate_id: candidate.id,
    source,
    file_path: file?.path ?? null,
    content: out.resume_text,
    parsed,
  });

  const reply =
    (file ? `I've read "${file.name}" and updated your profile and resume.` : lastResume ? "I've updated your resume." : "Your resume is ready and your profile is filled in automatically.") +
    (out.missing_info ? `\nTo make it stronger: ${out.missing_info}` : "");

  return { agent: "resume", intent: "build_resume", reply, cards: [resumeCard(updated, out.resume_text)], data: { candidate_id: candidate.id } };
}

export const resumeAgent: AgentHandler = async ({ ctx, message, history, via }) =>
  buildResume({ ctx, message, history, source: via });

// ---------- VIEW RESUME VERSIONS ----------
export const myResumesAgent: AgentHandler = async ({ ctx, intent }) => {
  const { data: candidate } = await supabaseAdmin.from("candidates").select("*").eq("user_id", ctx.userId).maybeSingle();
  if (!candidate) throw new Error("Candidate profile not found.");
  const { data: versions } = await supabaseAdmin
    .from("resumes").select("id, source, file_path, content, created_at").eq("candidate_id", candidate.id)
    .order("created_at", { ascending: false });
  if (!versions?.length) {
    return { agent: "resume", intent: intent.intent, reply: "You don't have a resume yet. Tell me about your experience, or upload one with 📎." };
  }
  const SOURCE: Record<string, string> = { voice: "🎤 from voice", text: "⌨️ from text", upload: "📎 from uploaded file", whatsapp: "💬 from WhatsApp" };
  const cards: Card[] = versions.map((v, i) => {
    const card: Card = i === 0 ? resumeCard(candidate, v.content) : { type: "resume", title: "", body: v.content };
    card.id = v.id;
    card.title = `Version ${versions.length - i}${i === 0 ? " (current)" : ""}`;
    card.subtitle = `${SOURCE[v.source] ?? v.source} · ${new Date(v.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    return card;
  });
  return {
    agent: "resume", intent: intent.intent,
    reply: `You have ${versions.length} resume version${versions.length > 1 ? "s" : ""}. The newest one is used when you apply.`,
    cards,
  };
};
