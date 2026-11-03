'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { Coffee, Play, Square, Loader2, Lock, X } from 'lucide-react';
import { BreakRecord } from '@/types/database.types';
import { getOrCreateDeviceId } from '@/lib/device';

interface Props {
  activeBreak: BreakRecord | null;
  attendanceId: string | null;
  onBreakUpdated: () => void;
}

export default function BreakButton({ activeBreak, attendanceId, onBreakUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [fallbackPassword, setFallbackPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'break_in' | 'break_out'>('break_in');

  const isOnBreak = Boolean(activeBreak && !activeBreak.break_end);
  const actionType = isOnBreak ? 'break_out' : 'break_in';

  const handleToggleBreak = async () => {
    if (loading || !attendanceId) return;

    // Requirement E: offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setMsg('No connection, cannot record attendance.');
      return;
    }

    setLoading(true);
    setMsg(null);

    const deviceId = getOrCreateDeviceId();

    // 1. Fetch WebAuthn auth options
    let authResponse = null;
    try {
      const optionsRes = await fetch('/api/auth/webauthn/auth-options');
      if (optionsRes.ok) {
        const options = await optionsRes.json();
        authResponse = await startAuthentication({ optionsJSON: options });
      }
    } catch (authErr) {
      console.warn('WebAuthn prompt error / dismissed:', authErr);
      // Offer password fallback modal
      setPendingAction(actionType);
      setShowFallbackModal(true);
      setLoading(false);
      setMsg('Biometric scan cancelled. You may use fallback verification.');
      return;
    }

    // 2. Submit break action
    try {
      const res = await fetch('/api/attendance/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          attendance_id: attendanceId,
          device_id: deviceId,
          authResponse,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Failed to update break');
      } else {
        setMsg(data.message);
        onBreakUpdated();
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error updating break');
    } finally {
      setLoading(false);
    }
  };

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fallbackPassword) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setMsg('No connection, cannot record attendance.');
      setShowFallbackModal(false);
      return;
    }

    setLoading(true);
    setMsg(null);

    const deviceId = getOrCreateDeviceId();

    try {
      const res = await fetch('/api/attendance/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pendingAction,
          attendance_id: attendanceId,
          device_id: deviceId,
          fallbackPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Fallback verification failed.');
      } else {
        setMsg(data.message);
        setShowFallbackModal(false);
        setFallbackPassword('');
        onBreakUpdated();
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error submitting break');
    } finally {
      setLoading(false);
    }
  };

  if (!attendanceId) return null;

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isOnBreak
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isOnBreak ? 'Currently on Break' : 'Rest & Meal Break'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isOnBreak && activeBreak?.break_start
                ? `Started at ${new Date(activeBreak.break_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Fingerprint verified break logging'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleBreak}
          disabled={loading}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            isOnBreak
              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
              : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shadow-sm'
          }`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isOnBreak ? (
            <Square className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isOnBreak ? 'End Break' : 'Take Break'}
        </button>
      </div>

      {msg && (
        <p className="text-xs text-center text-slate-600 dark:text-slate-400 mt-1">
          {msg}
        </p>
      )}

      {/* Fallback password modal for break */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => {
                setShowFallbackModal(false);
                setFallbackPassword('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Break Fallback Verification
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter your account password to verify this {pendingAction === 'break_in' ? 'break start' : 'break conclusion'}.
            </p>

            <form onSubmit={handleFallbackSubmit} className="space-y-3">
              <input
                type="password"
                required
                placeholder="Account password"
                value={fallbackPassword}
                onChange={(e) => setFallbackPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
