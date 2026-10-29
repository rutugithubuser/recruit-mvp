// DEMO DATA: realistic SME candidates, companies, jobs and score history for Mumbai/Pune.
// Writes straight to the database (no AI calls, no quota used). Safe to re-run: it replaces
// only its own demo records and never touches accounts you created.
// All names, companies and Aadhaar numbers below are fictional test data for demos.
// Run:  node --env-file=.env.local scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const salt = process.env.AADHAAR_SALT || "dev-salt-change-me";
const hash = (d) => createHash("sha256").update(`${salt}:${d}`).digest("hex");
const DEMO = "@demo.hirespeak.in";
const die = (where, error) => { if (error) { console.error(`✗ ${where}: ${error.message}`); process.exit(1); } };

// ---------------- COMPANIES ----------------
const companies = [
  { name: "Om Sai Traders", industry: "Wholesale trading & distribution", location: "Andheri East, Mumbai", size: "25 employees",
    description: "Om Sai Traders is a 25-person wholesale distributor of electrical and hardware goods based in Andheri East, Mumbai. We supply 400+ retailers across the western suburbs and run a fast, friendly, family-style office." },
  { name: "Greenleaf Foods Pvt Ltd", industry: "Food processing (manufacturing)", location: "Vasai, Mumbai", size: "180 employees",
    description: "Greenleaf Foods makes ready-to-cook snacks and spice mixes at its plant in Vasai. A growing manufacturing SME with 180 people, we sell across Maharashtra and Gujarat through modern and general trade." },
  { name: "Patil Auto Components", industry: "Auto parts manufacturing", location: "Chakan, Pune", size: "120 employees",
    description: "Patil Auto Components is a Tier-2 supplier of machined and forged parts to leading two-wheeler and tractor makers. Our 120-person plant in Chakan, Pune, runs three shifts and is IATF certified." },
  { name: "Kapoor & Associates", industry: "Chartered accountancy firm", location: "Andheri East, Mumbai", size: "15 employees",
    description: "Kapoor & Associates is a 15-person CA firm in Andheri East handling audit, GST and tax work for 120+ SMEs. We offer hands-on learning and direct client exposure." },
  { name: "Mehta Textiles", industry: "Textile manufacturing", location: "Bhiwandi, Thane", size: "60 employees",
    description: "Mehta Textiles weaves and processes cotton and blended fabrics in Bhiwandi. A 60-person manufacturing SME supplying garment exporters in Mumbai and Surat." },
];

// ---------------- JOBS ----------------
const jobs = [
  { company: "Om Sai Traders", title: "Accountant", location: "Andheri East, Mumbai", salary_min: 28000, salary_max: 32000, experience_min: 2,
    skills: ["Tally Prime", "GST returns", "Bank reconciliation", "Excel"], industry: "Trading" },
  { company: "Greenleaf Foods Pvt Ltd", title: "Chartered Accountant (CA)", location: "Mumbai", salary_min: 65000, salary_max: 80000, experience_min: 2,
    skills: ["Statutory audit", "GST", "Costing", "MIS reporting", "SAP"], industry: "Manufacturing" },
  { company: "Kapoor & Associates", title: "Accounts Assistant", location: "Andheri East, Mumbai", salary_min: 18000, salary_max: 22000, experience_min: 1,
    skills: ["Tally", "Data entry", "GST basics", "Excel"], industry: "CA firm" },
  { company: "Kapoor & Associates", title: "GST Executive", location: "Andheri East, Mumbai", salary_min: 25000, salary_max: 30000, experience_min: 2,
    skills: ["GSTR-1", "GSTR-3B", "GST reconciliation", "E-way bills"], industry: "CA firm" },
  { company: "Patil Auto Components", title: "Production Supervisor", location: "Chakan, Pune", salary_min: 30000, salary_max: 36000, experience_min: 4,
    skills: ["Shift planning", "5S", "Quality checks", "CNC machining"], industry: "Manufacturing" },
  { company: "Patil Auto Components", title: "HR Executive", location: "Chakan, Pune", salary_min: 25000, salary_max: 30000, experience_min: 2,
    skills: ["Recruitment", "Payroll", "PF/ESIC", "Contract labour compliance"], industry: "Manufacturing" },
  { company: "Mehta Textiles", title: "Sales Executive", location: "Bhiwandi, Thane", salary_min: 20000, salary_max: 25000, experience_min: 1,
    skills: ["B2B sales", "Client follow-up", "Order tracking"], industry: "Manufacturing" },
  { company: "Greenleaf Foods Pvt Ltd", title: "Store Keeper", location: "Vasai, Mumbai", salary_min: 16000, salary_max: 19000, experience_min: 2,
    skills: ["Inventory", "GRN", "Stock audit", "Tally inventory"], industry: "Manufacturing" },
];

