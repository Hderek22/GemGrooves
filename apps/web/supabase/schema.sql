-- GemGrooves — The Studio session persistence
--
-- One-time setup. Run this in the Supabase SQL Editor after creating a
-- Storage bucket named `studio-audio` (mark it "public" in the dashboard
-- for read access — the insert/update/delete policies below handle writes).
--
-- Access control is intentionally open for this phase (no per-wallet
-- enforcement) — draft session data, not funds, and real authorization
-- becomes necessary once Phase 3 (collaborator invites) puts other
-- people's data at stake. See the Studio Phase 2 plan for the reasoning.

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
  created_at timestamptz not null default now()
);

create index if not exists studio_sessions_owner_wallet_idx on studio_sessions (owner_wallet);
create index if not exists studio_tracks_session_id_idx on studio_tracks (session_id);

alter table studio_sessions enable row level security;
alter table studio_tracks enable row level security;

create policy "open read" on studio_sessions for select using (true);
create policy "open write" on studio_sessions for all using (true) with check (true);
create policy "open read" on studio_tracks for select using (true);
create policy "open write" on studio_tracks for all using (true) with check (true);

-- Storage: the bucket's "Public" toggle only covers the public URL read
-- route — the regular object API (used internally by upsert's existence
-- check, among other things) still goes through RLS, so an explicit
-- select policy is needed too, not just insert/update/delete.
create policy "open select studio-audio" on storage.objects
  for select using (bucket_id = 'studio-audio');
create policy "open insert studio-audio" on storage.objects
  for insert with check (bucket_id = 'studio-audio');
create policy "open update studio-audio" on storage.objects
  for update using (bucket_id = 'studio-audio');
create policy "open delete studio-audio" on storage.objects
  for delete using (bucket_id = 'studio-audio');
