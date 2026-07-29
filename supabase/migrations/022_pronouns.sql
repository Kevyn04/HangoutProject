-- Pronouns on profile: she/her, he/him, they/them, or prefer not to say.
-- Nullable (unset) so existing users aren't forced to pick one.
-- profiles SELECT is column-granted only (see 014) so new columns are hidden
-- by default — must explicitly grant select here for it to be readable.

alter table public.profiles
  add column if not exists pronouns text;

alter table public.profiles
  drop constraint if exists profiles_pronouns_check;
alter table public.profiles
  add constraint profiles_pronouns_check
  check (pronouns is null or pronouns in ('she/her', 'he/him', 'they/them', 'prefer_not_to_say'));

grant select (pronouns) on public.profiles to anon, authenticated;

notify pgrst, 'reload schema';
