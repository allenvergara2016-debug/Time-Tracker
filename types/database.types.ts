export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'employee';
export type BiometricMode = 'off' | 'always' | 'random';
export type VerificationMethod = 'none' | 'biometric' | 'fallback';
export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'on_leave' | 'absent' | 'completed';
export type LeaveType = 'sick' | 'vacation' | 'emergency' | 'maternity' | 'paternity' | 'other';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type HolidayType = 'regular' | 'special_non_working' | 'company';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  department_id: string | null;
  shift_id: string | null;
  device_id: string | null;
  device_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  whatsapp_verified: boolean;
  avatar_url: string | null;
  daily_rate?: number;
  hourly_rate?: number;
  overtime_rate_per_hour?: number;
  overtime_multiplier?: number;
  is_active: boolean;
  must_change_password: boolean;
  consent_given: boolean;
  is_super_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PasskeyCredential {
  id: string;
  employee_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_id: string;
  device_name: string;
  transports: string[];
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  break_duration_mins?: number;
  grace_period_mins: number;
  work_days: number[];
  created_at: string;
  employeeCount?: number;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeLocation {
  id: string;
  employee_id: string;
  location_id: string;
  created_at: string;
}

export interface AttendanceLog {
  id: string;
  employee_id: string;
  date: string;
  time_in: string;
  time_out: string | null;
  lat_in: number | null;
  lng_in: number | null;
  accuracy_in: number | null;
  location_in_id: string | null;
  lat_out: number | null;
  lng_out: number | null;
  accuracy_out: number | null;
  location_out_id: string | null;
  device_id: string | null;
  verification_method: VerificationMethod;
  status: AttendanceStatus;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  hours_worked: number;
  selfie_url: string | null;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  profile?: Profile;
  employee?: Profile;
  location_in?: Location;
  location_out?: Location;
}

export interface BreakRecord {
  id: string;
  attendance_id: string;
  employee_id: string;
  break_start: string;
  break_end: string | null;
  verification_method: string;
  duration_minutes: number;
  created_at: string;
}

export interface FailedAttempt {
  id: string;
  employee_id: string | null;
  attempt_type: 'time_in' | 'time_out' | 'break_in' | 'break_out';
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  device_id: string | null;
  reason: string;
  distance_meters: number | null;
  nearest_location_name: string | null;
  created_at: string;
  profile?: Profile;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: RequestStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile?: Profile;
  reviewer?: Profile;
}

export interface CorrectionRequest {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  requested_date: string;
  requested_time_in: string | null;
  requested_time_out: string | null;
  reason: string;
  status: RequestStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile?: Profile;
  reviewer?: Profile;
}

export interface Conversation {
  id: string;
  title: string | null;
  is_group: boolean;
  is_announcement: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  members?: ConversationMember[];
  last_message?: Message | null;
  lastMessage?: Message | null;
  unread_count?: number;
  unreadCount?: number;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  employee_id: string;
  last_read_at: string;
  created_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  sender?: Profile;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id?: string;
  message_id: string;
  user_id: string;
  emoji: string;
  user?: Profile;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  employee_id: string;
  email_time_in_reminder: boolean;
  email_late_alert: boolean;
  email_request_updates: boolean;
  whatsapp_time_in_reminder: boolean;
  whatsapp_late_alert: boolean;
  whatsapp_request_updates: boolean;
  push_time_in_reminder: boolean;
  push_late_alert: boolean;
  push_request_updates: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  biometric_mode: BiometricMode;
  biometric_random_percentage: number;
  allow_fallback: boolean;
  gps_accuracy_threshold_meters: number;
  enable_random_selfie: boolean;
  selfie_random_percentage: number;
  allowed_login_google: boolean;
  allowed_login_facebook: boolean;
  allowed_login_whatsapp: boolean;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  actor?: Profile;
}
