-- GemGrooves — The Studio session persistence + collaboration
--
-- One-time setup. Run this in the Supabase SQL Editor after creating a
-- Storage bucket named `studio-audio` (mark it "public" in the dashboard
-- for read access — the insert/update/delete policies below handle writes).
--
-- RLS is scoped per-session: a session's owner (owner_wallet) or an
-- accepted collaborator (studio_session_collaborators) can read/write it;
-- anyone else can, at most, see that a link-shared session (is_shared)
-- exists, enough to decide whether to join it. All of this depends on the
-- SIWE sign-in flow (api/_lib/siwe.ts) — auth.jwt()->>'sub' is only
-- populated once a client has exchanged a signed wallet message for a JWT.

create table if not exists studio_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null,
  name text not null default 'Untitled Session',
  bpm integer not null default 120,
  count_in_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists studio_tracks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references studio_sessions(id) on delete cascade,
  name text not null,
  storage_path text not null,
  duration_sec double precision not null,
  gain double precision not null default 1,
  muted boolean not null default false,
  solo boolean not null default false,
  offset_sec double precision not null default 0,
  looped boolean not null default false,
  -- Per-track FX (Studio Phase: effects chain). Null = use the app-side
  -- DEFAULT_TRACK_FX values (audioEngine.ts) — nullable rather than
  -- defaulted here so a track saved before this feature existed is
  -- unambiguously "never touched FX" rather than "explicitly flat/off".
  fx_eq_low real,
  fx_eq_mid real,
  fx_eq_high real,
  fx_comp_threshold real,
  fx_comp_ratio real,
  fx_reverb_wet real,
  -- Tempo-aware loop library. playback_rate = sessionBpm / loop's native
  -- bpm at the moment it was dropped in; source_loop_id just tags which
  -- built-in loop (lib/loopLibrary.ts) it came from, for display/debugging.
  playback_rate real not null default 1,
  source_loop_id text,
  created_at timestamptz not null default now()
);

-- Re-running this file against a database created before these features
-- needs this to backfill the columns (create table above only applies to
-- a fresh database).
alter table studio_tracks add column if not exists looped boolean not null default false;
alter table studio_tracks add column if not exists fx_eq_low real;
alter table studio_tracks add column if not exists fx_eq_mid real;
alter table studio_tracks add column if not exists fx_eq_high real;
alter table studio_tracks add column if not exists fx_comp_threshold real;
alter table studio_tracks add column if not exists fx_comp_ratio real;
alter table studio_tracks add column if not exists fx_reverb_wet real;
alter table studio_tracks add column if not exists playback_rate real not null default 1;
alter table studio_tracks add column if not exists source_loop_id text;

-- Studio Phase 3, part 2: link-based sharing. A session is only joinable
-- by a stranger with the link while this is true — the owner turns it on
-- explicitly via the "Share session" action.
alter table studio_sessions add column if not exists is_shared boolean not null default false;

create index if not exists studio_sessions_owner_wallet_idx on studio_sessions (owner_wallet);
create index if not exists studio_tracks_session_id_idx on studio_tracks (session_id);

-- Who else (besides the owner) can read/write a session. Joining is
-- self-service: a signed-in wallet adds itself once the owner has shared
-- the session (see policies below) — there is no email/approval step.
create table if not exists studio_session_collaborators (
  session_id uuid not null references studio_sessions(id) on delete cascade,
  wallet text not null,
  role text not null default 'editor',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (session_id, wallet)
);

create index if not exists studio_session_collaborators_wallet_idx
  on studio_session_collaborators (wallet);

alter table studio_sessions enable row level security;
alter table studio_tracks enable row level security;
alter table studio_session_collaborators enable row level security;

