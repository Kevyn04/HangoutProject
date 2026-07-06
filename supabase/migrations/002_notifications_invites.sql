-- ── Notifications ────────────────────────────────────────────────────────────

create table if not exists notifications (
  id          bigserial primary key,
  recipient_username text not null,
  type        text not null,
  title       text not null,
  body        text not null,
  data        jsonb default '{}'::jsonb,
  read        boolean default false,
  created_at  timestamptz default now()
);

create index if not exists idx_notifications_recipient
  on notifications(recipient_username, created_at desc);

alter table notifications enable row level security;

-- Users can read their own notifications
create policy "users_read_own_notifications" on notifications
  for select
  using (recipient_username = (select username from profiles where id = auth.uid()));

-- Service role (Edge Function) can insert/update notifications
create policy "service_role_manage_notifications" on notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── Invites ───────────────────────────────────────────────────────────────────

create table if not exists invites (
  id                bigserial primary key,
  inviter_username  text not null,
  invitee_username  text not null,
  bubble_id         bigint references bubbles(id) on delete cascade,
  event_id          bigint references events(id) on delete cascade,
  status            text default 'pending',
  created_at        timestamptz default now()
);

create index if not exists idx_invites_invitee
  on invites(invitee_username, created_at desc);

alter table invites enable row level security;

-- Inviter can create invites
create policy "users_create_invites" on invites
  for insert
  with check (inviter_username = (select username from profiles where id = auth.uid()));

-- Invitee can read and update their own invites
create policy "invitee_read_own_invites" on invites
  for select
  using (invitee_username = (select username from profiles where id = auth.uid()));

create policy "invitee_update_own_invites" on invites
  for update
  using (invitee_username = (select username from profiles where id = auth.uid()));

-- Inviter can also read their sent invites
create policy "inviter_read_sent_invites" on invites
  for select
  using (inviter_username = (select username from profiles where id = auth.uid()));
