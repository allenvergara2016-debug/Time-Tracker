import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://usuiogirtzoukodycisd.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzdWlvZ2lydHpvdWtvZHljaXNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzMxMzIzOSwiZXhwIjoyMTA4ODg5MjM5fQ.2k8-YZwp4UQLMvzqjfrLf4aLvo8hM7WI5CL-Sbc9L5Q';

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

