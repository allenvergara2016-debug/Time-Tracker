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

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const departmentId = searchParams.get('department_id');
    const employeeId = searchParams.get('employee_id');

    let query = adminClient
      .from('attendance_logs')
      .select(`
        *,
        employee:profiles(id, full_name, email, department:departments(name), shift:shifts(name, start_time, end_time)),
        location_in:locations!location_in_id(name),
        location_out:locations!location_out_id(name)
      `)
      .order('date', { ascending: false });

    if (!isAdmin) {
      // Employees only view their own
      query = query.eq('employee_id', user.id);
    } else {
      if (employeeId) query = query.eq('employee_id', employeeId);
      if (departmentId) query = query.eq('employee.department_id', departmentId);
    }

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data: logs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Compute aggregated summary
    let totalHoursWorked = 0;
    let totalLateMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalUndertimeMinutes = 0;
    let lateDaysCount = 0;
    let presentDaysCount = 0;

    (logs || []).forEach((l) => {
      totalHoursWorked += l.hours_worked || 0;
      totalLateMinutes += l.late_minutes || 0;
      totalOvertimeMinutes += l.overtime_minutes || 0;
      totalUndertimeMinutes += l.undertime_minutes || 0;
      if (l.late_minutes > 0 || l.status === 'late') lateDaysCount++;
      if (l.time_in) presentDaysCount++;
    });

    return NextResponse.json({
      summary: {
        totalRecords: (logs || []).length,
        presentDaysCount,
        lateDaysCount,
        totalHoursWorked: Number(totalHoursWorked.toFixed(2)),
        totalLateMinutes,
        totalOvertimeMinutes,
        totalUndertimeMinutes,
      },
      logs: logs || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reports fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

