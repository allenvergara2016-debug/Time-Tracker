'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Mail, Bell, ExternalLink, CheckCircle2, AlertCircle, Loader2, Link2, Unlink, Globe } from 'lucide-react';
import { Profile, NotificationPreference } from '@/types/database.types';
import PasskeyManager from '@/components/auth/PasskeyManager';

interface Props {
  profile: Profile;
  preferences: NotificationPreference | null;
  onProfileUpdated: () => void;
}

export default function ConnectedAccounts({ profile, preferences, onProfileUpdated }: Props) {
  const supabase = createClient();

  const [whatsappNumber, setWhatsappNumber] = useState(profile.whatsapp_number || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Social account states
  const [googleEmail, setGoogleEmail] = useState(profile.google_email || '');
  const [showGoogleInput, setShowGoogleInput] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);

  // Sync state if profile prop updates
  useEffect(() => {
    if (profile.google_email) setGoogleEmail(profile.google_email);
    if (profile.whatsapp_number) setWhatsappNumber(profile.whatsapp_number);
  }, [profile]);

  // Check URL on load for OAuth return
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('linked=')) {
      const handleOAuthReturn = async () => {
        try {
          const res = await fetch('/api/profile/social-links', { method: 'POST' });
          if (res.ok) {
            setMessage({ text: 'Google identity successfully connected and synced!', type: 'success' });
            onProfileUpdated();
          }
        } catch {
          // ignore
        } finally {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      handleOAuthReturn();
    }
  }, [onProfileUpdated]);

  // Save or update Google Gmail account
  const handleSaveGoogle = async (clearValue = false) => {
    setSavingSocial(true);
    setMessage(null);
    try {
      const payload = {
        google_email: clearValue ? null : googleEmail.trim(),
      };

      const res = await fetch('/api/profile/social-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to update Google link', type: 'error' });
      } else {
        setMessage({
          text: clearValue
            ? 'Google / Gmail account unlinked.'
            : 'Google / Gmail account successfully linked!',
          type: 'success',
        });
        setShowGoogleInput(false);
        onProfileUpdated();
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Error updating link', type: 'error' });
    } finally {
      setSavingSocial(false);
    }
  };

  // Notification toggles
  const [prefs, setPrefs] = useState<Partial<NotificationPreference>>(
    preferences || {
      email_time_in_reminder: true,
      email_late_alert: true,
      email_request_updates: true,
      whatsapp_time_in_reminder: false,
      whatsapp_late_alert: false,
      whatsapp_request_updates: false,
      push_time_in_reminder: true,
      push_late_alert: true,
      push_request_updates: true,
    }
  );

  // Link OAuth provider (Google)
  const handleLinkGoogle = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard?linked=google`,
        },
      });

      if (error) {
        const errMsg = error.message || '';
        if (errMsg.toLowerCase().includes('manual linking')) {
          setMessage({
            text: 'Manual account linking is currently disabled in your authentication provider settings. Please ensure "Allow Manual Linking" is enabled under Authentication Providers.',
            type: 'error',
          });
        } else {
          setMessage({ text: error.message, type: 'error' });
        }
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Google OAuth link failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp OTP Send
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappNumber) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/whatsapp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: whatsappNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to dispatch verification code', type: 'error' });
      } else {
        setOtpSent(true);
        if (data.demoOtp) {
          setDemoOtp(data.demoOtp);
          setOtp(data.demoOtp); // Autofill for convenience in dev mode
        }
        setMessage({ text: data.message, type: 'success' });
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Error sending OTP', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp OTP Verify
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    try {
      const res = await fetch('/api/profile/whatsapp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'Verification failed', type: 'error' });
      } else {
        setMessage({ text: 'WhatsApp linked and verified!', type: 'success' });
        setOtpSent(false);
        setDemoOtp(null);
        onProfileUpdated();
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Verification error', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Save Notification Preferences
  const handleUpdatePreference = async (key: keyof NotificationPreference, val: boolean) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);

    try {
      await fetch('/api/profile/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Biometric Passkey / Fingerprint Re-registration for All Users */}
      <PasskeyManager onUpdated={onProfileUpdated} />

      {/* 1. Connected Google Account (Gmail) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Google Account Integration
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Connect your Google account / Gmail so administrators can view your linked email in the directory and you can sign in quickly.
          </p>
        </div>

        {/* GOOGLE / GMAIL CARD */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Google Account</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Gmail integration &amp; 1-click login</p>
              </div>
            </div>

            {profile.google_email ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Linked
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                Not Linked
              </span>
            )}
          </div>

          {profile.google_email ? (
            <div className="bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="truncate mr-2">
                <span className="text-[10px] text-slate-400 uppercase font-medium block">Linked Google Account</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">
                  {profile.google_email}
                </span>
              </div>
              <button
                onClick={() => handleSaveGoogle(true)}
                disabled={savingSocial}
                className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleLinkGoogle}
                disabled={loading}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Link Google Account via OAuth</span>
              </button>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Clicking above will open Google&apos;s secure sign-in page to cryptographically verify ownership. Manual typing of unauthorized email addresses is prohibited for fraud prevention.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. WhatsApp Number & Verification */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            WhatsApp Integration
          </h3>
          {profile.whatsapp_verified && (
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Receive shift reminders, late arrival warnings, and leave approvals directly on WhatsApp.
        </p>

        {profile.whatsapp_verified && profile.whatsapp_number ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Linked WhatsApp:</span>
              <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">{profile.whatsapp_number}</p>
            </div>
            <a
              href={`https://wa.me/${profile.whatsapp_number.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <span>Test Chat</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Enter WhatsApp Number (with country code)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+1 555 123 4567"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Send WhatsApp OTP</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                {demoOtp && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                    Dev Test Code: <b>{demoOtp}</b>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Enter 6-digit WhatsApp Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="py-2 px-3 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Change Number
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-sm"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Verify</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* 3. Notification Preferences */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          Notification Channels & Reminders
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Select which channels you want to receive time tracking alerts and updates on.
        </p>

        <div className="space-y-4">
          {/* Email row */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Email Notifications</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Shift reminders and approval summaries</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.email_time_in_reminder ?? true}
              onChange={(e) => handleUpdatePreference('email_time_in_reminder', e.target.checked)}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
            />
          </div>

          {/* WhatsApp row */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">WhatsApp Alerts</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profile.whatsapp_verified ? 'Instant messages via WhatsApp' : 'Requires WhatsApp verification above'}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!profile.whatsapp_verified}
              checked={Boolean(profile.whatsapp_verified && prefs.whatsapp_time_in_reminder)}
              onChange={(e) => handleUpdatePreference('whatsapp_time_in_reminder', e.target.checked)}
              className="w-5 h-5 accent-emerald-600 rounded cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Push Notifications row */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-600" />
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Browser / Mobile Push</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">On-device PWA notification badges</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.push_time_in_reminder ?? true}
              onChange={(e) => handleUpdatePreference('push_time_in_reminder', e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

