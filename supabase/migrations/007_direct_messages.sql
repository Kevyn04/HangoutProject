create table direct_messages (
  id            bigserial primary key,
  sender_username    text not null references profiles(username),
  recipient_username text not null references profiles(username),
  content       text not null check (char_length(content) between 1 and 1000),
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_dm_sender   on direct_messages(sender_username,    created_at desc);
create index idx_dm_recipient on direct_messages(recipient_username, created_at desc);

alter table direct_messages enable row level security;

create policy "dm_select" on direct_messages
  for select using (sender_username = my_username() or recipient_username = my_username());

create policy "dm_insert" on direct_messages
  for insert with check (sender_username = my_username());

create policy "dm_update" on direct_messages
  for update using (recipient_username = my_username());
