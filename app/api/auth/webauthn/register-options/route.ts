import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWebAuthnConfig } from '@/lib/webauthn';

export async function GET(req: NextRequest) {
  try {
    const { rpID, rpName } = getWebAuthnConfig(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // Check if re-registering to allow overwriting / replacing existing passkey
    const { searchParams } = new URL(req.url);
    const isReRegister = searchParams.get('re_register') === 'true';

    // Fetch existing credentials to exclude ONLY if not re-registering
    let excludeCredentials: { id: string; transports: AuthenticatorTransport[] }[] = [];
    if (!isReRegister) {
      const { data: existingPasskeys } = await supabase
        .from('passkey_credentials')
        .select('credential_id')
        .eq('employee_id', user.id);

      excludeCredentials = (existingPasskeys || []).map((cred) => ({
        id: cred.credential_id,
        transports: ['internal'] as AuthenticatorTransport[],
      }));
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: profile?.email || user.email || user.id,
      userDisplayName: profile?.full_name || 'Employee',
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // phone fingerprint / FaceID / Windows Hello
        userVerification: 'required',
        residentKey: 'preferred',
      },
    });

    const adminClient = createAdminClient();

    // Store challenge in webauthn_challenges table (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await adminClient
      .from('webauthn_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'registration');

    await adminClient.from('webauthn_challenges').insert({
      user_id: user.id,
      challenge: options.challenge,
      type: 'registration',
      expires_at: expiresAt,
    });

    return NextResponse.json(options);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate registration options';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

