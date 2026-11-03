-- Migration: 20261103000003_audit_and_hardening.sql
-- Safe additive schema enhancements

-- 1. Profiles additions
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);

-- 2. Audit logs enhancement
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS old_value JSONB,
ADD COLUMN IF NOT EXISTS new_value JSONB;

-- 3. App Settings additions for rates & retention
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS overtime_multiplier_ordinary NUMERIC DEFAULT 1.25,
ADD COLUMN IF NOT EXISTS overtime_multiplier_restday NUMERIC DEFAULT 1.30,
ADD COLUMN IF NOT EXISTS overtime_multiplier_special_holiday NUMERIC DEFAULT 1.30,
ADD COLUMN IF NOT EXISTS overtime_multiplier_regular_holiday NUMERIC DEFAULT 2.00,
ADD COLUMN IF NOT EXISTS data_retention_years INTEGER DEFAULT 3;

-- 4. Attendance logs rate snapshots
ALTER TABLE attendance_logs
ADD COLUMN IF NOT EXISTS daily_rate NUMERIC,
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC,
ADD COLUMN IF NOT EXISTS overtime_rate_per_hour NUMERIC,
ADD COLUMN IF NOT EXISTS overtime_multiplier NUMERIC;

-- 5. WhatsApp OTP verification table with rate limiting
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user ON phone_verifications(user_id, created_at DESC);

-- 6. Passkey Credentials device_id binding
ALTER TABLE passkey_credentials
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 7. Audit logs RLS (Admins read-only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit logs" ON audit_logs;
CREATE POLICY "Admins read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';

