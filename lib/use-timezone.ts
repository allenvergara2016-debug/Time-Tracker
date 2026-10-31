'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_TIMEZONE, getTimezoneLabel } from '@/lib/ph-time';
import { createClient } from '@/lib/supabase/client';

export function useCompanyTimezone() {
  const [timezone, setTimezone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('company_timezone') || DEFAULT_TIMEZONE;
    }
    return DEFAULT_TIMEZONE;
  });

  const fetchTimezone = async () => {
    try {
      const res = await fetch('/api/settings/timezone');
      if (res.ok) {
        const data = await res.json();
        if (data.timezone && data.timezone !== timezone) {
          setTimezone(data.timezone);
          if (typeof window !== 'undefined') {
            localStorage.setItem('company_timezone', data.timezone);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTimezone();

    // Listen for local updates triggered by admin in the same window
    const handleLocalChange = (e: Event) => {
      const custom = e as CustomEvent<{ timezone: string }>;
      if (custom.detail?.timezone) {
        setTimezone(custom.detail.timezone);
      } else {
        fetchTimezone();
      }
    };
    window.addEventListener('company-timezone-changed', handleLocalChange);

    // Supabase Realtime subscription with unique channel name to avoid StrictMode / multi-instance conflicts
    const supabase = createClient();
    const channelId = `company-tz-sync-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        () => fetchTimezone()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          if (payload.new && (payload.new as any).action === 'UPDATE_TIMEZONE') {
            fetchTimezone();
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('company-timezone-changed', handleLocalChange);
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    timezone,
    timezoneLabel: getTimezoneLabel(timezone),
  };
}

