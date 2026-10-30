-- ==============================================================================
-- 20261030000002_peso_wage_shift_breaks.sql
-- Wage in Peso (Daily Rate & Exact OT Rate per hour) + Shift Break Time
-- ==============================================================================

-- 1. PROFILES: Daily rate and exact Overtime Rate per hour in Philippine Peso (₱)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS daily_rate DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_rate_per_hour DOUBLE PRECISION DEFAULT 0;

-- 2. SHIFTS: Scheduled Break Time (e.g. 12:00 to 13:00)
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS break_start TIME DEFAULT '12:00:00',
ADD COLUMN IF NOT EXISTS break_end TIME DEFAULT '13:00:00',
ADD COLUMN IF NOT EXISTS break_duration_mins INTEGER DEFAULT 60;

