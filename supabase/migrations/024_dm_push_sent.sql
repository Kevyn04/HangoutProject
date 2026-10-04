-- ============================================================
-- One push per DM.
--
-- send-notification's `dm` type atomically flips push_sent false -> true
-- (service role) before sending, so replaying the request for the same
-- message can't be used to spam the recipient with pushes. Clients never
-- need to write it.
-- ============================================================

alter table public.direct_messages
  add column if not exists push_sent boolean not null default false;
