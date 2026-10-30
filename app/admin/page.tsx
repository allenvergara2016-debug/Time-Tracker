'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import RequestsManager from '@/components/dashboard/RequestsManager';
import { exportToCSV, exportToExcel, exportToPDF, ReportItem } from '@/lib/export';
import { formatPHTime, getPHDateString } from '@/lib/ph-time';
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
} from 'lucide-react';
import DTRViewer from '@/components/reports/DTRViewer';
import ChatWindow from '@/components/chat/ChatWindow';
import {
  Profile,
  Location,
  Shift,
  Department,
  AppSettings,
  AttendanceLog,
  FailedAttempt,
} from '@/types/database.types';

// Dynamic import for Leaflet maps to disable SSR
const LocationAdminMap = dynamic(() => import('@/components/map/LocationAdminMap'), { ssr: false });
const LiveAttendanceMap = dynamic(() => import('@/components/map/LiveAttendanceMap'), { ssr: false });

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  type AdminTab = 'overview' | 'map' | 'employees' | 'locations' | 'shifts' | 'requests' | 'chat' | 'dtr' | 'reports' | 'flagged' | 'settings';
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
  const [empDailyRate, setEmpDailyRate] = useState('610.00');
  const [empOvertimeRate, setEmpOvertimeRate] = useState('114.38');
  const [empRole, setEmpRole] = useState<'employee' | 'admin'>('employee');
  const [empError, setEmpError] = useState('');

  // Edit Employee Modal
  const [editingEmp, setEditingEmp] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editShiftId, setEditShiftId] = useState('');
  const [editDailyRate, setEditDailyRate] = useState('');
  const [editOvertimeRate, setEditOvertimeRate] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'employee' | 'admin'>('employee');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState('');

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

  // Entities
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setAppSettings] = useState<AppSettings | null>(null);

  // Load Admin Data
  const loadDashboardData = async () => {
    try {
      const q = new URLSearchParams({ date: selectedDate });
      if (selectedDept) q.set('department_id', selectedDept);

      const res = await fetch(`/api/admin/dashboard?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts);
        setAttendanceLogs(data.attendanceLogs || []);
        setFailedAttempts(data.failedAttempts || []);
        setFlaggedLogs(data.flaggedLogs || []);
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
    const channel = supabase
      .channel('admin-dashboard-realtime')
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
  }, [selectedDate, selectedDept]);

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
    setEditDailyRate((emp.daily_rate || 0).toString());
    setEditOvertimeRate((emp.overtime_rate_per_hour || 0).toString());
    setEditPhone(emp.phone || '');
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
          daily_rate: Number(editDailyRate) || 0,
          overtime_rate_per_hour: Number(editOvertimeRate) || 0,
          phone: editPhone || null,
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

  // Quick edit wage and overtime rate in Philippine Peso (₱)
  const handleUpdateWage = async (emp: Profile) => {
    const newDailyRateStr = prompt(`Set Daily Wage Rate (₱) for ${emp.full_name}:`, (emp.daily_rate || 610).toString());
    if (newDailyRateStr === null) return;
    const newDailyRate = parseFloat(newDailyRateStr);
    if (isNaN(newDailyRate) || newDailyRate < 0) return alert('Invalid daily rate.');

    const newOtStr = prompt(`Set Overtime Rate per Hour (₱/hr) for ${emp.full_name}:`, (emp.overtime_rate_per_hour || 114.38).toString());
    if (newOtStr === null) return;
    const newOt = parseFloat(newOtStr);
    if (isNaN(newOt) || newOt < 0) return alert('Invalid overtime rate.');

    const res = await fetch(`/api/admin/employees/${emp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daily_rate: newDailyRate,
        overtime_rate_per_hour: newOt,
      }),
    });

    if (res.ok) {
      alert(`Wage updated for ${emp.full_name}: ₱${newDailyRate.toFixed(2)}/day (OT: ₱${newOt.toFixed(2)}/hr)`);
      loadAllEntities();
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
    const tempPass = prompt('Enter new temporary password (at least 6 characters):');
    if (!tempPass) return;
    const res = await fetch(`/api/admin/employees/${empId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: tempPass }),
    });
    if (res.ok) alert('Temporary password set! Employee will be forced to change it on login.');
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
    if (res.ok) alert('Settings saved successfully!');
  };

  // Export Reports
  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    const items: ReportItem[] = attendanceLogs.map((l) => ({
      date: l.date,
      employee_name: l.profile?.full_name || 'Unknown',
      department: l.profile?.department_id || 'General',
      time_in: l.time_in ? formatPHTime(l.time_in) : '-',
      time_out: l.time_out ? formatPHTime(l.time_out) : '-',
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
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            TT
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Admin Command Center</h1>
            <p className="text-[11px] text-slate-400">Time Tracker & Biometrics</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
                    value={selectedDate}
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

              {/* Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium uppercase">Present</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{counts.present}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium uppercase">Late</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">{counts.late}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium uppercase">Timed Out</span>
                  <div className="text-2xl font-black text-blue-400 mt-1">{counts.timedOut}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium uppercase">On Leave</span>
                  <div className="text-2xl font-black text-purple-400 mt-1">{counts.onLeave}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium uppercase">Absent</span>
                  <div className="text-2xl font-black text-rose-400 mt-1">{counts.absent}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium uppercase">Flagged / Alerts</span>
                  <div className="text-2xl font-black text-rose-500 mt-1">{counts.flagged}</div>
                </div>
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
                            <td className="py-3 text-slate-300 font-mono whitespace-nowrap">{formatPHTime(log.time_in)}</td>
                            <td className="py-3 text-slate-300 font-mono whitespace-nowrap">
                              {log.time_out ? formatPHTime(log.time_out) : '--'}
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
                    Public sign-up is disabled. Accounts are provisioned here via Supabase Admin API.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddEmpModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" /> Provision Account
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Name</th>
                      <th className="pb-3 font-semibold">Email</th>
                      <th className="pb-3 font-semibold">Role</th>
                      <th className="pb-3 font-semibold">Daily Rate / OT</th>
                      <th className="pb-3 font-semibold">Device</th>
                      <th className="pb-3 font-semibold">Passkeys</th>
                      <th className="pb-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-medium text-white">{emp.full_name}</td>
                        <td className="py-3 text-slate-400">{emp.email}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                            {emp.role}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleUpdateWage(emp)}
                            className="px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 font-mono font-bold text-[11px] flex flex-col items-start gap-0.5 transition"
                            title="Click to edit Daily Wage Rate and Overtime Rate"
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-400 font-semibold">₱{(emp.daily_rate || 610).toFixed(2)}/day</span>
                            </div>
                            <span className="text-[10px] text-emerald-500 font-normal">OT: ₱{(emp.overtime_rate_per_hour || 114.38).toFixed(2)}/hr</span>
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
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950 text-rose-300">
                              Inactive
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
                <ChatWindow currentUser={currentUserProfile} />
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
                              {formatPHTime(fa.created_at)}
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl">
              <h3 className="font-bold text-base text-white mb-4">System Biometrics & Verification Rules</h3>
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

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
                >
                  Save Settings
                </button>
              </form>
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
                  placeholder="At least 6 characters"
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
                  <label className="block text-slate-300 mb-1 font-medium">Phone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+63 9..."
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Role</label>
                  {currentUserProfile?.email === 'admin@company.com' || currentUserProfile?.is_super_admin ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'employee' | 'admin')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Administrator</option>
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 capitalize flex items-center justify-between">
                      <span>{editRole}</span>
                      <span className="text-[10px] text-amber-500 font-medium">Super Admin Only</span>
                    </div>
                  )}
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
    </div>
  );
}
