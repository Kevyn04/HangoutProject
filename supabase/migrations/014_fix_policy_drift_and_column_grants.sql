-- ============================================================
-- Follow-up to 013. Two corrections found during live re-testing:
--   (a) Table-level SELECT supersedes column-level revokes, so revoking just
--       the push_token column did nothing while `authenticated` kept table
--       SELECT. Fix: revoke table SELECT, re-grant every column EXCEPT push_token.
--   (b) The drifted tables carried extra permissive policies (created via the
--       dashboard under unknown names). Postgres OR's permissive policies, so a
--       leftover loose policy bypassed the strict ones from 013. Fix: drop ALL
--       policies on those tables dynamically, then recreate only the correct set.
-- ============================================================

-- ── (a) profiles: hide push_token via per-column SELECT grant ────────────────
revoke select on public.profiles from anon, authenticated;
grant select (id, username, bio, avatar_color, profile_emoji, avatar_url,
              created_at, privacy_accepted_at)
  on public.profiles to anon, authenticated;
-- writing your own token still works (column-level UPDATE):
grant update (push_token, bio, avatar_color, profile_emoji, avatar_url) on public.profiles to authenticated;

-- ── (b) wipe drifted policies, recreate the intended set ─────────────────────
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('event_attendees','event_messages','discussions',
                        'discussion_replies','reports','blocked_users')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- event_attendees
create policy "attendees_select" on public.event_attendees for select using (true);
create policy "attendees_insert" on public.event_attendees for insert with check (username = my_username());
create policy "attendees_delete" on public.event_attendees for delete using (username = my_username());

-- event_messages
create policy "event_messages_select" on public.event_messages for select using (auth.uid() is not null);
create policy "event_messages_insert" on public.event_messages for insert with check (username = my_username());

-- discussions
create policy "discussions_select" on public.discussions for select using (auth.uid() is not null);
create policy "discussions_insert" on public.discussions for insert with check (created_by = my_username());
create policy "discussions_delete" on public.discussions for delete using (created_by = my_username());

-- discussion_replies
create policy "discussion_replies_select" on public.discussion_replies for select using (auth.uid() is not null);
create policy "discussion_replies_insert" on public.discussion_replies for insert with check (username = my_username());

-- reports  (file as yourself; read only your own — admin uses service role)
create policy "reports_insert" on public.reports for insert with check (reporter_username = my_username());
create policy "reports_select" on public.reports for select using (reporter_username = my_username());

-- blocked_users  (manage + read only your own list)
create policy "blocked_users_insert" on public.blocked_users for insert with check (blocker = my_username());
create policy "blocked_users_select" on public.blocked_users for select using (blocker = my_username());
create policy "blocked_users_delete" on public.blocked_users for delete using (blocker = my_username());

-- Force PostgREST to reload its cached column privileges immediately
notify pgrst, 'reload schema';