-- Helper functions for RLS: a plain `exists (select ... from studio_sessions
-- ...)` inline in another table's policy would itself be filtered by
-- studio_sessions' own RLS for the querying role, which breaks exactly the
-- cross-table checks these policies need (e.g. "is this session shared?"
-- must return true even for a wallet that isn't a member yet). SECURITY
-- DEFINER runs these as the function owner (the table owner, via the SQL
-- Editor), which bypasses RLS on the tables they read.
create or replace function public.studio_session_is_member(p_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from studio_sessions s
    where s.id = p_session_id
      and (
        s.owner_wallet = auth.jwt()->>'sub'
        or exists (
          select 1 from studio_session_collaborators c
          where c.session_id = s.id and c.wallet = auth.jwt()->>'sub'
        )
      )
  );
$$;

-- Used only by studio_sessions' OWN select/update policies. Unlike
-- studio_session_is_member (used by other tables to look sessions up by
-- id), this never re-queries studio_sessions itself — the row's own id/
-- owner_wallet are passed straight in. That distinction matters: Postgres
-- evaluates a SELECT policy on `insert ... returning` using the same
-- statement's snapshot, and a security-definer function that re-queries
-- the table currently being inserted into can miss the just-inserted row
-- under that snapshot — which surfaced as "insert own session" succeeding
-- but the chained .select() on it failing, during Phase A2 verification.
create or replace function public.studio_session_is_member_of(p_session_id uuid, p_owner_wallet text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_owner_wallet = auth.jwt()->>'sub'
    or exists (
      select 1 from studio_session_collaborators c
      where c.session_id = p_session_id and c.wallet = auth.jwt()->>'sub'
    );
$$;

create or replace function public.studio_session_is_shared(p_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_shared from studio_sessions where id = p_session_id), false);
$$;

-- storage.objects has no session_id column — paths are always
-- `<session_id>/<track_id>.<ext>` (see useSessionPersistence.ts), so the
-- session id is recovered from the path prefix. Wrapped in its own
-- exception-safe function so a malformed/unrelated object name can't crash
-- policy evaluation for the whole query — it just fails closed (null).
create or replace function public.storage_path_session_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

-- Postgres has no `create policy if not exists`, so drop-then-create is
-- what makes re-running this file against an already-set-up database safe.
-- Multiple `for select` policies on the same table are OR'd together, so
-- "member select" and "shared select" combine into "member OR shared".
drop policy if exists "open read" on studio_sessions;
drop policy if exists "open write" on studio_sessions;
drop policy if exists "insert own session" on studio_sessions;
create policy "insert own session" on studio_sessions
  for insert with check (owner_wallet = auth.jwt()->>'sub');
drop policy if exists "member select" on studio_sessions;
create policy "member select" on studio_sessions
  for select using (studio_session_is_member_of(id, owner_wallet));
drop policy if exists "shared select" on studio_sessions;
create policy "shared select" on studio_sessions
  for select using (is_shared = true);
drop policy if exists "member update" on studio_sessions;
create policy "member update" on studio_sessions
  for update
  using (studio_session_is_member_of(id, owner_wallet))
  with check (studio_session_is_member_of(id, owner_wallet));
drop policy if exists "owner delete" on studio_sessions;
create policy "owner delete" on studio_sessions
  for delete using (owner_wallet = auth.jwt()->>'sub');

drop policy if exists "open read" on studio_tracks;
drop policy if exists "open write" on studio_tracks;
drop policy if exists "member read" on studio_tracks;
create policy "member read" on studio_tracks
  for select using (studio_session_is_member(session_id));
drop policy if exists "member write" on studio_tracks;
create policy "member write" on studio_tracks
  for all using (studio_session_is_member(session_id)) with check (studio_session_is_member(session_id));

-- Same same-table-in-RETURNING pitfall as above applies here too:
-- studio_session_is_member's collaborator check re-queries
-- studio_session_collaborators itself, so joinSession()'s insert into this
-- table must NOT chain .select() (it doesn't — see useSessionPersistence.ts).
drop policy if exists "self join shared session" on studio_session_collaborators;
create policy "self join shared session" on studio_session_collaborators
  for insert with check (
    wallet = auth.jwt()->>'sub' and studio_session_is_shared(session_id)
  );
drop policy if exists "member read collaborators" on studio_session_collaborators;
create policy "member read collaborators" on studio_session_collaborators
  for select using (studio_session_is_member(session_id));
drop policy if exists "owner remove collaborator" on studio_session_collaborators;
create policy "owner remove collaborator" on studio_session_collaborators
  for delete using (
    exists (select 1 from studio_sessions s where s.id = session_id and s.owner_wallet = auth.jwt()->>'sub')
  );

-- Storage: the bucket's "Public" toggle only covers the public URL read
-- route — the regular object API (used internally by upsert's existence
-- check, among other things) still goes through RLS, so an explicit
-- select policy is needed too, not just insert/update/delete.
drop policy if exists "open select studio-audio" on storage.objects;
drop policy if exists "open insert studio-audio" on storage.objects;
drop policy if exists "open update studio-audio" on storage.objects;
drop policy if exists "open delete studio-audio" on storage.objects;
drop policy if exists "member select studio-audio" on storage.objects;
create policy "member select studio-audio" on storage.objects
  for select using (
    bucket_id = 'studio-audio' and studio_session_is_member(storage_path_session_id(name))
  );
drop policy if exists "member insert studio-audio" on storage.objects;
create policy "member insert studio-audio" on storage.objects
  for insert with check (
    bucket_id = 'studio-audio' and studio_session_is_member(storage_path_session_id(name))
  );
drop policy if exists "member update studio-audio" on storage.objects;
create policy "member update studio-audio" on storage.objects
  for update using (
    bucket_id = 'studio-audio' and studio_session_is_member(storage_path_session_id(name))
  );
drop policy if exists "member delete studio-audio" on storage.objects;
create policy "member delete studio-audio" on storage.objects
  for delete using (
    bucket_id = 'studio-audio' and studio_session_is_member(storage_path_session_id(name))
  );

-- Realtime (Postgres Changes) delivery is also governed by these same
-- policies, evaluated using whatever JWT the client attached to its
-- websocket connection (see src/lib/supabase.ts's realtime.setAuth call) —
-- so collaborators only ever receive change events for sessions they're
-- actually a member of.
--
-- New Supabase projects start with an empty supabase_realtime publication —
-- a table emits no Postgres Changes events at all until added to it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'studio_sessions'
  ) then
    alter publication supabase_realtime add table studio_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'studio_tracks'
  ) then
    alter publication supabase_realtime add table studio_tracks;
  end if;
end $$;

-- Sign-in-with-Ethereum nonces (Studio Phase 3, part 1: collaborator
-- auth). Single-use, short-lived, and only ever touched by the
-- service-role key from api/_lib/siwe.ts — RLS is enabled with
-- deliberately zero policies so no anon/authenticated client can read or
-- write this table directly.
create table if not exists siwe_nonces (
  nonce text primary key,
  wallet text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table siwe_nonces enable row level security;
