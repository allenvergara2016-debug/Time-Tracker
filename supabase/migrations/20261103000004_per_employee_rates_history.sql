-- Migration: 20261103000004_per_employee_rates_history.sql
-- PER-EMPLOYEE RATES SET BY MANAGEMENT (Rate history, RLS, and DTR calculation settings)

-- 1. Create employee_rates history table
CREATE TABLE IF NOT EXISTS employee_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  regular_rate NUMERIC(12, 2) NOT NULL,
  overtime_rate_per_hour NUMERIC(12, 2) NOT NULL,
  rest_day_ot_rate NUMERIC(12, 2),
  holiday_ot_rate NUMERIC(12, 2),
  effective_from DATE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_rates_lookup 
  ON employee_rates(employee_id, effective_from DESC, created_at DESC);

-- 2. Add computation settings to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS show_rates_to_employees BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hours_per_day NUMERIC(5, 2) DEFAULT 8.00,
ADD COLUMN IF NOT EXISTS undertime_minutes_basis TEXT DEFAULT 'exact',
ADD COLUMN IF NOT EXISTS require_overtime_approval BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS overtime_rounding_rule TEXT DEFAULT 'exact',
ADD COLUMN IF NOT EXISTS enable_special_day_rates BOOLEAN DEFAULT false;

-- 3. RLS on employee_rates
ALTER TABLE employee_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access on employee_rates" ON employee_rates;
CREATE POLICY "Admins full access on employee_rates"
  ON employee_rates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Employees view own rates if enabled" ON employee_rates;
CREATE POLICY "Employees view own rates if enabled"
  ON employee_rates
  FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM app_settings 
      WHERE id = 'global' AND show_rates_to_employees = true
    )
  );

-- 4. Seed initial rate records for any existing profiles with daily_rate > 0
INSERT INTO employee_rates (employee_id, regular_rate, overtime_rate_per_hour, effective_from, created_at)
SELECT 
  id, 
  COALESCE(daily_rate, 610.00), 
  COALESCE(overtime_rate_per_hour, 114.38), 
  CURRENT_DATE - INTERVAL '1 year',
  now()
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM employee_rates WHERE employee_rates.employee_id = profiles.id
);