function jd(j, c) {
  return `About us
${c.description}

The role
We are hiring a ${j.title} for our ${j.location} office.

Key responsibilities
${j.skills.map((s) => `• Handle ${s.toLowerCase()} work end to end`).join("\n")}
• Coordinate with the team and report to management on time

Requirements
• ${j.experience_min}+ years of relevant experience
• Good knowledge of ${j.skills.slice(0, 2).join(" and ")}
• Experience in an SME environment preferred

Salary & location
Salary: ₹${j.salary_min.toLocaleString("en-IN")} – ₹${j.salary_max.toLocaleString("en-IN")} per month
Location: ${j.location}`;
}

// ---------------- CANDIDATES ----------------
const candidates = [
  { full_name: "Priya Shah", current_title: "Chartered Accountant", location: "Andheri West, Mumbai", experience_years: 2.5,
    skills: ["Statutory audit", "GST", "Costing", "MIS reporting", "Tally", "SAP"], industries: ["manufacturing", "SME"], expected_salary: 70000,
    history: "Finance Executive, Shree Ganesh Plastics (plastic moulding SME, 90 employees) | 2022 – Present", edu: "CA, ICAI (2022) · B.Com, Mumbai University", aadhaar: "234567890123" },
  { full_name: "Amit Joshi", current_title: "Chartered Accountant", location: "Thane", experience_years: 3,
    skills: ["Audit", "Direct tax", "GST", "Costing", "Excel"], industries: ["manufacturing", "auto components"], expected_salary: 75000,
    history: "Accounts Manager, Vardhman Precision Parts (auto components SME) | 2021 – Present", edu: "CA, ICAI (2021) · B.Com, Thane" },
  { full_name: "Neha Kulkarni", current_title: "Chartered Accountant", location: "Pune", experience_years: 2,
    skills: ["Audit", "Ind AS", "Transfer pricing"], industries: ["IT services"], expected_salary: 85000,
    history: "Audit Associate, large audit firm, Pune | 2023 – Present", edu: "CA, ICAI (2023)" },
  { full_name: "Rahul Verma", current_title: "Chartered Accountant", location: "Navi Mumbai", experience_years: 1,
    skills: ["GST", "Tax audit"], industries: ["FMCG"], expected_salary: 60000,
    history: "Junior Finance Analyst, FMCG distributor | 2024 – Present", edu: "CA, ICAI (2024)" },
  { full_name: "Rohan Desai", current_title: "Accountant", location: "Andheri East, Mumbai", experience_years: 3,
    skills: ["Tally Prime", "GST returns", "Bank reconciliation", "Excel", "TDS"], industries: ["trading", "SME"], expected_salary: 30000,
    history: "Accountant, Jai Hind Hardware Distributors | 2022 – Present\nAccounts Assistant, Shiv Shakti Traders | 2021 – 2022", edu: "B.Com, Mumbai University", aadhaar: "345678901234" },
  { full_name: "Meera Joshi", current_title: "Accountant", location: "Andheri East, Mumbai", experience_years: 2,
    skills: ["Tally", "GST", "Payables", "Excel"], industries: ["manufacturing"], expected_salary: 26000,
    history: "Accounts Executive, Precision Pack Industries (packaging) | 2023 – Present", edu: "M.Com, Mumbai University" },
  { full_name: "Deepa Iyer", current_title: "Senior Accountant", location: "Andheri East, Mumbai", experience_years: 7,
    skills: ["Finalisation of accounts", "GST", "TDS", "Tally", "Team handling"], industries: ["trading", "manufacturing"], expected_salary: 45000,
    history: "Senior Accountant, Ratna Electricals | 2019 – Present\nAccountant, Laxmi Enterprises | 2017 – 2019", edu: "B.Com, Mumbai University" },
  { full_name: "Vikram Singh", current_title: "Accountant", location: "Goregaon, Mumbai", experience_years: 5,
    skills: ["Tally", "GST", "Bank reconciliation"], industries: ["trading"], expected_salary: 35000,
    history: "Accountant, various trading firms | 2020 – Present", edu: "B.Com", aadhaar: "456789012345", violations: ["no_join", "no_join"] },
  { full_name: "Sneha Patil", current_title: "Accounts Assistant", location: "Andheri East, Mumbai", experience_years: 1,
    skills: ["Tally", "Data entry", "Excel"], industries: ["CA firm"], expected_salary: 20000,
    history: "Accounts Trainee, R. K. Shah & Co. (CA firm) | 2024 – Present", edu: "B.Com, Mumbai University (2024)" },
  { full_name: "Pooja Nair", current_title: "Junior Accountant", location: "Malad, Mumbai", experience_years: 1.5,
    skills: ["Tally", "GST basics", "Invoicing"], industries: ["retail"], expected_salary: 22000,
    history: "Junior Accountant, Nair Retail Mart | 2023 – Present", edu: "B.Com" },
  { full_name: "Fatima Shaikh", current_title: "GST Executive", location: "Kurla, Mumbai", experience_years: 2,
    skills: ["GSTR-1", "GSTR-3B", "GST reconciliation", "E-way bills", "Tally"], industries: ["CA firm", "trading"], expected_salary: 27000,
    history: "GST Executive, M. A. Ansari & Associates | 2023 – Present", edu: "B.Com, Mumbai University" },
  { full_name: "Suresh Yadav", current_title: "Production Supervisor", location: "Chakan, Pune", experience_years: 6,
    skills: ["Shift planning", "5S", "Kaizen", "Quality checks", "CNC machining"], industries: ["manufacturing", "auto components"], expected_salary: 34000,
    history: "Production Supervisor, Sai Forgings (forging unit, Chakan MIDC) | 2019 – Present\nMachine Operator, Chakan MIDC | 2018 – 2019", edu: "Diploma in Mechanical Engineering" },
  { full_name: "Anjali Rao", current_title: "HR Executive", location: "Pune", experience_years: 3,
    skills: ["Recruitment", "Payroll", "PF/ESIC", "Onboarding"], industries: ["manufacturing"], expected_salary: 28000,
    history: "HR Executive, Shinde Engineering Works | 2022 – Present", edu: "MBA (HR), Pune University" },
  { full_name: "Karan Mehta", current_title: "Sales Executive", location: "Bhiwandi, Thane", experience_years: 2,
    skills: ["B2B sales", "Client follow-up", "Cold calling"], industries: ["textiles"], expected_salary: 22000,
    history: "Sales Executive, Shree Fabrics | 2023 – Present", edu: "BBA", violations: ["left_without_notice"] },
  { full_name: "Imran Khan", current_title: "Store Keeper", location: "Vasai, Mumbai", experience_years: 4,
    skills: ["Inventory", "GRN", "Stock audit", "Tally inventory"], industries: ["manufacturing", "food processing"], expected_salary: 18000,
    history: "Store Keeper, Coastal Foods | 2021 – Present", edu: "HSC" },
];

