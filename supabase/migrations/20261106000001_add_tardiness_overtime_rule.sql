-- Migration: Add tardiness_overtime_rule to app_settings
-- Gives management full control over how tardiness and overtime interact
-- Options:
--   'no_offset'           : Strict Shift Schedule (Default / Labor Standard - Late deducted, overtime paid past shift end)
--   'require_full_hours'  : Require 8 Hours First (Overtime only starts after completing full regular hours; 5pm-6pm is not OT if late by 1 hr)
--   'offset_late'         : Offset Tardiness / Make-up Time (Post-shift work offsets late minutes to avoid pay deduction; excess is OT)

ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS tardiness_overtime_rule TEXT DEFAULT 'no_offset';

UPDATE app_settings 
SET tardiness_overtime_rule = 'no_offset' 
WHERE tardiness_overtime_rule IS NULL;

