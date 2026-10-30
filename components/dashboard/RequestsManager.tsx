'use client';

import { useState, useEffect } from 'react';
import { Calendar, AlertCircle, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { LeaveRequest, CorrectionRequest, LeaveType } from '@/types/database.types';

interface Props {
  isAdmin?: boolean;
}

export default function RequestsManager({ isAdmin = false }: Props) {
  const [activeTab, setActiveTab] = useState<'leave' | 'correction'>('leave');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // New leave modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // New correction modal state
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [corrDate, setCorrDate] = useState('');
  const [corrTimeIn, setCorrTimeIn] = useState('');
  const [corrTimeOut, setCorrTimeOut] = useState('');
  const [corrReason, setCorrReason] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    try {
      const [lRes, cRes] = await Promise.all([
        fetch('/api/requests/leave'),
        fetch('/api/requests/correction'),
      ]);

      if (lRes.ok) {
        const lData = await lRes.json();
        setLeaves(lData.requests || []);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCorrections(cData.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Submit new leave
  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/requests/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: leaveReason,
        }),
      });

      if (res.ok) {
        setShowLeaveModal(false);
        setLeaveReason('');
        loadRequests();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Submit new correction
  const handleCreateCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const timeInIso = corrTimeIn ? `${corrDate}T${corrTimeIn}:00Z` : null;
      const timeOutIso = corrTimeOut ? `${corrDate}T${corrTimeOut}:00Z` : null;

      const res = await fetch('/api/requests/correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_date: corrDate,
          requested_time_in: timeInIso,
          requested_time_out: timeOutIso,
          reason: corrReason,
        }),
      });

      if (res.ok) {
        setShowCorrectionModal(false);
        setCorrReason('');
        loadRequests();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Admin Review action
  const handleAdminReview = async (type: 'leave' | 'correction', id: string, status: 'approved' | 'rejected') => {
    const notes = prompt(`Enter review notes for ${status}:`) || '';
    try {
      const endpoint = type === 'leave' ? `/api/requests/leave/${id}` : `/api/requests/correction/${id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_notes: notes }),
      });

      if (res.ok) {
        loadRequests();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('leave')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'leave'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Leave Requests ({leaves.length})
          </button>
          <button
            onClick={() => setActiveTab('correction')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'correction'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Attendance Corrections ({corrections.length})
          </button>
        </div>

        {!isAdmin && (
          <button
            onClick={() => (activeTab === 'leave' ? setShowLeaveModal(true) : setShowCorrectionModal(true))}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'leave' ? 'File Leave' : 'Request Correction'}</span>
          </button>
        )}
      </div>

      {/* Content list */}
      <div className="mt-4 space-y-3">
        {activeTab === 'leave' ? (
          leaves.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No leave requests found.</p>
          ) : (
            leaves.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                      {req.leave_type} Leave
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : req.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Dates: <b>{req.start_date}</b> to <b>{req.end_date}</b> {isAdmin && req.profile ? `• ${req.profile.full_name}` : ''}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 italic">&quot;{req.reason}&quot;</p>
                  {req.review_notes && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                      Admin note: {req.review_notes}
                    </p>
                  )}
                </div>

                {isAdmin && req.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAdminReview('leave', req.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleAdminReview('leave', req.id, 'rejected')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          corrections.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No correction requests found.</p>
          ) : (
            corrections.map((corr) => (
              <div
                key={corr.id}
                className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Attendance Correction ({corr.requested_date})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        corr.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : corr.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {corr.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {corr.requested_time_in && `In: ${new Date(corr.requested_time_in).toLocaleTimeString()} `}
                    {corr.requested_time_out && `Out: ${new Date(corr.requested_time_out).toLocaleTimeString()} `}
                    {isAdmin && corr.profile ? `• ${corr.profile.full_name}` : ''}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 italic">&quot;{corr.reason}&quot;</p>
                  {corr.review_notes && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                      Admin note: {corr.review_notes}
                    </p>
                  )}
                </div>

                {isAdmin && corr.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAdminReview('correction', corr.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleAdminReview('correction', corr.id, 'rejected')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>

      {/* New Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">Request Leave</h3>
            <form onSubmit={handleCreateLeave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                >
                  <option value="vacation">Vacation Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">Reason</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain reason for leave..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">Request Attendance Correction</h3>
            <form onSubmit={handleCreateCorrection} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">Date of Shift</label>
                <input
                  type="date"
                  required
                  value={corrDate}
                  onChange={(e) => setCorrDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">Actual Time In</label>
                  <input
                    type="time"
                    value={corrTimeIn}
                    onChange={(e) => setCorrTimeIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">Actual Time Out</label>
                  <input
                    type="time"
                    value={corrTimeOut}
                    onChange={(e) => setCorrTimeOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-medium">Explanation</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Forgot to tap out before leaving office..."
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

