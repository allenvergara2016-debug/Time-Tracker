import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
    const isAdmin = profile?.role === 'admin';

    let query = adminClient
      .from('leave_requests')
      .select('*, employee:profiles!leave_requests_employee_id_fkey(id, full_name, email, department:departments(name)), reviewer:profiles!leave_requests_reviewed_by_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('employee_id', user.id);
    }

    const { data: requests, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (requests || []).map((r) => ({
      ...r,
      profile: r.employee || r.profile,
    }));

    return NextResponse.json({ requests: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Leave requests fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { leave_type, start_date, end_date, reason } = body;

    if (!leave_type || !start_date || !end_date || !reason) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: newReq, error } = await adminClient
      .from('leave_requests')
      .insert({
        employee_id: user.id,
        leave_type,
        start_date,
        end_date,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, request: newReq });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Leave request error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

