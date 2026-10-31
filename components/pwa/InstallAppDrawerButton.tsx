'use client';

import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Smartphone, ArrowDownToLine, Sparkles } from 'lucide-react';
import InstallModal from './InstallModal';

interface Props {
  variant?: 'drawer' | 'header' | 'card';
  className?: string;
}

export default function InstallAppDrawerButton({ variant = 'drawer', className = '' }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // 3. Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) {
      alert('Time Tracker is already installed on this device!');
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {
        setShowModal(true);
      }
    } else {
      // Fallback for iOS or browsers without native prompt
      setShowModal(true);
    }
  };

  if (isInstalled && variant === 'header') {
    return null; // Don't crowd header if already installed
  }

  return (
    <>
      {variant === 'drawer' && (
        <div className={`pt-2 ${className}`}>
          {isInstalled ? (
            <div className="w-full px-3.5 py-2.5 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-xs font-semibold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="text-left">
                <span className="block leading-tight">App Installed</span>
                <span className="text-[10px] text-emerald-500 font-normal">Active on your device</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-full group relative overflow-hidden px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs font-bold flex items-center justify-between"
              title="Download & install website to home screen / desktop"
            >
              <div className="flex items-center gap-2.5 text-left">
                <div className="p-1.5 rounded-xl bg-white/20 text-white backdrop-blur-xs">
                  <ArrowDownToLine className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                </div>
                <div>
                  <span className="block leading-tight font-extrabold tracking-tight">Download App</span>
                  <span className="text-[10px] text-blue-100 font-medium block">
                    Add to Home Screen
                  </span>
                </div>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-blue-200 opacity-80" />
            </button>
          )}
        </div>
      )}

      {variant === 'header' && (
        <button
          onClick={handleInstallClick}
          className={`px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition ${className}`}
          title="Download app on this phone or PC"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Download App</span>
          <span className="xs:hidden">App</span>
        </button>
      )}

      {variant === 'card' && (
        <div className={`p-4 rounded-3xl bg-gradient-to-br from-blue-900/30 via-slate-900 to-indigo-950/40 border border-blue-800/40 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Download Website as App
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Install to your home screen or desktop drawer for one-click access without opening the browser.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            disabled={isInstalled}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition shrink-0 ${
              isInstalled
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 cursor-default'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isInstalled ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Installed</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Install App</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Guide Modal */}
      <InstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        platform={platform}
      />
    </>
  );
}

