import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    return NextResponse.json({ settings });
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
    } = body;

    const adminClient = createAdminClient();

    const { data: updated, error } = await adminClient
      .from('app_settings')
      .upsert({
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
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE_APP_SETTINGS',
      details: body,
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Settings update error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

