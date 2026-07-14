-- Event cover images + photo messages in bubble/event chat.
-- Client re-encodes every image to JPEG (expo-image-manipulator) before
-- upload, so buckets accept image/jpeg only.

alter table public.events add column if not exists cover_url text;
alter table public.chat_messages add column if not exists image_url text;
alter table public.event_messages add column if not exists image_url text;

-- Buckets (public read via CDN URL; writes gated by the policies below)
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values
  ('event-covers', 'event-covers', true, '{"image/jpeg"}', 5242880),
  ('chat-media',   'chat-media',   true, '{"image/jpeg"}', 5242880)
on conflict (id) do update
  set public             = excluded.public,
      allowed_mime_types = excluded.allowed_mime_types,
      file_size_limit    = excluded.file_size_limit;

-- Uploads must land in a folder named after the uploader's auth uid
-- (same convention as the avatars bucket). Folder-name check is used for
-- update/delete too so we don't depend on the legacy storage.objects.owner
-- column.
drop policy if exists "media_insert_own_folder" on storage.objects;
create policy "media_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('event-covers', 'chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_update_own_folder" on storage.objects;
create policy "media_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('event-covers', 'chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('event-covers', 'chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_delete_own_folder" on storage.objects;
create policy "media_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('event-covers', 'chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects
  for select to authenticated
  using (bucket_id in ('event-covers', 'chat-media'));
