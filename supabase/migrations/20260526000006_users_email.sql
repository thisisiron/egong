-- Add email column to public.users for convenient join (avoid auth.users hop).
-- Backfilled from auth.users for existing rows.

ALTER TABLE public.users ADD COLUMN email text;

UPDATE public.users u
SET email = au.email
FROM auth.users au
WHERE u.id = au.id AND u.email IS NULL;

CREATE INDEX idx_users_email ON public.users(email) WHERE email IS NOT NULL;
