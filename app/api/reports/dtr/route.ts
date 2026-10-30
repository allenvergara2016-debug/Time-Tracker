import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface DTRDayRecord {
  day: number;
  date: string;
  dayOfWeek: string;
  timeIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  timeOut: string | null;
  regularHours: number;
  overtimeMinutes: number;
  overtimeHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  regularPay: number;
  overtimePay: number;
  totalDailyWage: number;
  status: string;
}

export interface EmployeeDTR {
  employee: {
    id: string;
    fullName: string;
    email: string;
    department: string;
    shift: string;
    dailyRate: number;
    hourlyRate: number;
    overtimeRatePerHour: number;
  };
  period: {
    startDate: string;
    endDate: string;
    formattedRange: string;
    daysCount: number;
  };
  days: DTRDayRecord[];
  totals: {
    daysWorked: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalLateMinutes: number;
    totalUndertimeMinutes: number;
    totalRegularPay: number; // Daily wages
    totalOvertimePay: number; // Overtime pay
    totalGrossPay: number; // Total wage to be given
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: currentProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = currentProfile?.role === 'admin';

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const requestedEmployeeId = searchParams.get('employee_id');

    // Date range support: start_date & end_date OR year & month
    let startDateStr = searchParams.get('start_date');
    let endDateStr = searchParams.get('end_date');

    if (!startDateStr || !endDateStr) {
      const year = Number(searchParams.get('year')) || now.getFullYear();
      const month = Number(searchParams.get('month')) || (now.getMonth() + 1);
      const daysInMonth = new Date(year, month, 0).getDate();
      startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    }

    // 1. Fetch targeted employees
    let employeesQuery = adminClient
      .from('profiles')
      .select('*, department:departments(name), shift:shifts(name, start_time, end_time, break_start, break_end)')
      .eq('is_active', true);

    if (!isAdmin) {
      // Regular employees can only view their own DTR
      employeesQuery = employeesQuery.eq('id', user.id);
    } else if (requestedEmployeeId && requestedEmployeeId !== 'all') {
      employeesQuery = employeesQuery.eq('id', requestedEmployeeId);
    }

    const { data: employees, error: empErr } = await employeesQuery;
    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // 2. Fetch all attendance logs in the date range
    const { data: logs, error: logsErr } = await adminClient
      .from('attendance_logs')
      .select('*, breaks(*)')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (logsErr) return NextResponse.json({ error: logsErr.message }, { status: 500 });

    // Group logs by employee_id -> date -> log
    const logsByEmpAndDate = new Map<string, Map<string, typeof logs[0]>>();
    (logs || []).forEach((log) => {
      if (!logsByEmpAndDate.has(log.employee_id)) {
        logsByEmpAndDate.set(log.employee_id, new Map());
      }
      logsByEmpAndDate.get(log.employee_id)!.set(log.date, log);
    });

    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);

