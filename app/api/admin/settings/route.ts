import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCompanyTimezone } from '@/lib/company-timezone';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    const activeTz = await getCompanyTimezone();

    return NextResponse.json({
      settings: {
        ...(settings || {}),
        timezone: (settings as any)?.timezone || activeTz,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Settings fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      biometric_mode,
      biometric_random_percentage,
      allow_fallback,
      gps_accuracy_threshold_meters,
      enable_random_selfie,
      selfie_random_percentage,
      allowed_login_google,
      allowed_login_facebook,
      allowed_login_whatsapp,
      timezone,
      overtime_multiplier_ordinary,
      overtime_multiplier_restday,
      overtime_multiplier_special_holiday,
      overtime_multiplier_regular_holiday,
      data_retention_years,
      show_rates_to_employees,
      hours_per_day,
      undertime_minutes_basis,
      require_overtime_approval,
      overtime_rounding_rule,
      tardiness_overtime_rule,
      enable_special_day_rates,
    } = body;

    const adminClient = createAdminClient();

    // Fetch existing settings for audit trail diff
    const { data: existingSettings } = await adminClient
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    const basePayload: Record<string, any> = {
      id: 'global',
      biometric_mode: biometric_mode ?? existingSettings?.biometric_mode ?? 'always',
      biometric_random_percentage: Number(biometric_random_percentage ?? existingSettings?.biometric_random_percentage ?? 20),
      allow_fallback: allow_fallback !== undefined ? Boolean(allow_fallback) : (existingSettings?.allow_fallback ?? true),
      gps_accuracy_threshold_meters: Number(gps_accuracy_threshold_meters ?? existingSettings?.gps_accuracy_threshold_meters ?? 50),
      enable_random_selfie: Boolean(enable_random_selfie),
      selfie_random_percentage: Number(selfie_random_percentage ?? 0),
      allowed_login_google: Boolean(allowed_login_google),
      allowed_login_facebook: Boolean(allowed_login_facebook),
      allowed_login_whatsapp: Boolean(allowed_login_whatsapp),
      overtime_multiplier_ordinary: Number(overtime_multiplier_ordinary ?? existingSettings?.overtime_multiplier_ordinary ?? 1.25),
      overtime_multiplier_restday: Number(overtime_multiplier_restday ?? existingSettings?.overtime_multiplier_restday ?? 1.30),
      overtime_multiplier_special_holiday: Number(overtime_multiplier_special_holiday ?? existingSettings?.overtime_multiplier_special_holiday ?? 1.30),
      overtime_multiplier_regular_holiday: Number(overtime_multiplier_regular_holiday ?? existingSettings?.overtime_multiplier_regular_holiday ?? 2.00),
      data_retention_years: Number(data_retention_years ?? existingSettings?.data_retention_years ?? 3),
      show_rates_to_employees: show_rates_to_employees !== undefined ? Boolean(show_rates_to_employees) : (existingSettings?.show_rates_to_employees ?? false),
      hours_per_day: Number(hours_per_day ?? existingSettings?.hours_per_day ?? 8),
      undertime_minutes_basis: undertime_minutes_basis ?? existingSettings?.undertime_minutes_basis ?? 'exact',
      require_overtime_approval: require_overtime_approval !== undefined ? Boolean(require_overtime_approval) : (existingSettings?.require_overtime_approval ?? true),
      overtime_rounding_rule: overtime_rounding_rule ?? existingSettings?.overtime_rounding_rule ?? 'exact',
      tardiness_overtime_rule: tardiness_overtime_rule ?? existingSettings?.tardiness_overtime_rule ?? 'no_offset',
      enable_special_day_rates: enable_special_day_rates !== undefined ? Boolean(enable_special_day_rates) : (existingSettings?.enable_special_day_rates ?? false),
      updated_at: new Date().toISOString(),
    };

    let updated: any = null;

    // 1. First attempt with timezone column
    if (timezone) {
      const withTz = { ...basePayload, timezone };
      const { data, error } = await adminClient
        .from('app_settings')
        .upsert(withTz)
        .select()
        .single();

      if (!error) {
        updated = data;
      }
    }

    // 2. Fallback without timezone column if schema doesn't have it yet
    if (!updated) {
      const { data, error } = await adminClient
        .from('app_settings')
        .upsert(basePayload)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      updated = data;
    }

    // 3. Always log audit log for general settings update with old and new values
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE_APP_SETTINGS',
      target_type: 'app_settings',
      target_id: 'global',
      old_value: existingSettings,
      new_value: updated,
      details: body,
    });

    // 4. Log specific UPDATE_TIMEZONE audit record for resilient fallback across all users
    if (timezone) {
      await adminClient.from('audit_logs').insert({
        actor_id: user.id,
        action: 'UPDATE_TIMEZONE',
        details: { timezone, updated_by: user.id },
      });
    }

    return NextResponse.json({
      success: true,
      settings: { ...updated, timezone: timezone || updated?.timezone || 'Asia/Manila' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Settings update error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
