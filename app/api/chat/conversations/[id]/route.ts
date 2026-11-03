import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // 1. Fetch conversation details & membership
    const { data: conv, error: convError } = await adminClient
      .from('conversations')
      .select('id, is_announcement, members:conversation_members(employee_id)')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 2. Check permissions: admin or member of the conversation
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const isMember = conv.members?.some((m: { employee_id: string }) => m.employee_id === user.id);

    // If announcement channel, only admin can delete
    if (conv.is_announcement && !isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can delete announcement channels.' },
        { status: 403 }
      );
    }

    if (!isMember && !isAdmin) {
      return NextResponse.json(
        { error: 'You are not a member of this conversation.' },
        { status: 403 }
      );
    }

    // 3. Delete the conversation (cascades to members, messages, and reactions)
    const { error: delError } = await adminClient
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, conversationId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete conversation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

