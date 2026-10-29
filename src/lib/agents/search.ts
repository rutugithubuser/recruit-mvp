// MATCHING AGENT: plain-language search for candidates (employers/recruiters) and jobs (candidates/recruiters).
// The AI reads the request + the data lake records and ranks the best fits with a reason.
import { supabaseAdmin } from "../supabase/admin";
import { generateJSON } from "../gemini";
import type { AgentHandler, Card } from "./types";
import { compact, historyText, inr, salaryRange } from "./util";

type Ranking = {
  summary?: string;
  job_id?: string;
  matches: { id: string; match_score: number; reason: string }[];
};

const RANK_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One short sentence describing what was searched for" },
    job_id: { type: "string", description: "If the request is about one of the employer's jobs, its id, else empty" },
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          match_score: { type: "number", description: "0-100" },
          reason: { type: "string", description: "One short sentence why it fits (or what is missing)" },
        },
        required: ["id", "match_score", "reason"],
      },
    },
  },
  required: ["matches"],
};

const RANK_RULES = `Score each record 0-100 for how well it fits the request.
Hard requirements matter most: role/title, minimum experience, city/area, salary range, industry.
Treat close equivalents as matches (e.g. "CA" = "Chartered Accountant", "Andheri" is in Mumbai).
Return at most 5 records with score >= 40, best first. Use only ids from the list. If nothing fits, return an empty list.`;

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// ---------- FIND CANDIDATES ----------
export const findCandidatesAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const isEmployer = ctx.profile.role === "employer";

  let jobs: Record<string, unknown>[] = [];
  if (isEmployer) {
    const { data: company } = await supabaseAdmin.from("companies").select("id").eq("owner_id", ctx.userId).maybeSingle();
    if (company) {
      const { data } = await supabaseAdmin
        .from("jobs").select("id, title, location, experience_min, salary_min, salary_max, skills, industry")
        .eq("company_id", company.id).eq("status", "open").order("created_at", { ascending: false }).limit(10);
      jobs = data ?? [];
    }
  }

  const { data: pool } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, current_title, location, experience_years, skills, industries, expected_salary, score, resumes(content, created_at)")
    .order("created_at", { ascending: false })
    .limit(100);

  const candidates = (pool ?? []).filter((c) => c.current_title || (c.skills?.length ?? 0) > 0);
  if (!candidates.length) {
    return { agent: "matching", intent: intent.intent, reply: "There are no candidate profiles in the data lake yet. Once candidates build resumes, they'll show up here." };
  }

  const records = candidates.map((c) => {
    const latest = [...((c.resumes as { content: string; created_at: string }[]) ?? [])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return compact({
      id: c.id, title: c.current_title, location: c.location, experience_years: c.experience_years,
      skills: c.skills, industries: c.industries, expected_salary: c.expected_salary, trust_score: c.score,
      resume_excerpt: latest?.content?.slice(0, 300),
    });
  });

  const prompt = `${historyText(history)}Request: ${message}
Extracted: ${JSON.stringify(intent.entities)}
${jobs.length ? `Employer's open jobs (if the request is vague or names one of these, use that job as the criteria and return its id as job_id): ${JSON.stringify(jobs)}\n` : ""}
Candidates:
${JSON.stringify(records)}`;

  const ranking = await generateJSON<Ranking>(prompt, RANK_SCHEMA, `You are the Matching Agent of a recruiting app for Indian SMEs. Rank CANDIDATES for an employer/recruiter.\n${RANK_RULES}`);

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const job = jobs.find((j) => j.id === ranking.job_id);
  const matches = ranking.matches.filter((m) => byId.has(m.id)).slice(0, 5);

  if (!matches.length) {
    return {
      agent: "matching",
      intent: intent.intent,
      reply: `I searched ${candidates.length} candidate profiles but none match well yet. Try relaxing the experience, area or salary.`,
    };
  }

  const cards: Card[] = matches.map((m) => {
    const c = byId.get(m.id)!;
    const actions = [{ label: "Check score", prompt: `Check the score of candidate ${c.full_name}` }];
    if (isEmployer) {
      actions.unshift({
        label: "Send offer",
        prompt: job ? `Send an offer to ${c.full_name} for the ${job.title} job` : `Send an offer to ${c.full_name}`,
      });
    }
    return {
      type: "candidate",
      id: c.id,
      title: c.full_name,
      subtitle: [c.current_title, c.location].filter(Boolean).join(" · "),
      meta: {
        match: `${Math.round(m.match_score)}%`,
        experience: c.experience_years ? `${c.experience_years} years` : null,
        expected_salary: inr(c.expected_salary),
        trust_score: c.score,
        skills: (c.skills ?? []).slice(0, 5).join(", "),
      },
      body: m.reason,
      actions,
    };
  });

  return {
    agent: "matching",
    intent: intent.intent,
    reply: `${ranking.summary ? ranking.summary + "\n" : ""}I found ${matches.length} matching candidate${matches.length > 1 ? "s" : ""} out of ${candidates.length} in the data lake (avg match ${Math.round(mean(matches.map((m) => m.match_score)))}%).`,
    cards,
    data: { matches, job_id: job?.id ?? null },
  };
};

// ---------- FIND JOBS ----------
export const findJobsAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const isCandidate = ctx.profile.role === "candidate";

  let profile: Record<string, unknown> | null = null;
  let applied = new Set<string>();
  if (isCandidate) {
    const { data: cand } = await supabaseAdmin
      .from("candidates").select("id, current_title, location, experience_years, skills, industries, expected_salary")
      .eq("user_id", ctx.userId).maybeSingle();
    if (cand) {
      profile = compact(cand);
      const { data: apps } = await supabaseAdmin.from("applications").select("job_id").eq("candidate_id", cand.id);
      applied = new Set((apps ?? []).map((a) => a.job_id));
    }
  }

  const { data: pool } = await supabaseAdmin
    .from("jobs")
    .select("id, title, location, salary_min, salary_max, experience_min, skills, industry, description, companies(name, score)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);

  const jobs = pool ?? [];
  if (!jobs.length) return { agent: "matching", intent: intent.intent, reply: "There are no open jobs posted yet. Check back soon." };

  const records = jobs.map((j) => {
    const co = j.companies as unknown as { name: string; score: number } | null;
    return compact({
      id: j.id, title: j.title, company: co?.name, company_trust_score: co?.score, location: j.location,
      salary_min: j.salary_min, salary_max: j.salary_max, experience_min: j.experience_min, skills: j.skills,
      industry: j.industry, description_excerpt: j.description?.slice(0, 250),
    });
  });

  const prompt = `${historyText(history)}Request: ${message}
Extracted: ${JSON.stringify(intent.entities)}
${profile ? `Candidate profile (use as default preferences when the request is vague, e.g. "jobs that match my resume"): ${JSON.stringify(profile)}\n` : ""}
Jobs:
${JSON.stringify(records)}`;

  const ranking = await generateJSON<Ranking>(prompt, RANK_SCHEMA, `You are the Matching Agent of a recruiting app for Indian SMEs. Rank JOBS for a job seeker.\n${RANK_RULES}\nIf a salary is requested, jobs paying clearly below it should score low.`);

  const byId = new Map(jobs.map((j) => [j.id, j]));
  const matches = ranking.matches.filter((m) => byId.has(m.id)).slice(0, 5);
  if (!matches.length) {
    return { agent: "matching", intent: intent.intent, reply: `I checked ${jobs.length} open jobs but none match well. Try a nearby area or a different salary.` };
  }

  const cards: Card[] = matches.map((m) => {
    const j = byId.get(m.id)!;
    const co = j.companies as unknown as { name: string; score: number } | null;
    const already = applied.has(j.id);
    return {
      type: "job",
      id: j.id,
      title: j.title,
      subtitle: [co?.name, j.location].filter(Boolean).join(" · "),
      meta: {
        match: `${Math.round(m.match_score)}%`,
        salary: salaryRange(j.salary_min, j.salary_max),
        experience: j.experience_min ? `${j.experience_min}+ years` : null,
        company_trust_score: co?.score,
        status: already ? "Applied" : null,
      },
      body: m.reason,
      actions: isCandidate
        ? already
          ? [{ label: "My applications", prompt: "Show my applications" }]
          : [
              { label: "Apply", prompt: `Apply to the ${j.title} job at ${co?.name ?? "this company"}` },
              { label: "Company score", prompt: `What is the score of ${co?.name}?` },
            ]
        : [{ label: "Find candidates for it", prompt: `Find candidates for the ${j.title} job in ${j.location ?? ""}` }],
    };
  });

  return {
    agent: "matching",
    intent: intent.intent,
    reply: `${ranking.summary ? ranking.summary + "\n" : ""}I found ${matches.length} matching job${matches.length > 1 ? "s" : ""} out of ${jobs.length} open.`,
    cards,
    data: { matches },
  };
};
