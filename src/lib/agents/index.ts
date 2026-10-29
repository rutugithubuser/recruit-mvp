// ORCHESTRATOR: runs the Intake Agent, then hands the request to the right specialist agent.
import type { AuthContext } from "../auth";
import { runIntake, INTENTS } from "./intake";
import { logAgent } from "./log";
import type { AgentHandler, AgentResult, ChatTurn, InputVia } from "./types";
import { companyProfileAgent, firmProfileAgent, viewCompanyProfileAgent, viewFirmProfileAgent } from "./profile";
import { jobDescriptionAgent, myJobsAgent } from "./jobs";
import { resumeAgent, myResumesAgent } from "./resume";
import { findCandidatesAgent, findJobsAgent } from "./search";
import { applyJobAgent, myApplicationsAgent, viewApplicantsAgent } from "./applications";
import { createOfferAgent, myOffersAgent, acceptOfferAgent, declineOfferAgent, withdrawOfferAgent } from "./offers";
import { checkScoreAgent, disputeScoreAgent } from "./scores";
import { markJoinedAgent, reportNoJoinAgent, reportLeftAgent, reportOfferRevokedAgent, reportFiredAgent, pipelineAgent } from "./employment";

// Intent -> specialist agent. New agents are added here as we build them.
const handlers: Partial<Record<string, AgentHandler>> = {
  help: async ({ ctx }) => helpAgent(ctx),
  create_company_profile: companyProfileAgent,
  create_firm_profile: firmProfileAgent,
  create_job: jobDescriptionAgent,
  my_jobs: myJobsAgent,
  build_resume: resumeAgent,
  my_resumes: myResumesAgent,
  view_company_profile: viewCompanyProfileAgent,
  view_firm_profile: viewFirmProfileAgent,
  find_candidates: findCandidatesAgent,
  find_jobs: findJobsAgent,
  apply_job: applyJobAgent,
  my_applications: myApplicationsAgent,
  view_applicants: viewApplicantsAgent,
  create_offer: createOfferAgent,
  my_offers: myOffersAgent,
  accept_offer: acceptOfferAgent,
  decline_offer: declineOfferAgent,
  withdraw_offer: withdrawOfferAgent,
  mark_joined: markJoinedAgent,
  report_no_join: reportNoJoinAgent,
  report_left_without_notice: reportLeftAgent,
  report_offer_revoked: reportOfferRevokedAgent,
  report_fired_without_notice: reportFiredAgent,
  check_score: checkScoreAgent,
  dispute_score: disputeScoreAgent,
  pipeline: pipelineAgent,
};

export async function runAgents(ctx: AuthContext, message: string, history: ChatTurn[], via: InputVia = "text"): Promise<AgentResult> {
  const t0 = Date.now();
  const intent = await runIntake(ctx.profile.role, message, history);
  const intakeLog = logAgent("intake", ctx.userId, { message }, intent);
  console.log(`[agents] intent=${intent.intent} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const handler = handlers[intent.intent];
  const result: AgentResult = handler
    ? await handler({ ctx, message, history, intent, via })
    : {
        agent: "orchestrator",
        intent: intent.intent,
        reply: `I understood you want to "${INTENTS[ctx.profile.role][intent.intent]}". That agent is coming in the next build step.`,
        cards: [
          {
            type: "info",
            title: `Intent: ${intent.intent}`,
            subtitle: "What the Intake Agent extracted",
            meta: Object.fromEntries(
              Object.entries(intent.entities).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : (v as string | number)])
            ),
          },
        ],
      };

  await Promise.all([intakeLog, logAgent(result.agent, ctx.userId, { message, intent }, { reply: result.reply, data: result.data ?? null })]);
  console.log(`[agents] ${result.agent} done in ${((Date.now() - t0) / 1000).toFixed(1)}s total`);
  return result;
}

function helpAgent(ctx: AuthContext): AgentResult {
  const examples: Record<string, string[]> = {
    candidate: [
      "Make my resume: I'm an accountant with 3 years in Tally and GST, based in Andheri East",
      "Find me an accountant's job in Andheri East that pays Rs 30,000",
      "Show my offers",
      "What is the score of Sharma Industries?",
    ],
    employer: [
      "Create my company profile: Sharma Industries, 50-person auto parts maker in Bhiwandi",
      "Post a job for an accounts executive, 2 years, Tally, 25-30k, Andheri",
      "Find me a CA with 2 years at an SME, based in Mumbai, from manufacturing",
      "Check the score of candidate Rahul Mehta",
    ],
    recruiter: [
      "Set up my firm: TalentBridge, we place finance staff for Mumbai SMEs",
      "Find me a CA with 2 years experience in Mumbai",
      "Show my pipeline",
      "Check score for Aadhaar 1234 5678 9012",
    ],
  };
  const role = ctx.profile.role;
  return {
    agent: "help",
    intent: "help",
    reply: `Hi${ctx.profile.full_name ? " " + ctx.profile.full_name.split(" ")[0] : ""}! Just speak or type what you need. For example:`,
    cards: examples[role].map((e) => ({ type: "info" as const, title: e, actions: [{ label: "Try this", prompt: e }] })),
  };
}