    const dtrList: EmployeeDTR[] = (employees || []).map((emp) => {
      const empLogs = logsByEmpAndDate.get(emp.id) || new Map();
      const dailyRate = Number(emp.daily_rate) || 0;
      const hourlyRate = Number(emp.hourly_rate) || (dailyRate > 0 ? Number((dailyRate / 8).toFixed(2)) : 0);
      const overtimeRatePerHour = Number(emp.overtime_rate_per_hour) || (hourlyRate > 0 ? Number((hourlyRate * 1.25).toFixed(2)) : 0);

      const dayRecords: DTRDayRecord[] = [];
      let daysWorked = 0;
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let totalLateMinutes = 0;
      let totalUndertimeMinutes = 0;
      let totalRegularPay = 0;
      let totalOvertimePay = 0;

      // Loop through each day in the date range
      const curr = new Date(startObj);
      let dayIndex = 1;

      while (curr <= endObj) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayOfWeek = curr.toLocaleDateString('en-US', { weekday: 'short' });

        const log = empLogs.get(dateStr);

        let timeInStr: string | null = null;
        let timeOutStr: string | null = null;
        let breakStartStr: string | null = null;
        let breakEndStr: string | null = null;
        let regularHours = 0;
        let otMinutes = 0;
        let otHours = 0;
        let lateMins = 0;
        let underMins = 0;
        let status = 'absent';

        if (log) {
          daysWorked++;
          timeInStr = log.time_in ? new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
          timeOutStr = log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

          // Break records (or scheduled break default)
          const firstBreak = log.breaks?.[0];
          if (firstBreak) {
            breakStartStr = firstBreak.break_start ? new Date(firstBreak.break_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
            breakEndStr = firstBreak.break_end ? new Date(firstBreak.break_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
          } else if (emp.shift?.break_start && emp.shift?.break_end && log.time_in && log.time_out) {
            breakStartStr = emp.shift.break_start.slice(0, 5);
            breakEndStr = emp.shift.break_end.slice(0, 5);
          }

          const hoursWorked = log.hours_worked || 0;
          otMinutes = log.overtime_minutes || 0;
          otHours = Number((otMinutes / 60).toFixed(2));
          lateMins = log.late_minutes || 0;
          underMins = log.undertime_minutes || 0;
          status = log.status || 'present';

          // Standard regular hours capped at 8 per workday
          regularHours = Number(Math.min(8, Math.max(0, hoursWorked - otHours)).toFixed(2));
        }

        // Wage calculation in Philippine Peso (₱)
        let dayRegPay = 0;
        if (dailyRate > 0) {
          dayRegPay = regularHours >= 8 ? dailyRate : Number(((dailyRate / 8) * regularHours).toFixed(2));
        } else if (hourlyRate > 0) {
          dayRegPay = Number((regularHours * hourlyRate).toFixed(2));
        }

        const dayOtPay = Number((otHours * overtimeRatePerHour).toFixed(2));
        const totalDailyWage = Number((dayRegPay + dayOtPay).toFixed(2));

        totalRegularHours += regularHours;
        totalOvertimeHours += otHours;
        totalLateMinutes += lateMins;
        totalUndertimeMinutes += underMins;
        totalRegularPay += dayRegPay;
        totalOvertimePay += dayOtPay;

        dayRecords.push({
          day: dayIndex,
          date: dateStr,
          dayOfWeek,
          timeIn: timeInStr,
          breakStart: breakStartStr,
          breakEnd: breakEndStr,
          timeOut: timeOutStr,
          regularHours,
          overtimeMinutes: otMinutes,
          overtimeHours: otHours,
          lateMinutes: lateMins,
          undertimeMinutes: underMins,
          regularPay: dayRegPay,
          overtimePay: dayOtPay,
          totalDailyWage,
          status,
        });

        curr.setDate(curr.getDate() + 1);
        dayIndex++;
      }

      const totalGrossPay = Number((totalRegularPay + totalOvertimePay).toFixed(2));

      return {
        employee: {
          id: emp.id,
          fullName: emp.full_name,
          email: emp.email,
          department: emp.department?.name || 'General',
          shift: emp.shift?.name || 'Regular Shift',
          dailyRate,
          hourlyRate,
          overtimeRatePerHour,
        },
        period: {
          startDate: startDateStr,
          endDate: endDateStr,
          formattedRange: `${startDateStr} to ${endDateStr}`,
          daysCount: dayRecords.length,
        },
        days: dayRecords,
        totals: {
          daysWorked,
          totalRegularHours: Number(totalRegularHours.toFixed(2)),
          totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
          totalLateMinutes,
          totalUndertimeMinutes,
          totalRegularPay: Number(totalRegularPay.toFixed(2)),
          totalOvertimePay: Number(totalOvertimePay.toFixed(2)),
          totalGrossPay,
        },
      };
    });

    return NextResponse.json({
      period: { startDate: startDateStr, endDate: endDateStr },
      dtrList,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DTR generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
