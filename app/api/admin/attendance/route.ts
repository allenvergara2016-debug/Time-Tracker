import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseShiftToPHDate } from '@/lib/ph-time';
import { getCompanyTimezone } from '@/lib/company-timezone';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      employee_id,
      date,
      time_in, // e.g. "08:00" or ISO string or null
      time_out, // e.g. "17:00" or ISO string or null
      break_start, // e.g. "12:00" or null
      break_end, // e.g. "13:00" or null
      late_minutes,
      undertime_minutes,
      overtime_minutes,
      status = 'present',
    } = body;

    if (!employee_id || !date) {
      return NextResponse.json({ error: 'Employee ID and date are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const activeTz = await getCompanyTimezone();

    // Helper to format ISO timestamp in configured company timezone
    const convertToIso = (tVal: string | null | undefined): string | null => {
      if (!tVal) return null;
      if (tVal.includes('T')) return new Date(tVal).toISOString();
      return parseShiftToPHDate(tVal, date, activeTz).toISOString();
    };

    const timeInIso = convertToIso(time_in);
    const timeOutIso = convertToIso(time_out);
    const breakStartIso = convertToIso(break_start);
    const breakEndIso = convertToIso(break_end);

    // Calculate total hours worked
    let hoursWorked = 0;
    if (timeInIso && timeOutIso) {
      const diffMs = new Date(timeOutIso).getTime() - new Date(timeInIso).getTime();
      let breakMs = 0;
      if (breakStartIso && breakEndIso) {
        breakMs = Math.max(0, new Date(breakEndIso).getTime() - new Date(breakStartIso).getTime());
      }
      hoursWorked = Number(Math.max(0, (diffMs - breakMs) / (1000 * 60 * 60)).toFixed(2));
    }

    // Check if an attendance log already exists for this date and employee
    const { data: existingLog } = await adminClient
      .from('attendance_logs')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('date', date)
      .maybeSingle();

    let targetLogId = existingLog?.id;

    if (targetLogId) {
      // Update existing log
      const { error: updateErr } = await adminClient
        .from('attendance_logs')
        .update({
          time_in: timeInIso,
          time_out: timeOutIso,
          hours_worked: hoursWorked,
          late_minutes: Number(late_minutes) || 0,
          undertime_minutes: Number(undertime_minutes) || 0,
          overtime_minutes: Number(overtime_minutes) || 0,
          status,
          verification_method: 'fallback',
          flagged: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetLogId);

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    } else {
      // Insert new log
      const { data: newLog, error: insertErr } = await adminClient
        .from('attendance_logs')
        .insert({
          employee_id,
          date,
          time_in: timeInIso,
          time_out: timeOutIso,
          hours_worked: hoursWorked,
          late_minutes: Number(late_minutes) || 0,
          undertime_minutes: Number(undertime_minutes) || 0,
          overtime_minutes: Number(overtime_minutes) || 0,
          status,
          verification_method: 'fallback',
          flagged: false,
        })
        .select('id')
        .single();

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      targetLogId = newLog.id;
    }

    // Handle break record update / insert if break info provided
    if (targetLogId && (breakStartIso || breakEndIso)) {
      const { data: existingBreak } = await adminClient
        .from('breaks')
        .select('id')
        .eq('attendance_id', targetLogId)
        .maybeSingle();

      const durationMinutes = (breakStartIso && breakEndIso)
        ? Math.max(0, Math.round((new Date(breakEndIso).getTime() - new Date(breakStartIso).getTime()) / 60000))
        : 60;

      if (existingBreak) {
        await adminClient
          .from('breaks')
          .update({
            break_start: breakStartIso,
            break_end: breakEndIso,
            duration_minutes: durationMinutes,
          })
          .eq('id', existingBreak.id);
      } else {
        await adminClient
          .from('breaks')
          .insert({
            attendance_id: targetLogId,
            employee_id,
            break_start: breakStartIso,
            break_end: breakEndIso,
            duration_minutes: durationMinutes,
            verification_method: 'fallback',
          });
      }
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'ADMIN_EDIT_DTR',
      target_type: 'attendance_log',
      target_id: targetLogId,
      details: body,
    });

    return NextResponse.json({ success: true, attendanceId: targetLogId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error saving attendance record';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

