-- ==============================================================================
-- 20261030000003_reactions_and_super_admin.sql
-- 1. Message Reactions (Messenger-style emoji reactions)
-- 2. Super Admin flag on profiles
-- ==============================================================================

-- 1. Super Admin column on profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Designate the first administrator as super admin
UPDATE profiles 
SET is_super_admin = true 
WHERE email = 'admin@company.com';

-- 2. Message Reactions Table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, -- e.g. 👍, ❤️, 😂, 😮, 😢, 😡
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- RLS for message_reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add their own reaction"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reaction"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

NOTIFY pgrst, 'reload schema';

