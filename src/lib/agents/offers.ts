// OFFER LETTER AGENT (employer) and ACCEPTANCE AGENT (candidate).
import { supabaseAdmin } from "../supabase/admin";
import { generateJSON, generateText } from "../gemini";
import type { AgentHandler, AgentResult, Card, CardAction } from "./types";
import { compact, historyText, inr } from "./util";
import { pickOne, rel } from "./resolve";
import { confirmDueEvents, recordScoreEvent } from "./scores";

type Co = { id: string; name: string; location: string | null; score: number };
type JobRel = { id: string; title: string; location: string | null; companies?: Co | null };
type CandRel = { id: string; full_name: string; current_title: string | null; score: number };

const STATUS_LABEL: Record<string, string> = {
  sent: "Waiting for candidate", accepted: "Accepted", declined: "Declined",
  joined: "Joined", no_show: "Did not join", revoked: "Withdrawn by employer",
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

const OFFER_SELECT = "id, status, salary, joining_date, content, created_at, job_id, candidate_id, company_id, jobs(id, title, location), candidates(id, full_name, current_title, score), companies(id, name, location, score)";

function offerCard(o: Record<string, unknown>, viewer: "candidate" | "employer" | "recruiter", showLetter = false): Card {
  const job = rel<JobRel>(o.jobs);
  const cand = rel<CandRel>(o.candidates);
  const co = rel<Co>(o.companies);
  const status = o.status as string;
  const actions: CardAction[] = [];
  const tag = `${job?.title} ${viewer === "candidate" ? "at " + co?.name : "for " + cand?.full_name}`;

  if (viewer === "candidate") {
    if (status === "sent") actions.push({ label: "Accept", prompt: `Accept the ${job?.title} offer from ${co?.name}` }, { label: "Decline", prompt: `Decline the ${job?.title} offer from ${co?.name}` });
    if (status === "accepted") actions.push({ label: "Employer didn't take me", prompt: `Report that ${co?.name} did not take me after the ${job?.title} offer` });
    if (status === "joined") actions.push({ label: "Fired without notice", prompt: `Report that ${co?.name} fired me without notice` });
  } else if (viewer === "employer") {
    if (status === "sent" || status === "accepted") actions.push({ label: "Withdraw offer", prompt: `Withdraw the ${tag} offer` });
    if (status === "accepted") actions.unshift({ label: "Mark joined", prompt: `${cand?.full_name} has joined for the ${job?.title} role` }, { label: "Didn't join", prompt: `${cand?.full_name} accepted the ${job?.title} offer but did not join` });
    if (status === "joined") actions.push({ label: "Left without notice", prompt: `${cand?.full_name} left without notice` });
  }

  return {
    type: status === "accepted" || status === "joined" ? "acceptance" : "offer",
    id: o.id as string,
    title: `${job?.title ?? "Offer"} — ${viewer === "candidate" ? co?.name : cand?.full_name}`,
    subtitle: viewer === "candidate" ? `Company trust score: ${co?.score}` : `Candidate trust score: ${cand?.score}`,
    meta: {
      status: STATUS_LABEL[status] ?? status,
      salary: o.salary ? `${inr(o.salary as number)}/month` : null,
      joining_date: fmtDate(o.joining_date as string),
      offered_on: fmtDate(o.created_at as string),
    },
    body: showLetter ? (o.content as string) : undefined,
    actions,
  };
}

// ---------- CREATE OFFER (employer) ----------
export const createOfferAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const r = (reply: string, cards?: Card[], data?: unknown): AgentResult => ({ agent: "offer_letter", intent: intent.intent, reply, cards, data });

  const { data: company } = await supabaseAdmin.from("companies").select("*").eq("owner_id", ctx.userId).maybeSingle();
  if (!company) return r("Set up your company profile first.");

  const { data: jobs } = await supabaseAdmin
    .from("jobs").select("id, title, location, salary_min, salary_max").eq("company_id", company.id).eq("status", "open");
  if (!jobs?.length) return r("Post the job first, then I can make an offer letter for it.");

  // Candidate pool: everyone who applied to this employer + anyone matching the spoken name.
  const pool = new Map<string, Record<string, unknown>>();
  const { data: apps } = await supabaseAdmin
    .from("applications").select("job_id, candidates(id, full_name, current_title, location, expected_salary)")
    .in("job_id", jobs.map((j) => j.id));
  for (const a of apps ?? []) {
    const c = rel<Record<string, unknown>>(a.candidates);
    if (c) pool.set(c.id as string, { ...c, applied_for: jobs.find((j) => j.id === a.job_id)?.title });
  }
  if (intent.entities.person_name) {
    const { data: named } = await supabaseAdmin
      .from("candidates").select("id, full_name, current_title, location, expected_salary")
      .ilike("full_name", `%${intent.entities.person_name}%`).limit(10);
    for (const c of named ?? []) if (!pool.has(c.id)) pool.set(c.id, c);
  }
  if (!pool.size) {
    return r(intent.entities.person_name
      ? `I couldn't find a candidate named "${intent.entities.person_name}". Check the name, or search candidates first.`
      : "Who is the offer for? Say the candidate's name and the job.");
  }

  const out = await generateJSON<{
    candidate_id: string; job_id: string; salary?: number; joining_date?: string; letter: string; question?: string;
  }>(
    `${historyText(history)}Employer says: ${message}
Extracted: ${JSON.stringify(intent.entities)}
Company: ${JSON.stringify(compact({ name: company.name, location: company.location, industry: company.industry }))}
Employer name (signs the letter): ${ctx.profile.full_name}
Open jobs: ${JSON.stringify(jobs)}
Candidates: ${JSON.stringify([...pool.values()])}
Today: ${today()}`,
    {
      type: "object",
      properties: {
        candidate_id: { type: "string", description: "id from Candidates, or empty if unclear" },
        job_id: { type: "string", description: "id from Open jobs, or empty if unclear" },
        salary: { type: "number", description: "Monthly INR. If not said, use the job's salary_max (or salary_min)." },
        joining_date: { type: "string", description: "YYYY-MM-DD. If not said, 15 days from today." },
        letter: { type: "string", description: "The complete offer letter" },
        question: { type: "string", description: "If the candidate or job is unclear, one short question" },
      },
      required: ["candidate_id", "job_id", "letter"],
    },
    `You are the Offer Letter Agent of a recruiting app for Indian SMEs. Write a formal, warm offer letter in simple English, plain text (no markdown).
Include: date, candidate name, "Subject: Offer of Employment – <role>", position, work location, monthly salary and annual CTC (monthly x 12),
joining date, notice period (use what the employer said, else "30 days from either side"), probation only if the employer mentioned it,
documents to bring on day 1 (ID proof, address proof, education certificates, last 3 salary slips if any),
and "Please accept or decline this offer in the app by voice or text." Sign off with the employer's name and company.
Do not invent benefits or bonuses the employer did not mention.`
  );

  const job = jobs.find((j) => j.id === out.job_id);
  const cand = pool.get(out.candidate_id);
  if (!job || !cand) return r(out.question || "Which candidate and which job is this offer for?");

  const { data: existing } = await supabaseAdmin
    .from("offers").select("id").eq("candidate_id", cand.id).eq("job_id", job.id).in("status", ["sent", "accepted"]).maybeSingle();
  if (existing) return r(`${cand.full_name} already has an active offer for ${job.title}. Say "show my offers" to see it.`);

  // Make sure there is an application record (offer may come straight from a search).
  const { data: app } = await supabaseAdmin
    .from("applications").upsert({ job_id: job.id, candidate_id: cand.id as string, status: "offered" }, { onConflict: "job_id,candidate_id" })
    .select("id").single();

  const { data: offer, error } = await supabaseAdmin.from("offers").insert({
    application_id: app?.id ?? null,
    job_id: job.id,
    candidate_id: cand.id,
    company_id: company.id,
    content: out.letter,
    salary: out.salary || job.salary_max || job.salary_min || null,
    joining_date: /^\d{4}-\d{2}-\d{2}$/.test(out.joining_date ?? "") ? out.joining_date : addDays(15),
    status: "sent",
  }).select(OFFER_SELECT).single();
  if (error) throw new Error(error.message);

  return r(
    `Offer letter for ${cand.full_name} (${job.title}) is ready and sent. They can accept it by voice or text.`,
    [offerCard(offer, "employer", true)],
    { offer_id: offer.id }
  );
};

