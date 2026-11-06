'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import RequestsManager from '@/components/dashboard/RequestsManager';
import { exportToCSV, exportToExcel, exportToPDF, ReportItem } from '@/lib/export';
import { formatPHTime, getPHDateString, SUPPORTED_TIMEZONES, getTimezoneLabel } from '@/lib/ph-time';
import { useCompanyTimezone } from '@/lib/use-timezone';
import {
  Users,
  MapPin,
  Clock,
  ShieldAlert,
  FileSpreadsheet,
  Settings,
  Activity,
  Plus,
  RefreshCw,
  LogOut,
  Download,
  AlertTriangle,
  Key,
  Smartphone,
  CheckCircle2,
  Trash2,
  FileText,
  DollarSign,
  Edit2,
  Edit,
  MessageSquare,
  Crown,
  Globe,
  ExternalLink,
  Mail,
  Archive,
  UserCheck,
  ClipboardList,
  Calendar,
  UploadCloud,
  History,
  X,
} from 'lucide-react';
import DTRViewer from '@/components/reports/DTRViewer';
import ChatWindow from '@/components/chat/ChatWindow';
import PasskeyManager from '@/components/auth/PasskeyManager';
import AppLogo from '@/components/ui/AppLogo';
import InstallAppDrawerButton from '@/components/pwa/InstallAppDrawerButton';
import StatusDrilldownModal, { DrilldownStatus } from '@/components/admin/StatusDrilldownModal';
import {
  Profile,
  Location,
  Shift,
  Department,
  AppSettings,
  AttendanceLog,
  FailedAttempt,
  LeaveRequest,
  AuditLog,
  Holiday,
  EmployeeRate,
} from '@/types/database.types';

