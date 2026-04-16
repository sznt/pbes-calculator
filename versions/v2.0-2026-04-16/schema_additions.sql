-- ═══════════════════════════════════════════════════════════════════════════
-- PBES Schema Additions — run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add 'source' column to assessments (marks dissertation seed data)
alter table public.assessments
  add column if not exists source text default null;

comment on column public.assessments.source is
  'Data source: null = live user, dissertation_2023 = seeded from PhD study';

create index if not exists assessments_source_idx on public.assessments(source);

-- 2. Individual peer invitations (user-to-user, outside org mode)
create table if not exists public.peer_invites (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid references auth.users on delete cascade,
  from_name     text,
  from_email    text,
  to_email      text not null,
  peer_url      text not null,
  email_sent    boolean default false,
  email_sent_at timestamptz,
  completed     boolean default false,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

create index if not exists peer_invites_from_user_idx on public.peer_invites(from_user_id);
create index if not exists peer_invites_to_email_idx  on public.peer_invites(to_email);

alter table public.peer_invites enable row level security;

-- Users can manage their own sent invitations
create policy "peer_invites_own" on public.peer_invites
  for all using (auth.uid() = from_user_id);

-- Allow anonymous read to mark completion (when peer submits their assessment)
create policy "peer_invites_complete" on public.peer_invites
  for update using (true)
  with check (completed = true);

grant all on public.peer_invites to authenticated;
grant select, update on public.peer_invites to anon;

-- 3. Benchmark cache (precomputed averages by industry/seniority — refreshed nightly)
create table if not exists public.benchmark_cache (
  id          uuid primary key default gen_random_uuid(),
  group_key   text not null,   -- e.g. 'industry:Technology' or 'seniority:Manager' or 'all'
  n           int,
  avg_ba      float,
  avg_bd      float,
  avg_br      float,
  avg_pbe     float,
  computed_at timestamptz default now(),
  unique(group_key)
);

alter table public.benchmark_cache enable row level security;
create policy "benchmark_public_read" on public.benchmark_cache for select using (true);
grant select on public.benchmark_cache to anon, authenticated;
