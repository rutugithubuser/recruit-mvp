// EMPLOYMENT AGENT: joinings, no-shows, exits without notice — and the score reports they trigger.
import { supabaseAdmin } from "../supabase/admin";
import type { AgentHandler, AgentResult, Card } from "./types";
import { pickOne, rel } from "./resolve";
import { recordScoreEvent, windowText, confirmDueEvents } from "./scores";
import { OFFER_SELECT, offerCard } from "./offers";

type Named = { id: string; full_name?: string; name?: string; title?: string };

const today = () => new Date().toISOString().slice(0, 10);
const res = (intent: string, reply: string, cards?: Card[]): AgentResult => ({ agent: "employment", intent, reply, cards });

function pendingNote(status: string, who: string) {
  return status === "confirmed"
    ? `${who}'s trust score dropped by 5.`
    : `${who} has been notified and can dispute this. If not disputed, their trust score drops by 5 ${windowText()}.`;
}

async function myCompany(userId: string) {
  const { data } = await supabaseAdmin.from("companies").select("id, name").eq("owner_id", userId).maybeSingle();
  return data;
}
async function myCandidate(userId: string) {
  const { data } = await supabaseAdmin.from("candidates").select("id, full_name").eq("user_id", userId).maybeSingle();
  return data;
}

// ---------- EMPLOYER: candidate joined ----------
export const markJoinedAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const co = await myCompany(ctx.userId);
  if (!co) return res(intent.intent, "Set up your company profile first.");
  const { data } = await supabaseAdmin.from("offers").select(OFFER_SELECT).eq("company_id", co.id).eq("status", "accepted");
  const offers = data ?? [];
  if (!offers.length) return res(intent.intent, "There are no accepted offers waiting for a joining.");

  const list = offers.map((o) => ({ id: o.id, candidate: rel<Named>(o.candidates)?.full_name, job: rel<Named>(o.jobs)?.title }));
  const pick = await pickOne({ what: "accepted offer", records: list, message, history, entities: intent.entities });
  const offer = offers.find((o) => o.id === pick.id);
  if (!offer) return res(intent.intent, pick.question || "Who joined? Say the candidate's name.");

  const { data: updated } = await supabaseAdmin.from("offers").update({ status: "joined", updated_at: new Date().toISOString() }).eq("id", offer.id).select(OFFER_SELECT).single();
  await supabaseAdmin.from("employments").insert({
    offer_id: offer.id, candidate_id: offer.candidate_id, company_id: co.id,
    start_date: intent.entities.joining_date || today(), status: "active",
  });
  return res(intent.intent, `Great — ${rel<Named>(offer.candidates)?.full_name} is now recorded as joined. Hiring record saved.`, [offerCard(updated ?? offer, "employer")]);
};

// ---------- EMPLOYER: accepted but did not join ----------
export const reportNoJoinAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const co = await myCompany(ctx.userId);
  if (!co) return res(intent.intent, "Set up your company profile first.");
  const { data } = await supabaseAdmin.from("offers").select(OFFER_SELECT).eq("company_id", co.id).eq("status", "accepted");
  const offers = data ?? [];
  if (!offers.length) return res(intent.intent, "This only applies to offers the candidate has accepted. You have none right now.");

  const list = offers.map((o) => ({ id: o.id, candidate: rel<Named>(o.candidates)?.full_name, job: rel<Named>(o.jobs)?.title, joining_date: o.joining_date }));
  const pick = await pickOne({ what: "accepted offer", records: list, message, history, entities: intent.entities });
  const offer = offers.find((o) => o.id === pick.id);
  if (!offer) return res(intent.intent, pick.question || "Which candidate did not join?");

  await supabaseAdmin.from("offers").update({ status: "no_show", updated_at: new Date().toISOString() }).eq("id", offer.id);
  const ev = await recordScoreEvent({ entity_type: "candidate", entity_id: offer.candidate_id as string, event_type: "no_join", related_offer_id: offer.id as string, reported_by: ctx.userId, selfReported: false });
  const name = rel<Named>(offer.candidates)?.full_name ?? "The candidate";
  return res(intent.intent, ev.duplicate ? `This was already reported for ${name}.` : `Recorded: ${name} accepted but did not join. ${pendingNote(ev.status, name)}`);
};

// ---------- EMPLOYER: employee left without notice ----------
export const reportLeftAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const co = await myCompany(ctx.userId);
  if (!co) return res(intent.intent, "Set up your company profile first.");
  const { data } = await supabaseAdmin.from("employments").select("id, offer_id, candidate_id, start_date, candidates(full_name), offers(jobs(title))").eq("company_id", co.id).eq("status", "active");
  const emps = data ?? [];
  if (!emps.length) return res(intent.intent, "You have no active employees recorded in the app. (Only people hired through the app can be reported.)");

  const list = emps.map((e) => ({ id: e.id, employee: rel<Named>(e.candidates)?.full_name, job: rel<{ jobs: Named }>(e.offers)?.jobs?.title, since: e.start_date }));
  const pick = await pickOne({ what: "employee", records: list, message, history, entities: intent.entities });
  const emp = emps.find((e) => e.id === pick.id);
  if (!emp) return res(intent.intent, pick.question || "Which employee left without notice?");

  await supabaseAdmin.from("employments").update({ status: "left_without_notice", end_date: today() }).eq("id", emp.id);
  const ev = await recordScoreEvent({ entity_type: "candidate", entity_id: emp.candidate_id, event_type: "left_without_notice", related_offer_id: emp.offer_id, reported_by: ctx.userId, selfReported: false });
  const name = rel<Named>(emp.candidates)?.full_name ?? "The employee";
  return res(intent.intent, ev.duplicate ? `Already reported.` : `Recorded: ${name} left without notice. ${pendingNote(ev.status, name)}`);
};

