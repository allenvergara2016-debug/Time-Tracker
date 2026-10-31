import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPHDateString } from '@/lib/ph-time';
import { getCompanyTimezone } from '@/lib/company-timezone';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const activeTz = await getCompanyTimezone();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getPHDateString(new Date(), activeTz);
    const departmentId = searchParams.get('department_id');

    const adminClient = createAdminClient();

    // 1. Fetch all active employees
    let employeesQuery = adminClient
      .from('profiles')
      .select('id, full_name, email, role, avatar_url, is_active, department_id, shift_id, department:departments(name), shift:shifts(name, start_time, end_time)')
      .eq('role', 'employee')
      .eq('is_active', true);

    if (departmentId) {
      employeesQuery = employeesQuery.eq('department_id', departmentId);
    }

    const { data: employees } = await employeesQuery;
    const totalEmployees = employees?.length || 0;

    // 2. Fetch today's attendance logs
    const { data: logs } = await adminClient
      .from('attendance_logs')
      .select(`
        *,
        employee:profiles(id, full_name, email, avatar_url, department:departments(name), shift:shifts(name)),
        location_in:locations!location_in_id(id, name, lat, lng, radius_meters),
        location_out:locations!location_out_id(id, name, lat, lng, radius_meters),
        breaks(*)
      `)
      .eq('date', date)
      .order('time_in', { ascending: false });

    // Format logs with normalized profile field
    const formattedLogs = (logs || []).map((l) => ({
      ...l,
      profile: l.employee || l.profile,
    }));

    // 3. Fetch approved leaves for today
    const { data: leaves } = await adminClient
      .from('leave_requests')
      .select('*, employee:profiles(id, full_name, email, department:departments(name))')
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date);

    // 4. Compute metrics
    const attendanceMap = new Map((logs || []).map((l) => [l.employee_id, l]));
    const leaveMap = new Map((leaves || []).map((lv) => [lv.employee_id, lv]));

    let presentCount = 0;
    let lateCount = 0;
    let timedOutCount = 0;
    let onLeaveCount = leaves?.length || 0;

    (logs || []).forEach((log) => {
      if (log.status === 'late') lateCount++;
      else presentCount++;

      if (log.time_out) timedOutCount++;
    });

    const activeTapsCount = (logs || []).length;
    const absentCount = Math.max(0, totalEmployees - activeTapsCount - onLeaveCount);

    // 5. Fetch recent failed attempts and alerts
    const { data: recentFailed } = await adminClient
      .from('failed_attempts')
      .select('*, profile:profiles(id, full_name, email)')
      .gte('created_at', `${date}T00:00:00Z`)
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. Fetch flagged entries
    const { data: flaggedLogs } = await adminClient
      .from('attendance_logs')
      .select('*, employee:profiles(id, full_name, email)')
      .eq('date', date)
      .eq('flagged', true);

    return NextResponse.json({
      date,
      counts: {
        totalEmployees,
        present: presentCount,
        late: lateCount,
        timedOut: timedOutCount,
        absent: absentCount,
        onLeave: onLeaveCount,
        flagged: (flaggedLogs?.length || 0) + (recentFailed?.length || 0),
      },
      attendanceLogs: formattedLogs || [],
      leaves: leaves || [],
      failedAttempts: recentFailed || [],
      flaggedLogs: (flaggedLogs || []).map((fl) => ({ ...fl, profile: fl.employee || fl.profile })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Dashboard data fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

