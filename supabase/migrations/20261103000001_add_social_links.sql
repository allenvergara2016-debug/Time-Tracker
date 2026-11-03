-- ==============================================================================
-- 20261103000001_add_social_links.sql
-- Add linked Google, Facebook, and social channels to profiles
-- ==============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS google_email TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_name TEXT;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