// ---------- MY OFFERS (candidate or employer) ----------
export const myOffersAgent: AgentHandler = async ({ ctx, intent }) => {
  await confirmDueEvents();
  const role = ctx.profile.role;
  let query = supabaseAdmin.from("offers").select(OFFER_SELECT).order("created_at", { ascending: false });

  if (role === "candidate") {
    const { data: c } = await supabaseAdmin.from("candidates").select("id").eq("user_id", ctx.userId).maybeSingle();
    if (!c) return { agent: "offer_letter", intent: intent.intent, reply: "Candidate profile not found." };
    query = query.eq("candidate_id", c.id);
  } else {
    const { data: co } = await supabaseAdmin.from("companies").select("id").eq("owner_id", ctx.userId).maybeSingle();
    if (!co) return { agent: "offer_letter", intent: intent.intent, reply: "Set up your company profile first." };
    query = query.eq("company_id", co.id);
  }

  const { data: offers } = await query;
  if (!offers?.length) {
    return { agent: "offer_letter", intent: intent.intent, reply: role === "candidate" ? "You don't have any offers yet." : "You haven't sent any offers yet." };
  }
  const viewer = role === "candidate" ? "candidate" : "employer";
  return {
    agent: "offer_letter", intent: intent.intent,
    reply: `You have ${offers.length} offer${offers.length > 1 ? "s" : ""}.`,
    cards: offers.map((o, i) => offerCard(o, viewer, role === "candidate" && o.status === "sent" && i === 0)),
    data: offers,
  };
};

