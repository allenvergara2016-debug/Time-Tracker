import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// In-memory OTP storage for demonstration / dev
// Map: employeeId -> { otp: string, phoneNumber: string, expiresAt: number }
declare global {
  // eslint-disable-next-line no-var
  var __whatsapp_otps: Map<string, { otp: string; phoneNumber: string; expiresAt: number }> | undefined;
}

if (!global.__whatsapp_otps) {
  global.__whatsapp_otps = new Map();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone_number } = body;

    if (!phone_number || phone_number.length < 8) {
      return NextResponse.json({ error: 'Valid international phone number required (e.g. +1234567890)' }, { status: 400 });
    }

    // Clean number: ensure starts with + or digits only
    const cleanNumber = phone_number.replace(/[^\d+]/g, '');

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    global.__whatsapp_otps?.set(user.id, {
      otp,
      phoneNumber: cleanNumber,
      expiresAt,
    });

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
              body: `Your Time Tracker verification code is: ${otp}. It expires in 5 minutes.`,
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
      // If no live cloud API token is connected in dev mode, we return the demo OTP so user can test seamlessly
      demoOtp: sentViaCloudApi ? undefined : otp,
      message: sentViaCloudApi
        ? 'Verification code sent to your WhatsApp number!'
        : `[DEV/TEST MODE] Verification code generated: ${otp}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OTP dispatch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

