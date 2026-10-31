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
    } = body;

    const adminClient = createAdminClient();

    const basePayload: Record<string, any> = {
      id: 'global',
      biometric_mode,
      biometric_random_percentage: Number(biometric_random_percentage),
      allow_fallback: Boolean(allow_fallback),
      gps_accuracy_threshold_meters: Number(gps_accuracy_threshold_meters),
      enable_random_selfie: Boolean(enable_random_selfie),
      selfie_random_percentage: Number(selfie_random_percentage),
      allowed_login_google: Boolean(allowed_login_google),
      allowed_login_facebook: Boolean(allowed_login_facebook),
      allowed_login_whatsapp: Boolean(allowed_login_whatsapp),
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

    // 3. Always log audit log for general settings update
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE_APP_SETTINGS',
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
