-- ============================================================
-- Blocking applies to DMs.
--
-- Previously a blocked user could keep sending you direct messages — the
-- block only hid them in bubble members/chat on the client. Now a DM can't
-- be inserted when either side has blocked the other.
--
-- blocked_users SELECT is restricted to the blocker (013), so a policy
-- subquery can't see whether the *recipient* blocked the sender. can_dm()
-- is SECURITY DEFINER to read across that, but it only ever answers about
-- the caller and one recipient — it can't be used to probe block
-- relationships between other users.
-- ============================================================

create or replace function public.can_dm(recipient text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.blocked_users
    where (blocker = my_username() and blocked = recipient)
       or (blocker = recipient and blocked = my_username())
  );
$$;

revoke execute on function public.can_dm(text) from public, anon;
grant execute on function public.can_dm(text) to authenticated;

drop policy if exists "dm_insert" on public.direct_messages;
create policy "dm_insert" on public.direct_messages
  for insert with check (
    sender_username = my_username()
    and public.can_dm(recipient_username)
  );
