'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_TIMEZONE, getTimezoneLabel } from '@/lib/ph-time';

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

    // 1. Listen for local updates triggered by admin in the same window
    const handleLocalChange = (e: Event) => {
      const custom = e as CustomEvent<{ timezone: string }>;
      if (custom.detail?.timezone) {
        setTimezone(custom.detail.timezone);
      } else {
        fetchTimezone();
      }
    };
    window.addEventListener('company-timezone-changed', handleLocalChange);

    // 2. Listen for cross-tab updates via localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'company_timezone' && e.newValue) {
        setTimezone(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Re-verify on window focus
    const handleFocus = () => {
      fetchTimezone();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('company-timezone-changed', handleLocalChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return {
    timezone,
    timezoneLabel: getTimezoneLabel(timezone),
  };
}
