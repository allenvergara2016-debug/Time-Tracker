import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { bufferToBase64Url, getWebAuthnConfig } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  try {
    const { rpID, origin } = getWebAuthnConfig(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { registrationResponse, device_id, device_name } = body;

    if (!registrationResponse || !device_id) {
      return NextResponse.json({ error: 'Missing registration response or device binding' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Retrieve active registration challenge
    const { data: challengeRecord, error: chError } = await adminClient
      .from('webauthn_challenges')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'registration')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (chError || !challengeRecord) {
      return NextResponse.json({ error: 'No active registration challenge found or challenge expired.' }, { status: 400 });
    }

    if (new Date(challengeRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Biometric verification failed.' }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const publicKeyBase64 = bufferToBase64Url(credential.publicKey);

    // Save credential in passkey_credentials
    const { error: insertError } = await adminClient
      .from('passkey_credentials')
      .upsert({
        employee_id: user.id,
        credential_id: credential.id,
        public_key: publicKeyBase64,
        counter: credential.counter,
        device_id,
        device_name: device_name || 'Mobile Authenticator',
        transports: credential.transports || ['internal'],
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Also bind device_id to profile if not yet set
    await adminClient
      .from('profiles')
      .update({
        device_id,
        device_name: device_name || 'Mobile Authenticator',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Delete used challenge
    await adminClient
      .from('webauthn_challenges')
      .delete()
      .eq('id', challengeRecord.id);

    return NextResponse.json({
      verified: true,
      credentialId: credential.id,
      message: 'Fingerprint passkey registered and bound to this device successfully!',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration verification error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

