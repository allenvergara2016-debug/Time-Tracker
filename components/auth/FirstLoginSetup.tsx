'use client';

import { useState } from 'react';
import { Lock, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import PasskeyEnrollment from './PasskeyEnrollment';

interface Props {
  mustChangePassword: boolean;
  needsConsent: boolean;
  onCompleted: () => void;
}

export default function FirstLoginSetup({ mustChangePassword, needsConsent, onCompleted }: Props) {
  const [step, setStep] = useState<'password' | 'consent' | 'passkey'>(
    mustChangePassword ? 'password' : needsConsent ? 'consent' : 'passkey'
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle password change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setPwdError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setPwdError('Passwords do not match');
      return;
    }

    setLoading(true);
    setPwdError('');
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update password');
      }

      if (needsConsent) {
        setStep('consent');
      } else {
        setStep('passkey');
      }
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : 'Error updating password');
    } finally {
      setLoading(false);
    }
  };

  // Handle consent submission
  const handleConsentSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_given: true }),
      });

      if (!res.ok) throw new Error('Failed to record consent');
      setStep('passkey');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
        {step === 'password' && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
              Set Permanent Password
            </h3>
            <p className="text-xs text-center text-slate-600 dark:text-slate-400 mb-6">
              You are logging in with a temporary password. Please set your new permanent password to secure your account.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {pwdError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{pwdError}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md"
              >
                {loading ? 'Updating...' : 'Save & Continue'}
              </button>
            </form>
          </div>
        )}

        {step === 'consent' && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
              Privacy & Attendance Consent
            </h3>
            <p className="text-xs text-center text-slate-600 dark:text-slate-400 mb-6">
              Before you begin, please review what information is gathered for attendance verification.
            </p>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-3 mb-6">
              <div className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <b>GPS Location:</b> Only read at the instant you tap Time In/Out to verify you are within the designated work perimeter. Background tracking is <b>never</b> performed.
                </span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <b>Device Binding:</b> An identifier of this device is registered to prevent proxy attendance (&quot;buddy punching&quot;).
                </span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <b>Biometric Privacy:</b> Your fingerprint or facial scan NEVER leaves your personal device. Only cryptographic keys are exchanged via WebAuthn standards.
                </span>
              </div>
            </div>

            <button
              onClick={handleConsentSubmit}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-md"
            >
              <span>I Understand & Agree</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'passkey' && (
          <div>
            <PasskeyEnrollment onSuccess={onCompleted} />
            <div className="text-center mt-4">
              <button
                onClick={onCompleted}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Skip for now (I will use fallback password)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

