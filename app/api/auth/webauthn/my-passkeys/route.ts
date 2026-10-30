import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/auth/webauthn/my-passkeys
 * Returns the current authenticated user's registered passkeys
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: passkeys, error } = await adminClient
      .from('passkey_credentials')
      .select('id, credential_id, device_name, created_at')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      passkeys: passkeys || [],
      count: passkeys?.length || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/webauthn/my-passkeys
 * Clears the current user's registered passkeys so they can re-register their fingerprint freshly
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();

    // 1. Delete passkey credentials
    const { error: delErr } = await adminClient
      .from('passkey_credentials')
      .delete()
      .eq('employee_id', user.id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    // 2. Also clear any device locking on profile to permit fresh pairing
    await adminClient
      .from('profiles')
      .update({
        device_id: null,
        device_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // 3. Log audit event
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'USER_SELF_RESET_PASSKEY',
      target_type: 'passkey_credentials',
      target_id: user.id,
      details: { reason: 'User requested passkey re-registration' },
    });

    return NextResponse.json({
      success: true,
      message: 'Fingerprint / passkey credentials cleared successfully. You can now re-register!',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

