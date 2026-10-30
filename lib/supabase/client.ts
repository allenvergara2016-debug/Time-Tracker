import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://usuiogirtzoukodycisd.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzdWlvZ2lydHpvdWtvZHljaXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMTMyMzksImV4cCI6MjEwODg4OTIzOX0.1oFp8ucl0zt3pXDQyI0apHYFBB5rg4ocBO7ujTwpQlY';

  return createBrowserClient(supabaseUrl, supabaseKey);
}

