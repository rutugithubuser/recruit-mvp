// SCORE AGENT: trust scores. Everyone starts at 100. Each confirmed violation = -5.
// Reports against someone else are "pending" for a dispute window, then auto-confirm.
// Self-admitted violations (e.g. employer withdraws an offer) are confirmed immediately.
import { supabaseAdmin } from "../supabase/admin";
import { hashAadhaar, normalizeAadhaar } from "../aadhaar";
import type { AgentHandler, Card } from "./types";
import { pickOne, rel } from "./resolve";

const WINDOW_MIN = Number(process.env.DISPUTE_WINDOW_MINUTES ?? 4320); // default 3 days

export const EVENT_LABEL: Record<string, string> = {
  no_join: "Accepted an offer but did not join",
  offer_revoked: "Did not take a candidate after giving an offer",
  left_without_notice: "Left a job without notice",
  fired_without_notice: "Fired an employee without notice",
};

/** Confirm every pending report whose dispute window has passed (the DB trigger then drops the score). */
export async function confirmDueEvents() {
  await supabaseAdmin
    .from("score_events")
    .update({ status: "confirmed" })
    .eq("status", "pending")
    .lt("dispute_deadline", new Date().toISOString());
}

export async function recordScoreEvent(p: {
  entity_type: "candidate" | "company";
  entity_id: string;
  event_type: keyof typeof EVENT_LABEL;
  related_offer_id?: string | null;
  reported_by: string;
  selfReported: boolean;
}): Promise<{ status: string; duplicate: boolean }> {
  if (p.related_offer_id) {
    const { data: dup } = await supabaseAdmin
      .from("score_events").select("id, status")
      .eq("entity_id", p.entity_id).eq("event_type", p.event_type).eq("related_offer_id", p.related_offer_id)
      .maybeSingle();
    if (dup) return { status: dup.status, duplicate: true };
  }
  const status = p.selfReported || WINDOW_MIN <= 0 ? "confirmed" : "pending";
  const { error } = await supabaseAdmin.from("score_events").insert({
    entity_type: p.entity_type,
    entity_id: p.entity_id,
    event_type: p.event_type,
    related_offer_id: p.related_offer_id ?? null,
    reported_by: p.reported_by,
    status,
    dispute_deadline: new Date(Date.now() + Math.max(WINDOW_MIN, 0) * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { status, duplicate: false };
}

export function windowText(): string {
  if (WINDOW_MIN <= 0) return "immediately";
  if (WINDOW_MIN < 120) return `in ${WINDOW_MIN} minutes`;
  if (WINDOW_MIN < 2880) return `in ${Math.round(WINDOW_MIN / 60)} hours`;
  return `in ${Math.round(WINDOW_MIN / 1440)} days`;
}

function verdict(score: number) {
  if (score >= 95) return "✅ Reliable";
  if (score >= 85) return "⚠️ Some issues";
  return "🚩 High risk";
}

type Ev = { entity_id: string; event_type: string; status: string; created_at: string };

async function eventsFor(ids: string[]): Promise<Map<string, Ev[]>> {
  const map = new Map<string, Ev[]>();
  if (!ids.length) return map;
  const { data } = await supabaseAdmin
    .from("score_events").select("entity_id, event_type, status, created_at").in("entity_id", ids)
    .order("created_at", { ascending: false });
  for (const e of data ?? []) map.set(e.entity_id, [...(map.get(e.entity_id) ?? []), e]);
  return map;
}

function historyLines(evs: Ev[]): string | undefined {
  if (!evs.length) return "No violations on record.";
  return evs.slice(0, 6)
    .map((e) => `• ${EVENT_LABEL[e.event_type]} (${e.status === "confirmed" ? "−5, confirmed" : e.status}) · ${new Date(e.created_at).toLocaleDateString("en-IN")}`)
    .join("\n");
}

function candidateScoreCard(c: Record<string, unknown>, evs: Ev[]): Card {
  const score = c.score as number;
  return {
    type: "score", id: c.id as string, title: c.full_name as string,
    subtitle: ["Candidate", c.current_title, c.location].filter(Boolean).join(" · "),
    meta: {
      trust_score: score,
      verdict: verdict(score),
      aadhaar: c.aadhaar_last4 ? `XXXX XXXX ${c.aadhaar_last4}` : null,
      confirmed_violations: evs.filter((e) => e.status === "confirmed").length,
      pending_reports: evs.filter((e) => e.status === "pending").length,
    },
    body: historyLines(evs),
  };
}

function companyScoreCard(c: Record<string, unknown>, evs: Ev[]): Card {
  const score = c.score as number;
  return {
    type: "score", id: c.id as string, title: c.name as string,
    subtitle: ["Employer", c.industry, c.location].filter(Boolean).join(" · "),
    meta: {
      trust_score: score,
      verdict: verdict(score),
      confirmed_violations: evs.filter((e) => e.status === "confirmed").length,
      pending_reports: evs.filter((e) => e.status === "pending").length,
    },
    body: historyLines(evs),
  };
}

// ---------- CHECK SCORE ----------
export const checkScoreAgent: AgentHandler = async ({ ctx, intent }) => {
  await confirmDueEvents();
  const role = ctx.profile.role;
  const e = intent.entities;
  const aadhaar = normalizeAadhaar(e.aadhaar);
  const reply = (r: string, cards?: Card[]) => ({ agent: "score", intent: intent.intent, reply: r, cards });

  // Nothing specified -> your own score.
  if (!aadhaar && !e.person_name && !e.company_name) {
    if (role === "candidate") {
      const { data: c } = await supabaseAdmin.from("candidates").select("*").eq("user_id", ctx.userId).maybeSingle();
      if (!c) return reply("Candidate profile not found.");
      const ev = (await eventsFor([c.id])).get(c.id) ?? [];
      return reply(`Your trust score is ${c.score}.`, [candidateScoreCard(c, ev)]);
    }
    if (role === "employer") {
      const { data: co } = await supabaseAdmin.from("companies").select("*").eq("owner_id", ctx.userId).maybeSingle();
      if (!co) return reply("Set up your company profile first, then you'll have a score.");
      const ev = (await eventsFor([co.id])).get(co.id) ?? [];
      return reply(`${co.name}'s trust score is ${co.score}.`, [companyScoreCard(co, ev)]);
    }
    return reply("Whose score should I check? Say a candidate's name, their company, or their Aadhaar number, or a company name.");
  }

  // Candidates can check COMPANY scores.
  if (role === "candidate" || (role === "recruiter" && e.company_name && !e.person_name && !aadhaar)) {
    const name = e.company_name || e.person_name;
    const { data: cos } = await supabaseAdmin.from("companies").select("*").ilike("name", `%${name}%`).limit(5);
    if (!cos?.length) return reply(`I couldn't find a company called "${name}" in the data lake.`);
    const evs = await eventsFor(cos.map((c) => c.id));
    const cards = cos.map((c) => companyScoreCard(c, evs.get(c.id) ?? []));
    if (role === "recruiter") {
      // Recruiters also see candidates who worked at that company.
      const cands = await candidatesByCompany(name!);
      const cev = await eventsFor(cands.map((c) => c.id as string));
      cards.push(...cands.map((c) => candidateScoreCard(c, cev.get(c.id as string) ?? [])));
    }
    return reply(cos.length === 1 ? `${cos[0].name} has a trust score of ${cos[0].score}.` : `Found ${cos.length} matching companies.`, cards);
  }

  // Employers / recruiters check CANDIDATE scores by Aadhaar, name or company.
  let found: Record<string, unknown>[] = [];
  let how = "";
  if (aadhaar) {
    const { data } = await supabaseAdmin.from("candidates").select("*").eq("aadhaar_hash", hashAadhaar(aadhaar)).limit(1);
    found = data ?? [];
    how = `Aadhaar ending ${aadhaar.slice(-4)}`;
  } else if (e.person_name) {
    const { data } = await supabaseAdmin.from("candidates").select("*").ilike("full_name", `%${e.person_name}%`).limit(5);
    found = data ?? [];
    how = `name "${e.person_name}"`;
  } else if (e.company_name) {
    found = await candidatesByCompany(e.company_name);
    how = `company "${e.company_name}"`;
  }

  if (!found.length) return reply(`No candidate found with ${how}.`);
  const evs = await eventsFor(found.map((c) => c.id as string));
  return reply(
    found.length === 1 ? `${found[0].full_name} has a trust score of ${found[0].score}.` : `Found ${found.length} candidates matching ${how}.`,
    found.map((c) => candidateScoreCard(c, evs.get(c.id as string) ?? []))
  );
};

/** Candidates linked to a company: via employment records or mentioned in their resume. */
async function candidatesByCompany(name: string): Promise<Record<string, unknown>[]> {
  const ids = new Set<string>();
  const { data: cos } = await supabaseAdmin.from("companies").select("id").ilike("name", `%${name}%`);
  if (cos?.length) {
    const { data: emps } = await supabaseAdmin.from("employments").select("candidate_id").in("company_id", cos.map((c) => c.id));
    (emps ?? []).forEach((x) => ids.add(x.candidate_id));
  }
  const { data: res } = await supabaseAdmin.from("resumes").select("candidate_id").ilike("content", `%${name}%`).limit(20);
  (res ?? []).forEach((x) => ids.add(x.candidate_id));
  if (!ids.size) return [];
  const { data } = await supabaseAdmin.from("candidates").select("*").in("id", [...ids]).limit(5);
  return data ?? [];
}

// ---------- DISPUTE ----------
export const disputeScoreAgent: AgentHandler = async ({ ctx, message, history, intent }) => {
  const role = ctx.profile.role;
  const { data: me } = role === "candidate"
    ? await supabaseAdmin.from("candidates").select("id").eq("user_id", ctx.userId).maybeSingle()
    : await supabaseAdmin.from("companies").select("id").eq("owner_id", ctx.userId).maybeSingle();
  if (!me) return { agent: "score", intent: intent.intent, reply: "Profile not found." };

  const { data: pending } = await supabaseAdmin
    .from("score_events").select("id, event_type, created_at, dispute_deadline, offers(id, jobs(title))")
    .eq("entity_id", me.id).eq("status", "pending");
  if (!pending?.length) {
    return { agent: "score", intent: intent.intent, reply: "There are no pending reports against you to dispute. (Reports can only be disputed before they are confirmed.)" };
  }

  const records = pending.map((p) => ({
    id: p.id, report: EVENT_LABEL[p.event_type], job: rel<{ jobs: { title: string } }>(p.offers)?.jobs?.title, reported_on: p.created_at.slice(0, 10),
  }));
  const pick = await pickOne({ what: "pending report", records, message, history, entities: intent.entities });
  if (!pick.id) return { agent: "score", intent: intent.intent, reply: pick.question || "Which report do you want to dispute?" };

  await supabaseAdmin.from("score_events").update({ status: "disputed", dispute_reason: message }).eq("id", pick.id);
  return {
    agent: "score", intent: intent.intent,
    reply: "Your dispute is recorded. This report is now on hold and will not reduce your score unless it is reviewed and confirmed.",
  };
};
