-- ═══════════════════════════════════════════════════════════════════════════
-- Security Advisory Fixes — pbes-calculator
-- Applied: 2026-04-16
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fixes addressed:
--   ERROR  admin_assessments view → add security_invoker = on
--   WARN   handle_new_user function → add SET search_path = public
--
-- Intentional design (no code change needed):
--   WARN   org_members INSERT policy allows all  → anyone with join code can join
--   WARN   peer_invites UPDATE policy is open    → peers mark invite done without login
-- ═══════════════════════════════════════════════════════════════════════════


-- ── FIX 1: handle_new_user — pin search_path to prevent injection ─────────
-- Without SET search_path, a malicious user could create a 'profiles' table
-- in a different schema and redirect the insert. Pinning to 'public' closes
-- that vector.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;


-- ── FIX 2: admin_assessments view — use security_invoker = on ────────────
-- SECURITY DEFINER views bypass RLS for all callers, which is the Supabase
-- advisory ERROR. Adding security_invoker = on makes the view respect the
-- caller's RLS context. The service_role key bypasses RLS anyway, so admin
-- queries are unaffected. Authenticated users will still only see rows
-- permitted by their own RLS policies.
create or replace view public.admin_assessments
  with (security_invoker = on)
as
  select
    a.*,
    p.name as registered_name
  from public.assessments a
  left join public.profiles p on p.id = a.user_id
  order by a.created_at desc;