function resume(c) {
  return `${c.full_name.toUpperCase()}
${c.location} · ${c.full_name.toLowerCase().replace(" ", ".")}${DEMO}

PROFESSIONAL SUMMARY
${c.current_title} with ${c.experience_years} years of experience in ${c.industries.join(" and ")} businesses. Strong in ${c.skills.slice(0, 3).join(", ")}.

WORK EXPERIENCE
${c.history}

SKILLS
${c.skills.map((s) => `• ${s}`).join("\n")}

EDUCATION
${c.edu}`;
}

// ---------------- RUN ----------------
console.log("Removing old demo data…");
const { data: oldC } = await db.from("candidates").select("id").like("email", `%${DEMO}`);
const { data: oldCo } = await db.from("companies").select("id").is("owner_id", null).in("name", companies.map((c) => c.name));
const oldIds = [...(oldC ?? []), ...(oldCo ?? [])].map((r) => r.id);
if (oldIds.length) await db.from("score_events").delete().in("entity_id", oldIds);
if (oldC?.length) die("delete candidates", (await db.from("candidates").delete().in("id", oldC.map((r) => r.id))).error);
if (oldCo?.length) die("delete companies", (await db.from("companies").delete().in("id", oldCo.map((r) => r.id))).error);

console.log("Adding companies and jobs…");
const { data: coRows, error: coErr } = await db.from("companies").insert(companies.map((c) => ({ ...c, owner_id: null }))).select("id, name");
die("companies", coErr);
const coId = Object.fromEntries(coRows.map((c) => [c.name, c.id]));
const { error: jobErr } = await db.from("jobs").insert(jobs.map(({ company, ...j }) => ({
  ...j, company_id: coId[company], description: jd(j, companies.find((c) => c.name === company)), status: "open",
})));
die("jobs", jobErr);

