'use client';

import React from 'react';
import { X, Smartphone, Share, PlusSquare, Monitor, CheckCircle2, Download, ExternalLink } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  platform: 'ios' | 'android' | 'desktop';
}

export default function InstallModal({ isOpen, onClose, platform }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-5 text-slate-900 dark:text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Logo */}
        <div className="flex items-center gap-3 pr-8">
          <AppLogo size="md" />
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
              Download Time Tracker
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Install to your home screen or desktop for 1-tap instant access
            </p>
          </div>
        </div>

        {/* Benefits Pills */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Opens like native app</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Faster biometric taps</span>
          </div>
        </div>

        {/* Platform Specific Steps */}
        <div className="space-y-3 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {platform === 'ios' ? 'iPhone / iPad Instructions' : platform === 'android' ? 'Android Instructions' : 'Desktop Instructions'}
          </span>

          {platform === 'ios' && (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Tap the Share button</span>
                  <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    At the bottom of Safari, tap the <Share className="w-3.5 h-3.5 inline text-blue-500" /> Share icon.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Select &quot;Add to Home Screen&quot;</span>
                  <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline text-blue-500" /> <b>Add to Home Screen</b>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  3
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Tap &quot;Add&quot;</span>
                  <p className="text-slate-500 dark:text-slate-400">
                    Tap <b>Add</b> in the top right corner. The app icon will appear directly on your home screen!
                  </p>
                </div>
              </div>
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Tap the Browser Menu (⋮)</span>
                  <p className="text-slate-500 dark:text-slate-400">
                    Tap the 3 dots in the top-right corner of Chrome.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Select &quot;Install app&quot; or &quot;Add to Home screen&quot;</span>
                  <p className="text-slate-500 dark:text-slate-400">
                    Tap <b>Install app</b> or <b>Add to Home Screen</b> from the menu.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  3
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Confirm &quot;Install&quot;</span>
                  <p className="text-slate-500 dark:text-slate-400">
                    Confirm by tapping <b>Install</b>. The Time Tracker icon will be placed on your phone drawer!
                  </p>
                </div>
              </div>
            </div>
          )}

          {platform === 'desktop' && (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Look at the Address Bar</span>
                  <p className="text-slate-500 dark:text-slate-400">
                    In Chrome or Edge, click the <b>Install App icon (<Download className="w-3 h-3 inline text-purple-600" />)</b> on the right side of the address bar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Click &quot;Install&quot;</span>
                  <p className="text-slate-500 dark:text-slate-400">
                    A desktop shortcut will be added and the website opens in its own clean window.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