// Offers for the logged-in candidate with given statuses, plus a compact list for pickOne.
async function candidateOffers(userId: string, statuses: string[]) {
  const { data: c } = await supabaseAdmin.from("candidates").select("id, full_name").eq("user_id", userId).maybeSingle();
  if (!c) return { cand: null, offers: [] as Record<string, unknown>[], list: [] };
  const { data } = await supabaseAdmin.from("offers").select(OFFER_SELECT).eq("candidate_id", c.id).in("status", statuses).order("created_at", { ascending: false });
  const offers = data ?? [];
  const list = offers.map((o) => ({ id: o.id, job: rel<JobRel>(o.jobs)?.title, company: rel<Co>(o.companies)?.name, status: o.status }));
  return { cand: c, offers, list };
}

// ---------- ACCEPT OFFER (candidate) ----------
export const acceptOfferAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const { cand, offers, list } = await candidateOffers(ctx.userId, ["sent"]);
  if (!cand) throw new Error("Candidate profile not found.");
  if (!offers.length) return { agent: "acceptance", intent: intent.intent, reply: "You don't have any pending offers to accept." };

  const pick = await pickOne({ what: "offer", records: list, message, history, entities: intent.entities });
  const offer = offers.find((o) => o.id === pick.id);
  if (!offer) return { agent: "acceptance", intent: intent.intent, reply: pick.question || "Which offer do you want to accept?" };

  const job = rel<JobRel>(offer.jobs);
  const co = rel<Co>(offer.companies);

  const letter = await generateText(
    `Candidate's own words: "${message}"
Candidate: ${cand.full_name}
Company: ${co?.name}
Role: ${job?.title}
Salary: ${inr(offer.salary as number)}/month
Joining date in offer: ${offer.joining_date}
Today: ${today()}`,
    `You are the Acceptance Agent. Write a short, formal offer acceptance letter (plain text, no markdown) from the candidate to the company.
Include date, subject line, thanks, clear acceptance of the role, salary and joining date, and a commitment to join on that date.
If the candidate mentioned anything specific (e.g. a different joining date or a question), include it politely. Sign with the candidate's name.`
  );

  const { error } = await supabaseAdmin.from("acceptances").insert({ offer_id: offer.id, candidate_id: cand.id, content: letter });
  if (error && error.code !== "23505") throw new Error(error.message);
  const { data: updated } = await supabaseAdmin
    .from("offers").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", offer.id).select(OFFER_SELECT).single();

  const card = offerCard(updated ?? offer, "candidate");
  card.body = letter;
  return {
    agent: "acceptance", intent: intent.intent,
    reply: `Congratulations! I've written your acceptance letter and sent it to ${co?.name}. Remember: if you accept and then don't join, your trust score drops by 5.`,
    cards: [card],
    data: { offer_id: offer.id },
  };
};

