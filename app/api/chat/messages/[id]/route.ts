import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // 1. Fetch message to check existence and ownership
    const { data: message, error: fetchError } = await adminClient
      .from('messages')
      .select('id, sender_id, conversation_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 2. Check if user is the sender or an admin
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isOwner = message.sender_id === user.id;
    const isAdmin = profile?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only delete your own messages.' },
        { status: 403 }
      );
    }

    // 3. Delete the message (associated reactions cascade automatically)
    const { error: deleteError } = await adminClient
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 4. Update conversation's updated_at
    await adminClient
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.conversation_id);

    return NextResponse.json({ success: true, messageId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

