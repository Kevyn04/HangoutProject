-- ============================================================
-- (1) Remove the throwaway accounts created during the 2026-07-05 security
--     audit. Deleting from auth.users cascades to public.profiles.
--     Scoped to the exact UUIDs captured during that session (safe no-op
--     on any other environment).
-- (2) Make username immutable once set — closes the username-squatting /
--     impersonation vector (created_by links are text, not FKs).
-- ============================================================

-- ── (1) delete audit test accounts ───────────────────────────────────────────
delete from auth.users
where id in (
  '8111eaab-c686-4b74-a1b1-847d79646134',  -- sectest_*
  'fff439e9-71eb-4a92-96d2-4b565e770fd5',  -- vic_*
  '8d966158-f66e-41e1-8b3e-29db6c883874'   -- atk_*
);

-- ── (2) lock username after first set ────────────────────────────────────────
-- OAuth users get a NULL username from handle_new_user() and set it once via
-- the choose-username screen; that first NULL -> value transition is allowed.
-- Any later change to an already-set username is rejected.
create or replace function public.prevent_username_change()
returns trigger language plpgsql as $$
begin
  if OLD.username is not null and NEW.username is distinct from OLD.username then
    raise exception 'username is immutable once set';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_username_change on public.profiles;
create trigger trg_prevent_username_change
  before update on public.profiles
  for each row execute function public.prevent_username_change();
