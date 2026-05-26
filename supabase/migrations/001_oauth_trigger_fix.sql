-- Fix: only auto-create profile row if username is provided (email/password signup).
-- OAuth users (Google, Apple) will have no username in metadata,
-- so their profile is created manually in the choose-username screen.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF new.raw_user_meta_data->>'username' IS NOT NULL THEN
    INSERT INTO public.profiles (id, username)
    VALUES (new.id, new.raw_user_meta_data->>'username');
  END IF;
  RETURN new;
END;
$$;
