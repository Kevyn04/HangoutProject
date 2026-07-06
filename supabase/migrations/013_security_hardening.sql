-- ============================================================
-- Security hardening — closes gaps found in the 2026-07-05 audit.
-- Idempotent: drops + recreates policies so it corrects live drift
-- regardless of what was previously applied via the dashboard.
-- ============================================================

-- ── 0. notifications: track the acting user (rate limiting + provenance) ─────
alter table public.notifications add column if not exists actor_username text;
create index if not exists idx_notifications_actor
  on public.notifications (actor_username, created_at desc);

-- ── 1. push_token must never be readable by clients ──────────────────────────
-- Any authenticated user could SELECT other users' Expo push tokens and spam
-- their devices directly via the Expo API. Revoke column-level read; the
-- send-notification Edge Function reads it with the service role (bypasses grants).
revoke select (push_token) on public.profiles from anon, authenticated;
-- Users still need to write their own token (registerPushToken):
grant update (push_token) on public.profiles to authenticated;

-- ── 2. event_attendees: RSVP only as yourself ────────────────────────────────
drop policy if exists "attendees_insert" on public.event_attendees;
create policy "attendees_insert" on public.event_attendees
  for insert with check (username = my_username());

-- ── 3. event_messages: authored only as yourself, with a length cap ──────────
alter table public.event_messages enable row level security;
drop policy if exists "event_messages_select" on public.event_messages;
create policy "event_messages_select" on public.event_messages
  for select using (auth.uid() is not null);
drop policy if exists "event_messages_insert" on public.event_messages;
create policy "event_messages_insert" on public.event_messages
  for insert with check (username = my_username());
alter table public.event_messages drop constraint if exists event_messages_len;
alter table public.event_messages add constraint event_messages_len
  check (char_length(message) between 1 and 2000);

-- ── 4. discussions + replies: authored only as yourself, length caps ─────────
alter table public.discussions enable row level security;
drop policy if exists "discussions_select" on public.discussions;
create policy "discussions_select" on public.discussions
  for select using (auth.uid() is not null);
drop policy if exists "discussions_insert" on public.discussions;
create policy "discussions_insert" on public.discussions
  for insert with check (created_by = my_username());
drop policy if exists "discussions_delete" on public.discussions;
create policy "discussions_delete" on public.discussions
  for delete using (created_by = my_username());
alter table public.discussions drop constraint if exists discussions_len;
alter table public.discussions add constraint discussions_len
  check (char_length(title) between 1 and 200 and char_length(coalesce(body,'')) <= 5000);

alter table public.discussion_replies enable row level security;
drop policy if exists "discussion_replies_select" on public.discussion_replies;
create policy "discussion_replies_select" on public.discussion_replies
  for select using (auth.uid() is not null);
drop policy if exists "discussion_replies_insert" on public.discussion_replies;
create policy "discussion_replies_insert" on public.discussion_replies
  for insert with check (username = my_username());
alter table public.discussion_replies drop constraint if exists discussion_replies_len;
alter table public.discussion_replies add constraint discussion_replies_len
  check (char_length(content) between 1 and 2000);

-- ── 5. reports: file only as yourself; read only your own ────────────────────
-- (Admin review happens via the dashboard / service role, which bypasses RLS.)
alter table public.reports enable row level security;
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
  for insert with check (reporter_username = my_username());
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select using (reporter_username = my_username());
alter table public.reports drop constraint if exists reports_reason_len;
alter table public.reports add constraint reports_reason_len
  check (char_length(coalesce(reason,'')) <= 1000);

-- ── 6. blocked_users: manage + read only your own block list ─────────────────
alter table public.blocked_users enable row level security;
drop policy if exists "blocked_users_insert" on public.blocked_users;
create policy "blocked_users_insert" on public.blocked_users
  for insert with check (blocker = my_username());
drop policy if exists "blocked_users_select" on public.blocked_users;
create policy "blocked_users_select" on public.blocked_users
  for select using (blocker = my_username());
drop policy if exists "blocked_users_delete" on public.blocked_users;
create policy "blocked_users_delete" on public.blocked_users
  for delete using (blocker = my_username());

-- ── 7. Length caps on remaining free-text columns (anti-bloat) ───────────────
update public.profiles set bio = left(bio, 500) where char_length(coalesce(bio,'')) > 500;
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len
  check (char_length(coalesce(bio,'')) <= 500);

update public.user_ratings set reason = left(reason, 500) where char_length(coalesce(reason,'')) > 500;
alter table public.user_ratings drop constraint if exists user_ratings_reason_len;
alter table public.user_ratings add constraint user_ratings_reason_len
  check (char_length(coalesce(reason,'')) <= 500);
