-- ============================================================
-- Enforce username format at the database level.
--
-- The client filters usernames to [a-z0-9_] (min 3 chars), but that is
-- client-side only — a caller using the public anon key directly could set a
-- username containing PostgREST syntax characters ( , . ( ) % _ ), which are
-- interpolated into .or() filters in the DM queries. RLS still gates the rows,
-- so this is defense-in-depth, but the DB should be the source of truth.
--
-- Added NOT VALID so any pre-existing rows are left untouched; the check is
-- enforced on every INSERT and UPDATE from now on. NULL is allowed so the
-- OAuth NULL -> value first-set (choose-username) still works.
-- ============================================================

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,30}$')
  not valid;
