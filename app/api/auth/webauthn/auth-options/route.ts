import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWebAuthnConfig } from '@/lib/webauthn';

export async function GET(req: NextRequest) {
  try {
    const { rpID } = getWebAuthnConfig(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch user passkey credentials
    const { data: passkeys, error } = await adminClient
      .from('passkey_credentials')
      .select('credential_id, transports')
      .eq('employee_id', user.id);

    if (error || !passkeys || passkeys.length === 0) {
      return NextResponse.json(
        { error: 'No fingerprint passkey registered for this account. Please register first.' },
        { status: 404 }
      );
    }

    const allowCredentials = passkeys.map((p) => ({
      id: p.credential_id,
      transports: (p.transports as AuthenticatorTransport[]) || ['internal'],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'required',
    });

    // Store challenge
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await adminClient
      .from('webauthn_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'authentication');

    await adminClient.from('webauthn_challenges').insert({
      user_id: user.id,
      challenge: options.challenge,
      type: 'authentication',
      expires_at: expiresAt,
    });

    return NextResponse.json(options);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate auth options';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

