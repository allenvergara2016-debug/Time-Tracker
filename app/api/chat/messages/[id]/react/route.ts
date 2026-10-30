import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { emoji } = body; // e.g. 👍, ❤️, 😂, 😮, 😢, 😡

    if (!emoji) return NextResponse.json({ error: 'Emoji is required' }, { status: 400 });

    const adminClient = createAdminClient();

    // Check if the user already reacted with this emoji
    const { data: existingReaction } = await adminClient
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existingReaction) {
      // Toggle off (remove reaction if clicked again)
      await adminClient
        .from('message_reactions')
        .delete()
        .eq('id', existingReaction.id);

      return NextResponse.json({ success: true, action: 'removed' });
    }

    // Insert new reaction
    const { data: newReaction, error } = await adminClient
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      })
      .select('*, user:profiles(id, full_name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'added', reaction: newReaction });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reaction error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

