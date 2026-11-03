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

    if (!otp) return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });

    const adminClient = createAdminClient();

    // 1. Fetch latest pending verification for this user
    const { data: record, error: fetchErr } = await adminClient
      .from('phone_verifications')
      .select('*')
      .eq('user_id', user.id)
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !record) {
      return NextResponse.json({ error: 'No active verification code found. Please request a new code.' }, { status: 400 });
    }

    // 2. Check expiration (10 minutes)
    if (new Date() > new Date(record.expires_at)) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // 3. Check maximum attempt limit (max 5 tries per code)
    if ((record.attempts || 0) >= 5) {
      return NextResponse.json({ error: 'Maximum code attempts exceeded. Please request a new verification code.' }, { status: 400 });
    }

    // 4. Verify code
    if (record.otp_code.trim() !== otp.trim()) {
      await adminClient
        .from('phone_verifications')
        .update({ attempts: (record.attempts || 0) + 1 })
        .eq('id', record.id);

      return NextResponse.json({ error: 'Incorrect verification code. Please check and try again.' }, { status: 400 });
    }

    // 5. Code is valid! Mark verified in database
    await adminClient
      .from('phone_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', record.id);

    // Update user profile
    const { data: updatedProfile, error: upErr } = await adminClient
      .from('profiles')
      .update({
        whatsapp_number: record.phone_number,
        whatsapp_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

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
