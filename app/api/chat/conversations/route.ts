import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();

    // 1. Fetch conversations the user is a member of, or announcement channels
    const { data: conversations, error } = await adminClient
      .from('conversations')
      .select(`
        *,
        members:conversation_members(
          id,
          employee_id,
          last_read_at,
          profile:profiles(id, full_name, email, avatar_url, role)
        ),
        messages(
          id,
          content,
          media_url,
          created_at,
          sender:profiles(id, full_name)
        )
      `)
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Filter conversations: user is member OR conversation is announcement
    const filtered = (conversations || []).filter((c) => {
      if (c.is_announcement) return true;
      return c.members?.some((m: { employee_id: string }) => m.employee_id === user.id);
    });

    const formatted = filtered.map((c) => {
      const userMember = c.members?.find((m: { employee_id: string }) => m.employee_id === user.id);
      const lastRead = userMember?.last_read_at ? new Date(userMember.last_read_at) : new Date(0);

      // Sort messages
      const msgs = (c.messages || []).sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = msgs[0] || null;

      // Count unread
      const unreadCount = (c.messages || []).filter(
        (m: { created_at: string; sender_id?: string }) =>
          new Date(m.created_at) > lastRead && m.sender_id !== user.id
      ).length;

      return {
        id: c.id,
        title: c.title,
        is_group: c.is_group,
        is_announcement: c.is_announcement,
        created_at: c.created_at,
        updated_at: c.updated_at,
        members: c.members,
        lastMessage,
        unreadCount,
      };
    });

    return NextResponse.json({ conversations: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Conversations fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { title, participant_ids, is_group = false, is_announcement = false } = body;

    const adminClient = createAdminClient();

    // Verify admin if creating announcement
    if (is_announcement) {
      const { data: prof } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
      if (prof?.role !== 'admin') {
        return NextResponse.json({ error: 'Only admins can create announcement channels' }, { status: 403 });
      }
    }

    // 1. Create conversation
    const { data: conv, error: convErr } = await adminClient
      .from('conversations')
      .insert({
        title,
        is_group: Boolean(is_group),
        is_announcement: Boolean(is_announcement),
        created_by: user.id,
      })
      .select()
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: convErr?.message || 'Failed to create conversation' }, { status: 500 });
    }

    // 2. Add members
    const membersToAdd = Array.from(new Set([user.id, ...(participant_ids || [])]));
    const memberRows = membersToAdd.map((empId) => ({
      conversation_id: conv.id,
      employee_id: empId,
      last_read_at: new Date().toISOString(),
    }));

    await adminClient.from('conversation_members').insert(memberRows);

    return NextResponse.json({ success: true, conversation: conv });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Conversation create error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

