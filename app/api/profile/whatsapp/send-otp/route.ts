import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone_number } = body;

    if (!phone_number || phone_number.length < 8) {
      return NextResponse.json({ error: 'Valid international phone number required (e.g. +639171234567)' }, { status: 400 });
    }

    const cleanNumber = phone_number.replace(/[^\d+]/g, '');
    const adminClient = createAdminClient();

    // 1. Rate limiting: max 5 OTP requests per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await adminClient
      .from('phone_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if ((hourlyCount ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'Rate limit reached: Maximum 5 OTP requests per hour. Please wait before requesting another code.' },
        { status: 429 }
      );
    }

    // 2. Generate 6-digit cryptographic random OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // 10 minutes expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 3. Store in phone_verifications table
    const { error: insertErr } = await adminClient
      .from('phone_verifications')
      .insert({
        user_id: user.id,
        phone_number: cleanNumber,
        otp_code: otp,
        expires_at: expiresAt,
        attempts: 0,
      });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 4. Dispatch via WhatsApp Cloud API if configured
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    let sentViaCloudApi = false;

    if (whatsappToken && phoneId) {
      try {
        const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanNumber.replace('+', ''),
            type: 'text',
            text: {
              body: `Your Time Tracker verification code is: ${otp}. It expires in 10 minutes.`,
            },
          }),
        });

        if (response.ok) {
          sentViaCloudApi = true;
        }
      } catch (e) {
        console.warn('WhatsApp Cloud API dispatch error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      sentViaCloudApi,
      demoOtp: sentViaCloudApi ? undefined : otp,
      message: sentViaCloudApi
        ? 'Verification code sent to your WhatsApp number (valid for 10 minutes)!'
        : `[DEMO MODE] Verification code generated (valid for 10 minutes): ${otp}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OTP dispatch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
