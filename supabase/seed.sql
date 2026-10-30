-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- 1. APP SETTINGS DEFAULT
INSERT INTO app_settings (
  id,
  biometric_mode,
  biometric_random_percentage,
  allow_fallback,
  gps_accuracy_threshold_meters,
  enable_random_selfie,
  selfie_random_percentage,
  allowed_login_google,
  allowed_login_facebook,
  allowed_login_whatsapp
) VALUES (
  'global',
  'always',
  30,
  true,
  50.0,
  false,
  20,
  true,
  true,
  true
) ON CONFLICT (id) DO UPDATE SET
  biometric_mode = EXCLUDED.biometric_mode,
  allow_fallback = EXCLUDED.allow_fallback,
  gps_accuracy_threshold_meters = EXCLUDED.gps_accuracy_threshold_meters;

-- 2. DEPARTMENTS (Using valid hex UUID prefix 'd1...')
INSERT INTO departments (id, name, description) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Engineering', 'Software, IT & Technical Operations'),
  ('d1000000-0000-0000-0000-000000000002', 'Operations', 'Business Operations & Field Teams'),
  ('d1000000-0000-0000-0000-000000000003', 'Human Resources', 'People, Culture & Administration'),
  ('d1000000-0000-0000-0000-000000000004', 'Sales & Marketing', 'Growth, Client Relations & Support')
ON CONFLICT (name) DO NOTHING;

-- 3. SHIFTS (Using valid hex UUID prefix 'b1...')
INSERT INTO shifts (id, name, start_time, end_time, grace_period_mins, work_days) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Regular Day Shift', '09:00:00', '18:00:00', 15, '[1,2,3,4,5]'::jsonb),
  ('b1000000-0000-0000-0000-000000000002', 'Early Shift', '07:00:00', '16:00:00', 10, '[1,2,3,4,5]'::jsonb),
  ('b1000000-0000-0000-0000-000000000003', 'Night Shift', '22:00:00', '06:00:00', 15, '[1,2,3,4,5]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 4. LOCATIONS (Using valid hex UUID prefix 'a1...')
INSERT INTO locations (id, name, address, lat, lng, radius_meters, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Main Headquarters', '100 Innovation Plaza, Tech District', 14.5547, 121.0244, 150.0, true),
  ('a1000000-0000-0000-0000-000000000002', 'Downtown Branch Office', '45 Financial Center Blvd', 14.5869, 121.0614, 100.0, true),
  ('a1000000-0000-0000-0000-000000000003', 'North Logistics Hub', '12 Warehouse Avenue', 14.6507, 121.0312, 200.0, true)
ON CONFLICT (id) DO NOTHING;

-- 5. HOLIDAYS (Current Year)
INSERT INTO holidays (name, date, type) VALUES
  ('New Year''s Day', '2026-01-01', 'regular'),
  ('Labor Day', '2026-05-01', 'regular'),
  ('Independence Day', '2026-06-12', 'regular'),
  ('National Heroes Day', '2026-08-31', 'regular'),
  ('Christmas Day', '2026-12-25', 'regular')
ON CONFLICT (date) DO NOTHING;

-- 6. COMPANY-WIDE ANNOUNCEMENT CONVERSATION (Using valid hex UUID prefix 'c1...')
INSERT INTO conversations (id, title, is_group, is_announcement) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Company Announcements', true, true)
ON CONFLICT (id) DO NOTHING;
