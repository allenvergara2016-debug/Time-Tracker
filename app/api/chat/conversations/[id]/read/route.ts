import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();

    // Upsert member record with updated last_read_at timestamp
    // This ensures even announcement channels (where members aren't pre-populated) record the read receipt!
    const { error } = await adminClient
      .from('conversation_members')
      .upsert(
        {
          conversation_id: conversationId,
          employee_id: user.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: 'conversation_id,employee_id' }
      );

    if (error) {
      // Fallback: update if conflict resolution differs
      await adminClient
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('employee_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Read receipt error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
