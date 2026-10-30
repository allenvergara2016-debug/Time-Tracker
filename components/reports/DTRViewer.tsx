'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Printer, Download, Calendar, DollarSign, Clock, Users, User, ArrowRight } from 'lucide-react';
import { EmployeeDTR } from '@/app/api/reports/dtr/route';

interface Props {
  isAdmin?: boolean;
}

export default function DTRViewer({ isAdmin = false }: Props) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();

  const [startDate, setStartDate] = useState(
    `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
  );
  const [endDate, setEndDate] = useState(
    `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dtrList, setDtrList] = useState<EmployeeDTR[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick Cutoff Presets
  const setCutoff = (preset: 'first_half' | 'second_half' | 'full_month' | 'last_month') => {
    const y = currentYear;
    const m = currentMonth;
    if (preset === 'first_half') {
      setStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
      setEndDate(`${y}-${String(m).padStart(2, '0')}-15`);
    } else if (preset === 'second_half') {
      const lastDay = new Date(y, m, 0).getDate();
      setStartDate(`${y}-${String(m).padStart(2, '0')}-16`);
      setEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'full_month') {
      const lastDay = new Date(y, m, 0).getDate();
      setStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
      setEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'last_month') {
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const lastDay = new Date(prevY, prevM, 0).getDate();
      setStartDate(`${prevY}-${String(prevM).padStart(2, '0')}-01`);
      setEndDate(`${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  const fetchDTR = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (isAdmin && selectedEmployeeId) {
        q.set('employee_id', selectedEmployeeId);
      }

      const res = await fetch(`/api/reports/dtr?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDtrList(data.dtrList || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDTR();
  }, [startDate, endDate, selectedEmployeeId]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (dtrList.length === 0) return;

    const workbook = XLSX.utils.book_new();

    dtrList.forEach((dtr) => {
      const sheetData: (string | number)[][] = [
        ['CIVIL SERVICE FORM NO. 48 / DAILY TIME RECORD'],
        [`Employee Name: ${dtr.employee.fullName}`, `Department: ${dtr.employee.department}`],
        [`Period Covered: ${dtr.period.formattedRange}`],
        [`Daily Wage Rate: ₱${dtr.employee.dailyRate.toFixed(2)}`, `OT Rate/Hour: ₱${dtr.employee.overtimeRatePerHour.toFixed(2)}/hr`],
        [],
        ['Day', 'Date', 'Day of Week', 'A.M. Arrival', 'A.M. Departure', 'P.M. Arrival', 'P.M. Departure', 'Reg. Hours', 'OT Hours', 'OT Pay (₱)', 'Late (Mins)', 'Undertime (Mins)', 'Daily Pay (₱)'],
      ];

      dtr.days.forEach((d) => {
        sheetData.push([
          d.day,
          d.date,
          d.dayOfWeek,
          d.timeIn || '-',
          d.breakStart || '-',
          d.breakEnd || '-',
          d.timeOut || '-',
          d.regularHours,
          d.overtimeHours,
          d.overtimePay,
          d.lateMinutes,
          d.undertimeMinutes,
          d.totalDailyWage,
        ]);
      });

      sheetData.push([]);
      sheetData.push([
        'TOTALS',
        '',
        '',
        `Days Worked: ${dtr.totals.daysWorked}`,
        '',
        '',
        '',
        dtr.totals.totalRegularHours,
        dtr.totals.totalOvertimeHours,
        dtr.totals.totalOvertimePay,
        dtr.totals.totalLateMinutes,
        dtr.totals.totalUndertimeMinutes,
        dtr.totals.totalGrossPay,
      ]);
      sheetData.push([]);
      sheetData.push(['TOTAL BASIC WAGE TO BE GIVEN:', `₱${dtr.totals.totalRegularPay.toFixed(2)}`]);
      sheetData.push(['TOTAL OVERTIME PAY TO BE GIVEN:', `₱${dtr.totals.totalOvertimePay.toFixed(2)}`]);
      sheetData.push(['TOTAL GROSS WAGE TO BE GIVEN:', `₱${dtr.totals.totalGrossPay.toFixed(2)}`]);

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const safeName = dtr.employee.fullName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
    });

    XLSX.writeFile(workbook, `DTR_Payroll_${startDate}_to_${endDate}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar (Hidden during print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Date range pickers */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-500">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-500">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Employee selector (Admin only) */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-500">Employee:</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="all">⭐ All Employees (Batch)</option>
                  {dtrList.map((dtr) => (
                    <option key={dtr.employee.id} value={dtr.employee.id}>
                      {dtr.employee.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Quick Cutoff Preset Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500 font-medium mr-1">Quick Cutoff:</span>
          <button
            onClick={() => setCutoff('first_half')}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition"
          >
            1st to 15th
          </button>
          <button
            onClick={() => setCutoff('second_half')}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition"
          >
            16th to End
          </button>
          <button
            onClick={() => setCutoff('full_month')}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition"
          >
            Full Month
          </button>
          <button
            onClick={() => setCutoff('last_month')}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition"
          >
            Last Month
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          Calculating Daily Time Records and Overtime Pay in Philippine Peso (₱)...
        </div>
      ) : dtrList.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
          No attendance records found for this selected date range.
        </div>
      ) : (
        <div className="space-y-12">
          {dtrList.map((dtr) => (
            <div
              key={dtr.employee.id}
              className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-300 shadow-md max-w-4xl mx-auto print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0 print:break-after-page"
            >
              {/* Official DTR Header */}
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
                <span className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
                  Civil Service Form No. 48 / Standard Corporate Timesheet
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 mt-1">
                  DAILY TIME RECORD
                </h2>
                <div className="text-sm font-bold text-blue-800 mt-1">
                  Period: {dtr.period.formattedRange}
                </div>
              </div>

              {/* Employee Wage Details in Philippine Peso (₱) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-slate-200 pb-4 mb-4">
                <div>
                  <span className="text-slate-500 font-medium block">Employee Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{dtr.employee.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Department:</span>
                  <span className="font-semibold text-slate-800">{dtr.employee.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Daily Wage Rate:</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {dtr.employee.dailyRate > 0 ? `₱${dtr.employee.dailyRate.toFixed(2)} / day` : 'Not set'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Overtime Rate per Hour:</span>
                  <span className="font-bold text-amber-700 text-sm">
                    {dtr.employee.overtimeRatePerHour > 0 ? `₱${dtr.employee.overtimeRatePerHour.toFixed(2)} / hr` : '₱0.00 / hr'}
                  </span>
                </div>
              </div>

              {/* Official DTR Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-[11px]">
                  <thead>
                    <tr className="border-y-2 border-slate-800 bg-slate-100 font-bold text-slate-800">
                      <th rowSpan={2} className="border-r border-slate-300 py-2 px-1 w-10">Day</th>
                      <th colSpan={2} className="border-r border-slate-300 py-1">A.M.</th>
                      <th colSpan={2} className="border-r border-slate-300 py-1">P.M.</th>
                      <th colSpan={2} className="border-r border-slate-300 py-1 bg-amber-50">Overtime</th>
                      <th colSpan={2} className="border-r border-slate-300 py-1">Tardiness</th>
                      <th rowSpan={2} className="py-2 px-2 bg-emerald-50">Daily Wage (₱)</th>
                    </tr>
                    <tr className="border-b border-slate-800 bg-slate-50 text-[10px] text-slate-600">
                      <th className="border-r border-slate-300 py-1 px-1">Arrival</th>
                      <th className="border-r border-slate-300 py-1 px-1">Departure</th>
                      <th className="border-r border-slate-300 py-1 px-1">Arrival</th>
                      <th className="border-r border-slate-300 py-1 px-1">Departure</th>
                      <th className="border-r border-slate-300 py-1 px-1 bg-amber-50">Hours</th>
                      <th className="border-r border-slate-300 py-1 px-1 bg-amber-50">OT Pay (₱)</th>
                      <th className="border-r border-slate-300 py-1 px-1">Late (M)</th>
                      <th className="border-r border-slate-300 py-1 px-1">Under (M)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dtr.days.map((d) => (
                      <tr
                        key={d.date}
                        className={`hover:bg-slate-50 ${
                          d.dayOfWeek === 'Sun' || d.dayOfWeek === 'Sat' ? 'bg-slate-50/70 text-slate-500 font-medium' : ''
                        }`}
                      >
                        <td className="border-r border-slate-300 py-1 px-1 font-bold text-slate-700">
                          {d.day} <span className="text-[9px] font-normal text-slate-400">({d.dayOfWeek})</span>
                        </td>
                        <td className="border-r border-slate-200 py-1 px-1 font-mono">{d.timeIn || '-'}</td>
                        <td className="border-r border-slate-200 py-1 px-1 font-mono">{d.breakStart || '-'}</td>
                        <td className="border-r border-slate-200 py-1 px-1 font-mono">{d.breakEnd || '-'}</td>
                        <td className="border-r border-slate-200 py-1 px-1 font-mono">{d.timeOut || '-'}</td>
                        {/* Overtime */}
                        <td className="border-r border-slate-200 py-1 px-1 bg-amber-50/40 font-bold text-amber-700">
                          {d.overtimeHours > 0 ? `${d.overtimeHours}h` : '-'}
                        </td>
                        <td className="border-r border-slate-200 py-1 px-1 bg-amber-50/40 text-amber-800 font-mono">
                          {d.overtimePay > 0 ? `₱${d.overtimePay.toFixed(2)}` : '-'}
                        </td>
                        {/* Late / Undertime */}
                        <td className="border-r border-slate-200 py-1 px-1 text-rose-600 font-medium">
                          {d.lateMinutes > 0 ? `${d.lateMinutes}m` : '-'}
                        </td>
                        <td className="border-r border-slate-200 py-1 px-1 text-rose-600 font-medium">
                          {d.undertimeMinutes > 0 ? `${d.undertimeMinutes}m` : '-'}
                        </td>
                        {/* Daily Pay */}
                        <td className="py-1 px-2 font-mono font-semibold text-emerald-800 bg-emerald-50/30">
                          {d.totalDailyWage > 0 ? `₱${d.totalDailyWage.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals Summary Footer */}
                  <tfoot>
                    <tr className="border-t-2 border-b-2 border-slate-900 bg-slate-100 font-bold text-slate-900 text-xs">
                      <td className="border-r border-slate-300 py-2">TOTAL</td>
                      <td colSpan={4} className="border-r border-slate-300 py-2 text-left px-3">
                        Days Worked: <b>{dtr.totals.daysWorked} days</b> | Reg. Hours: <b>{dtr.totals.totalRegularHours} hrs</b>
                      </td>
                      <td className="border-r border-slate-300 py-2 bg-amber-100 text-amber-900">
                        {dtr.totals.totalOvertimeHours} hrs
                      </td>
                      <td className="border-r border-slate-300 py-2 bg-amber-100 text-amber-900">
                        ₱{dtr.totals.totalOvertimePay.toFixed(2)}
                      </td>
                      <td className="border-r border-slate-300 py-2 text-rose-700">
                        {dtr.totals.totalLateMinutes}m
                      </td>
                      <td className="border-r border-slate-300 py-2 text-rose-700">
                        {dtr.totals.totalUndertimeMinutes}m
                      </td>
                      <td className="py-2 px-2 bg-emerald-100 text-emerald-950 font-black text-sm">
                        ₱{dtr.totals.totalGrossPay.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* TOTAL WAGE TO BE GIVEN SUMMARY BOX */}
              <div className="mt-6 p-5 rounded-2xl bg-slate-50 border-2 border-slate-300 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block uppercase">Total Basic Daily Wage:</span>
                  <p className="font-extrabold text-slate-900 text-base">
                    ₱{dtr.totals.totalRegularPay.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    ({dtr.totals.daysWorked} days worked @ ₱{dtr.employee.dailyRate.toFixed(2)}/day)
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block uppercase">Total Overtime Pay:</span>
                  <p className="font-extrabold text-amber-700 text-base">
                    + ₱{dtr.totals.totalOvertimePay.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    ({dtr.totals.totalOvertimeHours} hrs OT @ ₱{dtr.employee.overtimeRatePerHour.toFixed(2)}/hr)
                  </p>
                </div>

                <div className="border-t sm:border-t-0 sm:border-l border-slate-300 pt-3 sm:pt-0 sm:pl-6 space-y-1">
                  <span className="text-emerald-800 font-black text-xs uppercase tracking-wider block">
                    TOTAL WAGE TO BE GIVEN:
                  </span>
                  <div className="px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-md inline-block">
                    <span className="font-mono text-xl sm:text-2xl font-black">
                      ₱{dtr.totals.totalGrossPay.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Official Certification Signature Block */}
              <div className="mt-8 pt-6 border-t border-slate-300 text-xs text-slate-700">
                <p className="italic text-center text-slate-600 mb-8 max-w-xl mx-auto">
                  &quot;I certify on my honor that the above is a true and correct report of the hours of work performed,
                  record of which was made daily at the time of arrival and departure from office.&quot;
                </p>

                <div className="grid grid-cols-2 gap-8 text-center pt-4">
                  <div>
                    <div className="border-b border-slate-400 w-48 sm:w-64 mx-auto mb-1" />
                    <span className="font-bold uppercase text-[11px] block">{dtr.employee.fullName}</span>
                    <span className="text-[10px] text-slate-500">Employee Signature</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 w-48 sm:w-64 mx-auto mb-1" />
                    <span className="font-bold uppercase text-[11px] block">Verified In-Charge</span>
                    <span className="text-[10px] text-slate-500">Supervisor / Administrator</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
