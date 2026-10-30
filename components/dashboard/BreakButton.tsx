'use client';

import { useState } from 'react';
import { Coffee, Play, Square, Loader2 } from 'lucide-react';
import { BreakRecord } from '@/types/database.types';

interface Props {
  activeBreak: BreakRecord | null;
  attendanceId: string | null;
  onBreakUpdated: () => void;
}

export default function BreakButton({ activeBreak, attendanceId, onBreakUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isOnBreak = Boolean(activeBreak && !activeBreak.break_end);

  const handleToggleBreak = async () => {
    if (loading || !attendanceId) return;
    setLoading(true);
    setMsg(null);

    try {
      const action = isOnBreak ? 'break_out' : 'break_in';
      const res = await fetch('/api/attendance/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          attendance_id: attendanceId,
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

  if (!attendanceId) return null;

  return (
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
              : 'Tap to log break start/end'}
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
  );
}
