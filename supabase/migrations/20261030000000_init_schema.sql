-- ==============================================================================
-- 1. EXTENSIONS & SCHEMAS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE ENUMS & LOOKUPS
-- ==============================================================================

-- DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  break_start TIME DEFAULT '12:00:00',
  break_end TIME DEFAULT '13:00:00',
  break_duration_mins INTEGER DEFAULT 60,
  grace_period_mins INTEGER NOT NULL DEFAULT 15,
  work_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb, -- 1=Monday ... 7=Sunday
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')) DEFAULT 'employee',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  device_id TEXT, -- Bound client device ID (UUID generated client-side and saved)
  device_name TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  whatsapp_verified BOOLEAN DEFAULT false,
  avatar_url TEXT,
  daily_rate DOUBLE PRECISION DEFAULT 0,
  hourly_rate DOUBLE PRECISION DEFAULT 0,
  overtime_rate_per_hour DOUBLE PRECISION DEFAULT 0,
  overtime_multiplier DOUBLE PRECISION DEFAULT 1.25,
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  consent_given BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PASSKEY CREDENTIALS (WebAuthn Platform Authenticators)
-- Public keys and signature counters only; NEVER raw biometric data.
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_id TEXT NOT NULL,
  device_name TEXT DEFAULT 'Mobile Authenticator',
  transports JSONB DEFAULT '["internal"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- WEBAUTHN CHALLENGES (Short-lived challenges for registration/authentication)
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- LOCATIONS (Multi-location geofencing)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters DOUBLE PRECISION NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EMPLOYEE SPECIFIC LOCATIONS (Optional location whitelist per employee)
CREATE TABLE IF NOT EXISTS employee_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, location_id)
);

-- ATTENDANCE LOGS
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TIMESTAMPTZ NOT NULL,
  time_out TIMESTAMPTZ,
  lat_in DOUBLE PRECISION,
  lng_in DOUBLE PRECISION,
  accuracy_in DOUBLE PRECISION,
  location_in_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  lat_out DOUBLE PRECISION,
  lng_out DOUBLE PRECISION,
  accuracy_out DOUBLE PRECISION,
  location_out_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  device_id TEXT,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('none', 'biometric', 'fallback')) DEFAULT 'biometric',
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'half_day', 'on_leave', 'absent', 'completed')) DEFAULT 'present',
  late_minutes INTEGER DEFAULT 0,
  undertime_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  hours_worked DOUBLE PRECISION DEFAULT 0,
  selfie_url TEXT,
  flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- BREAKS
CREATE TABLE IF NOT EXISTS breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  verification_method TEXT NOT NULL DEFAULT 'biometric',
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FAILED ATTEMPTS (Anti-cheat & verification audit)
CREATE TABLE IF NOT EXISTS failed_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('time_in', 'time_out', 'break_in', 'break_out')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  device_id TEXT,
  reason TEXT NOT NULL,
  distance_meters DOUBLE PRECISION,
  nearest_location_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'vacation', 'emergency', 'maternity', 'paternity', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CORRECTION REQUESTS
CREATE TABLE IF NOT EXISTS correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES attendance_logs(id) ON DELETE SET NULL,
  requested_date DATE NOT NULL,
  requested_time_in TIMESTAMPTZ,
  requested_time_out TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CONVERSATIONS & CHANNELS
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  is_group BOOLEAN DEFAULT false,
  is_announcement BOOLEAN DEFAULT false, -- Admin announcement broadcast
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CONVERSATION MEMBERS
CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (conversation_id, employee_id)
);

-- CHAT MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HOLIDAYS
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('regular', 'special_non_working', 'company')) DEFAULT 'regular',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  email_time_in_reminder BOOLEAN DEFAULT true,
  email_late_alert BOOLEAN DEFAULT true,
  email_request_updates BOOLEAN DEFAULT true,
  whatsapp_time_in_reminder BOOLEAN DEFAULT false,
  whatsapp_late_alert BOOLEAN DEFAULT false,
  whatsapp_request_updates BOOLEAN DEFAULT false,
  push_time_in_reminder BOOLEAN DEFAULT true,
  push_late_alert BOOLEAN DEFAULT true,
  push_request_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- APP SETTINGS
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  biometric_mode TEXT NOT NULL CHECK (biometric_mode IN ('off', 'always', 'random')) DEFAULT 'always',
  biometric_random_percentage INTEGER NOT NULL DEFAULT 30 CHECK (biometric_random_percentage BETWEEN 1 AND 100),
  allow_fallback BOOLEAN NOT NULL DEFAULT true,
  gps_accuracy_threshold_meters DOUBLE PRECISION NOT NULL DEFAULT 50,
  enable_random_selfie BOOLEAN NOT NULL DEFAULT false,
  selfie_random_percentage INTEGER NOT NULL DEFAULT 20,
  allowed_login_google BOOLEAN NOT NULL DEFAULT true,
  allowed_login_facebook BOOLEAN NOT NULL DEFAULT true,
  allowed_login_whatsapp BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 3. HELPER FUNCTIONS
