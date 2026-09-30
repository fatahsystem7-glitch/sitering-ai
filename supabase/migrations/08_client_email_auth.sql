-- ─────────────────────────────────────────────────────────────────
-- SiteRing AI · Database Schema (Migration 08)
-- Email + password login on Supabase Auth.
--
-- New accounts created through the public onboarding form now get a
-- Supabase Auth user (email + password): the contractor chooses those
-- credentials on the signup form and is signed straight in afterwards.
--
-- Existing accounts are deliberately NOT touched. Their
-- owner_auth_user_id stays NULL and they keep signing in with their
-- Client ID exactly as before, so nobody is locked out. The Client ID
-- also remains the human-readable account reference for telephony,
-- support and audit.
--
-- Idempotent. Safe to re-run from the build pipeline.
-- ─────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════
-- 1 · Link a client account to its Supabase Auth user
-- ═════════════════════════════════════════════════════════════════
alter table public.clients
  add column if not exists owner_auth_user_id uuid references auth.users(id) on delete set null;

comment on column public.clients.owner_auth_user_id is
  'Supabase Auth (email + password) user that owns this account. NULL for legacy accounts, which continue to authenticate with their Client ID.';

-- One Auth user owns at most one account.
create unique index if not exists clients_owner_auth_user_id_uidx
  on public.clients (owner_auth_user_id)
  where owner_auth_user_id is not null;

-- Sign-in resolves the account from the Auth user id.
create index if not exists clients_owner_auth_user_idx
  on public.clients (owner_auth_user_id)
  where owner_auth_user_id is not null;

-- ═════════════════════════════════════════════════════════════════
-- 2 · The dashboard may read its own row as the authenticated user
-- ═════════════════════════════════════════════════════════════════
drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own"
  on public.clients for select
  to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "client_documents_select_own" on public.client_documents;
create policy "client_documents_select_own"
  on public.client_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_documents.client_id
        and c.owner_auth_user_id = auth.uid()
    )
  );

-- ═════════════════════════════════════════════════════════════════
-- 3 · Why there is no "claim your account by signing up again" path
-- ═════════════════════════════════════════════════════════════════
-- /api/onboarding is a PUBLIC, unauthenticated endpoint. Matching an
-- existing row on email alone and handing it to whoever submitted the
-- form would let anyone who knows a contractor's email address take
-- over that account — including its call logs and its Twilio number.
-- It would also overwrite their stored business details.
--
-- So legacy contractors keep their Client ID login, and moving an
-- account to email + password requires an explicit, emailed claim link
-- whose token only the real owner receives. That migration is a
-- separate, auditable step and is NOT performed by this migration.