// ---------- DECLINE OFFER (candidate) ----------
export const declineOfferAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const { cand, offers, list } = await candidateOffers(ctx.userId, ["sent", "accepted"]);
  if (!cand) throw new Error("Candidate profile not found.");
  if (!offers.length) return { agent: "acceptance", intent: intent.intent, reply: "You don't have any open offers." };

  const pick = await pickOne({ what: "offer", records: list, message, history, entities: intent.entities, needConfirm: true });
  const offer = offers.find((o) => o.id === pick.id);
  if (!offer) return { agent: "acceptance", intent: intent.intent, reply: pick.question || "Which offer do you want to decline?" };
  const job = rel<JobRel>(offer.jobs);
  const co = rel<Co>(offer.companies);

  if (offer.status === "accepted") {
    if (!pick.confirmed) {
      return {
        agent: "acceptance", intent: intent.intent,
        reply: `You already ACCEPTED the ${job?.title} offer from ${co?.name}. Backing out now counts as "accepted but did not join" and your trust score will drop by 5. Are you sure?`,
        cards: [{ type: "info", title: "Confirm backing out", actions: [{ label: "Yes, back out (−5)", prompt: `Yes, I confirm I am declining the accepted ${job?.title} offer from ${co?.name}` }] }],
      };
    }
    await supabaseAdmin.from("offers").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", offer.id);
    await recordScoreEvent({ entity_type: "candidate", entity_id: cand.id, event_type: "no_join", related_offer_id: offer.id as string, reported_by: ctx.userId, selfReported: true });
    return { agent: "acceptance", intent: intent.intent, reply: `Done. You've backed out of the ${job?.title} offer from ${co?.name}. Your trust score dropped by 5.` };
  }

  await supabaseAdmin.from("offers").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", offer.id);
  return { agent: "acceptance", intent: intent.intent, reply: `Done. I've declined the ${job?.title} offer from ${co?.name}. Declining before accepting does not affect your score.` };
};

// ---------- WITHDRAW OFFER (employer) ----------
export const withdrawOfferAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const { data: co } = await supabaseAdmin.from("companies").select("id, name").eq("owner_id", ctx.userId).maybeSingle();
  if (!co) return { agent: "offer_letter", intent: intent.intent, reply: "Set up your company profile first." };
  const { data } = await supabaseAdmin.from("offers").select(OFFER_SELECT).eq("company_id", co.id).in("status", ["sent", "accepted"]);
  const offers = data ?? [];
  if (!offers.length) return { agent: "offer_letter", intent: intent.intent, reply: "You have no open offers to withdraw." };

  const list = offers.map((o) => ({ id: o.id, candidate: rel<CandRel>(o.candidates)?.full_name, job: rel<JobRel>(o.jobs)?.title, status: o.status }));
  const pick = await pickOne({ what: "offer", records: list, message, history, entities: intent.entities, needConfirm: true });
  const offer = offers.find((o) => o.id === pick.id);
  if (!offer) return { agent: "offer_letter", intent: intent.intent, reply: pick.question || "Which offer do you want to withdraw?" };
  const cand = rel<CandRel>(offer.candidates);
  const job = rel<JobRel>(offer.jobs);

  if (!pick.confirmed) {
    return {
      agent: "offer_letter", intent: intent.intent,
      reply: `Withdrawing the offer to ${cand?.full_name} for ${job?.title} counts as "did not take the candidate after an offer". ${co.name}'s trust score will drop by 5. Are you sure?`,
      cards: [{ type: "info", title: "Confirm withdrawal", actions: [{ label: "Yes, withdraw (−5)", prompt: `Yes, I confirm withdrawing the ${job?.title} offer for ${cand?.full_name}` }] }],
    };
  }

  await supabaseAdmin.from("offers").update({ status: "revoked", updated_at: new Date().toISOString() }).eq("id", offer.id);
  await recordScoreEvent({ entity_type: "company", entity_id: co.id, event_type: "offer_revoked", related_offer_id: offer.id as string, reported_by: ctx.userId, selfReported: true });
  return { agent: "offer_letter", intent: intent.intent, reply: `Offer to ${cand?.full_name} withdrawn. ${co.name}'s trust score dropped by 5.` };
};

export { OFFER_SELECT, offerCard };
