-- Location-aware "People You May Know".
-- The client writes a COARSE last-known position (rounded to ~1 km client-side)
-- to the owner's profile row. Raw coordinates are never client-readable:
-- there is deliberately NO select grant on these columns (014 made profiles
-- SELECT per-column, so new columns are hidden by default) — the only read
-- path is nearby_users(), which returns usernames + distance, not coordinates.

alter table public.profiles
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists location_updated_at timestamptz;

grant update (last_lat, last_lng, location_updated_at) on public.profiles to authenticated;

create or replace function public.nearby_users(
  my_lat double precision,
  my_lng double precision,
  radius_km double precision default 25
)
returns table (username text, distance_km double precision)
language sql
security definer
set search_path = public
stable
as $$
  select p.username, d.km
  from public.profiles p
  cross join lateral (
    select 2 * 6371 * asin(sqrt(
      pow(sin(radians(p.last_lat - my_lat) / 2), 2) +
      cos(radians(my_lat)) * cos(radians(p.last_lat)) *
      pow(sin(radians(p.last_lng - my_lng) / 2), 2)
    )) as km
  ) d
  where p.last_lat is not null
    and p.last_lng is not null
    and p.location_updated_at > now() - interval '7 days'
    and p.username is not null
    and p.username <> coalesce(public.my_username(), '')
    and d.km <= radius_km
  order by d.km asc
  limit 20;
$$;

revoke execute on function public.nearby_users(double precision, double precision, double precision) from public, anon;
grant execute on function public.nearby_users(double precision, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';