// Dynamic import for Leaflet maps to disable SSR
const LocationAdminMap = dynamic(() => import('@/components/map/LocationAdminMap'), { ssr: false });
const LiveAttendanceMap = dynamic(() => import('@/components/map/LiveAttendanceMap'), { ssr: false });

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const { timezone, timezoneLabel } = useCompanyTimezone();

  type AdminTab = 'overview' | 'map' | 'employees' | 'locations' | 'shifts' | 'requests' | 'chat' | 'dtr' | 'reports' | 'flagged' | 'settings' | 'audit';
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Restore saved active tab on reload, and persist tab selection
  useEffect(() => {
    const saved = localStorage.getItem('activeAdminTab') as AdminTab;
    if (saved) {
      setActiveTab(saved);
    }
  }, []);

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    localStorage.setItem('activeAdminTab', tab);
  };
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Dashboard Overview Data
  const [selectedDate, setSelectedDate] = useState('');

  // New Employee Modal
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [empFullName, setEmpFullName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empDeptId, setEmpDeptId] = useState('');
  const [empShiftId, setEmpShiftId] = useState('');
  const [empCompanyTag, setEmpCompanyTag] = useState('');
  const [empDailyRate, setEmpDailyRate] = useState('610.00');
  const [empOvertimeRate, setEmpOvertimeRate] = useState('114.38');
  const [empRole, setEmpRole] = useState<'employee' | 'admin'>('employee');
  const [empError, setEmpError] = useState('');

  // Edit Employee Modal
  const [editingEmp, setEditingEmp] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editShiftId, setEditShiftId] = useState('');
  const [editCompanyTag, setEditCompanyTag] = useState('');
  const [editDailyRate, setEditDailyRate] = useState('');
  const [editOvertimeRate, setEditOvertimeRate] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editGoogleEmail, setEditGoogleEmail] = useState('');
  const [editFacebookUrl, setEditFacebookUrl] = useState('');
  const [editRole, setEditRole] = useState<'employee' | 'admin'>('employee');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState('');

  // Directory filter by Company Tag
  const [directoryCompanyTagFilter, setDirectoryCompanyTagFilter] = useState('all');

  // New Shift Modal
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [shiftName, setShiftName] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('08:00');
  const [shiftEndTime, setShiftEndTime] = useState('17:00');
  const [shiftBreakStart, setShiftBreakStart] = useState('12:00');
  const [shiftBreakEnd, setShiftBreakEnd] = useState('13:00');
  const [shiftBreakDuration, setShiftBreakDuration] = useState('60');
  const [shiftGracePeriod, setShiftGracePeriod] = useState('15');
  const [shiftError, setShiftError] = useState('');

  useEffect(() => {
    setSelectedDate(getPHDateString());
  }, []);
  const [selectedDept, setSelectedDept] = useState('');
  const [counts, setCounts] = useState({
    totalEmployees: 0,
    present: 0,
    late: 0,
    timedOut: 0,
    absent: 0,
    onLeave: 0,
    flagged: 0,
  });
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempt[]>([]);
  const [flaggedLogs, setFlaggedLogs] = useState<AttendanceLog[]>([]);
  const [dashboardLeaves, setDashboardLeaves] = useState<LeaveRequest[]>([]);
  const [dashboardEmployees, setDashboardEmployees] = useState<Profile[]>([]);
  const [drilldownStatus, setDrilldownStatus] = useState<DrilldownStatus | null>(null);

  // Delete Employee state
  const [deletingEmp, setDeletingEmp] = useState<Profile | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [isDeletingEmp, setIsDeletingEmp] = useState(false);
  const [deleteEmpError, setDeleteEmpError] = useState('');

  // Audit Logs state
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Holidays state
  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'regular' | 'special_non_working' | 'special_working'>('regular');
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Management Rates & Tier History state
  const [rateEmp, setRateEmp] = useState<Profile | null>(null);
  const [rateHistory, setRateHistory] = useState<EmployeeRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [rateFormRegular, setRateFormRegular] = useState('');
  const [rateFormOt, setRateFormOt] = useState('');
  const [rateFormEffectiveFrom, setRateFormEffectiveFrom] = useState('');
  const [rateFormRestDayOt, setRateFormRestDayOt] = useState('');
  const [rateFormHolidayOt, setRateFormHolidayOt] = useState('');
  const [savingRateTier, setSavingRateTier] = useState(false);
  const [rateModalError, setRateModalError] = useState('');

  // Bulk Rates CSV State
  const [showBulkRatesModal, setShowBulkRatesModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkPreviewData, setBulkPreviewData] = useState<any[] | null>(null);
  const [loadingBulkPreview, setLoadingBulkPreview] = useState(false);
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');

  // Entities
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setAppSettings] = useState<AppSettings | null>(null);

  // Load Admin Data
  const loadDashboardData = async () => {
    try {
      const targetDate = selectedDate || getPHDateString(new Date(), timezone);
      const q = new URLSearchParams({ date: targetDate });
      if (selectedDept) q.set('department_id', selectedDept);

      const res = await fetch(`/api/admin/dashboard?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts);
        setAttendanceLogs(data.attendanceLogs || []);
        setFailedAttempts(data.failedAttempts || []);
        setFlaggedLogs(data.flaggedLogs || []);
        setDashboardLeaves(data.leaves || []);
        if (data.employees) setDashboardEmployees(data.employees);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllEntities = async () => {
    try {
      const [empRes, locRes, shRes, depRes, setRes, chatRes] = await Promise.all([
        fetch('/api/admin/employees'),
        fetch('/api/admin/locations'),
        fetch('/api/admin/shifts'),
        fetch('/api/admin/departments'),
        fetch('/api/admin/settings'),
        fetch('/api/chat/conversations'),
      ]);

      if (empRes.ok) {
        const d = await empRes.json();
        setEmployees(d.employees || []);
      }
      if (locRes.ok) {
        const d = await locRes.json();
        setLocations(d.locations || []);
      }
      if (shRes.ok) {
        const d = await shRes.json();
        setShifts(d.shifts || []);
      }
      if (depRes.ok) {
        const d = await depRes.json();
        setDepartments(d.departments || []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        setAppSettings(d.settings || null);
      }
      if (chatRes.ok) {
        const d = await chatRes.json();
        const totalUnread = (d.conversations || []).reduce(
          (acc: number, c: { unreadCount?: number }) => acc + (c.unreadCount || 0),
          0
        );
        setUnreadChatCount(totalUnread);
      }

      // Load current admin profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (prof) setCurrentUserProfile(prof as Profile);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadAllEntities();

    // 1. Supabase Realtime subscription for instant live admin dashboard
    const channelName = `admin-dashboard-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          loadDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        () => {
          loadDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          loadAllEntities();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          setUnreadChatCount((prev) => prev + 1);
        }
      )
      .subscribe();

    // 2. 5-second automatic heartbeat fallback
    const interval = setInterval(() => {
      loadDashboardData();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedDate, selectedDept, timezone]);

  // Handle Create Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError('');
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: empFullName,
          email: empEmail,
          password: empPassword,
          department_id: empDeptId || null,
          shift_id: empShiftId || null,
          company_tag: empCompanyTag ? empCompanyTag.trim() : null,
          daily_rate: Number(empDailyRate) || 0,
          overtime_rate_per_hour: Number(empOvertimeRate) || 0,
          role: empRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEmpError(data.error || 'Failed to create employee account');
      } else {
        setShowAddEmpModal(false);
        setEmpFullName('');
        setEmpEmail('');
        setEmpPassword('');
        setEmpCompanyTag('');
        setEmpDailyRate('610.00');
        setEmpOvertimeRate('114.38');
        loadAllEntities();
      }
    } catch (err: unknown) {
      setEmpError(err instanceof Error ? err.message : 'Error creating account');
    }
  };

  // Open Edit Employee Modal
  const handleOpenEditEmp = (emp: Profile) => {
    setEditingEmp(emp);
    setEditFullName(emp.full_name);
    setEditDeptId(emp.department_id || '');
    setEditShiftId(emp.shift_id || '');
    setEditCompanyTag(emp.company_tag || '');
    setEditDailyRate((emp.daily_rate || 0).toString());
    setEditOvertimeRate((emp.overtime_rate_per_hour || 0).toString());
    setEditPhone(emp.phone || '');
    setEditWhatsapp(emp.whatsapp_number || '');
    setEditGoogleEmail(emp.google_email || '');
    setEditFacebookUrl(emp.facebook_url || '');
    setEditRole(emp.role);
    setEditIsActive(emp.is_active !== false);
    setEditError('');
  };

  const handleSaveEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setEditError('');

    try {
      const res = await fetch(`/api/admin/employees/${editingEmp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editFullName,
          department_id: editDeptId || null,
          shift_id: editShiftId || null,
          company_tag: editCompanyTag ? editCompanyTag.trim() : null,
          daily_rate: Number(editDailyRate) || 0,
          overtime_rate_per_hour: Number(editOvertimeRate) || 0,
          phone: editPhone || null,
          whatsapp_number: editWhatsapp || null,
          google_email: editGoogleEmail || null,
          facebook_url: editFacebookUrl || null,
          role: editRole,
          is_active: editIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update employee');
      } else {
        setEditingEmp(null);
        loadAllEntities();
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error updating employee profile');
    }
  };

  // Management Rates & Tier History Handlers
  const handleOpenRatesModal = async (emp: Profile) => {
    setRateEmp(emp);
    setRateModalError('');
    setRateFormRegular(emp.daily_rate ? emp.daily_rate.toString() : '');
    setRateFormOt(emp.overtime_rate_per_hour ? emp.overtime_rate_per_hour.toString() : '');
    setRateFormEffectiveFrom(getPHDateString(new Date(), timezone));
    setRateFormRestDayOt('');
    setRateFormHolidayOt('');
    setLoadingRates(true);

    try {
      const res = await fetch(`/api/admin/employees/${emp.id}/rates`);
      if (res.ok) {
        const data = await res.json();
        setRateHistory(data.rates || []);
      } else {
        const err = await res.json();
        setRateModalError(err.error || 'Failed to fetch rate tiers');
      }
    } catch {
      setRateModalError('Network error loading rates history');
    } finally {
      setLoadingRates(false);
    }
  };

  const handleSaveRateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateEmp) return;
    setRateModalError('');

    const regularRate = parseFloat(rateFormRegular);
    const otRate = parseFloat(rateFormOt);
    if (isNaN(regularRate) || regularRate < 0) {
      setRateModalError('Please enter a valid regular daily rate.');
      return;
    }
    if (isNaN(otRate) || otRate < 0) {
      setRateModalError('Please enter a valid overtime rate per hour.');
      return;
    }
    if (!rateFormEffectiveFrom) {
      setRateModalError('Effective from date is required.');
      return;
    }

    setSavingRateTier(true);
    try {
      const payload: Record<string, any> = {
        regular_rate: regularRate,
        overtime_rate_per_hour: otRate,
        effective_from: rateFormEffectiveFrom,
      };
      if (rateFormRestDayOt.trim() !== '') {
        const v = parseFloat(rateFormRestDayOt);
        if (!isNaN(v) && v >= 0) payload.rest_day_ot_rate = v;
      }
      if (rateFormHolidayOt.trim() !== '') {
        const v = parseFloat(rateFormHolidayOt);
        if (!isNaN(v) && v >= 0) payload.holiday_ot_rate = v;
      }

      const res = await fetch(`/api/admin/employees/${rateEmp.id}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setRateModalError(data.error || 'Failed to save rate tier');
      } else {
        await handleOpenRatesModal(rateEmp);
        loadAllEntities();
      }
    } catch {
      setRateModalError('Network error saving rate tier');
    } finally {
      setSavingRateTier(false);
    }
  };

  // Bulk Rates CSV Handlers
  const handlePreviewBulkCsv = async () => {
    setBulkError('');
    setBulkSuccessMsg('');
    if (!bulkCsvText.trim()) {
      setBulkError('Please paste CSV content.');
      return;
    }

    const lines = bulkCsvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setBulkError('CSV text is empty.');
      return;
    }

    const firstLine = lines[0].toLowerCase();
    const dataLines =
      firstLine.includes('employee') || firstLine.includes('email') || firstLine.includes('regular')
        ? lines.slice(1)
        : lines;

    const parsedRows = dataLines.map((line) => {
      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      return {
        identifier: parts[0] || '',
        regular_rate: parseFloat(parts[1]) || 0,
        overtime_rate_per_hour: parseFloat(parts[2]) || 0,
        effective_from: parts[3] || getPHDateString(new Date(), timezone),
        rest_day_ot_rate: parts[4] ? parseFloat(parts[4]) : undefined,
        holiday_ot_rate: parts[5] ? parseFloat(parts[5]) : undefined,
      };
    });

    setLoadingBulkPreview(true);
    try {
      const res = await fetch('/api/admin/rates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkError(data.error || 'Failed to preview CSV rates');
      } else {
        setBulkPreviewData(data.preview || []);
      }
    } catch {
      setBulkError('Network error previewing bulk CSV');
    } finally {
      setLoadingBulkPreview(false);
    }
  };

  const handleConfirmBulkRates = async () => {
    if (!bulkPreviewData || bulkPreviewData.length === 0) return;
    setBulkError('');
    setConfirmingBulk(true);

    try {
      const validRows = bulkPreviewData
        .filter((r) => r.matched && !r.error)
        .map((r) => ({
          employee_id: r.employeeId,
          regular_rate: r.newRegularRate,
          overtime_rate_per_hour: r.newOtRate,
          effective_from: r.effectiveFrom,
          rest_day_ot_rate: r.newRestDayOtRate,
          holiday_ot_rate: r.newHolidayOtRate,
        }));

      const res = await fetch('/api/admin/rates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'confirm', rows: validRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkError(data.error || 'Failed to confirm bulk rates');
      } else {
        setBulkSuccessMsg(`Successfully applied rates for ${data.insertedCount} employee(s).`);
        setBulkPreviewData(null);
        setBulkCsvText('');
        loadAllEntities();
      }
    } catch {
      setBulkError('Network error saving bulk rates');
    } finally {
      setConfirmingBulk(false);
    }
  };

  // Handle Shift Creation & Deletion
  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError('');
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shiftName,
          start_time: shiftStartTime.length === 5 ? `${shiftStartTime}:00` : shiftStartTime,
          end_time: shiftEndTime.length === 5 ? `${shiftEndTime}:00` : shiftEndTime,
          break_start: shiftBreakStart.length === 5 ? `${shiftBreakStart}:00` : shiftBreakStart,
          break_end: shiftBreakEnd.length === 5 ? `${shiftBreakEnd}:00` : shiftBreakEnd,
          break_duration_mins: Number(shiftBreakDuration) || 60,
          grace_period_mins: Number(shiftGracePeriod) || 15,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShiftError(data.error || 'Failed to create shift');
      } else {
        setShowAddShiftModal(false);
        setShiftName('');
        loadAllEntities();
      }
    } catch (err: unknown) {
      setShiftError(err instanceof Error ? err.message : 'Error creating shift');
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    const res = await fetch(`/api/admin/shifts?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadAllEntities();
  };

  // Reset passkey / device / password
  const handleResetPasskey = async (empId: string) => {
    if (!confirm('Are you sure you want to reset this employee’s fingerprint passkey? They will need to re-enroll upon login.')) return;
    await fetch(`/api/admin/employees/${empId}/reset-passkey`, { method: 'POST' });
    loadAllEntities();
  };

  const handleResetDevice = async (empId: string) => {
    if (!confirm('Clear bound device ID? The employee can then register a new phone.')) return;
    await fetch(`/api/admin/employees/${empId}/reset-device`, { method: 'POST' });
    loadAllEntities();
  };

  const handleResetPassword = async (empId: string) => {
    const tempPass = prompt('Enter new temporary password (min 8 characters, must include uppercase, lowercase, and a number):');
    if (!tempPass) return;
    const res = await fetch(`/api/admin/employees/${empId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: tempPass }),
    });
    const data = await res.json();
    if (res.ok) {
      alert('Temporary password set! Employee will be forced to change it on login.');
    } else {
      alert(data.error || 'Failed to reset password');
    }
  };

  const handleArchiveEmployee = async (empId: string, archive: boolean) => {
    const action = archive ? 'archive' : 'reactivate';
    const label = archive ? 'deactivate/archive' : 'reactivate';
    if (!confirm(`Are you sure you want to ${label} this employee account?`)) return;
    try {
      const res = await fetch(`/api/admin/employees/${empId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([loadAllEntities(), loadDashboardData()]);
      } else {
        alert(data.error || 'Failed to update employee status');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating employee status');
    }
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!deletingEmp) return;
    setIsDeletingEmp(true);
    setDeleteEmpError('');
    try {
      const res = await fetch(`/api/admin/employees/${deletingEmp.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_name: confirmDeleteInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteEmpError(data.error || 'Failed to delete employee.');
        setIsDeletingEmp(false);
        return;
      }
      setDeletingEmp(null);
      setConfirmDeleteInput('');
      await Promise.all([loadAllEntities(), loadDashboardData()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting employee.';
      setDeleteEmpError(msg);
    } finally {
      setIsDeletingEmp(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const d = await res.json();
        setAuditLogsList(d.auditLogs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const loadHolidays = async () => {
    try {
      const res = await fetch('/api/admin/holidays');
      if (res.ok) {
        const d = await res.json();
        setHolidaysList(d.holidays || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName || !newHolidayDate) return;
    setAddingHoliday(true);
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHolidayName,
          date: newHolidayDate,
          type: newHolidayType,
        }),
      });
      if (res.ok) {
        setNewHolidayName('');
        setNewHolidayDate('');
        loadHolidays();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to add holiday');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error adding holiday');
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      const res = await fetch(`/api/admin/holidays?id=${id}`, { method: 'DELETE' });
      if (res.ok) loadHolidays();
    } catch (e) {
      console.error(e);
    }
  };

  // Add / Delete location
  const handleAddLocation = async (locData: { name: string; address: string; lat: number; lng: number; radius_meters: number }) => {
    const res = await fetch('/api/admin/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(locData),
    });
    if (res.ok) loadAllEntities();
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Delete this office location geofence?')) return;
    await fetch(`/api/admin/locations/${id}`, { method: 'DELETE' });
    loadAllEntities();
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      if (typeof window !== 'undefined' && settings.timezone) {
        localStorage.setItem('company_timezone', settings.timezone);
        window.dispatchEvent(new CustomEvent('company-timezone-changed', { detail: { timezone: settings.timezone } }));
      }
      alert(`Settings saved successfully! Active Timezone: ${settings.timezone || timezone}`);
    } else {
      alert('Failed to save settings.');
    }
  };

  // Export Reports
  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    const items: ReportItem[] = attendanceLogs.map((l) => ({
      date: l.date,
      employee_name: l.profile?.full_name || 'Unknown',
      department: l.profile?.department_id || 'General',
      time_in: l.time_in ? formatPHTime(l.time_in, false, timezone) : '-',
      time_out: l.time_out ? formatPHTime(l.time_out, false, timezone) : '-',
      hours_worked: l.hours_worked || 0,
      late_minutes: l.late_minutes || 0,
      overtime_minutes: l.overtime_minutes || 0,
      undertime_minutes: l.undertime_minutes || 0,
      status: l.status,
      verification_method: l.verification_method,
      location: l.location_in?.name || 'Authorized Office',
    }));

    if (type === 'csv') exportToCSV(items, `attendance_${selectedDate}.csv`);
    else if (type === 'excel') exportToExcel(items, `attendance_${selectedDate}.xlsx`);
    else exportToPDF(items, `Attendance Report - ${selectedDate}`, `attendance_${selectedDate}.pdf`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AppLogo size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white">Admin Command Center</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950 border border-blue-800 text-blue-300">
                <Globe className="w-3 h-3" />
                {timezoneLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Time Tracker & Biometrics</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <InstallAppDrawerButton variant="header" />
          <button
            onClick={() => router.push('/dashboard')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Employee Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-white rounded-xl"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Nav */}
        <nav className="w-full md:w-64 border-r border-slate-800 p-4 space-y-1 bg-slate-900/40">
          <button
            onClick={() => handleSelectTab('overview')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'overview' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" /> Live Overview
          </button>

          <button
            onClick={() => handleSelectTab('map')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'map' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" /> Live Attendance Map
          </button>

          <button
            onClick={() => handleSelectTab('employees')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'employees' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" /> Employee Accounts
          </button>

          <button
            onClick={() => handleSelectTab('locations')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'locations' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" /> Location Geofences
          </button>

          <button
            onClick={() => handleSelectTab('shifts')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'shifts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" /> Shifts & Work Hours
          </button>

          <button
            onClick={() => handleSelectTab('requests')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'requests' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Approvals
          </button>

          <button
            onClick={() => {
              handleSelectTab('chat');
              setUnreadChatCount(0);
            }}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
              activeTab === 'chat' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" /> Company Chat &amp; Announcements
            </div>
            {unreadChatCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-sm" />
            )}
          </button>

          <button
            onClick={() => handleSelectTab('dtr')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'dtr' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" /> DTR & Overtime Payroll
          </button>

          <button
            onClick={() => handleSelectTab('reports')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'reports' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Reports & Exports
          </button>

          <button
            onClick={() => handleSelectTab('flagged')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'flagged' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Flagged & Anti-Cheat
          </button>

          <button
            onClick={() => handleSelectTab('settings')}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" /> System Settings
          </button>

          <button
            onClick={() => {
              handleSelectTab('audit');
              loadAuditLogs();
            }}
            className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${
              activeTab === 'audit' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Audit Logs
          </button>

          {/* Download Website as App Drawer Button */}
          <div className="pt-3 mt-3 border-t border-slate-800/80">
            <InstallAppDrawerButton variant="drawer" />
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-w-6xl">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Date & Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={selectedDate || getPHDateString(new Date(), timezone)}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={loadDashboardData}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {/* Counts Grid - Clickable Drilldown Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <button
                  type="button"
                  onClick={() => setDrilldownStatus('present')}
                  title="Click to see all on-time present employees"
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 p-4 rounded-2xl text-left transition-all duration-200 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium uppercase group-hover:text-emerald-400 transition-colors">
                      Present
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{counts.present}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-300 mt-1 transition-colors flex items-center gap-1 font-medium">
                    <span>View list</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDrilldownStatus('late')}
                  title="Click to see all late check-in employees"
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 p-4 rounded-2xl text-left transition-all duration-200 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium uppercase group-hover:text-amber-400 transition-colors">
                      Late
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </div>
                  <div className="text-2xl font-black text-amber-400 mt-1">{counts.late}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-300 mt-1 transition-colors flex items-center gap-1 font-medium">
                    <span>View list</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDrilldownStatus('timedOut')}
                  title="Click to see all employees who timed out"
                  className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 p-4 rounded-2xl text-left transition-all duration-200 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium uppercase group-hover:text-blue-400 transition-colors">
                      Timed Out
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </div>
                  <div className="text-2xl font-black text-blue-400 mt-1">{counts.timedOut}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-300 mt-1 transition-colors flex items-center gap-1 font-medium">
                    <span>View list</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDrilldownStatus('onLeave')}
                  title="Click to see all employees on scheduled leave"
                  className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-850 p-4 rounded-2xl text-left transition-all duration-200 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium uppercase group-hover:text-purple-400 transition-colors">
                      On Leave
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-purple-400 transition-transform group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </div>
                  <div className="text-2xl font-black text-purple-400 mt-1">{counts.onLeave}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-300 mt-1 transition-colors flex items-center gap-1 font-medium">
                    <span>View list</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDrilldownStatus('absent')}
                  title="Click to see who is absent today"
                  className="bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-850 p-4 rounded-2xl text-left transition-all duration-200 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium uppercase group-hover:text-rose-400 transition-colors">
                      Absent
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-rose-400 transition-transform group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </div>
                  <div className="text-2xl font-black text-rose-400 mt-1">{counts.absent}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-300 mt-1 transition-colors flex items-center gap-1 font-medium">
                    <span>View list</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDrilldownStatus('flagged')}
                  title="Click to see flagged scans and failed attempts"
                  className="bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-850 p-4 rounded-2xl text-left transition-all duration-200 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium uppercase group-hover:text-rose-400 transition-colors">
                      Flagged / Alerts
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-rose-400 transition-transform group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </div>
                  <div className="text-2xl font-black text-rose-500 mt-1">{counts.flagged}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-300 mt-1 transition-colors flex items-center gap-1 font-medium">
                    <span>View alerts</span>
                  </div>
                </button>
              </div>

              {/* Today's Attendance Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-white">Today&apos;s Attendance Logs</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExport('csv')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 text-slate-300"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 text-slate-300"
                    >
                      <Download className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 text-slate-300"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </div>

                {attendanceLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">No attendance logged for this date yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-3 font-semibold">Date</th>
                          <th className="pb-3 font-semibold">Employee</th>
                          <th className="pb-3 font-semibold">Time In</th>
                          <th className="pb-3 font-semibold">Time Out</th>
                          <th className="pb-3 font-semibold">Hours</th>
                          <th className="pb-3 font-semibold">Status</th>
                          <th className="pb-3 font-semibold">Verification</th>
                          <th className="pb-3 font-semibold">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {attendanceLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/30">
                            <td className="py-3 font-mono text-slate-400 whitespace-nowrap">{log.date}</td>
                            <td className="py-3 font-medium text-white whitespace-nowrap">
                              {log.profile?.full_name || log.employee?.full_name || log.profile?.email || log.employee?.email || 'Employee'}
                            </td>
                            <td className="py-3 text-slate-300 font-mono whitespace-nowrap">{formatPHTime(log.time_in, false, timezone)}</td>
                            <td className="py-3 text-slate-300 font-mono whitespace-nowrap">
                              {log.time_out ? formatPHTime(log.time_out, false, timezone) : '--'}
                            </td>
                            <td className="py-3 font-mono text-slate-300 whitespace-nowrap">{log.hours_worked ?? '--'}</td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  log.status === 'late'
                                    ? 'bg-amber-950 text-amber-300'
                                    : 'bg-emerald-950 text-emerald-300'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400 capitalize">{log.verification_method}</td>
                            <td className="py-3 text-slate-400">{log.location_in?.name || 'Office'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LIVE MAP */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="font-bold text-base text-white mb-2">Live Attendance Tap Map</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Visual representation of today&apos;s employee check-in pins inside corporate geofence perimeters.
                </p>
                <div className="h-[550px]">
                  <LiveAttendanceMap attendanceLogs={attendanceLogs} locations={locations} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EMPLOYEES CRUD */}
          {activeTab === 'employees' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white">Employee Directory</h3>
                  <p className="text-xs text-slate-400">
                    Public sign-up is disabled. Accounts are securely provisioned here by administrators.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Tag:</span>
                    <select
                      value={directoryCompanyTagFilter}
                      onChange={(e) => setDirectoryCompanyTagFilter(e.target.value)}
                      className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-slate-900 text-white">All Companies / Tags</option>
                      <option value="Allen Care Staff" className="bg-slate-900 text-sky-400">Allen Care Staff</option>
                      <option value="Allen V Fruits" className="bg-slate-900 text-emerald-400">Allen V Fruits</option>
                      <option value="none" className="bg-slate-900 text-slate-400">Untagged</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setBulkCsvText('');
                      setBulkPreviewData(null);
                      setBulkError('');
                      setBulkSuccessMsg('');
                      setShowBulkRatesModal(true);
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Bulk update management wage rates via CSV"
                  >
                    <UploadCloud className="w-4 h-4 text-emerald-400" /> Bulk Rates CSV
                  </button>
                  <button
                    onClick={() => setShowAddEmpModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-4 h-4" /> Provision Account
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Name</th>
                      <th className="pb-3 font-semibold">Email</th>
                      <th className="pb-3 font-semibold">Role</th>
                      <th className="pb-3 font-semibold">Connected Socials</th>
                      <th className="pb-3 font-semibold">Daily Rate / OT</th>
                      <th className="pb-3 font-semibold">Device</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {employees
                      .filter((emp) => {
                        if (directoryCompanyTagFilter === 'all') return true;
                        if (directoryCompanyTagFilter === 'none') return !emp.company_tag;
                        return emp.company_tag === directoryCompanyTagFilter;
                      })
                      .map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-medium text-white">
                          <div>{emp.full_name}</div>
                          {emp.company_tag && (
                            <div className="mt-1">
                              <span
                                className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  emp.company_tag === 'Allen Care Staff'
                                    ? 'bg-sky-950/70 text-sky-400 border-sky-800/60'
                                    : emp.company_tag === 'Allen V Fruits'
                                    ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {emp.company_tag}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-slate-400">{emp.email}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                            {emp.role}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-1 min-w-[170px]">
                            {/* WhatsApp */}
                            {emp.whatsapp_number ? (
                              <a
                                href={`https://wa.me/${emp.whatsapp_number.replace(/[^\d]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition group text-[11px] w-fit"
                                title="Open WhatsApp Chat"
                              >
                                <MessageSquare className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="font-semibold">{emp.whatsapp_number}</span>
                                {emp.whatsapp_verified && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Verified" />
                                )}
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <MessageSquare className="w-3 h-3 opacity-40 shrink-0" />
                                <span>No WhatsApp</span>
                              </span>
                            )}

                            {/* Gmail / Google */}
                            {emp.google_email || (emp.email && emp.email.endsWith('@gmail.com')) ? (
                              <a
                                href={`mailto:${emp.google_email || emp.email}`}
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition group text-[11px] w-fit"
                                title="Send Gmail"
                              >
                                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
                                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                <span className="font-semibold truncate max-w-[150px]">
                                  {emp.google_email || emp.email}
                                </span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <Mail className="w-3 h-3 opacity-40 shrink-0" />
                                <span>No Gmail</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleOpenRatesModal(emp)}
                            className="px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 font-mono font-bold text-[11px] flex flex-col items-start gap-0.5 transition"
                            title="Click to view rate history and set new rate tier"
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-400 font-semibold">
                                {emp.daily_rate ? `₱${emp.daily_rate.toFixed(2)}/day` : 'Rate not set'}
                              </span>
                            </div>
                            <span className="text-[10px] text-emerald-500 font-normal">
                              {emp.overtime_rate_per_hour ? `OT: ₱${emp.overtime_rate_per_hour.toFixed(2)}/hr` : 'OT not set'}
                            </span>
                          </button>
                        </td>
                        <td className="py-3 text-slate-400">
                          {emp.device_id ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5" /> Bound
                            </span>
                          ) : (
                            <span className="text-slate-500">Unbound</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-400">
                          {emp.is_active === false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800/60 inline-flex items-center gap-1">
                              <Archive className="w-3 h-3" /> Archived
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditEmp(emp)}
                              className="p-1 hover:text-blue-400 text-slate-400"
                              title="Edit Employee Profile"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(emp.id)}
                              className="p-1 hover:text-amber-400 text-slate-400"
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleResetDevice(emp.id)}
                              className="p-1 hover:text-purple-400 text-slate-400"
                              title="Reset Bound Phone"
                            >
                              <Smartphone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleResetPasskey(emp.id)}
                              className="p-1 hover:text-rose-400 text-slate-400"
                              title="Reset Fingerprint Passkey"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                            {emp.is_active === false ? (
                              <button
                                onClick={() => handleArchiveEmployee(emp.id, false)}
                                className="p-1 hover:text-emerald-400 text-slate-400 hover:bg-emerald-500/10 rounded-lg transition"
                                title="Reactivate Employee Account"
                              >
                                <UserCheck className="w-4 h-4 text-emerald-400" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleArchiveEmployee(emp.id, true)}
                                disabled={emp.id === currentUserProfile?.id || emp.is_super_admin}
                                className="p-1 hover:text-amber-400 text-slate-400 hover:bg-amber-500/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Deactivate / Archive Employee (Preserves History)"
                              >
                                <Archive className="w-4 h-4 text-amber-400" />
                              </button>
                            )}
                            {currentUserProfile?.is_super_admin && (
                              <button
                                onClick={() => {
                                  setDeleteEmpError('');
                                  setConfirmDeleteInput('');
                                  setDeletingEmp(emp);
                                }}
                                disabled={emp.id === currentUserProfile?.id || emp.is_super_admin}
                                className={`p-1 rounded-lg transition ${
                                  emp.id === currentUserProfile?.id || emp.is_super_admin
                                    ? 'text-slate-600 cursor-not-allowed opacity-30'
                                    : 'hover:text-rose-400 text-slate-400 hover:bg-rose-500/10'
                                }`}
                                title="Permanent Deletion (Super Admin Only)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LOCATIONS & GEOFENCES */}
          {activeTab === 'locations' && (
            <LocationAdminMap
              locations={locations}
              onAddLocation={handleAddLocation}
              onDeleteLocation={handleDeleteLocation}
            />
          )}

          {/* TAB 5: SHIFTS */}
          {activeTab === 'shifts' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white">Work Shifts & Scheduled Breaks</h3>
                  <p className="text-xs text-slate-400">Configure standard working hours, mandatory meal/rest breaktimes, and grace periods.</p>
                </div>
                <button
                  onClick={() => setShowAddShiftModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> Add Work Shift
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {shifts.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-950 relative group">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm text-white">{s.name}</h4>
                      <button
                        onClick={() => handleDeleteShift(s.id)}
                        className="text-slate-600 hover:text-rose-400 transition"
                        title="Delete Shift"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Working Hours:</span>
                        <span className="font-mono text-white font-semibold">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Break Time:</span>
                        <span className="font-mono text-amber-300">
                          {s.break_start ? s.break_start.slice(0, 5) : '12:00'} - {s.break_end ? s.break_end.slice(0, 5) : '13:00'} ({s.break_duration_mins || 60}m)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Grace Period:</span>
                        <span className="text-blue-400 font-medium">{s.grace_period_mins} mins</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: REQUESTS APPROVAL */}
          {activeTab === 'requests' && <RequestsManager isAdmin={true} />}

          {/* TAB 7: CHAT & ANNOUNCEMENTS */}
          {activeTab === 'chat' && currentUserProfile && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-bold text-base text-white">Company Communication &amp; Official Announcements</h3>
                  <p className="text-xs text-slate-400">
                    Broadcast corporate bulletins or chat directly with employees with real-time Messenger-style reactions.
                  </p>
                </div>
                <ChatWindow currentUser={currentUserProfile} onUnreadCountChange={setUnreadChatCount} />
              </div>
            </div>
          )}

          {/* TAB 7: REPORTS */}
          {activeTab === 'reports' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-base text-white">Attendance Analytics & Reports</h3>
              <p className="text-xs text-slate-400">
                Generate and export detailed timesheets for payroll with calculated late minutes, undertime, and overtime.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleExport('csv')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export Excel
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export PDF
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: DTR & OVERTIME PAYROLL */}
          {activeTab === 'dtr' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="font-bold text-base text-white mb-1">
                  Daily Time Record (DTR) & Overtime Payroll
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Standard Civil Service / Corporate Timesheet with automated overtime calculations and hourly wage rates.
                </p>
                <DTRViewer isAdmin={true} />
              </div>
            </div>
          )}

          {/* TAB 9: FLAGGED ENTRIES & ANTI-CHEAT */}
          {activeTab === 'flagged' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-2 text-rose-500">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="font-bold text-base text-white">Suspicious Entries & Failed Checks</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Records where geofence failed, accuracy exceeded threshold, device mismatched, or fallback password was used.
                </p>

                {failedAttempts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No failed attempts recorded today.</p>
                ) : (
                  <div className="space-y-3">
                    {failedAttempts.map((fa) => (
                      <div
                        key={fa.id}
                        className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-xs flex items-start justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-rose-400 uppercase">{fa.attempt_type}</span>
                            <span className="text-slate-400">
                              {formatPHTime(fa.created_at, false, timezone)}
                            </span>
                          </div>
                          <p className="text-rose-200 mt-1 font-medium">{fa.reason}</p>
                          {fa.distance_meters && (
                            <p className="text-slate-400 mt-0.5">
                              Distance away: {Math.round(fa.distance_meters)}m from {fa.nearest_location_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: SETTINGS */}
          {activeTab === 'settings' && settings && (
            <div className="space-y-6 max-w-xl">
              {/* Admin's Own Biometric Passkey */}
              <PasskeyManager />

              {/* Company Timezone Configuration */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-2 text-blue-400">
                  <Globe className="w-5 h-5" />
                  <h3 className="font-bold text-base text-white">Company Timezone & Regional Clock</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Set the company&apos;s primary operational timezone. This applies universally to all employees, live dashboard clocks, attendance logs, grace period lateness checks, and DTR payroll records.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Operational Timezone
                    </label>
                    <select
                      value={settings.timezone || timezone || 'Asia/Manila'}
                      onChange={(e) => {
                        const newTz = e.target.value;
                        setAppSettings({ ...settings, timezone: newTz });
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {SUPPORTED_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label} ({tz.utcOffset})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Live Clock Preview in Selected Timezone */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Live Preview (Selected Timezone)
                      </span>
                      <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                        {new Date().toLocaleTimeString('en-US', {
                          timeZone: settings.timezone || timezone || 'Asia/Manila',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true,
                        })}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date().toLocaleDateString('en-US', {
                          timeZone: settings.timezone || timezone || 'Asia/Manila',
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-950/80 border border-blue-800/60 text-blue-300">
                        {getTimezoneLabel(settings.timezone || timezone || 'Asia/Manila')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="font-bold text-base text-white mb-4">System Biometrics &amp; Verification Rules</h3>
              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Biometric Verification Enforcement
                  </label>
                  <select
                    value={settings.biometric_mode}
                    onChange={(e) =>
                      setAppSettings({ ...settings, biometric_mode: e.target.value as 'off' | 'always' | 'random' })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="always">Always Require Fingerprint / Passkey</option>
                    <option value="random">Random Spot Checks (%)</option>
                    <option value="off">Off (GPS Location Only)</option>
                  </select>
                </div>

                {settings.biometric_mode === 'random' && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Random Check Percentage ({settings.biometric_random_percentage}%)
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={settings.biometric_random_percentage}
                      onChange={(e) =>
                        setAppSettings({ ...settings, biometric_random_percentage: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <h5 className="font-semibold text-white">Allow Password Fallback</h5>
                    <p className="text-[11px] text-slate-400">If employee sensor fails or device lacks sensor</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allow_fallback}
                    onChange={(e) => setAppSettings({ ...settings, allow_fallback: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Maximum Allowed GPS Accuracy (meters)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={settings.gps_accuracy_threshold_meters}
                    onChange={(e) =>
                      setAppSettings({ ...settings, gps_accuracy_threshold_meters: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>

                {/* Overtime Multipliers & Data Retention */}
                <div className="border-t border-slate-800 pt-4 space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-amber-300">Management Rates &amp; DTR Computation Rules</h4>
                    <p className="text-[11px] text-slate-400">
                      Rates are set per employee by management. Configure standard daily hours, rounding, and deduction policies below.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.show_rates_to_employees ?? false}
                        onChange={(e) =>
                          setAppSettings({ ...settings, show_rates_to_employees: e.target.checked })
                        }
                        className="rounded border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-950"
                      />
                      <span className="text-xs text-slate-300 font-medium">
                        Show Rates &amp; Gross Pay on Employee Dashboard / Reports (Default: OFF / Hidden from employees)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.require_overtime_approval ?? true}
                        onChange={(e) =>
                          setAppSettings({ ...settings, require_overtime_approval: e.target.checked })
                        }
                        className="rounded border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-950"
                      />
                      <span className="text-xs text-slate-300 font-medium">
                        Require Approved Overtime Request for Overtime Pay (Default: ON)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enable_special_day_rates ?? false}
                        onChange={(e) =>
                          setAppSettings({ ...settings, enable_special_day_rates: e.target.checked })
                        }
                        className="rounded border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-950"
                      />
                      <span className="text-xs text-slate-300 font-medium">
                        Enable Special Day Overtime Overrides (Allows setting custom rest day and holiday OT rates per employee)
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1 text-xs">Standard Hours Per Day</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="24"
                        value={settings.hours_per_day ?? 8}
                        onChange={(e) =>
                          setAppSettings({ ...settings, hours_per_day: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500">Hourly deduction rate = Daily wage / Hours per day</span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1 text-xs">Late / Undertime Basis</label>
                      <select
                        value={settings.undertime_minutes_basis || 'exact'}
                        onChange={(e) =>
                          setAppSettings({ ...settings, undertime_minutes_basis: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                      >
                        <option value="exact">Exact (Per-minute basis)</option>
                        <option value="15_min_block">15-Minute Blocks (Rounded up)</option>
                      </select>
                      <span className="text-[10px] text-slate-500">Controls how late &amp; undertime deductions are counted</span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1 text-xs">Overtime Minimum &amp; Rounding</label>
                      <select
                        value={settings.overtime_rounding_rule || 'exact'}
                        onChange={(e) =>
                          setAppSettings({ ...settings, overtime_rounding_rule: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                      >
                        <option value="exact">Exact (Per-minute basis)</option>
                        <option value="30_min_block">Full 30-Minute Blocks (Min. 30 mins)</option>
                        <option value="1_hour_block">Full 1-Hour Blocks (Must render at least 1 hour)</option>
                      </select>
                      <span className="text-[10px] text-slate-500">e.g. 1-hour block requires rendering at least 60 mins of OT</span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1 text-xs">Late vs Overtime Policy</label>
                      <select
                        value={settings.tardiness_overtime_rule || 'no_offset'}
                        onChange={(e) =>
                          setAppSettings({ ...settings, tardiness_overtime_rule: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                      >
                        <option value="no_offset">Strict Schedule (No Offset - Labor Standard)</option>
                        <option value="require_full_hours">Require 8 Regular Hours Before Overtime</option>
                        <option value="offset_late">Auto-Offset Late with Post-Shift Work (Make-up Time)</option>
                      </select>
                      <span className="text-[10px] text-slate-500">
                        {settings.tardiness_overtime_rule === 'offset_late'
                          ? 'Staying late recovers morning late minutes first (no pay deduction); excess is Overtime'
                          : settings.tardiness_overtime_rule === 'require_full_hours'
                          ? 'Overtime only starts after completing 8 regular hours; 5pm-6pm is not OT if 1 hr late'
                          : 'Morning late is deducted; work past shift end is paid as Overtime (Standard)'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1 text-xs">Attendance Data Retention (Years)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={settings.data_retention_years ?? 3}
                      onChange={(e) =>
                        setAppSettings({ ...settings, data_retention_years: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                    />
                    <span className="text-[10px] text-slate-500">Permanent employee deletion is locked if records exist within this window (default: 3 years).</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
                >
                  Save Settings
                </button>
              </form>
            </div>

            {/* Holidays Management Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    Company &amp; Statutory Holidays
                  </h3>
                  <p className="text-xs text-slate-400">
                    Holidays recognized for DTR overtime multipliers and attendance expectations.
                  </p>
                </div>
              </div>

              {/* Add Holiday Form */}
              <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Holiday Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Labor Day"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Date</label>
                  <input
                    type="date"
                    required
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Holiday Type</label>
                  <select
                    value={newHolidayType}
                    onChange={(e) => setNewHolidayType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                  >
                    <option value="regular">Regular Holiday (200% OT)</option>
                    <option value="special_non_working">Special Non-Working (130% OT)</option>
                    <option value="special_working">Special Working (130% OT)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={addingHoliday}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" /> Add Holiday
                  </button>
                </div>
              </form>

              {/* Holidays Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2.5 font-semibold">Date</th>
                      <th className="pb-2.5 font-semibold">Holiday Name</th>
                      <th className="pb-2.5 font-semibold">Type</th>
                      <th className="pb-2.5 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {holidaysList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-500">
                          No holidays registered yet. Add company holidays above.
                        </td>
                      </tr>
                    ) : (
                      holidaysList.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 font-mono text-slate-300">{h.date}</td>
                          <td className="py-2.5 font-medium text-white">{h.name}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950 text-amber-300">
                              {h.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="p-1 hover:text-rose-400 text-slate-500 rounded transition"
                              title="Delete Holiday"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {/* TAB 12: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-400" />
                    Security &amp; Operational Audit Trail
                  </h3>
                  <p className="text-xs text-slate-400">
                    Read-only immutable log of wage changes, passkey/device resets, employee archival/deletion, and system settings modifications.
                  </p>
                </div>
                <button
                  onClick={loadAuditLogs}
                  disabled={loadingAuditLogs}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 text-slate-300"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {loadingAuditLogs ? (
                <div className="py-12 text-center text-slate-500 text-xs">Loading audit trail records...</div>
              ) : auditLogsList.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">No audit logs recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Timestamp</th>
                        <th className="pb-3 font-semibold">Action</th>
                        <th className="pb-3 font-semibold">Actor</th>
                        <th className="pb-3 font-semibold">Target</th>
                        <th className="pb-3 font-semibold">Details / Changes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {auditLogsList.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/30">
                          <td className="py-3 text-slate-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('en-US', { timeZone: timezone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-950 text-blue-300 border border-blue-800/60">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 text-slate-300 font-sans">
                            {log.actor?.full_name || log.actor?.email || log.actor_id || 'System'}
                          </td>
                          <td className="py-3 text-slate-400">
                            {log.target_type ? `${log.target_type}` : '--'}
                          </td>
                          <td className="py-3 font-sans">
                            <button
                              onClick={() => setSelectedAuditLog(log)}
                              className="text-blue-400 hover:text-blue-300 hover:underline text-[11px] font-medium"
                            >
                              View Diff &amp; Payload &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Provision Employee Modal */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-base text-white mb-2">Create Employee Account</h3>
            <p className="text-xs text-slate-400 mb-4">
              A temporary password will be assigned. The employee will be forced to change it on their first login.
            </p>

            <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe"
                  value={empFullName}
                  onChange={(e) => setEmpFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Temporary Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 chars (1 upper, 1 lower, 1 number)"
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Department</label>
                <select
                  value={empDeptId}
                  onChange={(e) => setEmpDeptId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Daily Rate (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="610.00"
                    value={empDailyRate}
                    onChange={(e) => setEmpDailyRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">OT Rate (₱/hr) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="114.38"
                    value={empOvertimeRate}
                    onChange={(e) => setEmpOvertimeRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Shift</label>
                <select
                  value={empShiftId}
                  onChange={(e) => setEmpShiftId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="">Select Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Company Tag (Optional)</label>
                <select
                  value={empCompanyTag}
                  onChange={(e) => setEmpCompanyTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="">-- None / Untagged --</option>
                  <option value="Allen Care Staff">Allen Care Staff</option>
                  <option value="Allen V Fruits">Allen V Fruits</option>
                </select>
              </div>

              {(currentUserProfile?.email === 'admin@company.com' || currentUserProfile?.is_super_admin) && (
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Account Role (Super Admin Privilege)</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value as 'employee' | 'admin')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              )}

              {empError && <p className="text-rose-400 text-[11px]">{empError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {showAddShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-base text-white mb-2">Create Work Shift</h3>
            <p className="text-xs text-slate-400 mb-4">
              Set shift working hours, grace period, and scheduled mandatory meal/rest breaktimes.
            </p>

            <form onSubmit={handleCreateShift} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular Day Shift (8am-5pm)"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Time *</label>
                  <input
                    type="time"
                    required
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block mb-2">
                  Break / Lunch Schedule
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Break Start</label>
                    <input
                      type="time"
                      value={shiftBreakStart}
                      onChange={(e) => setShiftBreakStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Break End</label>
                    <input
                      type="time"
                      value={shiftBreakEnd}
                      onChange={(e) => setShiftBreakEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Break Duration (mins)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="60"
                    value={shiftBreakDuration}
                    onChange={(e) => setShiftBreakDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Grace Period (mins)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="15"
                    value={shiftGracePeriod}
                    onChange={(e) => setShiftGracePeriod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              {shiftError && <p className="text-rose-400 text-[11px]">{shiftError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddShiftModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-base text-white">Edit Employee Profile</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {editingEmp.email}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Update employee information, work shift assignment, and wage compensation.
            </p>

            <form onSubmit={handleSaveEditEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Department</label>
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="">None / Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Work Shift</label>
                  <select
                    value={editShiftId}
                    onChange={(e) => setEditShiftId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="">None / Default</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Daily Rate (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editDailyRate}
                    onChange={(e) => setEditDailyRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">OT Rate (₱/hr) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editOvertimeRate}
                    onChange={(e) => setEditOvertimeRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Phone</label>
                  <input
                    type="text"
                    placeholder="+63 9..."
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Role</label>
                  {currentUserProfile?.email === 'admin@company.com' || currentUserProfile?.is_super_admin ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'employee' | 'admin')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Administrator</option>
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 capitalize flex items-center justify-between text-xs">
                      <span>{editRole}</span>
                      <span className="text-[10px] text-amber-500 font-medium">Super Admin Only</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Company Tag (Optional)</label>
                <select
                  value={editCompanyTag}
                  onChange={(e) => setEditCompanyTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                >
                  <option value="">-- None / Untagged --</option>
                  <option value="Allen Care Staff">Allen Care Staff</option>
                  <option value="Allen V Fruits">Allen V Fruits</option>
                </select>
              </div>

              {/* Social Channels: WhatsApp & Gmail */}
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Connected Channels</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">WhatsApp Number</label>
                    <input
                      type="text"
                      placeholder="+63 9..."
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Gmail / Google Email</label>
                    <input
                      type="email"
                      placeholder="user@gmail.com"
                      value={editGoogleEmail}
                      onChange={(e) => setEditGoogleEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-semibold text-white block">Account Active</span>
                  <span className="text-[11px] text-slate-400">If deactivated, employee cannot sign in or tap attendance</span>
                </div>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </div>

              {editError && <p className="text-rose-400 text-[11px]">{editError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Employee Status Drilldown Modal */}
      {drilldownStatus && (
        <StatusDrilldownModal
          isOpen={Boolean(drilldownStatus)}
          initialStatus={drilldownStatus}
          selectedDate={selectedDate || getPHDateString(new Date(), timezone)}
          timezone={timezone}
          employees={dashboardEmployees.length > 0 ? dashboardEmployees : employees}
          attendanceLogs={attendanceLogs}
          leaves={dashboardLeaves}
          failedAttempts={failedAttempts}
          flaggedLogs={flaggedLogs}
          counts={counts}
          onClose={() => setDrilldownStatus(null)}
          onOpenChat={() => {
            handleSelectTab('chat');
            setUnreadChatCount(0);
          }}
        />
      )}

      {/* Delete Employee Confirmation Modal */}
      {deletingEmp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => !isDeletingEmp && setDeletingEmp(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Delete Employee Account</h3>
                <p className="text-xs text-slate-400">This action is permanent and irreversible</p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee Name:</span>
                <strong className="text-white">{deletingEmp.full_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-300 font-mono">{deletingEmp.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="uppercase text-slate-300 font-bold text-[10px] bg-slate-800 px-2 py-0.5 rounded-full">
                  {deletingEmp.role}
                </span>
              </div>
            </div>

            <p className="text-xs text-rose-300/90 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl leading-relaxed">
              ⚠️ Permanent deletion is strictly restricted to Super Admins. It permanently erases the user account. Permanent deletion is locked if records exist within the retention window (default 3 years).
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-300 font-semibold block">
                Type employee full name <span className="text-rose-400 font-mono font-bold">&quot;{deletingEmp.full_name}&quot;</span> to unlock permanent deletion:
              </label>
              <input
                type="text"
                placeholder={deletingEmp.full_name}
                value={confirmDeleteInput}
                onChange={(e) => setConfirmDeleteInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 focus:outline-none"
              />
            </div>

            {deleteEmpError && (
              <p className="text-xs text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
                {deleteEmpError}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isDeletingEmp}
                  onClick={() => {
                    setDeletingEmp(null);
                    setConfirmDeleteInput('');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingEmp || confirmDeleteInput.trim().toLowerCase() !== deletingEmp.full_name.trim().toLowerCase()}
                  onClick={handleConfirmDeleteEmployee}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  {isDeletingEmp ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const empId = deletingEmp.id;
                  setDeletingEmp(null);
                  setConfirmDeleteInput('');
                  handleArchiveEmployee(empId, true);
                }}
                className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition"
              >
                Archive Employee Instead (Recommended)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Detail Modal */}
      {selectedAuditLog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedAuditLog(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Audit Log Entry Details</h3>
                <span className="text-xs font-mono text-blue-400 font-bold">{selectedAuditLog.action}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {new Date(selectedAuditLog.created_at).toLocaleString()}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              <div>
                <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Actor / Performed By:</span>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-slate-300">
                  {selectedAuditLog.actor?.full_name || 'System / Service'} ({selectedAuditLog.actor?.email || selectedAuditLog.actor_id})
                </div>
              </div>

              {selectedAuditLog.old_value && (
                <div>
                  <span className="text-[11px] text-rose-400 block mb-1 font-semibold">Previous State (old_value):</span>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px] text-rose-300 overflow-x-auto">
                    {JSON.stringify(selectedAuditLog.old_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAuditLog.new_value && (
                <div>
                  <span className="text-[11px] text-emerald-400 block mb-1 font-semibold">Updated State (new_value):</span>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px] text-emerald-300 overflow-x-auto">
                    {JSON.stringify(selectedAuditLog.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAuditLog.details && (
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Payload &amp; Context:</span>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(selectedAuditLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate History & Tier Modal */}
      {rateEmp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => !savingRateTier && setRateEmp(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  Management Rates &amp; Wage History
                </h3>
                <p className="text-xs text-slate-400">
                  {rateEmp.full_name} ({rateEmp.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRateEmp(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rateModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {rateModalError}
              </div>
            )}

            {/* Form to insert new rate tier */}
            <form onSubmit={handleSaveRateTier} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <h4 className="font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Set New Rate Tier
              </h4>
              <p className="text-[11px] text-slate-400">
                New rates take effect from the chosen date forward. Past DTRs and historical reports are never rewritten.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Effective Date</label>
                  <input
                    type="date"
                    required
                    value={rateFormEffectiveFrom}
                    onChange={(e) => setRateFormEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Daily Wage Rate (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 610.00"
                    value={rateFormRegular}
                    onChange={(e) => setRateFormRegular(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Overtime Rate / hr (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 114.38"
                    value={rateFormOt}
                    onChange={(e) => setRateFormOt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
              </div>

              {settings?.enable_special_day_rates && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Rest Day OT Rate / hr (₱) <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Leave blank to use standard OT"
                      value={rateFormRestDayOt}
                      onChange={(e) => setRateFormRestDayOt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Holiday OT Rate / hr (₱) <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Leave blank to use standard OT"
                      value={rateFormHolidayOt}
                      onChange={(e) => setRateFormHolidayOt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingRateTier}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-1.5"
              >
                {savingRateTier ? 'Saving Rate Tier...' : 'Save & Apply New Rate Tier'}
              </button>
            </form>

            {/* History Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Historical Rate Tiers</h4>
              {loadingRates ? (
                <p className="text-xs text-slate-500">Loading rate history...</p>
              ) : rateHistory.length === 0 ? (
                <p className="text-xs text-slate-500">No previous rate history records found.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                        <th className="p-2.5 font-semibold">Effective From</th>
                        <th className="p-2.5 font-semibold">Daily Wage</th>
                        <th className="p-2.5 font-semibold">OT Rate / hr</th>
                        {settings?.enable_special_day_rates && (
                          <>
                            <th className="p-2.5 font-semibold">Rest Day OT</th>
                            <th className="p-2.5 font-semibold">Holiday OT</th>
                          </>
                        )}
                        <th className="p-2.5 font-semibold">Logged At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {rateHistory.map((tier) => (
                        <tr key={tier.id} className="hover:bg-slate-800/20">
                          <td className="p-2.5 text-emerald-400 font-semibold">{tier.effective_from}</td>
                          <td className="p-2.5 text-white">₱{Number(tier.regular_rate).toFixed(2)}</td>
                          <td className="p-2.5 text-amber-300">₱{Number(tier.overtime_rate_per_hour).toFixed(2)}</td>
                          {settings?.enable_special_day_rates && (
                            <>
                              <td className="p-2.5 text-slate-300">
                                {tier.rest_day_ot_rate ? `₱${Number(tier.rest_day_ot_rate).toFixed(2)}` : '—'}
                              </td>
                              <td className="p-2.5 text-slate-300">
                                {tier.holiday_ot_rate ? `₱${Number(tier.holiday_ot_rate).toFixed(2)}` : '—'}
                              </td>
                            </>
                          )}
                          <td className="p-2.5 text-[10px] text-slate-500">
                            {new Date(tier.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRateEmp(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Rates CSV Modal */}
      {showBulkRatesModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => !confirmingBulk && setShowBulkRatesModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-emerald-400" />
                  Bulk Update Management Rates via CSV
                </h3>
                <p className="text-xs text-slate-400">
                  Update employee daily wages and overtime rates in bulk with effective dates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkRatesModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {bulkError}
              </div>
            )}

            {bulkSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                {bulkSuccessMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">CSV Format Specification</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Columns: <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded">employee (email/name/id), regular_rate, overtime_rate_per_hour, effective_from (YYYY-MM-DD)</code>
                </p>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`employee,regular_rate,overtime_rate_per_hour,effective_from
juan@company.com,650.00,121.88,2026-11-01
maria@company.com,700.00,131.25,2026-11-01`}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Paste CSV Text or Upload File</label>
                  <label className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                    Browse File (.csv, .txt)
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setBulkCsvText((ev.target?.result as string) || '');
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  rows={5}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder="Paste CSV rows here..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <button
                type="button"
                onClick={handlePreviewBulkCsv}
                disabled={loadingBulkPreview}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-md"
              >
                {loadingBulkPreview ? 'Validating CSV...' : 'Preview Changes'}
              </button>
            </div>

            {/* Preview Results Table */}
            {bulkPreviewData && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-amber-300 uppercase tracking-wider">
                    Validation Preview ({bulkPreviewData.filter((r) => r.matched && !r.error).length} valid, {bulkPreviewData.filter((r) => !r.matched || r.error).length} errors)
                  </h4>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-2xl max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                        <th className="p-2.5 font-semibold">Status</th>
                        <th className="p-2.5 font-semibold">Employee</th>
                        <th className="p-2.5 font-semibold">Regular Rate</th>
                        <th className="p-2.5 font-semibold">OT Rate / hr</th>
                        <th className="p-2.5 font-semibold">Effective From</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {bulkPreviewData.map((row, idx) => (
                        <tr key={idx} className={row.matched && !row.error ? 'hover:bg-slate-800/20' : 'bg-rose-950/20'}>
                          <td className="p-2.5">
                            {row.matched && !row.error ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                                Match
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950 text-rose-400 border border-rose-800/60" title={row.error}>
                                Error: {row.error}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="font-medium text-white">{row.fullName || row.identifier}</div>
                            {row.email && <div className="text-[10px] text-slate-400">{row.email}</div>}
                          </td>
                          <td className="p-2.5 font-mono">
                            <span className="text-slate-400">₱{Number(row.oldRegularRate || 0).toFixed(2)}</span>
                            <span className="text-slate-500 mx-1">&rarr;</span>
                            <span className="text-emerald-400 font-bold">₱{Number(row.newRegularRate).toFixed(2)}</span>
                          </td>
                          <td className="p-2.5 font-mono">
                            <span className="text-slate-400">₱{Number(row.oldOtRate || 0).toFixed(2)}</span>
                            <span className="text-slate-500 mx-1">&rarr;</span>
                            <span className="text-amber-300 font-bold">₱{Number(row.newOtRate).toFixed(2)}</span>
                          </td>
                          <td className="p-2.5 font-mono text-emerald-300">{row.effectiveFrom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmBulkRates}
                  disabled={confirmingBulk || bulkPreviewData.filter((r) => r.matched && !r.error).length === 0}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-md"
                >
                  {confirmingBulk ? 'Applying Rates...' : 'Confirm & Apply Rates'}
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkRatesModal(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
