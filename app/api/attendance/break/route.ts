import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPHDateString } from '@/lib/ph-time';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, attendance_id } = body; // action: 'break_in' | 'break_out'

    const adminClient = createAdminClient();
    const serverNow = new Date();
    const today = getPHDateString(serverNow);

    // Verify user has active attendance log today
    let targetAttendanceId = attendance_id;
    if (!targetAttendanceId) {
      const { data: activeLog } = await adminClient
        .from('attendance_logs')
        .select('id')
        .eq('employee_id', user.id)
        .eq('date', today)
        .is('time_out', null)
        .single();
      
      if (!activeLog) {
        return NextResponse.json({ error: 'Must be timed in before taking a break.' }, { status: 400 });
      }
      targetAttendanceId = activeLog.id;
    }

    if (action === 'break_in') {
      // Check if break already ongoing
      const { data: openBreak } = await adminClient
        .from('breaks')
        .select('id')
        .eq('attendance_id', targetAttendanceId)
        .is('break_end', null)
        .single();

      if (openBreak) {
        return NextResponse.json({ error: 'You are already on an active break!' }, { status: 400 });
      }

      const { data: newBreak, error: breakErr } = await adminClient
        .from('breaks')
        .insert({
          attendance_id: targetAttendanceId,
          employee_id: user.id,
          break_start: serverNow.toISOString(),
          verification_method: 'biometric',
        })
        .select()
        .single();

      if (breakErr) return NextResponse.json({ error: breakErr.message }, { status: 500 });

      return NextResponse.json({
        success: true,
        action: 'break_in',
        break: newBreak,
        message: 'Break started. Enjoy your rest!',
      });
    } else {
      // action === 'break_out'
      const { data: activeBreak, error: bErr } = await adminClient
        .from('breaks')
        .select('*')
        .eq('attendance_id', targetAttendanceId)
        .is('break_end', null)
        .single();

      if (bErr || !activeBreak) {
        return NextResponse.json({ error: 'No active break found to conclude.' }, { status: 400 });
      }

      const startTime = new Date(activeBreak.break_start);
      const durationMinutes = Math.max(0, Math.round((serverNow.getTime() - startTime.getTime()) / 60000));

      const { data: updatedBreak, error: upErr } = await adminClient
        .from('breaks')
        .update({
          break_end: serverNow.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', activeBreak.id)
        .select()
        .single();

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({
        success: true,
        action: 'break_out',
        break: updatedBreak,
        durationMinutes,
        message: `Break concluded. Total break time: ${durationMinutes} minutes.`,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Break action error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