// ---------- CANDIDATE: employer didn't take me after an offer ----------
export const reportOfferRevokedAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const cand = await myCandidate(ctx.userId);
  if (!cand) throw new Error("Candidate profile not found.");
  const { data } = await supabaseAdmin.from("offers").select(OFFER_SELECT).eq("candidate_id", cand.id).in("status", ["sent", "accepted"]);
  const offers = data ?? [];
  if (!offers.length) return res(intent.intent, "You have no open offers to report on.");

  const list = offers.map((o) => ({ id: o.id, company: rel<Named>(o.companies)?.name, job: rel<Named>(o.jobs)?.title, status: o.status }));
  const pick = await pickOne({ what: "offer", records: list, message, history, entities: intent.entities });
  const offer = offers.find((o) => o.id === pick.id);
  if (!offer) return res(intent.intent, pick.question || "Which company did not take you?");

  await supabaseAdmin.from("offers").update({ status: "revoked", updated_at: new Date().toISOString() }).eq("id", offer.id);
  const ev = await recordScoreEvent({ entity_type: "company", entity_id: offer.company_id as string, event_type: "offer_revoked", related_offer_id: offer.id as string, reported_by: ctx.userId, selfReported: false });
  const name = rel<Named>(offer.companies)?.name ?? "The company";
  return res(intent.intent, ev.duplicate ? "Already reported." : `Recorded: ${name} did not take you after the offer. ${pendingNote(ev.status, name)}`);
};

// ---------- CANDIDATE: fired without notice ----------
export const reportFiredAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const cand = await myCandidate(ctx.userId);
  if (!cand) throw new Error("Candidate profile not found.");
  const { data } = await supabaseAdmin.from("employments").select("id, offer_id, company_id, start_date, companies(name), offers(jobs(title))").eq("candidate_id", cand.id).eq("status", "active");
  const emps = data ?? [];
  if (!emps.length) return res(intent.intent, "You have no active job recorded in the app. (Only jobs taken through the app can be reported.)");

  const list = emps.map((e) => ({ id: e.id, company: rel<Named>(e.companies)?.name, job: rel<{ jobs: Named }>(e.offers)?.jobs?.title, since: e.start_date }));
  const pick = await pickOne({ what: "job", records: list, message, history, entities: intent.entities });
  const emp = emps.find((e) => e.id === pick.id);
  if (!emp) return res(intent.intent, pick.question || "Which company fired you without notice?");

  await supabaseAdmin.from("employments").update({ status: "fired_without_notice", end_date: today() }).eq("id", emp.id);
  const ev = await recordScoreEvent({ entity_type: "company", entity_id: emp.company_id, event_type: "fired_without_notice", related_offer_id: emp.offer_id, reported_by: ctx.userId, selfReported: false });
  const name = rel<Named>(emp.companies)?.name ?? "The company";
  return res(intent.intent, ev.duplicate ? "Already reported." : `Recorded: ${name} fired you without notice. ${pendingNote(ev.status, name)}`);
};

// ---------- RECRUITER: pipeline overview ----------
export const pipelineAgent: AgentHandler = async ({ intent }) => {
  await confirmDueEvents();
  const count = async (table: string, col?: string, val?: string) => {
    let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
    if (col && val) q = q.eq(col, val);
    const { count } = await q;
    return count ?? 0;
  };
  const [jobs, cands, sent, accepted, joined, noShow, revoked, acceptances] = await Promise.all([
    count("jobs", "status", "open"), count("candidates"), count("offers", "status", "sent"), count("offers", "status", "accepted"),
    count("offers", "status", "joined"), count("offers", "status", "no_show"), count("offers", "status", "revoked"), count("acceptances"),
  ]);
  const { data: recent } = await supabaseAdmin.from("offers").select(OFFER_SELECT).order("created_at", { ascending: false }).limit(5);

  const cards: Card[] = [
    {
      type: "info", title: "Hiring pipeline (whole data lake)",
      meta: { open_jobs: jobs, candidates: cands, offers_waiting: sent, accepted, joined, did_not_join: noShow, withdrawn_by_employer: revoked, acceptance_letters: acceptances },
    },
    ...(recent ?? []).map((o) => offerCard(o, "recruiter")),
  ];
  return { agent: "pipeline", intent: intent.intent, reply: "Here's the current hiring pipeline.", cards };
};
