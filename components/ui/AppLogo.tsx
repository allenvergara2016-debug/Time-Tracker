import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'blue' | 'dark' | 'mono';
  showText?: boolean;
}

export default function AppLogo({
  className = '',
  size = 'md',
  variant = 'blue',
  showText = false,
}: AppLogoProps) {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const bgGradient =
    variant === 'dark'
      ? 'from-slate-900 via-slate-950 to-black border border-slate-800'
      : variant === 'mono'
      ? 'from-black to-zinc-900 border border-zinc-800'
      : 'from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Minimal Icon Glyph */}
      <div
        className={`${currentSize} rounded-2xl bg-gradient-to-br ${bgGradient} flex items-center justify-center p-2 shrink-0 select-none transition-transform hover:scale-105`}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Dial Background Ring */}
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="currentColor"
            className={variant === 'dark' ? 'text-slate-700' : 'text-white/30'}
            strokeWidth="6"
          />

          {/* Active 270-degree Clock Sweep Arc */}
          <path
            d="M 50 12 A 38 38 0 1 1 12 50"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Minimal Clock Hands */}
          <circle cx="50" cy="50" r="4.5" fill="white" />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="26"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="50"
            y1="50"
            x2="72"
            y2="50"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Geofence Pulse Dot */}
          <circle cx="76" cy="24" r="5" fill="#38bdf8" />
        </svg>
      </div>

      {/* Optional Brand Text */}
      {showText && (
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Time Tracker
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            Biometrics &amp; Attendance
          </p>
        </div>
      )}
    </div>
  );
}

