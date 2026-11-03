-- Allow authenticated users to delete their own messages or admins to delete any message
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid() OR is_admin()
  );

-- Allow conversation members or admins to delete conversations
DROP POLICY IF EXISTS "Users can delete conversations they are members of" ON conversations;
CREATE POLICY "Users can delete conversations they are members of"
  ON conversations FOR DELETE
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = conversations.id 
        AND employee_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';

