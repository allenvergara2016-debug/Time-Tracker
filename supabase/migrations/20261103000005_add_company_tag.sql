-- Migration: 20261103000005_add_company_tag.sql
-- Add optional company_tag to profiles for multi-branch/company tagging (e.g. "Allen Care Staff", "Allen V Fruits")

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS company_tag TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_company_tag ON profiles(company_tag);

