'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getPHDateString, formatPHTime } from '@/lib/ph-time';
import TimeTapButton from '@/components/dashboard/TimeTapButton';
import BreakButton from '@/components/dashboard/BreakButton';
import FirstLoginSetup from '@/components/auth/FirstLoginSetup';
import ConnectedAccounts from '@/components/profile/ConnectedAccounts';
import RequestsManager from '@/components/dashboard/RequestsManager';
import ChatWindow from '@/components/chat/ChatWindow';
import {
  Clock,
  History,
  Calendar,
  MessageSquare,
  User,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import DTRViewer from '@/components/reports/DTRViewer';
import { Profile, AttendanceLog, BreakRecord, NotificationPreference } from '@/types/database.types';

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [activeBreak, setActiveBreak] = useState<BreakRecord | null>(null);
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  type EmployeeTab = 'clock' | 'history' | 'dtr' | 'requests' | 'chat' | 'profile';
  const [activeTab, setActiveTab] = useState<EmployeeTab>('clock');

  // Restore saved employee tab from localStorage on reload
  useEffect(() => {
    const saved = localStorage.getItem('activeEmployeeTab') as EmployeeTab;
    if (saved) {
      setActiveTab(saved);
    }
  }, []);

  const handleSelectTab = (tab: EmployeeTab) => {
    setActiveTab(tab);
    localStorage.setItem('activeEmployeeTab', tab);
  };
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Live clock ticker
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Fetch user profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*, shift:shifts(*), department:departments(*)')
        .eq('id', user.id)
        .single();

      if (prof) setProfile(prof as Profile);

      // 2. Fetch today's log in Philippine Standard Time
      const todayStr = getPHDateString();
      const { data: log } = await supabase
        .from('attendance_logs')
        .select('*, breaks(*)')
        .eq('employee_id', user.id)
        .eq('date', todayStr)
        .single();

      if (log) {
        setTodayLog(log as AttendanceLog);
        const openBreak = log.breaks?.find((b: BreakRecord) => !b.break_end);
        setActiveBreak(openBreak || null);
      } else {
        setTodayLog(null);
        setActiveBreak(null);
      }

      // 3. Fetch recent history
      const { data: hist } = await supabase
        .from('attendance_logs')
        .select('*, location_in:locations!location_in_id(name)')
        .eq('employee_id', user.id)
        .order('date', { ascending: false })
        .limit(14);

      if (hist) setHistory(hist as AttendanceLog[]);

      // 4. Fetch notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('employee_id', user.id)
        .single();

      if (prefs) setPreferences(prefs as NotificationPreference);

      // 5. Fetch unread chat count
      try {
        const chatRes = await fetch('/api/chat/conversations');
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const totalUnread = (chatData.conversations || []).reduce(
            (acc: number, c: { unreadCount?: number }) => acc + (c.unreadCount || 0),
            0
          );
          setUnreadChatCount(totalUnread);
        }
      } catch (err) {
        // ignore
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 1. Supabase Realtime channel for live employee updates
    const channel = supabase
      .channel('employee-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        () => {
          loadData();
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
      loadData();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  // Check if first-login setup required
  const needsSetup = profile.must_change_password || !profile.consent_given;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 sm:pb-8 flex flex-col">
      {/* First-login setup modal */}
      {needsSetup && (
        <FirstLoginSetup
          mustChangePassword={profile.must_change_password}
          needsConsent={!profile.consent_given}
          onCompleted={() => loadData()}
        />
      )}

      {/* Top Mobile-First Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            {profile.full_name?.[0] || 'E'}
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              {profile.full_name}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {profile.role === 'admin' ? 'Administrator' : 'Employee'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile.role === 'admin' && (
            <button
              onClick={() => router.push('/admin')}
              className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-xs font-semibold hover:bg-purple-200"
            >
              Admin View
            </button>
          )}
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Tabs (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center justify-center gap-2 bg-slate-200/60 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => handleSelectTab('clock')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'clock' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Clock className="w-4 h-4" /> Clock In/Out
          </button>
          <button
            onClick={() => handleSelectTab('history')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <History className="w-4 h-4" /> Attendance
          </button>
          <button
            onClick={() => handleSelectTab('dtr')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'dtr' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <FileText className="w-4 h-4" /> DTR Form
          </button>
          <button
            onClick={() => handleSelectTab('requests')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'requests' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Calendar className="w-4 h-4" /> Requests
          </button>
          <button
            onClick={() => {
              handleSelectTab('chat');
              setUnreadChatCount(0);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 relative ${
              activeTab === 'chat' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-4 h-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </div>
            <span>Team Chat</span>
          </button>
          <button
            onClick={() => handleSelectTab('profile')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'profile' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <User className="w-4 h-4" /> Settings
          </button>
        </div>

        {/* TAB 1: TAP CLOCK IN / OUT */}
        {activeTab === 'clock' && (
          <div className="space-y-6">
            {/* Live Clock Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm text-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {currentTime ? currentTime.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : '...'} (Philippine Time)
              </span>
              <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white my-1 tracking-tight font-mono">
                {currentTime ? currentTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '--:--:--'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 mt-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Device Geofenced & WebAuthn Protected</span>
              </div>
            </div>

            {/* Tap Button */}
            <TimeTapButton activeLog={todayLog} onAttendanceUpdated={loadData} />

            {/* Rest Break Button */}
            <BreakButton
              activeBreak={activeBreak}
              attendanceId={todayLog?.id || null}
              onBreakUpdated={loadData}
            />

            {/* Today's Stats Cards */}
            {todayLog && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Time In</span>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {formatPHTime(todayLog.time_in)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Time Out</span>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {todayLog.time_out ? formatPHTime(todayLog.time_out) : '--:--'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Hours Worked</span>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {todayLog.hours_worked ? `${todayLog.hours_worked}h` : 'In Progress'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Status</span>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        todayLog.status === 'late'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {todayLog.status}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ATTENDANCE HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Recent Attendance History
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No past attendance logs found.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{h.date}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            h.status === 'late'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {h.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        In: {formatPHTime(h.time_in)} • Out: {h.time_out ? formatPHTime(h.time_out) : 'Pending'}
                      </p>
                      {h.late_minutes > 0 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                          Late by {h.late_minutes} minutes
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {h.hours_worked ? `${h.hours_worked.toFixed(1)} hrs` : '--'}
                      </span>
                      <p className="text-[10px] text-slate-400 capitalize">{h.verification_method} verif.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: OFFICIAL DTR SLIP */}
        {activeTab === 'dtr' && <DTRViewer isAdmin={false} />}

        {/* TAB 3: REQUESTS (LEAVE & CORRECTION) */}
        {activeTab === 'requests' && <RequestsManager isAdmin={false} />}

        {/* TAB 4: CHAT */}
        {activeTab === 'chat' && <ChatWindow currentUser={profile} onUnreadCountChange={setUnreadChatCount} />}

        {/* TAB 5: CONNECTED ACCOUNTS & SETTINGS */}
        {activeTab === 'profile' && (
          <ConnectedAccounts
            profile={profile}
            preferences={preferences}
            onProfileUpdated={loadData}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Sticky Bottom) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-around">
        <button
          onClick={() => handleSelectTab('clock')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'clock' ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] font-bold">Tap</span>
        </button>

        <button
          onClick={() => handleSelectTab('history')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold">Log</span>
        </button>

        <button
          onClick={() => handleSelectTab('dtr')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'dtr' ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold">DTR</span>
        </button>

        <button
          onClick={() => handleSelectTab('requests')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'requests' ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] font-bold">Requests</span>
        </button>

        <button
          onClick={() => {
            handleSelectTab('chat');
            setUnreadChatCount(0);
          }}
          className={`flex flex-col items-center gap-1 relative ${
            activeTab === 'chat' ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-bold">Chat</span>
        </button>

        <button
          onClick={() => handleSelectTab('profile')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'profile' ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </nav>
    </div>
  );
}
