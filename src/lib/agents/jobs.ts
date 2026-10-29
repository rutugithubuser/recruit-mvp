// JOB DESCRIPTION AGENT: writes a full JD from a spoken/typed request and posts it.
import { supabaseAdmin } from "../supabase/admin";
import { generateJSON } from "../gemini";
import type { AgentHandler, Card } from "./types";
import { historyText, salaryRange } from "./util";

type JobOut = {
  title: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  experience_min?: number;
  skills?: string[];
  industry?: string;
  description: string;
  question?: string;
};

export function jobCard(j: Record<string, unknown>, companyName?: string, full = true): Card {
  const title = j.title as string;
  return {
    type: "job",
    id: j.id as string,
    title,
    subtitle: [companyName, j.location].filter(Boolean).join(" · "),
    meta: {
      salary: salaryRange(j.salary_min as number, j.salary_max as number),
      experience: j.experience_min ? `${j.experience_min}+ years` : null,
      skills: ((j.skills as string[]) ?? []).join(", "),
      status: j.status as string,
    },
    body: full ? (j.description as string) : undefined,
    actions: [{ label: "Find candidates for this job", prompt: `Find candidates for the ${title} job${j.location ? " in " + j.location : ""}` }],
  };
}

export const jobDescriptionAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const { data: company } = await supabaseAdmin
    .from("companies").select("*").eq("owner_id", ctx.userId).maybeSingle();

  if (!company) {
    return {
      agent: "job_description",
      intent: intent.intent,
      reply: "Before posting a job, tell me about your company: its name, what it does, where it is and how big it is.",
    };
  }

  const schema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Job title. Empty string if the user has not said what role." },
      location: { type: "string" },
      salary_min: { type: "number", description: "Monthly INR" },
      salary_max: { type: "number", description: "Monthly INR" },
      experience_min: { type: "number" },
      skills: { type: "array", items: { type: "string" } },
      industry: { type: "string" },
      description: { type: "string", description: "The full job description text" },
      question: { type: "string", description: "If the role is unknown, one short question asking for it" },
    },
    required: ["title", "description"],
  };

  const system = `You are the Job Description Agent of a recruiting app for Indian SMEs.
Write a clear job description in simple English with these sections, each on its own line:
About us / The role / Key responsibilities (4-6 "•" bullets) / Requirements ("•" bullets) / Salary & location.
No markdown symbols like # or **. Do not invent benefits. If salary is not given, write "Salary: As per experience".
If location is not given, use the company location. Salaries are monthly INR ("25-30k" = 25000 to 30000).`;

  const prompt = `Company: ${JSON.stringify({ name: company.name, industry: company.industry, location: company.location, size: company.size, description: company.description })}

${historyText(history)}Employer's request: ${message}
Already extracted: ${JSON.stringify(intent.entities)}`;

  const out = await generateJSON<JobOut>(prompt, schema, system);

  if (!out.title?.trim()) {
    return {
      agent: "job_description",
      intent: intent.intent,
      reply: out.question || "What role are you hiring for? Tell me the role, area, experience needed and salary.",
    };
  }

  const row = {
    company_id: company.id,
    posted_by: ctx.userId,
    title: out.title.trim(),
    description: out.description,
    location: out.location || company.location,
    salary_min: out.salary_min || null,
    salary_max: out.salary_max || out.salary_min || null,
    experience_min: out.experience_min || null,
    skills: out.skills ?? [],
    industry: out.industry || company.industry,
    status: "open",
  };

  // Same title already open? Update that job instead of posting a duplicate.
  const { data: same } = await supabaseAdmin
    .from("jobs").select("id").eq("company_id", company.id).eq("status", "open").ilike("title", row.title)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: job, error } = same
    ? await supabaseAdmin.from("jobs").update(row).eq("id", same.id).select().single()
    : await supabaseAdmin.from("jobs").insert(row).select().single();
  if (error) throw new Error(error.message);

  if (same) {
    return {
      agent: "job_description",
      intent: intent.intent,
      reply: `You already had an open "${job.title}" job, so I updated it with these details instead of posting a duplicate.`,
      cards: [jobCard(job, company.name)],
      data: job,
    };
  }

  return {
    agent: "job_description",
    intent: intent.intent,
    reply: `I've written and posted the job description for "${job.title}". Candidates can now find and apply to it.`,
    cards: [jobCard(job, company.name)],
    data: job,
  };
};

export const myJobsAgent: AgentHandler = async ({ ctx, intent }) => {
  const { data: company } = await supabaseAdmin
    .from("companies").select("id, name").eq("owner_id", ctx.userId).maybeSingle();
  if (!company) return { agent: "jobs", intent: intent.intent, reply: "You haven't set up your company yet. Tell me about your company first." };

  const { data: jobs } = await supabaseAdmin
    .from("jobs").select("*, applications(count)").eq("company_id", company.id).order("created_at", { ascending: false });

  if (!jobs?.length) {
    return { agent: "jobs", intent: intent.intent, reply: "You haven't posted any jobs yet. Just tell me the role you're hiring for." };
  }

  return {
    agent: "jobs",
    intent: intent.intent,
    reply: `You have ${jobs.length} job${jobs.length > 1 ? "s" : ""} posted.`,
    cards: jobs.map((j) => {
      const card = jobCard(j, company.name, false);
      const count = (j.applications as { count: number }[] | undefined)?.[0]?.count ?? 0;
      card.meta = { ...card.meta, applicants: count };
      card.actions = [
        ...(card.actions ?? []),
        { label: "View applicants", prompt: `Show applicants for the ${j.title} job` },
      ];
      return card;
    }),
    data: jobs,
  };
};
