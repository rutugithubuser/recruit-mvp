// COMPANY PROFILE AGENT (employers) and FIRM PROFILE AGENT (recruitment firms).
// Turns a spoken/typed description into a polished profile and saves it.
import { supabaseAdmin } from "../supabase/admin";
import { generateJSON } from "../gemini";
import type { AgentHandler, Card } from "./types";
import { historyText } from "./util";

type CompanyOut = {
  name: string;
  industry?: string;
  location?: string;
  size?: string;
  description: string;
  question?: string;
};

export function companyCard(c: Record<string, unknown>): Card {
  return {
    type: "company",
    id: c.id as string,
    title: c.name as string,
    subtitle: [c.industry, c.location].filter(Boolean).join(" · "),
    meta: { size: c.size as string, trust_score: c.score as number },
    body: c.description as string,
    actions: [
      { label: "Post a job", prompt: "Help me post a new job" },
      { label: "Find candidates", prompt: "Find me candidates" },
    ],
  };
}

export const companyProfileAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const { data: existing } = await supabaseAdmin
    .from("companies").select("*").eq("owner_id", ctx.userId).maybeSingle();

  const schema = {
    type: "object",
    properties: {
      name: { type: "string", description: "Company name. Empty string if the user has not said it." },
      industry: { type: "string" },
      location: { type: "string" },
      size: { type: "string", description: "e.g. '50 employees'" },
      description: { type: "string", description: "Polished 80-120 word company description written for job seekers" },
      question: { type: "string", description: "If the name is unknown, one short question asking for it" },
    },
    required: ["name", "description"],
  };

  const system = `You are the Company Profile Agent of a recruiting app for Indian SMEs.
Write a professional, friendly company description in simple English for job seekers.
Use only facts the user gave. Do not invent awards, revenue, clients or years.`;

  const prompt = `${existing ? `Current profile (keep these facts unless the user changes them): ${JSON.stringify({
    name: existing.name, industry: existing.industry, location: existing.location, size: existing.size, description: existing.description,
  })}\n\n` : ""}${historyText(history)}User's new message: ${message}`;

  const out = await generateJSON<CompanyOut>(prompt, schema, system);

  if (!out.name?.trim()) {
    return { agent: "company_profile", intent: intent.intent, reply: out.question || "What is your company's name, and what does it do?" };
  }

  const row = {
    owner_id: ctx.userId,
    name: out.name.trim(),
    industry: out.industry || existing?.industry || null,
    location: out.location || existing?.location || null,
    size: out.size || existing?.size || null,
    description: out.description,
  };

  const { data, error } = existing
    ? await supabaseAdmin.from("companies").update(row).eq("id", existing.id).select().single()
    : await supabaseAdmin.from("companies").insert(row).select().single();
  if (error) throw new Error(error.message);

  return {
    agent: "company_profile",
    intent: intent.intent,
    reply: existing
      ? "Done. I've updated your company profile."
      : "Your company profile is ready. It will appear on every job you post. You start with a trust score of 100.",
    cards: [companyCard(data)],
    data,
  };
};

export const firmProfileAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const { data: existing } = await supabaseAdmin
    .from("recruitment_firms").select("*").eq("owner_id", ctx.userId).maybeSingle();

  const schema = {
    type: "object",
    properties: {
      name: { type: "string", description: "Firm name. Empty string if not said." },
      description: { type: "string", description: "Polished 60-100 word description of the recruitment firm" },
      question: { type: "string" },
    },
    required: ["name", "description"],
  };

  const out = await generateJSON<{ name: string; description: string; question?: string }>(
    `${existing ? `Current profile: ${JSON.stringify({ name: existing.name, description: existing.description })}\n\n` : ""}${historyText(history)}User's new message: ${message}`,
    schema,
    "You are the Firm Profile Agent of a recruiting app for Indian SMEs. Write a professional description in simple English using only facts the user gave."
  );

  if (!out.name?.trim()) {
    return { agent: "firm_profile", intent: intent.intent, reply: out.question || "What is your recruitment firm called, and what roles do you place?" };
  }

  const row = { owner_id: ctx.userId, name: out.name.trim(), description: out.description };
  const { data, error } = existing
    ? await supabaseAdmin.from("recruitment_firms").update(row).eq("id", existing.id).select().single()
    : await supabaseAdmin.from("recruitment_firms").insert(row).select().single();
  if (error) throw new Error(error.message);

  return {
    agent: "firm_profile",
    intent: intent.intent,
    reply: existing ? "Updated your firm profile." : "Your recruitment firm profile is ready.",
    cards: [{
      type: "firm",
      id: data.id,
      title: data.name,
      body: data.description,
      actions: [
        { label: "Find candidates", prompt: "Find me candidates" },
        { label: "Show pipeline", prompt: "Show my pipeline" },
      ],
    }],
    data,
  };
};
