-- ==============================================================================
-- 20261030000001_add_wages_and_dtr.sql
-- Add Wage and Overtime Multiplier to Profiles
-- ==============================================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS hourly_rate DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_multiplier DOUBLE PRECISION DEFAULT 1.25;

-- Update existing profiles with sensible defaults if null
UPDATE profiles 
SET 
  hourly_rate = COALESCE(hourly_rate, 0),
  overtime_multiplier = COALESCE(overtime_multiplier, 1.25);