-- ==============================================================================

-- Haversine formula for distance calculation in meters
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r CONSTANT DOUBLE PRECISION := 6371000; -- Earth radius in meters
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN 999999999;
  END IF;
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2.0)^2;
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if current authenticated user is an active Admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role = 'admin' 
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Admins can read/write everything.
CREATE POLICY "Admins full access on profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Users can read their own profile (and basic info of active colleagues for chat)
CREATE POLICY "Employees read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_active = true);

-- Users can update select fields of their own profile (phone, whatsapp, avatar, consent)
CREATE POLICY "Employees update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- PASSKEY CREDENTIALS POLICIES
-- Passkey public keys must NEVER be exposed to other users!
-- Users can only see their own credentials (metadata).
CREATE POLICY "Users read own passkeys"
  ON passkey_credentials FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_admin());

CREATE POLICY "Users create own passkey"
  ON passkey_credentials FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins or owners delete passkeys"
  ON passkey_credentials FOR DELETE
  TO authenticated
  USING (employee_id = auth.uid() OR is_admin());

-- WEBAUTHN CHALLENGES POLICIES
CREATE POLICY "Users manage own challenges"
  ON webauthn_challenges FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DEPARTMENTS & SHIFTS
CREATE POLICY "Everyone read departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage departments"
  ON departments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Everyone read shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- LOCATIONS
CREATE POLICY "Authenticated users read active locations"
  ON locations FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "Admins manage locations"
  ON locations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins manage employee_locations"
  ON employee_locations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Employees read own employee_locations"
  ON employee_locations FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- ATTENDANCE LOGS
CREATE POLICY "Admins full access to attendance_logs"
  ON attendance_logs FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Employees read own attendance_logs"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees insert own attendance_logs"
  ON attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees update own attendance_logs"
  ON attendance_logs FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- BREAKS
CREATE POLICY "Admins full access to breaks"
  ON breaks FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Employees manage own breaks"
  ON breaks FOR ALL
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- FAILED ATTEMPTS
CREATE POLICY "Admins read failed_attempts"
  ON failed_attempts FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Employees insert own failed_attempts"
  ON failed_attempts FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid() OR employee_id IS NULL);

-- LEAVE REQUESTS
CREATE POLICY "Admins manage all leave_requests"
  ON leave_requests FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Employees view own leave_requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees create own leave_requests"
  ON leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- CORRECTION REQUESTS
CREATE POLICY "Admins manage all correction_requests"
  ON correction_requests FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Employees view own correction_requests"
  ON correction_requests FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees create own correction_requests"
  ON correction_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- CONVERSATIONS & CHAT
CREATE POLICY "Users read conversations they are members of"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = conversations.id 
        AND employee_id = auth.uid()
    ) OR
    is_announcement = true
  );

CREATE POLICY "Users create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_admin());

CREATE POLICY "Admins update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (is_admin() OR created_by = auth.uid());

-- CONVERSATION MEMBERS
CREATE POLICY "Members view member list"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM conversation_members AS cm 
      WHERE cm.conversation_id = conversation_members.conversation_id 
        AND cm.employee_id = auth.uid()
    )
  );

CREATE POLICY "Users join or admin add members"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid() OR is_admin());

CREATE POLICY "Members update their own last_read_at"
  ON conversation_members FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- MESSAGES
CREATE POLICY "Users read messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = messages.conversation_id 
        AND employee_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id 
        AND is_announcement = true
    )
  );

CREATE POLICY "Users post messages to their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      is_admin() OR
      EXISTS (
        SELECT 1 FROM conversation_members 
        WHERE conversation_id = messages.conversation_id 
          AND employee_id = auth.uid()
      )
    ) AND NOT (
      -- Only admin can post in announcement channel
      EXISTS (
        SELECT 1 FROM conversations 
        WHERE id = messages.conversation_id 
          AND is_announcement = true 
          AND NOT is_admin()
      )
    )
  );

-- HOLIDAYS
CREATE POLICY "Everyone read holidays"
  ON holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage holidays"
  ON holidays FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- NOTIFICATION PREFERENCES
CREATE POLICY "Users manage own notification_preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (employee_id = auth.uid() OR is_admin())
  WITH CHECK (employee_id = auth.uid() OR is_admin());

-- APP SETTINGS
CREATE POLICY "Everyone read app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage app_settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- AUDIT LOGS
CREATE POLICY "Admins view audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "System insert audit_logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ==============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_logs(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_attendance_flagged ON attendance_logs(flagged);
CREATE INDEX IF NOT EXISTS idx_passkeys_employee ON passkey_credentials(employee_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_date ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_emp ON conversation_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_corrections_employee ON correction_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_created ON failed_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ==============================================================================
-- 6. REALTIME REPLICATION ENABLEMENT
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE correction_requests;