console.log("Adding candidates and resumes…");
const { data: cRows, error: cErr } = await db.from("candidates").insert(candidates.map((c) => ({
  full_name: c.full_name, email: c.full_name.toLowerCase().replace(" ", ".") + DEMO, location: c.location,
  current_title: c.current_title, experience_years: c.experience_years, skills: c.skills, industries: c.industries,
  expected_salary: c.expected_salary,
  aadhaar_hash: c.aadhaar ? hash(c.aadhaar) : null, aadhaar_last4: c.aadhaar ? c.aadhaar.slice(-4) : null,
}))).select("id, full_name");
die("candidates", cErr);
const cId = Object.fromEntries(cRows.map((c) => [c.full_name, c.id]));
die("resumes", (await db.from("resumes").insert(candidates.map((c) => ({
  candidate_id: cId[c.full_name], source: "text", content: resume(c),
  parsed: { full_name: c.full_name, current_title: c.current_title, skills: c.skills },
})))).error);

console.log("Adding score history…");
const events = [
  ...candidates.flatMap((c) => (c.violations ?? []).map((v) => ({ entity_type: "candidate", entity_id: cId[c.full_name], event_type: v }))),
  { entity_type: "company", entity_id: coId["Mehta Textiles"], event_type: "offer_revoked" },
  { entity_type: "company", entity_id: coId["Mehta Textiles"], event_type: "fired_without_notice" },
];
for (const e of events) {
  // Inserted as confirmed -> the database trigger applies the −5 automatically.
  die("score event", (await db.from("score_events").insert({ ...e, delta: -5, status: "confirmed" })).error);
}

console.log(`\n✓ Done: ${companies.length} companies, ${jobs.length} jobs, ${candidates.length} candidates with resumes.`);
console.log("  Lower scores: Vikram Singh 90, Karan Mehta 95, Mehta Textiles 90.");
console.log("  Demo Aadhaar numbers: Priya Shah 2345 6789 0123 · Rohan Desai 3456 7890 1234 · Vikram Singh 4567 8901 2345");
