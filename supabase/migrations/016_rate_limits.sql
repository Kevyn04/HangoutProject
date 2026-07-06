-- ============================================================
-- Per-account rate limits (TestFlight stopgap for open signup).
-- Doesn't stop account creation, but caps how fast one account can act, so
-- mass/bot accounts become far less useful for spam. Limits are generous
-- enough that a normal human never hits them.
-- ============================================================

-- Generic BEFORE INSERT guard. TG_ARGV = (actor_column, max_count, window_seconds).
create or replace function public.enforce_rate_limit()
returns trigger language plpgsql as $$
declare
  actor_col   text := TG_ARGV[0];
  max_count   int  := TG_ARGV[1]::int;
  window_secs int  := TG_ARGV[2]::int;
  actor       text;
  cnt         int;
begin
  actor := (to_jsonb(NEW) ->> actor_col);
  if actor is null then
    return NEW;
  end if;
  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
    TG_TABLE_NAME, actor_col
  ) into cnt using actor, window_secs;
  if cnt >= max_count then
    raise exception 'Rate limit exceeded for % (max % per % s)', TG_TABLE_NAME, max_count, window_secs
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_rl_bubbles on public.bubbles;
create trigger trg_rl_bubbles before insert on public.bubbles
  for each row execute function public.enforce_rate_limit('created_by', '10', '3600');

drop trigger if exists trg_rl_events on public.events;
create trigger trg_rl_events before insert on public.events
  for each row execute function public.enforce_rate_limit('created_by', '20', '3600');

drop trigger if exists trg_rl_dms on public.direct_messages;
create trigger trg_rl_dms before insert on public.direct_messages
  for each row execute function public.enforce_rate_limit('sender_username', '30', '60');

drop trigger if exists trg_rl_invites on public.invites;
create trigger trg_rl_invites before insert on public.invites
  for each row execute function public.enforce_rate_limit('inviter_username', '30', '3600');

drop trigger if exists trg_rl_reports on public.reports;
create trigger trg_rl_reports before insert on public.reports
  for each row execute function public.enforce_rate_limit('reporter_username', '20', '3600');

drop trigger if exists trg_rl_follows on public.user_follows;
create trigger trg_rl_follows before insert on public.user_follows
  for each row execute function public.enforce_rate_limit('follower', '60', '3600');
