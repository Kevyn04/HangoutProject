-- Records when a user accepted the privacy policy (consent step in onboarding)
alter table profiles add column if not exists privacy_accepted_at timestamptz;
