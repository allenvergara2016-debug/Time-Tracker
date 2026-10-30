'use client';

import { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, CheckCircle2, AlertTriangle, ShieldCheck, Smartphone, Loader2 } from 'lucide-react';
import { getOrCreateDeviceId, getDeviceName } from '@/lib/device';

interface Props {
  onSuccess?: () => void;
}

export default function PasskeyEnrollment({ onSuccess }: Props) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    // Check WebAuthn platform authenticator support
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available) => setIsSupported(available))
        .catch(() => setIsSupported(false));
    } else {
      setIsSupported(false);
    }
  }, []);

  const handleRegisterPasskey = async () => {
    setLoading(true);
    setStatus({ text: 'Initializing biometric authenticator...', type: 'info' });

    try {
      const deviceId = getOrCreateDeviceId();
      const deviceName = getDeviceName();

      // 1. Get options from server
      const optionsRes = await fetch('/api/auth/webauthn/register-options');
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || 'Failed to initialize biometric enrollment');
      }

      const options = await optionsRes.json();

      // 2. Browser platform prompt (Touch ID, Face ID, Android Fingerprint, Windows Hello)
      setStatus({ text: 'Please touch your fingerprint sensor or verify Face ID...', type: 'info' });
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Verify and save on server
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
        throw new Error(verifyData.error || 'Verification failed');
      }

      setEnrolled(true);
      setStatus({ text: 'Fingerprint passkey registered and bound to this device!', type: 'success' });
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Passkey registration error';
      setStatus({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5 mx-auto">
        <Fingerprint className="w-8 h-8" />
      </div>

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Biometric Passkey Setup
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Register your phone&apos;s fingerprint sensor or Face ID for fast, spoof-proof attendance logging.
        </p>
      </div>

      {/* Security notice */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2 mb-6">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <b>Privacy First:</b> The system NEVER receives or stores raw fingerprints. Authentication uses public-key cryptography via WebAuthn standard.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            <b>Device Binding:</b> Your passkey is strictly tied to this physical device to prevent buddy punching.
          </span>
        </div>
      </div>

      {isSupported === false && (
        <div className="p-3.5 mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Biometric authenticator (Fingerprint/Face ID) was not detected on this browser/device. If your device has no sensor, you may use fallback password verification.
          </span>
        </div>
      )}

      {status && (
        <div
          className={`p-3.5 mb-6 rounded-2xl text-xs font-medium flex items-center gap-2 ${
            status.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : status.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}
        >
          {status.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {status.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
          {status.type === 'info' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          <span>{status.text}</span>
        </div>
      )}

      {enrolled ? (
        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Passkey Active & Verified
        </div>
      ) : (
        <button
          onClick={handleRegisterPasskey}
          disabled={loading}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-98"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Fingerprint className="w-5 h-5" />
          )}
          <span>{loading ? 'Processing...' : 'Register Fingerprint / Passkey'}</span>
        </button>
      )}
    </div>
  );
}

