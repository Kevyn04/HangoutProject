-- ============================================================
-- The Hangout — Supabase Schema
-- Paste this into the Supabase SQL Editor and click Run
-- ============================================================

-- ── Profiles (linked to Supabase Auth) ──────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  bio text default '',
  avatar_color text default '#7c3aed',
  profile_emoji text default '',
  push_token text,
  created_at timestamptz default now()
);

-- ── Bubbles ──────────────────────────────────────────────────
create table public.bubbles (
  id bigserial primary key,
  name text not null,
  description text,
  created_by text not null,
  type text,
  meet_time text,
  max_members int,
  lat double precision,
  lng double precision,
  is_secret boolean default false,
  reveal_at text,
  created_at timestamptz default now()
);

-- ── Bubble member detail ─────────────────────────────────────
create table public.bubble_member_detail (
  id bigserial primary key,
  bubble_id bigint references public.bubbles(id) on delete cascade not null,
  username text not null,
  lat double precision,
  lng double precision,
  share_location boolean default false,
  channel_id int default 1,
  created_at timestamptz default now(),
  unique(bubble_id, username)
);

-- ── Chat messages ────────────────────────────────────────────
create table public.chat_messages (
  id bigserial primary key,
  bubble_id bigint not null,
  channel_id int default 1,
  username text not null,
  message text not null,
  created_at timestamptz default now()
);

-- ── Events ───────────────────────────────────────────────────
create table public.events (
  id bigserial primary key,
  title text not null,
  location text,
  time text,
  created_by text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz default now()
);

-- ── Event attendees ──────────────────────────────────────────
create table public.event_attendees (
  id bigserial primary key,
  event_id bigint references public.events(id) on delete cascade not null,
  username text not null,
  unique(event_id, username)
);

-- ── Pages ────────────────────────────────────────────────────
create table public.pages (
  id bigserial primary key,
  name text not null,
  description text,
  category text,
  created_by text not null,
  avatar_color text default '#7c3aed',
  created_at timestamptz default now()
);

-- ── Page followers ───────────────────────────────────────────
create table public.page_followers (
  id bigserial primary key,
  page_id bigint references public.pages(id) on delete cascade not null,
  username text not null,
  unique(page_id, username)
);

-- ── User follows ─────────────────────────────────────────────
create table public.user_follows (
  id bigserial primary key,
  follower text not null,
  followee text not null,
  created_at timestamptz default now(),
  unique(follower, followee)
);

-- ── User ratings ─────────────────────────────────────────────
create table public.user_ratings (
  id bigserial primary key,
  rated_username text not null,
  rater_username text not null,
  rating int check(rating between 1 and 5),
  reason text,
  bubble_id bigint,
  created_at timestamptz default now()
);

-- ============================================================
-- Helper: get current user's username from auth session
-- ============================================================
create or replace function public.my_username()
returns text language sql security definer stable as $$
  select username from public.profiles where id = auth.uid()
$$;

-- ============================================================
-- Trigger: auto-create profile row on new auth user
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.bubbles enable row level security;
alter table public.bubble_member_detail enable row level security;
alter table public.chat_messages enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.pages enable row level security;
alter table public.page_followers enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_ratings enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update using (id = auth.uid());

-- Bubbles
create policy "bubbles_select" on public.bubbles for select using (true);
create policy "bubbles_insert" on public.bubbles for insert with check (auth.uid() is not null);
create policy "bubbles_update" on public.bubbles for update using (created_by = my_username());
create policy "bubbles_delete" on public.bubbles for delete using (created_by = my_username());

-- Bubble member detail
create policy "bmd_select" on public.bubble_member_detail for select using (auth.uid() is not null);
create policy "bmd_insert" on public.bubble_member_detail for insert with check (auth.uid() is not null);
create policy "bmd_update" on public.bubble_member_detail for update using (username = my_username());
create policy "bmd_delete" on public.bubble_member_detail for delete using (
  username = my_username() or
  exists (select 1 from public.bubbles where id = bubble_id and created_by = my_username())
);

-- Chat messages
create policy "chat_select" on public.chat_messages for select using (auth.uid() is not null);
create policy "chat_insert" on public.chat_messages for insert with check (auth.uid() is not null);

-- Events
create policy "events_select" on public.events for select using (true);
create policy "events_insert" on public.events for insert with check (auth.uid() is not null);
create policy "events_update" on public.events for update using (created_by = my_username());
create policy "events_delete" on public.events for delete using (created_by = my_username());

-- Event attendees
create policy "attendees_select" on public.event_attendees for select using (true);
create policy "attendees_insert" on public.event_attendees for insert with check (auth.uid() is not null);
create policy "attendees_delete" on public.event_attendees for delete using (username = my_username());

-- Pages
create policy "pages_select" on public.pages for select using (true);
create policy "pages_insert" on public.pages for insert with check (auth.uid() is not null);
create policy "pages_update" on public.pages for update using (created_by = my_username());
create policy "pages_delete" on public.pages for delete using (created_by = my_username());

-- Page followers
create policy "page_followers_select" on public.page_followers for select using (true);
create policy "page_followers_insert" on public.page_followers for insert with check (auth.uid() is not null);
create policy "page_followers_delete" on public.page_followers for delete using (username = my_username());

-- User follows
create policy "follows_select" on public.user_follows for select using (auth.uid() is not null);
create policy "follows_insert" on public.user_follows for insert with check (follower = my_username());
create policy "follows_delete" on public.user_follows for delete using (follower = my_username());

-- User ratings
create policy "ratings_select" on public.user_ratings for select using (auth.uid() is not null);
create policy "ratings_insert" on public.user_ratings for insert with check (rater_username = my_username());

-- ============================================================
-- Enable Realtime for chat and member presence
-- ============================================================
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.bubble_member_detail;
