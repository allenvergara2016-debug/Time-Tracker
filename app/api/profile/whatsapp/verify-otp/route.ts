import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { otp } = body;

    const stored = global.__whatsapp_otps?.get(user.id);

    if (!stored) {
      return NextResponse.json({ error: 'No verification code requested or session expired. Request a new code.' }, { status: 400 });
    }

    if (Date.now() > stored.expiresAt) {
      global.__whatsapp_otps?.delete(user.id);
      return NextResponse.json({ error: 'Verification code expired. Please request a new one.' }, { status: 400 });
    }

    if (stored.otp !== otp?.trim()) {
      return NextResponse.json({ error: 'Incorrect verification code. Please check and try again.' }, { status: 400 });
    }

    // Success! Update employee profile
    const adminClient = createAdminClient();
    const { data: updatedProfile, error: upErr } = await adminClient
      .from('profiles')
      .update({
        whatsapp_number: stored.phoneNumber,
        whatsapp_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    global.__whatsapp_otps?.delete(user.id);

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: 'WhatsApp number verified and linked successfully!',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OTP verification error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

