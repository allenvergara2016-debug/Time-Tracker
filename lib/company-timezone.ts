import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_TIMEZONE, getTimezoneLabel } from '@/lib/ph-time';

/**
 * Server-side resolver for the company-wide configured timezone.
 * Checks app_settings, with audit_logs fallback, defaulting to Asia/Manila.
 */
export async function getCompanyTimezone(): Promise<string> {
  try {
    const adminClient = createAdminClient();

    // 1. Try querying app_settings table
    const { data: settings } = await adminClient
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();

    if (settings && (settings as any).timezone) {
      return (settings as any).timezone;
    }

    // 2. Fallback: check most recent audit_logs entry for timezone update
    const { data: tzLog } = await adminClient
      .from('audit_logs')
      .select('details')
      .eq('action', 'UPDATE_TIMEZONE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tzLog?.details && typeof tzLog.details === 'object' && 'timezone' in tzLog.details) {
      const val = (tzLog.details as any).timezone;
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  } catch (err) {
    console.error('Error resolving company timezone:', err);
  }

  return DEFAULT_TIMEZONE;
}

