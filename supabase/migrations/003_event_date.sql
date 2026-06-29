-- Add ISO timestamp alongside the human-readable time string
-- Existing events keep event_date = NULL (treated as no expiry — still shown)
alter table events add column if not exists event_date timestamptz;
