import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin permission required to review requests' }, { status: 403 });
    }

    const body = await req.json();
    const { status, review_notes } = body; // 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 });
    }

    const { data: updated, error } = await adminClient
      .from('leave_requests')
      .update({
        status,
        review_notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: `LEAVE_REQUEST_${status.toUpperCase()}`,
      target_type: 'leave_request',
      target_id: id,
      details: { status, review_notes },
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Review error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

