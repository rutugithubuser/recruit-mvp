// APPLICATION AGENT: candidates apply by voice/text; employers see applicants ranked by match.
import { supabaseAdmin } from "../supabase/admin";
import { generateJSON } from "../gemini";
import type { AgentHandler, Card } from "./types";
import { compact, historyText, inr, salaryRange } from "./util";

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied", shortlisted: "Shortlisted", offered: "Offer sent", rejected: "Not selected", withdrawn: "Withdrawn",
};

// ---------- APPLY (candidate) ----------
export const applyJobAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const { data: cand } = await supabaseAdmin
    .from("candidates").select("id, full_name, current_title, location, experience_years, skills, industries, expected_salary")
    .eq("user_id", ctx.userId).maybeSingle();
  if (!cand) throw new Error("Candidate profile not found.");

  const { data: resume } = await supabaseAdmin
    .from("resumes").select("id").eq("candidate_id", cand.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!resume) {
    return {
      agent: "application", intent: intent.intent,
      reply: "You need a resume before applying. Tell me about your experience, or upload your resume with 📎.",
    };
  }

  const { data: jobs } = await supabaseAdmin
    .from("jobs").select("id, title, location, salary_min, salary_max, experience_min, skills, industry, companies(name)")
    .eq("status", "open").order("created_at", { ascending: false }).limit(100);
  if (!jobs?.length) return { agent: "application", intent: intent.intent, reply: "There are no open jobs right now." };

  const list = jobs.map((j) => compact({
    id: j.id, title: j.title, company: (j.companies as unknown as { name: string } | null)?.name, location: j.location,
    salary_min: j.salary_min, salary_max: j.salary_max, experience_min: j.experience_min, skills: j.skills, industry: j.industry,
  }));

  const pick = await generateJSON<{ job_id: string; match_score: number; question?: string }>(
    `${historyText(history)}Candidate says: ${message}
Extracted: ${JSON.stringify(intent.entities)}
Candidate profile: ${JSON.stringify(compact(cand))}
Open jobs: ${JSON.stringify(list)}`,
    {
      type: "object",
      properties: {
        job_id: { type: "string", description: "id of the job the candidate wants to apply to, or empty if unclear" },
        match_score: { type: "number", description: "0-100 fit of this candidate for that job" },
        question: { type: "string", description: "If unclear, one short question to identify the job" },
      },
      required: ["job_id", "match_score"],
    },
    "You are the Application Agent. Identify exactly which open job the candidate means (use the conversation: 'apply to the first one' = first job shown earlier). Then score the fit."
  );

  const job = jobs.find((j) => j.id === pick.job_id);
  if (!job) {
    return { agent: "application", intent: intent.intent, reply: pick.question || "Which job would you like to apply to? Say the role and company." };
  }
  const companyName = (job.companies as unknown as { name: string } | null)?.name;

  const { error } = await supabaseAdmin.from("applications").insert({
    job_id: job.id, candidate_id: cand.id, resume_id: resume.id, status: "applied",
    match_score: Math.round(pick.match_score),
  });
  if (error) {
    if (error.code === "23505") return { agent: "application", intent: intent.intent, reply: `You've already applied to ${job.title} at ${companyName}.` };
    throw new Error(error.message);
  }

  return {
    agent: "application",
    intent: intent.intent,
    reply: `Done! I've applied to "${job.title}" at ${companyName} with your latest resume. The employer can see your application now.`,
    cards: [{
      type: "job", id: job.id, title: job.title,
      subtitle: [companyName, job.location].filter(Boolean).join(" · "),
      meta: { status: "Applied", match: `${Math.round(pick.match_score)}%`, salary: salaryRange(job.salary_min, job.salary_max) },
      actions: [{ label: "My applications", prompt: "Show my applications" }, { label: "Find more jobs", prompt: "Find more jobs that match my resume" }],
    }],
    data: { job_id: job.id },
  };
};

