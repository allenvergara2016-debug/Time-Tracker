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
      return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
    }

    const body = await req.json();
    const { status, review_notes } = body;

    // Fetch original request
    const { data: originalReq, error: reqErr } = await adminClient
      .from('correction_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (reqErr || !originalReq) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    // Update request status
    const { data: updatedReq, error: upErr } = await adminClient
      .from('correction_requests')
      .update({
        status,
        review_notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // If approved, apply correction to attendance_logs
    if (status === 'approved') {
      const timeInDate = originalReq.requested_time_in ? new Date(originalReq.requested_time_in) : null;
      const timeOutDate = originalReq.requested_time_out ? new Date(originalReq.requested_time_out) : null;

      let hoursWorked = 0;
      if (timeInDate && timeOutDate) {
        hoursWorked = Math.max(0, (timeOutDate.getTime() - timeInDate.getTime()) / (1000 * 60 * 60));
      }

      if (originalReq.attendance_id) {
        await adminClient
          .from('attendance_logs')
          .update({
            time_in: originalReq.requested_time_in || undefined,
            time_out: originalReq.requested_time_out || undefined,
            hours_worked: Number(hoursWorked.toFixed(2)),
            flagged: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', originalReq.attendance_id);
      } else if (originalReq.requested_time_in) {
        // Insert new corrected attendance record
        await adminClient.from('attendance_logs').insert({
          employee_id: originalReq.employee_id,
          date: originalReq.requested_date,
          time_in: originalReq.requested_time_in,
          time_out: originalReq.requested_time_out || null,
          hours_worked: Number(hoursWorked.toFixed(2)),
          verification_method: 'fallback',
          status: 'completed',
          flagged: true,
          flag_reason: 'Admin approved retroactive attendance correction.',
        });
      }
    }

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: `CORRECTION_REQUEST_${status.toUpperCase()}`,
      target_type: 'correction_request',
      target_id: id,
      details: { status, review_notes },
    });

    return NextResponse.json({ success: true, request: updatedReq });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Correction update error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

