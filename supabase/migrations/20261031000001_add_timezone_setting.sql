-- ==============================================================================
-- 20261031000001_add_timezone_setting.sql
-- Add configurable company-wide timezone setting to app_settings
-- ==============================================================================

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Manila';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

