'use client';

import Link from 'next/link';
import { ShieldCheck, MapPin, Smartphone, Fingerprint, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AppLogo size="sm" />
          <span className="text-sm font-bold text-white tracking-wide">Privacy Notice &amp; Data Protection</span>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
            <ShieldCheck className="w-4 h-4" /> Transparent Data Protection Policy
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Employee Attendance &amp; Privacy Notice
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            This platform is engineered with privacy-by-design principles. We clearly outline what information is gathered, how it is verified, and why biometric data never leaves your personal phone.
          </p>
        </div>

        {/* Section 1: What We Collect */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Information Collected Strictly at Attendance Events
          </h2>

          <div className="space-y-4 text-xs text-slate-300">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>1. Point-in-Time GPS Location</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-6">
                Coordinates and horizontal accuracy are retrieved <b>only at the moment you tap</b> Time In, Time Out, Break Start, or Break End to verify you are inside the assigned workplace geofence radius. Background or 24/7 location tracking is <b>never</b> conducted or requested.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <span>2. Biometric Privacy (FIDO2 / WebAuthn)</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-6">
                Your fingerprint, Touch ID, Face ID, or screen lock PIN <b>never leaves your device hardware enclave</b>. The application only receives a cryptographically signed passkey assertion. No raw biometric images or templates are ever sent to or stored on company servers.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <span>3. Device Binding</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-6">
                A unique cryptographic device token is paired with your passkey credential upon enrollment. This ensures attendance cannot be punched from unauthorized external devices or shared credentials (&quot;buddy punching&quot;).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>4. Timestamps &amp; Timezone Normalization</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-6">
                All attendance actions use the authoritative <b>server clock</b> and are stored in UTC (timestamptz). Times are converted to the company timezone for DTR reports and daily wage computation.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Data Retention & Audit Rights */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3">
          <h2 className="text-base font-bold text-white">Data Retention &amp; Audit Trail</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Attendance logs and DTR records are preserved in accordance with company data retention policy (default 3 years) to guarantee wage history accuracy and dispute resolution. Inactive accounts are safely deactivated/archived rather than erased to preserve complete payroll audit integrity.
          </p>
        </section>

        <div className="text-center pt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Attendance Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
