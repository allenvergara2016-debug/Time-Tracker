'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import confetti from 'canvas-confetti';
import { Clock, ShieldCheck, MapPin, AlertCircle, Lock, Loader2, Coffee } from 'lucide-react';
import { getOrCreateDeviceId } from '@/lib/device';
import { AttendanceLog } from '@/types/database.types';

interface Props {
  activeLog: AttendanceLog | null;
  onAttendanceUpdated: () => void;
}

export default function TimeTapButton({ activeLog, onAttendanceUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [fallbackPassword, setFallbackPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'time_in' | 'time_out'>('time_in');
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const isTimedIn = Boolean(activeLog && !activeLog.time_out);
  const actionType = isTimedIn ? 'time_out' : 'time_in';

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 100]);
    }
  };

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser or phone.'));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const handleTap = async () => {
    if (loading) return;
    setLoading(true);
    setStatusMessage({ text: 'Reading precise GPS coordinates...', type: 'info' });

    try {
      // 1. Get GPS coordinates
      let pos: GeolocationPosition;
      try {
        pos = await getPosition();
      } catch (geoErr: unknown) {
        const msg = geoErr instanceof Error ? geoErr.message : 'Location permission denied';
        setStatusMessage({
          text: `GPS Access Required: ${msg}. Please enable Location Services in your phone settings.`,
          type: 'error',
        });
        setLoading(false);
        return;
      }

      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const deviceId = getOrCreateDeviceId();

      // 2. Fetch biometric WebAuthn options
      setStatusMessage({ text: 'Verifying fingerprint / Face ID...', type: 'info' });
      const optionsRes = await fetch('/api/auth/webauthn/auth-options');

      let authResponse = null;

      if (optionsRes.ok) {
        const options = await optionsRes.json();
        try {
          authResponse = await startAuthentication({ optionsJSON: options });
        } catch (authErr: unknown) {
          console.warn('WebAuthn prompt error / dismissed:', authErr);
          // If biometric fails or is cancelled, offer fallback password prompt
          setPendingAction(actionType);
          setPendingCoords({ lat, lng, accuracy });
          setShowFallbackModal(true);
          setLoading(false);
          setStatusMessage({
            text: 'Biometric scan unavailable or cancelled. You may use fallback verification below.',
            type: 'info',
          });
          return;
        }
      }

      // 3. Send tap request to server
      setStatusMessage({ text: 'Recording attendance on server...', type: 'info' });
      const tapRes = await fetch('/api/attendance/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          lat,
          lng,
          accuracy,
          device_id: deviceId,
          authResponse,
        }),
      });

      const data = await tapRes.json();

      if (!tapRes.ok) {
        setStatusMessage({ text: data.error || 'Attendance check failed', type: 'error' });
      } else {
        triggerHaptic();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 },
        });

        setStatusMessage({
          text: `${data.message} (${data.verificationMethod.toUpperCase()})`,
          type: 'success',
        });
        onAttendanceUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Submit via fallback password
  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCoords || !fallbackPassword) return;

    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const tapRes = await fetch('/api/attendance/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pendingAction,
          lat: pendingCoords.lat,
          lng: pendingCoords.lng,
          accuracy: pendingCoords.accuracy,
          device_id: deviceId,
          fallbackPassword,
        }),
      });

      const data = await tapRes.json();

      if (!tapRes.ok) {
        setStatusMessage({ text: data.error || 'Fallback verification failed', type: 'error' });
      } else {
        triggerHaptic();
        setShowFallbackModal(false);
        setFallbackPassword('');
        setStatusMessage({
          text: `${data.message} (Recorded as Fallback for admin review)`,
          type: 'success',
        });
        onAttendanceUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting fallback';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg text-center relative overflow-hidden">
      {/* Decorative ambient background ring */}
      <div
        className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${
          isTimedIn ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
      />

      <div className="mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
            isTimedIn
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full animate-ping ${isTimedIn ? 'bg-amber-500' : 'bg-emerald-500'}`}
          />
          {isTimedIn ? 'Currently On Shift' : 'Ready to Time In'}
        </span>
      </div>

      {/* GIANT TAP BUTTON (No forms, single tap flow) */}
      <button
        onClick={handleTap}
        disabled={loading}
        className={`relative group w-56 h-56 sm:w-64 sm:h-64 rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-2xl cursor-pointer select-none ${
          loading
            ? 'opacity-80 scale-95 pointer-events-none'
            : isTimedIn
            ? 'bg-gradient-to-tr from-amber-600 to-rose-500 text-white shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105'
            : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105'
        }`}
      >
        {/* Animated concentric pulse ring */}
        <span
          className={`absolute inset-0 rounded-full animate-ping opacity-25 pointer-events-none ${
            isTimedIn ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
        />

        <div className="relative z-10 flex flex-col items-center gap-2">
          {loading ? (
            <Loader2 className="w-16 h-16 animate-spin text-white" />
          ) : (
            <ShieldCheck className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-md" />
          )}

          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-sm uppercase">
            {loading ? 'Verifying...' : isTimedIn ? 'TIME OUT' : 'TIME IN'}
          </div>

          <div className="text-[11px] font-medium tracking-wide uppercase opacity-90">
            {isTimedIn ? 'Tap + Biometric' : 'Tap + Biometric'}
          </div>
        </div>
      </button>

      {/* Sub-status or guidance message */}
      {statusMessage && (
        <div
          className={`mt-6 p-3.5 rounded-2xl max-w-sm w-full text-xs font-medium flex items-center gap-2.5 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}
        >
          {statusMessage.type === 'success' && <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
          {statusMessage.type === 'info' && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600" />}
          <span className="flex-1 text-left">{statusMessage.text}</span>
        </div>
      )}

      {/* Fallback Password Modal (when biometrics unavailable) */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-left">
            <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
              <Lock className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Biometric Fallback</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Enter your account password to verify attendance. This attempt will be logged as &quot;fallback&quot; for
              supervisor review.
            </p>

            <form onSubmit={handleFallbackSubmit} className="space-y-4">
              <input
                type="password"
                required
                placeholder="Enter account password"
                value={fallbackPassword}
                onChange={(e) => setFallbackPassword(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFallbackModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
                >
                  {loading ? 'Submitting...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

