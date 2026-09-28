-- Kargo Hiring Tool — initial schema
-- Single-user internal tool: every table is locked to the one authenticated user via RLS.

create extension if not exists "pgcrypto";

create type role_target as enum ('PM', 'SPM', 'unclear');
create type candidate_status as enum ('pending_score', 'scored');
create type score_band as enum ('advance', 'hold', 'decline');
create type email_kind as enum ('invite', 'decline');
create type email_status as enum ('draft', 'sent');
create type added_via_type as enum ('seed', 'manual_add');

-- App-wide config / reference text (e.g. the rubric, loaded once at seed time and
-- read from here at runtime so there is exactly one source of truth in production).
create table app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  storage_path text, -- path in the `resumes` storage bucket
  name text,
  email text,
  phone text,
  role_target role_target not null default 'unclear',
  tagging_rationale text, -- one-line reason when role_target was Gemini-classified rather than filename-derived
  raw_text text not null, -- full extracted text, private, never sent to the AI scoring step
  clean_text text not null, -- PII-stripped text, what Gemini actually sees
  roles_held jsonb not null default '[]',
  years_experience numeric,
  achievement_bullets jsonb not null default '[]',
  content_hash text not null,
  is_duplicate_of uuid references candidates(id),
  status candidate_status not null default 'pending_score',
  added_via added_via_type not null default 'manual_add',
  interview_notes text,
  created_at timestamptz not null default now()
);

create index candidates_content_hash_idx on candidates(content_hash);
create index candidates_role_target_idx on candidates(role_target);

create table scores (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  criterion_a int not null,
  criterion_b int not null,
  criterion_c int not null,
  criterion_d int not null,
  criterion_e int not null,
  criterion_f int not null,
  total int not null,
  gate_triggered boolean not null default false,
  band score_band not null,
  rationale text not null,
  evidence jsonb not null default '{}', -- { a: "quote", b: "quote", ... }
  confidence_flags jsonb not null default '{}', -- { a: true/false, ... } true = "thin evidence"
  probe_questions jsonb not null default '[]',
  model_version text not null,
  scored_at timestamptz not null default now(),
  unique (candidate_id)
);

-- Calibration reference set: the 8 known past hires. Never rescored as a live
-- candidate, never shown in the main shortlist — only on /calibration.
create table hires (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  name text not null,
  is_pm_hire boolean not null default false,
  actual_outcome text not null, -- e.g. "Exceeds", "Meets", "Below"
  raw_text text not null,
  clean_text text not null,
  created_at timestamptz not null default now()
);

create table hire_scores (
  id uuid primary key default gen_random_uuid(),
  hire_id uuid not null references hires(id) on delete cascade,
  criterion_a int not null,
  criterion_b int not null,
  criterion_c int not null,
  criterion_d int not null,
  criterion_e int not null,
  criterion_f int not null,
  total int not null,
  gate_triggered boolean not null default false,
  band score_band not null,
  rationale text not null,
  evidence jsonb not null default '{}',
  confidence_flags jsonb not null default '{}',
  probe_questions jsonb not null default '[]',
  model_version text not null,
  scored_at timestamptz not null default now(),
  unique (hire_id)
);

create table email_drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  kind email_kind not null,
  subject text not null,
  body text not null,
  status email_status not null default 'draft',
  sent_at timestamptz,
  resend_message_id text,
  created_at timestamptz not null default now()
);

create index email_drafts_candidate_idx on email_drafts(candidate_id);

-- Row Level Security: this is a single-operator internal tool. Every table is
-- readable/writable only by an authenticated user (there is exactly one account).
alter table app_config enable row level security;
alter table candidates enable row level security;
alter table scores enable row level security;
alter table hires enable row level security;
alter table hire_scores enable row level security;
alter table email_drafts enable row level security;

create policy "authenticated full access" on app_config for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on candidates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on scores for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on hires for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on hire_scores for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on email_drafts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
