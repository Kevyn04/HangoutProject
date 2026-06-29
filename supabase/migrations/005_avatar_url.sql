-- Add avatar photo URL to profiles
alter table profiles add column if not exists avatar_url text;

-- Create avatars storage bucket (public reads)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage RLS: anyone can read avatars
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Storage RLS: authenticated users can upload/replace their own avatar
-- Path pattern: {auth.uid()}/avatar.{ext}
create policy "avatars_auth_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_auth_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_auth_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
