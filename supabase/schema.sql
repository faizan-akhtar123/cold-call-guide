-- Cold call guide: Supabase schema
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create extension if not exists "pgcrypto";

-- One row per call.
create table if not exists public.calls (
  id               uuid primary key default gen_random_uuid(),
  prospect_name    text not null,
  prospect_role    text,
  company          text,
  caller           text,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  stage_reached    smallint not null default 1 check (stage_reached between 1 and 8),
  outcome          text,          -- what the caller logged
  next_step        text,          -- the one concrete thing agreed, if any
  summary          text,          -- one-line summary drafted by the LLM
  llm_outcome      text,          -- outcome the LLM reads from the call
  llm_reason       text,          -- why the LLM picked that outcome
  outcome_mismatch boolean not null default false
);

-- One row per stage the caller recorded on a call.
create table if not exists public.stage_results (
  id             bigint generated always as identity primary key,
  call_id        uuid not null references public.calls(id) on delete cascade,
  stage          smallint not null check (stage between 1 and 8),
  happened       text[] not null default '{}',  -- the taps
  prospect_words text,                          -- the prospect's own words
  created_at     timestamptz not null default now(),
  unique (call_id, stage)
);

create index if not exists calls_started_at_idx on public.calls (started_at desc);
create index if not exists stage_results_call_idx on public.stage_results (call_id);

-- Row level security on, with no policies: the browser cannot read or write
-- these tables directly. Only the backend, which holds the service role key,
-- can reach them.
alter table public.calls enable row level security;
alter table public.stage_results enable row level security;
