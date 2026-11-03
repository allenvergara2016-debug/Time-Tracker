'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  Clock,
  LogOut,
  CalendarOff,
  UserX,
  AlertTriangle,
  Search,
  X,
  Download,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Building2,
  Calendar,
} from 'lucide-react';
import { AttendanceLog, FailedAttempt, LeaveRequest, Profile } from '@/types/database.types';
import { formatPHTime, formatPHDate, DEFAULT_TIMEZONE } from '@/lib/ph-time';

export type DrilldownStatus = 'present' | 'late' | 'timedOut' | 'onLeave' | 'absent' | 'flagged';

interface StatusDrilldownModalProps {
  isOpen: boolean;
  initialStatus: DrilldownStatus;
  selectedDate: string;
  timezone?: string;
  employees: Profile[];
  attendanceLogs: AttendanceLog[];
  leaves: LeaveRequest[];
  failedAttempts: FailedAttempt[];
  flaggedLogs: AttendanceLog[];
  counts: {
    present: number;
    late: number;
    timedOut: number;
    absent: number;
    onLeave: number;
    flagged: number;
  };
  onClose: () => void;
  onOpenChat?: (employeeId?: string) => void;
}

export default function StatusDrilldownModal({
  isOpen,
  initialStatus,
  selectedDate,
  timezone = DEFAULT_TIMEZONE,
  employees,
  attendanceLogs,
  leaves,
  failedAttempts,
  flaggedLogs,
  counts,
  onClose,
  onOpenChat,
}: StatusDrilldownModalProps) {
  const [activeTab, setActiveTab] = useState<DrilldownStatus>(initialStatus);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync activeTab when initialStatus changes upon opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialStatus);
      setSearchQuery('');
    }
  }, [isOpen, initialStatus]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 1. Compute category datasets
  const activeEmployeeLogs = useMemo(() => {
    return attendanceLogs;
  }, [attendanceLogs]);

  // Present employees: logs where status !== 'late'
  const presentItems = useMemo(() => {
    return activeEmployeeLogs.filter((log) => log.status !== 'late');
  }, [activeEmployeeLogs]);

  // Late employees: logs where status === 'late'
  const lateItems = useMemo(() => {
    return activeEmployeeLogs.filter((log) => log.status === 'late');
  }, [activeEmployeeLogs]);

  // Timed Out employees: logs where time_out is not null
  const timedOutItems = useMemo(() => {
    return activeEmployeeLogs.filter((log) => Boolean(log.time_out));
  }, [activeEmployeeLogs]);

  // On Leave employees: active approved leaves for the date
  const onLeaveItems = useMemo(() => {
    return leaves;
  }, [leaves]);

  // Absent employees: active employees with NO log and NO leave today
  const absentItems = useMemo(() => {
    const loggedEmpIds = new Set(attendanceLogs.map((l) => l.employee_id));
    const leaveEmpIds = new Set(leaves.map((lv) => lv.employee_id));

    return employees.filter(
      (emp) => !loggedEmpIds.has(emp.id) && !leaveEmpIds.has(emp.id)
    );
  }, [employees, attendanceLogs, leaves]);

  // Flagged items: flagged logs + failed attempts
  const flaggedItems = useMemo(() => {
    const combined: Array<{
      id: string;
      type: 'flagged_log' | 'failed_attempt';
      employee?: Profile;
      reason: string;
      time: string;
      locationName?: string;
    }> = [];

    flaggedLogs.forEach((fl) => {
      combined.push({
        id: `flag_${fl.id}`,
        type: 'flagged_log',
        employee: fl.employee || fl.profile,
        reason: fl.flag_reason || 'Flagged attendance entry',
        time: fl.time_in,
        locationName: fl.location_in?.name,
      });
    });

    failedAttempts.forEach((fa) => {
      combined.push({
        id: `fail_${fa.id}`,
        type: 'failed_attempt',
        employee: fa.profile,
        reason: fa.reason || 'Failed tap attempt',
        time: fa.created_at,
        locationName: fa.nearest_location_name || undefined,
      });
    });

    return combined;
  }, [flaggedLogs, failedAttempts]);

  // Filter items based on searchQuery
  const filteredPresent = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return presentItems;
    return presentItems.filter((log) => {
      const name = (log.profile?.full_name || log.employee?.full_name || '').toLowerCase();
      const email = (log.profile?.email || log.employee?.email || '').toLowerCase();
      const dept = ((log.profile as any)?.department?.name || (log.employee as any)?.department?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [presentItems, searchQuery]);

  const filteredLate = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return lateItems;
    return lateItems.filter((log) => {
      const name = (log.profile?.full_name || log.employee?.full_name || '').toLowerCase();
      const email = (log.profile?.email || log.employee?.email || '').toLowerCase();
      const dept = ((log.profile as any)?.department?.name || (log.employee as any)?.department?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [lateItems, searchQuery]);

  const filteredTimedOut = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return timedOutItems;
    return timedOutItems.filter((log) => {
      const name = (log.profile?.full_name || log.employee?.full_name || '').toLowerCase();
      const email = (log.profile?.email || log.employee?.email || '').toLowerCase();
      const dept = ((log.profile as any)?.department?.name || (log.employee as any)?.department?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [timedOutItems, searchQuery]);

  const filteredOnLeave = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return onLeaveItems;
    return onLeaveItems.filter((item) => {
      const name = (item.employee?.full_name || item.profile?.full_name || '').toLowerCase();
      const email = (item.employee?.email || item.profile?.email || '').toLowerCase();
      const reason = (item.reason || '').toLowerCase();
      const type = (item.leave_type || '').toLowerCase();
      return name.includes(q) || email.includes(q) || reason.includes(q) || type.includes(q);
    });
  }, [onLeaveItems, searchQuery]);

  const filteredAbsent = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return absentItems;
    return absentItems.filter((emp) => {
      const name = (emp.full_name || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const dept = ((emp as any)?.department?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [absentItems, searchQuery]);

  const filteredFlagged = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return flaggedItems;
    return flaggedItems.filter((item) => {
      const name = (item.employee?.full_name || '').toLowerCase();
      const email = (item.employee?.email || '').toLowerCase();
      const reason = (item.reason || '').toLowerCase();
      return name.includes(q) || email.includes(q) || reason.includes(q);
    });
  }, [flaggedItems, searchQuery]);

  if (!isOpen) return null;

  // Tab config
  const tabs: Array<{
    key: DrilldownStatus;
    label: string;
    count: number;
    color: string;
    activeBg: string;
    icon: React.ElementType;
  }> = [
    {
      key: 'present',
      label: 'Present',
      count: counts.present,
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      icon: UserCheck,
    },
    {
      key: 'late',
      label: 'Late',
      count: counts.late,
      color: 'text-amber-400',
      activeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
      icon: Clock,
    },
    {
      key: 'timedOut',
      label: 'Timed Out',
      count: counts.timedOut,
      color: 'text-blue-400',
      activeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      icon: LogOut,
    },
    {
      key: 'onLeave',
      label: 'On Leave',
      count: counts.onLeave,
      color: 'text-purple-400',
      activeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
      icon: CalendarOff,
    },
    {
      key: 'absent',
      label: 'Absent',
      count: counts.absent,
      color: 'text-rose-400',
      activeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
      icon: UserX,
    },
    {
      key: 'flagged',
      label: 'Flagged / Alerts',
      count: counts.flagged,
      color: 'text-rose-500',
      activeBg: 'bg-rose-600/20 text-rose-300 border-rose-500/50',
      icon: AlertTriangle,
    },
  ];

  const currentTab = tabs.find((t) => t.key === activeTab) || tabs[0];

  // Quick export function for the current active list
  const handleExportList = () => {
    let rows: Array<Record<string, string>> = [];

    if (activeTab === 'absent') {
      rows = filteredAbsent.map((emp) => ({
        Status: 'Absent',
        Date: selectedDate,
        Name: emp.full_name,
        Email: emp.email,
        Phone: emp.phone || '--',
        Department: (emp as any)?.department?.name || 'Unassigned',
        Shift: (emp as any)?.shift?.name || 'Standard',
      }));
    } else if (activeTab === 'present') {
      rows = filteredPresent.map((l) => ({
        Status: 'Present (On-time)',
        Date: selectedDate,
        Name: l.profile?.full_name || l.employee?.full_name || 'Unknown',
        TimeIn: formatPHTime(l.time_in, false, timezone),
        Location: l.location_in?.name || 'Office',
        Verification: l.verification_method || 'Biometric',
      }));
    } else if (activeTab === 'late') {
      rows = filteredLate.map((l) => ({
        Status: 'Late',
        Date: selectedDate,
        Name: l.profile?.full_name || l.employee?.full_name || 'Unknown',
        TimeIn: formatPHTime(l.time_in, false, timezone),
        LateMinutes: `${l.late_minutes || 0} mins`,
        Location: l.location_in?.name || 'Office',
      }));
    } else if (activeTab === 'timedOut') {
      rows = filteredTimedOut.map((l) => ({
        Status: 'Timed Out',
        Date: selectedDate,
        Name: l.profile?.full_name || l.employee?.full_name || 'Unknown',
        TimeIn: formatPHTime(l.time_in, false, timezone),
        TimeOut: formatPHTime(l.time_out, false, timezone),
        HoursWorked: `${(l.hours_worked || 0).toFixed(2)} hrs`,
      }));
    } else if (activeTab === 'onLeave') {
      rows = filteredOnLeave.map((lv) => ({
        Status: 'On Leave',
        Name: lv.employee?.full_name || lv.profile?.full_name || 'Unknown',
        LeaveType: lv.leave_type,
        StartDate: lv.start_date,
        EndDate: lv.end_date,
        Reason: lv.reason || '--',
      }));
    } else if (activeTab === 'flagged') {
      rows = filteredFlagged.map((fl) => ({
        Status: 'Flagged / Alert',
        Name: fl.employee?.full_name || 'Unknown',
        Reason: fl.reason,
        Time: formatPHTime(fl.time, false, timezone),
        Location: fl.locationName || '--',
      }));
    }

    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab}_employees_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-800/90 border border-slate-700/60 ${currentTab.color}`}>
              <currentTab.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white truncate">
                  {currentTab.label} Employees
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {currentTab.count} {currentTab.count === 1 ? 'Person' : 'People'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Date: <strong className="text-slate-200">{formatPHDate(selectedDate, timezone)}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportList}
              title="Export this list to CSV"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700/60"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Switcher Tabs */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-slate-800/80 bg-slate-900/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  isActive
                    ? tab.activeBg
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-800/60 bg-slate-900/30 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${currentTab.label.toLowerCase()} employees by name, email, department...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Employee List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {/* TAB: PRESENT */}
          {activeTab === 'present' && (
            <>
              {filteredPresent.length === 0 ? (
                <EmptyState
                  icon={UserCheck}
                  title="No on-time present employees found"
                  desc={
                    searchQuery
                      ? 'No employees match your search query.'
                      : 'No employees have checked in on time for this date.'
                  }
                />
              ) : (
                filteredPresent.map((log) => {
                  const emp = log.profile || log.employee;
                  const dept = (emp as any)?.department?.name || 'Unassigned';
                  const shift = (emp as any)?.shift?.name || 'Standard Shift';

                  return (
                    <div
                      key={log.id}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar name={emp?.full_name} avatarUrl={emp?.avatar_url} statusColor="border-emerald-500" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {emp?.full_name || 'Unknown Employee'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Present (On Time)
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {dept}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">{shift}</span>
                            {emp?.email && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-500 truncate">{emp.email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500 uppercase font-medium">Time In</div>
                          <div className="font-bold text-emerald-400 text-sm mt-0.5">
                            {formatPHTime(log.time_in, false, timezone)}
                          </div>
                        </div>

                        {log.location_in?.name && (
                          <div className="text-right hidden md:block">
                            <div className="text-[11px] text-slate-500 uppercase font-medium">Location</div>
                            <div className="font-semibold text-slate-300 text-xs mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-blue-400" />
                              {log.location_in.name}
                            </div>
                          </div>
                        )}

                        {onOpenChat && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenChat(emp?.id);
                            }}
                            title="Chat with employee"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB: LATE */}
          {activeTab === 'late' && (
            <>
              {filteredLate.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No late employees"
                  desc={
                    searchQuery
                      ? 'No late employees match your search query.'
                      : 'All present employees arrived on time today!'
                  }
                />
              ) : (
                filteredLate.map((log) => {
                  const emp = log.profile || log.employee;
                  const dept = (emp as any)?.department?.name || 'Unassigned';
                  const shift = (emp as any)?.shift;

                  return (
                    <div
                      key={log.id}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/40 rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar name={emp?.full_name} avatarUrl={emp?.avatar_url} statusColor="border-amber-500" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {emp?.full_name || 'Unknown Employee'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {log.late_minutes ? `+${log.late_minutes}m Late` : 'Late'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {dept}
                            </span>
                            {shift?.name && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400">
                                  Shift: {shift.name} ({formatPHTime(shift.start_time, false, timezone)})
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500 uppercase font-medium">Time In</div>
                          <div className="font-bold text-amber-400 text-sm mt-0.5">
                            {formatPHTime(log.time_in, false, timezone)}
                          </div>
                        </div>

                        {onOpenChat && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenChat(emp?.id);
                            }}
                            title="Chat with employee"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB: TIMED OUT */}
          {activeTab === 'timedOut' && (
            <>
              {filteredTimedOut.length === 0 ? (
                <EmptyState
                  icon={LogOut}
                  title="No timed out employees yet"
                  desc={
                    searchQuery
                      ? 'No timed-out employees match your search query.'
                      : 'No employees have completed their shifts or clocked out yet today.'
                  }
                />
              ) : (
                filteredTimedOut.map((log) => {
                  const emp = log.profile || log.employee;
                  const dept = (emp as any)?.department?.name || 'Unassigned';

                  return (
                    <div
                      key={log.id}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/40 rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar name={emp?.full_name} avatarUrl={emp?.avatar_url} statusColor="border-blue-500" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {emp?.full_name || 'Unknown Employee'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                              Shift Completed
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {dept}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-emerald-400 font-medium">
                              Total: {(log.hours_worked || 0).toFixed(2)} hrs
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500 uppercase font-medium">Time In</div>
                          <div className="font-semibold text-slate-300 text-xs mt-0.5">
                            {formatPHTime(log.time_in, false, timezone)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500 uppercase font-medium">Time Out</div>
                          <div className="font-bold text-blue-400 text-sm mt-0.5">
                            {formatPHTime(log.time_out, false, timezone)}
                          </div>
                        </div>

                        {onOpenChat && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenChat(emp?.id);
                            }}
                            title="Chat with employee"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB: ON LEAVE */}
          {activeTab === 'onLeave' && (
            <>
              {filteredOnLeave.length === 0 ? (
                <EmptyState
                  icon={CalendarOff}
                  title="No employees on leave"
                  desc={
                    searchQuery
                      ? 'No on-leave employees match your search query.'
                      : 'No approved leaves scheduled for today.'
                  }
                />
              ) : (
                filteredOnLeave.map((lv) => {
                  const emp = lv.employee || lv.profile;
                  const dept = (emp as any)?.department?.name || 'Unassigned';

                  return (
                    <div
                      key={lv.id}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar name={emp?.full_name} avatarUrl={emp?.avatar_url} statusColor="border-purple-500" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {emp?.full_name || 'Unknown Employee'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              {lv.leave_type} Leave
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                              Approved
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {dept}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-300">
                              {formatPHDate(lv.start_date, timezone)} – {formatPHDate(lv.end_date, timezone)}
                            </span>
                          </div>
                          {lv.reason && (
                            <p className="text-xs text-slate-400 italic mt-1.5 truncate max-w-lg">
                              &ldquo;{lv.reason}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {onOpenChat && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenChat(emp?.id);
                            }}
                            title="Chat with employee"
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB: ABSENT */}
          {activeTab === 'absent' && (
            <>
              {filteredAbsent.length === 0 ? (
                <EmptyState
                  icon={UserX}
                  title="No absent employees!"
                  desc={
                    searchQuery
                      ? 'No absent employees match your search query.'
                      : 'All active employees have either clocked in or are on scheduled leave today.'
                  }
                />
              ) : (
                filteredAbsent.map((emp) => {
                  const dept = (emp as any)?.department?.name || 'Unassigned';
                  const shift = (emp as any)?.shift;

                  return (
                    <div
                      key={emp.id}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-rose-500/40 rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar name={emp.full_name} avatarUrl={emp.avatar_url} statusColor="border-rose-500" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {emp.full_name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              Absent
                            </span>
                            <span className="text-[11px] text-slate-500">
                              No tap-in recorded
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {dept}
                            </span>
                            {shift?.name && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400">
                                  Expected Shift: {shift.name} ({formatPHTime(shift.start_time, false, timezone)} - {formatPHTime(shift.end_time, false, timezone)})
                                </span>
                              </>
                            )}
                          </div>
                          {emp.email && (
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {emp.email}
                              </span>
                              {emp.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {emp.phone}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {onOpenChat && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenChat(emp.id);
                            }}
                            title="Message absent employee"
                            className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold border border-blue-500/30"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* TAB: FLAGGED / ALERTS */}
          {activeTab === 'flagged' && (
            <>
              {filteredFlagged.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No security alerts or flagged logs"
                  desc={
                    searchQuery
                      ? 'No alerts match your search query.'
                      : 'All attendance scans and geofence validations passed without issues today.'
                  }
                />
              ) : (
                filteredFlagged.map((item) => {
                  const emp = item.employee;
                  const dept = (emp as any)?.department?.name || 'Unassigned';

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-950/60 border border-slate-800/80 hover:border-rose-500/50 rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar name={emp?.full_name} avatarUrl={emp?.avatar_url} statusColor="border-rose-500" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {emp?.full_name || 'Unknown / Unassigned'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600/20 text-rose-300 border border-rose-500/40">
                              {item.type === 'flagged_log' ? 'Flagged Log' : 'Failed Attempt'}
                            </span>
                          </div>
                          <p className="text-xs text-rose-300/90 font-medium mt-1">
                            {item.reason}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {dept}
                            </span>
                            {item.locationName && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="flex items-center gap-1 text-slate-400">
                                  <MapPin className="w-3 h-3 text-slate-500" />
                                  {item.locationName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs shrink-0 self-end sm:self-auto">
                        <div className="text-[11px] text-slate-500 uppercase font-medium">Recorded At</div>
                        <div className="font-bold text-slate-300 text-xs mt-0.5">
                          {formatPHTime(item.time, false, timezone)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-slate-200">
              {activeTab === 'present' && filteredPresent.length}
              {activeTab === 'late' && filteredLate.length}
              {activeTab === 'timedOut' && filteredTimedOut.length}
              {activeTab === 'onLeave' && filteredOnLeave.length}
              {activeTab === 'absent' && filteredAbsent.length}
              {activeTab === 'flagged' && filteredFlagged.length}
            </strong> records
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Subcomponents for Avatar and EmptyState
function Avatar({
  name,
  avatarUrl,
  statusColor,
}: {
  name?: string;
  avatarUrl?: string | null;
  statusColor: string;
}) {
  const initials = (name || 'E')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      <div className={`relative w-10 h-10 rounded-2xl overflow-hidden border-2 ${statusColor} shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt={name || 'Avatar'} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 border-2 ${statusColor} flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm`}
    >
      {initials}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm">{desc}</p>
    </div>
  );
}