// ---------- MY APPLICATIONS (candidate) ----------
export const myApplicationsAgent: AgentHandler = async ({ ctx, intent }) => {
  const { data: cand } = await supabaseAdmin.from("candidates").select("id").eq("user_id", ctx.userId).maybeSingle();
  if (!cand) throw new Error("Candidate profile not found.");

  const { data: apps } = await supabaseAdmin
    .from("applications").select("id, status, match_score, created_at, jobs(id, title, location, salary_min, salary_max, companies(name, score))")
    .eq("candidate_id", cand.id).order("created_at", { ascending: false });

  if (!apps?.length) {
    return { agent: "application", intent: intent.intent, reply: "You haven't applied anywhere yet. Say something like \"Find me an accountant's job in Andheri East\"." };
  }

  const cards: Card[] = apps.map((a) => {
    const j = a.jobs as unknown as { id: string; title: string; location: string; salary_min: number; salary_max: number; companies: { name: string; score: number } | null };
    return {
      type: "job", id: j?.id, title: j?.title ?? "Job",
      subtitle: [j?.companies?.name, j?.location].filter(Boolean).join(" · "),
      meta: {
        status: STATUS_LABEL[a.status] ?? a.status,
        match: a.match_score ? `${a.match_score}%` : null,
        salary: salaryRange(j?.salary_min, j?.salary_max),
        company_trust_score: j?.companies?.score,
        applied_on: new Date(a.created_at).toLocaleDateString("en-IN"),
      },
      actions: a.status === "offered" ? [{ label: "View offer", prompt: "Show my offers" }] : undefined,
    };
  });

  return { agent: "application", intent: intent.intent, reply: `You have ${apps.length} application${apps.length > 1 ? "s" : ""}.`, cards, data: apps };
};

// ---------- VIEW APPLICANTS (employer) ----------
const STOP = new Set(["job", "jobs", "all", "my", "the", "for", "applicants", "role", "roles", "posted", "every", "show"]);
export const viewApplicantsAgent: AgentHandler = async ({ ctx, intent }) => {
  const { data: company } = await supabaseAdmin.from("companies").select("id").eq("owner_id", ctx.userId).maybeSingle();
  if (!company) return { agent: "application", intent: intent.intent, reply: "Set up your company profile first." };

  const { data: jobs } = await supabaseAdmin.from("jobs").select("id, title").eq("company_id", company.id);
  if (!jobs?.length) return { agent: "application", intent: intent.intent, reply: "You haven't posted any jobs yet." };

  // If the user named a job, narrow to it (simple word match on the title).
  const wanted = `${intent.entities.title ?? ""} ${intent.entities.reference ?? ""}`.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  const named = wanted.length ? jobs.filter((j) => wanted.some((w) => j.title.toLowerCase().includes(w))) : [];
  const jobIds = (named.length ? named : jobs).map((j) => j.id);

  const { data: apps } = await supabaseAdmin
    .from("applications")
    .select("id, status, match_score, created_at, job_id, candidates(id, full_name, current_title, location, experience_years, skills, expected_salary, score), resumes(content)")
    .in("job_id", jobIds)
    .order("match_score", { ascending: false, nullsFirst: false });

  if (!apps?.length) {
    return {
      agent: "application", intent: intent.intent,
      reply: named.length ? `No applicants yet for ${named.map((j) => j.title).join(", ")}.` : "No applicants yet. Want me to search the data lake for matching candidates instead?",
      cards: [{ type: "info", title: "Search candidates instead", actions: [{ label: "Find candidates", prompt: "Find candidates for my latest job" }] }],
    };
  }

  const titleOf = new Map(jobs.map((j) => [j.id, j.title]));
  const cards: Card[] = apps.map((a) => {
    const c = a.candidates as unknown as { id: string; full_name: string; current_title: string; location: string; experience_years: number; skills: string[]; expected_salary: number; score: number };
    const resume = (a.resumes as unknown as { content: string } | null)?.content;
    const jobTitle = titleOf.get(a.job_id);
    return {
      type: "candidate", id: c.id, title: c.full_name,
      subtitle: `Applied for ${jobTitle} · ${[c.current_title, c.location].filter(Boolean).join(" · ")}`,
      meta: {
        match: a.match_score ? `${a.match_score}%` : null,
        status: STATUS_LABEL[a.status] ?? a.status,
        experience: c.experience_years ? `${c.experience_years} years` : null,
        expected_salary: inr(c.expected_salary),
        trust_score: c.score,
      },
      body: resume ? resume.slice(0, 600) + (resume.length > 600 ? "…" : "") : undefined,
      actions: a.status === "applied" || a.status === "shortlisted"
        ? [{ label: "Send offer", prompt: `Send an offer to ${c.full_name} for the ${jobTitle} job` }]
        : undefined,
    };
  });

  return {
    agent: "application", intent: intent.intent,
    reply: `${apps.length} applicant${apps.length > 1 ? "s" : ""}${named.length ? ` for ${named.map((j) => j.title).join(", ")}` : " across your jobs"}, best match first.`,
    cards, data: apps,
  };
};
