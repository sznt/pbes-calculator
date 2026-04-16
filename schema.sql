-- ═══════════════════════════════════════════════════════════════════════════
-- Personal Brand Equity Calculator — Supabase Schema
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ── USER PROFILES ─────────────────────────────────────────────────────────────
-- Extends Supabase Auth with display name. Auto-created on registration.
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  name         text,
  created_at   timestamptz default now()
);

-- Auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── ASSESSMENTS ───────────────────────────────────────────────────────────────
create table if not exists public.assessments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users on delete cascade,
  -- Profile
  name           text,
  title          text,
  industry       text,
  employment     text,
  seniority      text,
  linkedin       text,
  -- Scores
  ba             float not null,
  bd             float not null,
  br             float not null,
  bi             float,
  pbe_w          float,
  pbe_r          float,
  archetype_key  text,
  -- Peer rating metadata
  is_peer        boolean default false,
  rater_name     text,
  peer_for       text,
  -- Raw answers (optional, for future analysis)
  answers        jsonb,
  -- Timestamps
  created_at     timestamptz default now()
);

create index if not exists assessments_user_id_idx on public.assessments(user_id);
create index if not exists assessments_created_at_idx on public.assessments(created_at desc);
create index if not exists assessments_archetype_idx on public.assessments(archetype_key);
create index if not exists assessments_industry_idx on public.assessments(industry);


-- ── ORGANIZATIONS ─────────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  industry     text,
  admin_id     uuid references auth.users on delete set null,
  admin_email  text,
  join_code    text unique not null,
  member_count int default 1,
  created_at   timestamptz default now()
);

create index if not exists organizations_join_code_idx on public.organizations(join_code);


-- ── ORG MEMBERS ───────────────────────────────────────────────────────────────
create table if not exists public.org_members (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references public.organizations on delete cascade,
  user_id         uuid references auth.users on delete cascade,
  name            text,
  email           text,
  role            text default 'Member',
  is_admin        boolean default false,
  has_assessment  boolean default false,
  -- Latest assessment snapshot (denormalized for dashboard speed)
  ba              float,
  bd              float,
  br              float,
  pbe_w           float,
  archetype_key   text,
  assessment_date text,
  joined_at       timestamptz default now(),
  unique(org_id, email)
);

create index if not exists org_members_org_id_idx on public.org_members(org_id);
create index if not exists org_members_user_id_idx on public.org_members(user_id);


-- ── PEER ASSIGNMENTS ──────────────────────────────────────────────────────────
create table if not exists public.peer_assignments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.organizations on delete cascade,
  rater_email  text not null,
  target_email text not null,
  rater_name   text,
  target_name  text,
  completed    boolean default false,
  created_at   timestamptz default now(),
  unique(org_id, rater_email, target_email)
);


-- ── PEER RATINGS ──────────────────────────────────────────────────────────────
create table if not exists public.peer_ratings (
  id             uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users on delete cascade,
  target_email   text,
  rater_name     text,
  assessment_id  uuid references public.assessments on delete cascade,
  ba             float,
  bd             float,
  br             float,
  pbe_w          float,
  archetype_key  text,
  created_at     timestamptz default now()
);

create index if not exists peer_ratings_target_idx on public.peer_ratings(target_user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Every user can only read/write their own data.
-- Super admin bypasses RLS using service_role key (server-side only).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles         enable row level security;
alter table public.assessments      enable row level security;
alter table public.organizations    enable row level security;
alter table public.org_members      enable row level security;
alter table public.peer_assignments enable row level security;
alter table public.peer_ratings     enable row level security;

-- Profiles: users manage their own
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

-- Assessments: users manage their own; anonymous read is public (for admin intelligence)
create policy "assessments_own" on public.assessments
  for all using (auth.uid() = user_id);

create policy "assessments_public_read" on public.assessments
  for select using (true);   -- Allow anonymous aggregate reads for intelligence dashboard

-- Organizations: anyone can read; admin manages
create policy "orgs_read" on public.organizations
  for select using (true);

create policy "orgs_admin_write" on public.organizations
  for all using (auth.uid() = admin_id);

-- Org members: org members can read their org; admin writes
create policy "org_members_read" on public.org_members
  for select using (
    org_id in (select id from public.organizations where admin_id = auth.uid())
    or user_id = auth.uid()
    or email = (select email from auth.users where id = auth.uid())
  );

create policy "org_members_write" on public.org_members
  for insert with check (true);  -- Allow self-join

create policy "org_members_admin_update" on public.org_members
  for update using (
    org_id in (select id from public.organizations where admin_id = auth.uid())
    or user_id = auth.uid()
  );

-- Peer assignments: org admin and assigned users
create policy "peer_assignments_read" on public.peer_assignments
  for select using (
    org_id in (select id from public.organizations where admin_id = auth.uid())
    or rater_email = (select email from auth.users where id = auth.uid())
  );

create policy "peer_assignments_write" on public.peer_assignments
  for all using (
    org_id in (select id from public.organizations where admin_id = auth.uid())
  );

-- Peer ratings: target user reads their own ratings
create policy "peer_ratings_own" on public.peer_ratings
  for select using (target_user_id = auth.uid());

create policy "peer_ratings_insert" on public.peer_ratings
  for insert with check (true);  -- Anyone can submit a peer rating


-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN VIEW (reads all assessments — used with service_role key only)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace view public.admin_assessments as
  select
    a.*,
    p.name as registered_name
  from public.assessments a
  left join public.profiles p on p.id = a.user_id
  order by a.created_at desc;

-- Grant anon/authenticated read on public assessments table (for intelligence dashboard aggregates)
grant select on public.assessments to anon, authenticated;
grant all on public.profiles to authenticated;
grant all on public.organizations to authenticated;
grant all on public.org_members to authenticated;
grant all on public.peer_assignments to authenticated;
grant all on public.peer_ratings to authenticated;
