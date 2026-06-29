-- Tighten insert policies: previously only checked auth.uid() is not null,
-- meaning an authenticated user could spoof another username as creator/attendee.
-- Now each insert must match the authenticated user's own username or uid.

-- Bubbles: creator must be the authenticated user
drop policy if exists "bubbles_insert" on public.bubbles;
create policy "bubbles_insert" on public.bubbles
  for insert with check (created_by = my_username());

-- Events: creator must be the authenticated user
drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events
  for insert with check (created_by = my_username());

-- Pages: creator must be the authenticated user
drop policy if exists "pages_insert" on public.pages;
create policy "pages_insert" on public.pages
  for insert with check (created_by = my_username());

-- Event attendees: you can only RSVP as yourself
drop policy if exists "attendees_insert" on public.event_attendees;
create policy "attendees_insert" on public.event_attendees
  for insert with check (username = my_username());

-- Bubble member detail: you can only join a bubble as yourself
drop policy if exists "bmd_insert" on public.bubble_member_detail;
create policy "bmd_insert" on public.bubble_member_detail
  for insert with check (username = my_username());

-- Chat messages: you can only send as yourself
drop policy if exists "chat_insert" on public.chat_messages;
create policy "chat_insert" on public.chat_messages
  for insert with check (username = my_username());
