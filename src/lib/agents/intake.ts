// INTAKE AGENT: understands what the user said and decides which agent handles it.
import { generateJSON } from "../gemini";
import type { Role } from "../auth";
import type { ChatTurn, Intent } from "./types";

export const INTENTS: Record<Role, Record<string, string>> = {
  candidate: {
    build_resume: "Create or update their resume from what they describe",
    find_jobs: "Search for jobs (role, area, salary, experience)",
    apply_job: "Apply to a specific job",
    my_applications: "See status of jobs they applied to",
    my_offers: "See offer letters they received",
    accept_offer: "Accept an offer letter",
    decline_offer: "Decline an offer letter, or back out of an offer they already accepted",
    report_offer_revoked: "Report that an employer did not take them after giving an offer",
    report_fired_without_notice: "Report that an employer fired them without notice",
    check_score: "Check the trust score of a company, or their own score",
    dispute_score: "Dispute a report against them (e.g. 'I did join', 'that is not true')",
    help: "Ask what the app can do, greetings, or anything unclear",
  },
  employer: {
    create_company_profile: "Create or update their company description",
    create_job: "Create and post a job description",
    find_candidates: "Search for candidates (role, experience, location, industry)",
    my_jobs: "See jobs they posted",
    view_applicants: "See who applied to their jobs",
    create_offer: "Generate an offer letter for a candidate",
    my_offers: "See offers they sent and their status",
    withdraw_offer: "Withdraw/cancel an offer they gave (employer backs out)",
    mark_joined: "Confirm a candidate joined after accepting an offer",
    report_no_join: "Report a candidate accepted an offer but did not join",
    report_left_without_notice: "Report an employee left without notice",
    check_score: "Check the trust score of a candidate (by name, company or Aadhaar), or their own company's score",
    dispute_score: "Dispute a report against their company",
    help: "Ask what the app can do, greetings, or anything unclear",
  },
  recruiter: {
    create_firm_profile: "Create or update their recruitment firm description",
    find_candidates: "Search for candidates (role, experience, location, industry)",
    find_jobs: "Search open jobs to fill",
    pipeline: "See overall hiring pipeline: offers, acceptances, joinings",
    check_score: "Check the trust score of a candidate or company",
    help: "Ask what the app can do, greetings, or anything unclear",
  },
};

const ENTITY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Job title / role, e.g. 'Chartered Accountant', 'Accountant'" },
    location: { type: "string", description: "City or area, e.g. 'Andheri East, Mumbai'" },
    min_experience_years: { type: "number" },
    salary: { type: "number", description: "Monthly salary in INR. '30k' = 30000. '6 LPA' = 50000." },
    skills: { type: "array", items: { type: "string" } },
    industry: { type: "string", description: "e.g. manufacturing, retail, SME" },
    person_name: { type: "string" },
    company_name: { type: "string" },
    aadhaar: { type: "string", description: "12-digit Aadhaar number, digits only" },
    reference: { type: "string", description: "Which job/offer/candidate they are referring to, in their words" },
    joining_date: { type: "string", description: "ISO date YYYY-MM-DD if mentioned" },
    details: { type: "string", description: "Any other useful details from the message" },
  },
};

export async function runIntake(role: Role, message: string, history: ChatTurn[]): Promise<Intent> {
  const intents = INTENTS[role];
  const intentList = Object.entries(intents).map(([k, v]) => `- ${k}: ${v}`).join("\n");

  const schema = {
    type: "object",
    properties: {
      intent: { type: "string", enum: Object.keys(intents) },
      entities: ENTITY_SCHEMA,
    },
    required: ["intent", "entities"],
  };

  const system = `You are the Intake Agent of a voice/text-first recruiting app for Indian SMEs.
The user is a ${role}. Messages may come from speech-to-text, so expect typos and Indian English.
Pick exactly ONE intent from this list:
${intentList}
Extract every entity you can. ALWAYS capture any city/area as location (e.g. "in Mumbai" -> "Mumbai").
Only include an entity if the user actually mentioned it. Never output 0 or empty values for unknown fields.
Speech-to-text may mishear roles: "sea"/"see a" usually means "CA". Salaries are monthly INR. Use recent conversation for context
(e.g. "apply to the first one" refers to results shown earlier). Today is ${new Date().toISOString().slice(0, 10)}.`;

  const convo = history.map((t) => `${t.from === "user" ? "User" : "App"}: ${t.text}`).join("\n");
  const prompt = `${convo ? `Recent conversation:\n${convo}\n\n` : ""}New message: ${message}`;

  const result = await generateJSON<Intent>(prompt, schema, system);
  if (!intents[result.intent]) result.intent = "help";
  // Drop empty / zero values the model sometimes adds for fields the user never said.
  const cleaned = Object.fromEntries(
    Object.entries(result.entities ?? {}).filter(([, v]) =>
      v !== null && v !== undefined && v !== "" && v !== 0 && !(Array.isArray(v) && v.length === 0)
    )
  );
  result.entities = cleaned;
  return result;
}
