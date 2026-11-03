import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPHTime, parseShiftToPHDate, getTimezoneLabel } from '@/lib/ph-time';
import { getCompanyTimezone } from '@/lib/company-timezone';

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
  regularPay: number | null;
  overtimePay: number | null;
  totalDailyWage: number | null;
  status: string;
  regularRate?: number | null;
  hourlyRate?: number | null;
  overtimeRatePerHour?: number | null;
  rateNotSet?: boolean;
  ratesHidden?: boolean;
  formula?: string;
  isHoliday?: boolean;
  holidayName?: string;
}

export interface EmployeeDTR {
  employee: {
    id: string;
    fullName: string;
    email: string;
    department: string;
    shift: string;
    dailyRate: number | null;
    hourlyRate: number | null;
    overtimeRatePerHour: number | null;
    rateNotSet?: boolean;
    ratesHidden?: boolean;
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
    totalRegularPay: number | null; // Daily wages
    totalOvertimePay: number | null; // Overtime pay
    totalGrossPay: number | null; // Total wage to be given
    rateNotSet?: boolean;
    ratesHidden?: boolean;
    summaryFormula?: string;
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

    // 1. Fetch targeted employees (including archived employees to preserve historical records)
    let employeesQuery = adminClient
      .from('profiles')
      .select('*, department:departments(name), shift:shifts(name, start_time, end_time, break_start, break_end)');

    if (!isAdmin) {
      // Regular employees can only view their own DTR
      employeesQuery = employeesQuery.eq('id', user.id);
    } else if (requestedEmployeeId && requestedEmployeeId !== 'all') {
      employeesQuery = employeesQuery.eq('id', requestedEmployeeId);
    }

    const { data: employees, error: empErr } = await employeesQuery;
    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    const targetEmpIds = (employees || []).map((e) => e.id);

    // 2. Fetch global app settings for labor computation
    const { data: appSettings } = await adminClient
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    const showRatesToEmployees = Boolean(appSettings?.show_rates_to_employees);
    const hoursPerDay = Number(appSettings?.hours_per_day) || 8.00;
    const undertimeMinutesBasis = appSettings?.undertime_minutes_basis || 'exact'; // 'exact' | '15_min_block'
    const requireOvertimeApproval = appSettings?.require_overtime_approval !== false; // default true
    const overtimeRoundingRule = appSettings?.overtime_rounding_rule || 'exact'; // 'exact' | '30_min_block'
    const enableSpecialDayRates = Boolean(appSettings?.enable_special_day_rates);

    // If caller is non-admin and rates are not visible, hide rates
    const ratesHiddenForCaller = !isAdmin && !showRatesToEmployees;

    // 3. Fetch all rate history for target employees
    const { data: allRates } = await adminClient
      .from('employee_rates')
      .select('*')
      .in('employee_id', targetEmpIds)
      .order('effective_from', { ascending: true })
      .order('created_at', { ascending: true });

    // Group rates by employee_id -> array of rate tiers
    const ratesByEmployee = new Map<string, typeof allRates>();
    (allRates || []).forEach((r) => {
      if (!ratesByEmployee.has(r.employee_id)) {
        ratesByEmployee.set(r.employee_id, []);
      }
      ratesByEmployee.get(r.employee_id)!.push(r);
    });

    // 4. Fetch holidays in the range
    const { data: holidays } = await adminClient
      .from('holidays')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    const holidayMap = new Map((holidays || []).map((h) => [h.date, h]));

    // 5. Fetch all attendance logs in the date range
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

    const activeTz = await getCompanyTimezone();
    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);

