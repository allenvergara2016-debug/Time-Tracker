import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();

    const { data: messages, error } = await adminClient
      .from('messages')
      .select('*, sender:profiles(id, full_name, email, avatar_url, role)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ messages: messages || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Messages fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { content, media_url } = body;

    if (!content && !media_url) {
      return NextResponse.json({ error: 'Message content or media required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Check conversation announcement status
    const { data: conv } = await adminClient
      .from('conversations')
      .select('is_announcement')
      .eq('id', conversationId)
      .single();

    if (conv?.is_announcement) {
      const { data: prof } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
      if (prof?.role !== 'admin') {
        return NextResponse.json({ error: 'Only administrators can post in the Announcements channel.' }, { status: 403 });
      }
    }

    // Insert message
    const { data: newMsg, error } = await adminClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content || null,
        media_url: media_url || null,
      })
      .select('*, sender:profiles(id, full_name, email, avatar_url, role)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update conversation updated_at
    await adminClient
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({ success: true, message: newMsg });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Message send error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

