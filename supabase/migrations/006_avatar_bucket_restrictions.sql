-- Lock the avatars bucket to image files only, max 5 MB.
-- Supabase Storage enforces these server-side regardless of what the client sends.
update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ],
  file_size_limit = 5242880  -- 5 MB in bytes
where id = 'avatars';