    const dtrList: EmployeeDTR[] = (employees || []).map((emp) => {
      const empLogs = logsByEmpAndDate.get(emp.id) || new Map();
      const empRateTiers = ratesByEmployee.get(emp.id) || [];

      // Helper: get rate effective on date
      const getEffectiveRateForDate = (dateStr: string) => {
        // Find latest rate tier with effective_from <= dateStr
        const eligible = empRateTiers.filter((r) => r.effective_from <= dateStr);
        if (eligible.length > 0) {
          // Return the last one (highest effective_from and created_at)
          return eligible[eligible.length - 1];
        }
        // Fallback to latest profile cached rate if exists
        if (emp.daily_rate && Number(emp.daily_rate) > 0) {
          return {
            regular_rate: Number(emp.daily_rate),
            overtime_rate_per_hour: Number(emp.overtime_rate_per_hour) || 0,
            rest_day_ot_rate: null,
            holiday_ot_rate: null,
            effective_from: 'legacy',
          };
        }
        return null;
      };

      const dayRecords: DTRDayRecord[] = [];
      let daysWorked = 0;
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let totalLateMinutes = 0;
      let totalUndertimeMinutes = 0;
      let totalRegularPay = 0;
      let totalOvertimePay = 0;
      let employeeHasAnyRateNotSet = false;

      // Loop through each day in the date range
      const curr = new Date(startObj);
      let dayIndex = 1;

      while (curr <= endObj) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayOfWeek = curr.toLocaleDateString('en-US', { timeZone: activeTz, weekday: 'short' });
        const holidayRecord = holidayMap.get(dateStr);
        const isRestDay = dayOfWeek === 'Sun' || dayOfWeek === 'Sat';

        const log = empLogs.get(dateStr);
        const effectiveRate = getEffectiveRateForDate(dateStr);

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
          timeInStr = log.time_in ? formatPHTime(log.time_in, false, activeTz) : null;
          timeOutStr = log.time_out ? formatPHTime(log.time_out, false, activeTz) : null;

          // Break records (or scheduled break default)
          const firstBreak = log.breaks?.[0];
          if (firstBreak) {
            breakStartStr = firstBreak.break_start ? formatPHTime(firstBreak.break_start, false, activeTz) : null;
            breakEndStr = firstBreak.break_end ? formatPHTime(firstBreak.break_end, false, activeTz) : null;
          } else if (emp.shift?.break_start && emp.shift?.break_end && log.time_in && log.time_out) {
            breakStartStr = formatPHTime(parseShiftToPHDate(emp.shift.break_start, dateStr, activeTz), false, activeTz);
            breakEndStr = formatPHTime(parseShiftToPHDate(emp.shift.break_end, dateStr, activeTz), false, activeTz);
          }

          const hoursWorked = log.hours_worked || 0;
          otMinutes = log.overtime_minutes || 0;
          lateMins = log.late_minutes || 0;
          underMins = log.undertime_minutes || 0;
          status = log.status || 'present';

          // Overtime minutes rounding rule
          let computedOtMinutes = otMinutes;
          if (overtimeRoundingRule === '30_min_block') {
            computedOtMinutes = Math.floor(otMinutes / 30) * 30;
          }

          // Overtime approval check
          const isOtApproved = !requireOvertimeApproval || Boolean(log.overtime_approved);
          otHours = isOtApproved ? Number((computedOtMinutes / 60).toFixed(2)) : 0;

          // Standard regular hours capped at hoursPerDay
          regularHours = Number(Math.min(hoursPerDay, Math.max(0, hoursWorked - (otMinutes / 60))).toFixed(2));
        }

        // Wage and deduction computation
        let dayRegPay: number | null = null;
        let dayOtPay: number | null = null;
        let totalDailyWage: number | null = null;
        let formula = '';
        const dayRateNotSet = !effectiveRate || Number(effectiveRate.regular_rate) <= 0;

        if (dayRateNotSet) {
          employeeHasAnyRateNotSet = true;
          formula = 'Rate not set by management';
        } else if (ratesHiddenForCaller) {
          formula = 'Rates hidden by company policy';
        } else {
          const regRate = Number(effectiveRate.regular_rate);
          const hourlyDeductionRate = regRate / hoursPerDay;

          // Undertime deduction minutes basis
          let deductionMinutes = lateMins + underMins;
          if (undertimeMinutesBasis === '15_min_block' && deductionMinutes > 0) {
            deductionMinutes = Math.ceil(deductionMinutes / 15) * 15;
          }

          const deductionAmount = Number(((deductionMinutes / 60) * hourlyDeductionRate).toFixed(2));

          if (log) {
            if (regularHours >= hoursPerDay && deductionMinutes === 0) {
              dayRegPay = regRate;
            } else {
              const baseEarned = Number(((regularHours / hoursPerDay) * regRate).toFixed(2));
              dayRegPay = Number(Math.max(0, baseEarned - deductionAmount).toFixed(2));
            }
          } else {
            dayRegPay = 0;
          }

          // Applicable Flat Overtime Rate
          let applicableOtRate = Number(effectiveRate.overtime_rate_per_hour);
          let otRateTypeLabel = 'Std OT';

          if (enableSpecialDayRates) {
            if (holidayRecord && effectiveRate.holiday_ot_rate && Number(effectiveRate.holiday_ot_rate) > 0) {
              applicableOtRate = Number(effectiveRate.holiday_ot_rate);
              otRateTypeLabel = 'Holiday OT';
            } else if (isRestDay && effectiveRate.rest_day_ot_rate && Number(effectiveRate.rest_day_ot_rate) > 0) {
              applicableOtRate = Number(effectiveRate.rest_day_ot_rate);
              otRateTypeLabel = 'Rest Day OT';
            }
          }

          dayOtPay = Number((otHours * applicableOtRate).toFixed(2));
          totalDailyWage = Number(((dayRegPay || 0) + dayOtPay).toFixed(2));

          formula = `Reg: (₱${regRate.toFixed(2)} ÷ ${hoursPerDay}h) - ded. ₱${deductionAmount.toFixed(2)} | ${otRateTypeLabel}: ${otHours}h × ₱${applicableOtRate.toFixed(2)}/h`;

          totalRegularPay += dayRegPay || 0;
          totalOvertimePay += dayOtPay;
        }

        totalRegularHours += regularHours;
        totalOvertimeHours += otHours;
        totalLateMinutes += lateMins;
        totalUndertimeMinutes += underMins;

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
          regularRate: effectiveRate ? Number(effectiveRate.regular_rate) : null,
          hourlyRate: effectiveRate ? Number((Number(effectiveRate.regular_rate) / hoursPerDay).toFixed(2)) : null,
          overtimeRatePerHour: effectiveRate ? Number(effectiveRate.overtime_rate_per_hour) : null,
          rateNotSet: dayRateNotSet,
          ratesHidden: ratesHiddenForCaller,
          formula,
          isHoliday: Boolean(holidayRecord),
          holidayName: holidayRecord?.name,
        });

        curr.setDate(curr.getDate() + 1);
        dayIndex++;
      }

      // Check overall employee rate state
      const latestEffectiveRate = getEffectiveRateForDate(endDateStr);
      const isRateNotSetOverall = !latestEffectiveRate || Number(latestEffectiveRate.regular_rate) <= 0 || employeeHasAnyRateNotSet;

      const finalRegularPay = ratesHiddenForCaller || isRateNotSetOverall ? null : Number(totalRegularPay.toFixed(2));
      const finalOtPay = ratesHiddenForCaller || isRateNotSetOverall ? null : Number(totalOvertimePay.toFixed(2));
      const finalGrossPay = ratesHiddenForCaller || isRateNotSetOverall ? null : Number(((finalRegularPay || 0) + (finalOtPay || 0)).toFixed(2));

      let summaryFormula = '';
      if (isRateNotSetOverall) {
        summaryFormula = 'Rate not set by management. Payroll computation locked.';
      } else if (ratesHiddenForCaller) {
        summaryFormula = 'Rates hidden by company policy.';
      } else {
        summaryFormula = `Gross Pay = Regular Pay (₱${(finalRegularPay || 0).toFixed(2)}) + Overtime Pay (₱${(finalOtPay || 0).toFixed(2)}) = ₱${(finalGrossPay || 0).toFixed(2)}`;
      }

      const formattedFullName = emp.is_active ? emp.full_name : `${emp.full_name} (Archived)`;

      return {
        employee: {
          id: emp.id,
          fullName: formattedFullName,
          email: emp.email,
          department: emp.department?.name || 'General',
          shift: emp.shift?.name || 'Regular Shift',
          dailyRate: latestEffectiveRate ? Number(latestEffectiveRate.regular_rate) : null,
          hourlyRate: latestEffectiveRate ? Number((Number(latestEffectiveRate.regular_rate) / hoursPerDay).toFixed(2)) : null,
          overtimeRatePerHour: latestEffectiveRate ? Number(latestEffectiveRate.overtime_rate_per_hour) : null,
          rateNotSet: isRateNotSetOverall,
          ratesHidden: ratesHiddenForCaller,
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
          totalRegularPay: finalRegularPay,
          totalOvertimePay: finalOtPay,
          totalGrossPay: finalGrossPay,
          rateNotSet: isRateNotSetOverall,
          ratesHidden: ratesHiddenForCaller,
          summaryFormula,
        },
      };
    });

    return NextResponse.json({
      period: { startDate: startDateStr, endDate: endDateStr },
      timezone: activeTz,
      timezoneLabel: getTimezoneLabel(activeTz),
      computationSettings: {
        hoursPerDay,
        undertimeMinutesBasis,
        requireOvertimeApproval,
        overtimeRoundingRule,
        enableSpecialDayRates,
        showRatesToEmployees,
      },
      dtrList,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DTR generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
