-- Migration: Add overtime_approved to attendance_logs
-- Allows overtime to be approved and reflected in DTR reports and payroll computations.

ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS overtime_approved BOOLEAN DEFAULT TRUE;

-- Ensure all existing attendance records with overtime default to approved = true
UPDATE attendance_logs 
SET overtime_approved = TRUE 
WHERE (overtime_minutes > 0 OR overtime_minutes IS NOT NULL) 
  AND overtime_approved IS NULL;

