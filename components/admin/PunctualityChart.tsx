'use client';

import React, { useState } from 'react';
import { PieChart, BarChart3, Clock, CheckCircle2, AlertTriangle, Users, Calendar, ArrowUpRight } from 'lucide-react';
import { AttendanceLog } from '@/types/database.types';

interface PunctualityChartProps {
  counts: {
    totalEmployees: number;
    present: number;
    late: number;
    timedOut: number;
    absent: number;
    onLeave: number;
    flagged: number;
  };
  attendanceLogs?: AttendanceLog[];
  onDrilldown?: (status: 'present' | 'late' | 'absent' | 'onLeave') => void;
}

export default function PunctualityChart({
  counts,
  attendanceLogs = [],
  onDrilldown,
}: PunctualityChartProps) {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const { present, late, absent, onLeave } = counts;
  const totalReported = present + late + absent + onLeave;
  const activeTaps = present + late;

  // Rates
  const onTimeRate = activeTaps > 0 ? Math.round((present / activeTaps) * 100) : 0;
  const tardyRate = activeTaps > 0 ? Math.round((late / activeTaps) * 100) : 0;

  // Average late minutes
  const lateLogs = attendanceLogs.filter((l) => l.status === 'late' || (l.late_minutes && l.late_minutes > 0));
  const totalLateMinutes = lateLogs.reduce((acc, l) => acc + (l.late_minutes || 0), 0);
  const avgLateMins = lateLogs.length > 0 ? Math.round(totalLateMinutes / lateLogs.length) : 0;

  // Tardiness severity breakdown
  const late1to15 = lateLogs.filter((l) => (l.late_minutes || 0) > 0 && (l.late_minutes || 0) <= 15).length;
  const late16to30 = lateLogs.filter((l) => (l.late_minutes || 0) > 15 && (l.late_minutes || 0) <= 30).length;
  const late31to60 = lateLogs.filter((l) => (l.late_minutes || 0) > 30 && (l.late_minutes || 0) <= 60).length;
  const lateAbove60 = lateLogs.filter((l) => (l.late_minutes || 0) > 60).length;

  // Chart data segments
  const segments = [
    {
      id: 'present',
      label: 'On-Time',
      count: present,
      color: '#10B981', // emerald-500
      bgClass: 'bg-emerald-500',
      textClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/30',
      desc: 'Clocked in within grace period',
    },
    {
      id: 'late',
      label: 'Late / Tardy',
      count: late,
      color: '#F59E0B', // amber-500
      bgClass: 'bg-amber-500',
      textClass: 'text-amber-400',
      borderClass: 'border-amber-500/30',
      desc: 'Exceeded shift grace period',
    },
    {
      id: 'absent',
      label: 'Absent',
      count: absent,
      color: '#F43F5E', // rose-500
      bgClass: 'bg-rose-500',
      textClass: 'text-rose-400',
      borderClass: 'border-rose-500/30',
      desc: 'No attendance recorded',
    },
    {
      id: 'onLeave',
      label: 'On Leave',
      count: onLeave,
      color: '#A855F7', // purple-500
      bgClass: 'bg-purple-500',
      textClass: 'text-purple-400',
      borderClass: 'border-purple-500/30',
      desc: 'Approved leave scheduled',
    },
  ];

  // Helper for SVG Pie/Donut arc
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    innerRadius: number = 0
  ) => {
    // If arc is full circle (360 deg)
    if (endAngle - startAngle >= 359.99) {
      endAngle = 359.99;
    }

    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    if (innerRadius > 0) {
      const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
      const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);
      return [
        'M', start.x, start.y,
        'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        'L', innerEnd.x, innerEnd.y,
        'A', innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
        'Z',
      ].join(' ');
    }

    return [
      'M', x, y,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'Z',
    ].join(' ');
  };

  // Compute angles for pie/donut
  let currentAngle = 0;
  const validTotal = totalReported > 0 ? totalReported : 1;
  const pieSegments = segments.map((seg) => {
    const sliceAngle = (seg.count / validTotal) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle += sliceAngle;
    const percentage = totalReported > 0 ? Math.round((seg.count / totalReported) * 100) : 0;
    return {
      ...seg,
      startAngle,
      endAngle,
      percentage,
      path: totalReported > 0 && seg.count > 0 ? describeArc(100, 100, 85, startAngle, endAngle, 52) : '',
    };
  });

  const maxBarCount = Math.max(...segments.map((s) => s.count), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
      {/* Header with Title & Chart Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-base text-white">Attendance &amp; Punctuality Analytics</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual breakdown of on-time arrivals, employee tardiness, and attendance status.
          </p>
        </div>

        {/* View Switcher: Pie vs Bar */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartType('pie')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              chartType === 'pie'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Pie Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              chartType === 'bar'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Bar Chart</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Punctuality Rate</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-400">{onTimeRate}%</span>
            <span className="text-[10px] text-slate-500 font-medium">of check-ins</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${onTimeRate}%` }} />
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Tardiness Rate</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-400">{tardyRate}%</span>
            <span className="text-[10px] text-slate-500 font-medium">{late} late</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${tardyRate}%` }} />
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Avg. Late Duration</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-amber-300">{avgLateMins}</span>
            <span className="text-xs text-slate-400 font-medium">mins</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-2 truncate">
            {lateLogs.length > 0 ? `${totalLateMinutes} total mins lost` : 'No tardiness today'}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Attendance</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-blue-400">{activeTaps}</span>
            <span className="text-[11px] text-slate-500 font-medium">/ {counts.totalEmployees} employees</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-2 truncate">
            {counts.timedOut} timed out
          </span>
        </div>
      </div>

      {/* Main Chart Body */}
      {totalReported === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800/60">
          No attendance or roster records found for the selected date.
        </div>
      ) : chartType === 'pie' ? (
        /* DONUT / PIE CHART VIEW */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-950/50 p-6 rounded-2xl border border-slate-800/80">
          {/* SVG Donut */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56">
              <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                {/* Background base track */}
                <circle
                  cx="100"
                  cy="100"
                  r="68.5"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="33"
                />
                {pieSegments.map((seg) => {
                  if (seg.count === 0 || !seg.path) return null;
                  const isHovered = hoveredSegment === seg.id;
                  return (
                    <path
                      key={seg.id}
                      d={seg.path}
                      fill={seg.color}
                      className="transition-all duration-300 cursor-pointer"
                      style={{
                        opacity: hoveredSegment ? (isHovered ? 1 : 0.4) : 0.95,
                        filter: isHovered ? `drop-shadow(0 0 8px ${seg.color})` : 'none',
                        transformOrigin: '100px 100px',
                        transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                      }}
                      onMouseEnter={() => setHoveredSegment(seg.id)}
                      onMouseLeave={() => setHoveredSegment(null)}
                      onClick={() => onDrilldown && onDrilldown(seg.id as any)}
                    />
                  );
                })}
              </svg>

              {/* Donut Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-3xl font-black text-white tracking-tight">
                  {onTimeRate}%
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  On-Time
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {present} of {activeTaps || totalReported}
                </span>
              </div>
            </div>

            <span className="text-[11px] text-slate-500 mt-2 text-center">
              Hover over a slice to highlight • Click to view employee list
            </span>
          </div>

          {/* Interactive Legend & Breakdown */}
          <div className="md:col-span-7 space-y-2.5">
            <span className="text-xs font-bold text-slate-300 block mb-2">
              Status Breakdown ({totalReported} total accounts)
            </span>

            {pieSegments.map((seg) => {
              const isHovered = hoveredSegment === seg.id;
              return (
                <div
                  key={seg.id}
                  onMouseEnter={() => setHoveredSegment(seg.id)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() => onDrilldown && onDrilldown(seg.id as any)}
                  className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                    isHovered
                      ? 'bg-slate-800/80 border-slate-700 shadow-md translate-x-1'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: seg.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{seg.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({seg.desc})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-white block">
                        {seg.count}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        {seg.percentage}%
                      </span>
                    </div>
                    {onDrilldown && (
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* BAR CHART VIEW */
        <div className="space-y-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/80">
          {/* Main Comparative Horizontal Bars */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Distribution Overview</span>
              <span className="text-slate-500 text-[11px]">Scaled by employee count</span>
            </div>

            {segments.map((seg) => {
              const pct = totalReported > 0 ? Math.round((seg.count / totalReported) * 100) : 0;
              const barWidthPct = maxBarCount > 0 ? Math.max(4, Math.round((seg.count / maxBarCount) * 100)) : 0;
              return (
                <div
                  key={seg.id}
                  onClick={() => onDrilldown && onDrilldown(seg.id as any)}
                  className="group cursor-pointer p-2 rounded-xl hover:bg-slate-900/60 transition"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-semibold text-white group-hover:text-blue-400 transition">
                        {seg.label}
                      </span>
                      <span className="text-[10px] text-slate-500">({seg.desc})</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-white">{seg.count}</span>
                      <span className="text-slate-500 text-[11px]">({pct}%)</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                      style={{
                        width: `${barWidthPct}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Secondary Breakdown: Tardiness Duration Severity (if any late logs exist) */}
          {lateLogs.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Tardiness Severity Range ({lateLogs.length} late employees)
                </span>
                <span className="text-[11px] text-slate-500">Minutes past shift start</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-medium">1 - 15 mins</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-bold text-amber-300">{late1to15}</span>
                    <span className="text-[10px] text-slate-500">Minor</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-medium">16 - 30 mins</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-bold text-amber-400">{late16to30}</span>
                    <span className="text-[10px] text-slate-500">Moderate</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-medium">31 - 60 mins</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-bold text-orange-400">{late31to60}</span>
                    <span className="text-[10px] text-slate-500">Significant</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-medium">&gt; 60 mins</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-bold text-rose-400">{lateAbove60}</span>
                    <span className="text-[10px] text-rose-500 font-semibold">Severe</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

