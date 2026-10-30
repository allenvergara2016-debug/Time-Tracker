'use client';

import { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Trash2, Smartphone, Loader2 } from 'lucide-react';
import { getOrCreateDeviceId, getDeviceName } from '@/lib/device';
import { formatPHDate } from '@/lib/ph-time';

interface PasskeyRecord {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: string;
}

interface Props {
  onUpdated?: () => void;
}

export default function PasskeyManager({ onUpdated }: Props) {
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Check WebAuthn platform support
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available) => setIsSupported(available))
        .catch(() => setIsSupported(false));
    } else {
      setIsSupported(false);
    }
  }, []);

  // Fetch current user passkeys
  const fetchPasskeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/webauthn/my-passkeys');
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasskeys();
  }, []);

  // Re-register / Register Fingerprint Passkey
  const handleRegister = async () => {
    setEnrolling(true);
    setStatus({ text: 'Initializing biometric sensor...', type: 'info' });

    try {
      const deviceId = getOrCreateDeviceId();
      const deviceName = getDeviceName();

      // 1. Get options with re_register=true so browser doesn't block existing authenticator
      const optionsRes = await fetch('/api/auth/webauthn/register-options?re_register=true');
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || 'Failed to start biometric enrollment');
      }

      const options = await optionsRes.json();

      // 2. Open native biometric prompt (Fingerprint / TouchID / FaceID / Windows Hello)
      setStatus({ text: 'Please touch your fingerprint sensor or verify Face ID on this device...', type: 'info' });
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Verify on server
      setStatus({ text: 'Securing passkey with device binding...', type: 'info' });
      const verifyRes = await fetch('/api/auth/webauthn/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationResponse: regResponse,
          device_id: deviceId,
          device_name: deviceName,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Biometric verification failed');
      }

      setStatus({
        text: 'Fingerprint / Face ID successfully registered and bound to this device!',
        type: 'success',
      });
      await fetchPasskeys();
      onUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric enrollment failed';
      // Provide user-friendly hint if user cancelled the biometric prompt
      if (msg.includes('The operation was aborted') || msg.includes('cancelled')) {
        setStatus({ text: 'Biometric prompt was cancelled. Please try again when ready.', type: 'info' });
      } else {
        setStatus({ text: msg, type: 'error' });
      }
    } finally {
      setEnrolling(false);
    }
  };

  // Reset / Clear Passkeys
  const handleResetPasskey = async () => {
    if (!confirm('Are you sure you want to remove your registered biometric passkey? You can re-register your fingerprint immediately.')) {
      return;
    }

    setEnrolling(true);
    setStatus(null);

    try {
      const res = await fetch('/api/auth/webauthn/my-passkeys', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset passkey');
      }

      setStatus({
        text: 'Existing passkeys cleared! You can now re-register your fingerprint freshly.',
        type: 'success',
      });
      await fetchPasskeys();
      onUpdated?.();
    } catch (err: unknown) {
      setStatus({ text: err instanceof Error ? err.message : 'Error resetting passkeys', type: 'error' });
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Fingerprint className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Biometric Fingerprint &amp; Passkey
              {passkeys.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Enrolled
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your fingerprint or Face ID device credential for quick attendance verification.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {passkeys.length > 0 && (
            <button
              type="button"
              onClick={handleResetPasskey}
              disabled={enrolling}
              className="px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 transition flex items-center gap-1.5"
              title="Reset biometric binding if experiencing login errors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRegister}
            disabled={enrolling || isSupported === false}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
          >
            {enrolling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning...</span>
              </>
            ) : passkeys.length > 0 ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-register Fingerprint</span>
              </>
            ) : (
              <>
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Register Fingerprint</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Device support warning */}
      {isSupported === false && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Biometric authentication is not supported or disabled on this browser. Ensure you are visiting via HTTPS or localhost and have a fingerprint/TouchID sensor enabled on your device.
          </span>
        </div>
      )}

      {/* Status message */}
      {status && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150 ${
            status.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
              : status.type === 'info'
              ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : status.type === 'info' ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* Enrolled credentials list */}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400">Loading biometric credentials...</div>
      ) : passkeys.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Registered Authenticator Devices:
          </span>
          {passkeys.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <h5 className="font-semibold text-slate-900 dark:text-white">
                    {p.device_name || 'Biometric Passkey'}
                  </h5>
                  <p className="text-[10px] text-slate-400">
                    Enrolled: {formatPHDate(p.created_at)}
                  </p>
                </div>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Bound
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          No fingerprint passkey registered yet. Tap <b>Register Fingerprint</b> above to bind your phone or laptop.
        </div>
      )}
    </div>
  );
}

