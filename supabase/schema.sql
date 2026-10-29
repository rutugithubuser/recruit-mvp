-- HireSpeak database schema (Supabase / Postgres). Run once in the Supabase SQL editor.
-- Enable "automatic RLS" on the project: the browser never reads tables directly;
-- all data access goes through server routes using the service_role key.

create type user_role as enum ('candidate','employer','recruiter');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null,
  full_name text,
  phone text,
  created_at timestamptz default now()
);

create table recruitment_firms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  industry text,
  location text,
  size text,
  score int not null default 100,
  created_at timestamptz default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  aadhaar_hash text unique,      -- salted SHA-256, never the raw number
  aadhaar_last4 text,
  location text,
  current_title text,
  experience_years numeric,
  skills text[] default '{}',
  industries text[] default '{}',
  expected_salary int,
  score int not null default 100,
  created_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  posted_by uuid references profiles(id),
  title text not null,
  description text,
  location text,
  salary_min int,
  salary_max int,
  experience_min numeric,
  skills text[] default '{}',
  industry text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);

create table resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  source text check (source in ('voice','text','upload','whatsapp')),
  file_path text,
  content text,
  parsed jsonb,
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete cascade,
  resume_id uuid references resumes(id),
  status text not null default 'applied'
    check (status in ('applied','shortlisted','offered','rejected','withdrawn')),
  match_score int,
  created_at timestamptz default now(),
  unique (job_id, candidate_id)
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id),
  job_id uuid references jobs(id),
  candidate_id uuid references candidates(id),
  company_id uuid references companies(id),
  content text,
  salary int,
  joining_date date,
  status text not null default 'sent'
    check (status in ('sent','accepted','declined','joined','no_show','revoked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table acceptances (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid unique references offers(id) on delete cascade,
  candidate_id uuid references candidates(id),
  content text,
  created_at timestamptz default now()
);

create table employments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id),
  candidate_id uuid references candidates(id),
  company_id uuid references companies(id),
  start_date date,
  end_date date,
  status text not null default 'active'
    check (status in ('active','resigned','left_without_notice','terminated','fired_without_notice')),
  created_at timestamptz default now()
);

create table score_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('candidate','company')),
  entity_id uuid not null,
  event_type text not null
    check (event_type in ('no_join','offer_revoked','left_without_notice','fired_without_notice')),
  delta int not null default -5,
  related_offer_id uuid references offers(id),
  reported_by uuid references profiles(id),
  status text not null default 'pending'
    check (status in ('pending','confirmed','disputed','rejected')),
  dispute_reason text,
  dispute_deadline timestamptz default now() + interval '3 days',
  created_at timestamptz default now()
);

create table agent_logs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  user_id uuid references profiles(id),
  input jsonb,
  output jsonb,
  created_at timestamptz default now()
);

-- Scores change only when a report is CONFIRMED (after the dispute window, or self-reported).
create or replace function apply_score_event() returns trigger
language plpgsql as $$
begin
  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    if new.entity_type = 'candidate' then
      update candidates set score = greatest(score + new.delta, 0) where id = new.entity_id;
    else
      update companies set score = greatest(score + new.delta, 0) where id = new.entity_id;
    end if;
  end if;
  return new;
end; $$;

create trigger trg_apply_score
after insert or update on score_events
for each row execute function apply_score_event();

insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false);
