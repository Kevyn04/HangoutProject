-- Server-side event reminders: scanned every minute by the
-- send-event-reminders Edge Function (scheduled via pg_cron in 010_schedule_event_reminders.sql)

create table event_reminders (
  id          bigserial primary key,
  event_id    bigint not null references events(id) on delete cascade,
  username    text not null references profiles(username),
  remind_at   timestamptz not null,
  sent        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (event_id, username)
);

-- partial index so the every-minute due-reminder scan stays cheap
create index idx_event_reminders_due on event_reminders(remind_at) where sent = false;

alter table event_reminders enable row level security;

create policy "reminders_select" on event_reminders
  for select using (username = my_username());

create policy "reminders_insert" on event_reminders
  for insert with check (username = my_username());

create policy "reminders_delete" on event_reminders
  for delete using (username = my_username());
