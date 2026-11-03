import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPHDateString } from '@/lib/ph-time';
import { getCompanyTimezone } from '@/lib/company-timezone';
import { base64UrlToBuffer, getWebAuthnConfig } from '@/lib/webauthn';
import { VerificationMethod } from '@/types/database.types';

export async function POST(req: NextRequest) {
  try {
    const { rpID, origin } = getWebAuthnConfig(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, attendance_id, authResponse, fallbackPassword, device_id } = body; // action: 'break_in' | 'break_out'

    const adminClient = createAdminClient();

    // 1. Fetch user profile & app settings
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, email, role, device_id')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Check device binding if device is bound
    if (profile.device_id && device_id && profile.device_id !== device_id) {
      await adminClient.from('failed_attempts').insert({
        employee_id: user.id,
        attempt_type: action || 'break_in',
        device_id,
        reason: 'Device binding mismatch on break action.',
      });
      return NextResponse.json({ error: 'Device not recognized, contact your admin.' }, { status: 403 });
    }

    const { data: appSettings } = await adminClient
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    const biometricMode = appSettings?.biometric_mode ?? 'always';
    const allowFallback = appSettings?.allow_fallback ?? true;

    // Determine if biometric is required for breaks
    let isBiometricRequired = false;
    if (biometricMode === 'always') {
      isBiometricRequired = true;
    } else if (biometricMode === 'random') {
      const rand = Math.floor(Math.random() * 100) + 1;
      isBiometricRequired = rand <= (appSettings?.biometric_random_percentage ?? 30);
    }

    let verificationMethod: VerificationMethod = 'none';

    if (isBiometricRequired) {
      if (fallbackPassword) {
        if (!allowFallback) {
          return NextResponse.json({ error: 'Biometric fallback is disabled by administrator.' }, { status: 403 });
        }
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: fallbackPassword,
        });
        if (signInErr) {
          await adminClient.from('failed_attempts').insert({
            employee_id: user.id,
            attempt_type: action || 'break_in',
            device_id,
            reason: 'Invalid fallback password provided on break action.',
          });
          return NextResponse.json({ error: 'Invalid fallback password.' }, { status: 401 });
        }
        verificationMethod = 'fallback';
      } else if (authResponse) {
        // Retrieve challenge
        const { data: challengeRecord } = await adminClient
          .from('webauthn_challenges')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'authentication')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!challengeRecord || new Date(challengeRecord.expires_at) < new Date()) {
          return NextResponse.json({ error: 'Authentication challenge expired (60s limit). Please retry.' }, { status: 400 });
        }

        const credentialId = authResponse.id;
        const { data: credential } = await adminClient
          .from('passkey_credentials')
          .select('*')
          .eq('credential_id', credentialId)
          .eq('employee_id', user.id)
          .single();

        if (!credential) {
          await adminClient.from('failed_attempts').insert({
            employee_id: user.id,
            attempt_type: action || 'break_in',
            device_id,
            reason: 'Fingerprint credential not registered to this employee account.',
          });
          return NextResponse.json({ error: 'Fingerprint credential not recognized.' }, { status: 400 });
        }

        const verification = await verifyAuthenticationResponse({
          response: authResponse,
          expectedChallenge: challengeRecord.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: credential.credential_id,
            publicKey: base64UrlToBuffer(credential.public_key) as any,
            counter: Number(credential.counter),
          },
          requireUserVerification: true,
        });

        if (!verification.verified || !verification.authenticationInfo) {
          await adminClient.from('failed_attempts').insert({
            employee_id: user.id,
            attempt_type: action || 'break_in',
            device_id,
            reason: 'Fingerprint verification failed on break action.',
          });
          return NextResponse.json({ error: 'Biometric verification could not be validated.' }, { status: 400 });
        }

        // Update signature counter & delete challenge
        await adminClient
          .from('passkey_credentials')
          .update({ counter: verification.authenticationInfo.newCounter })
          .eq('id', credential.id);

        await adminClient.from('webauthn_challenges').delete().eq('id', challengeRecord.id);

        verificationMethod = 'biometric';
      } else {
        return NextResponse.json(
          { error: 'Biometric prompt required. Please tap the fingerprint sensor.' },
          { status: 400 }
        );
      }
    }

    const activeTz = await getCompanyTimezone();
    const serverNow = new Date();
    const today = getPHDateString(serverNow, activeTz);

    // Verify user has active attendance log today
    let targetAttendanceId = attendance_id;
    if (!targetAttendanceId) {
      const { data: activeLog } = await adminClient
        .from('attendance_logs')
        .select('id')
        .eq('employee_id', user.id)
        .eq('date', today)
        .is('time_out', null)
        .single();
      
      if (!activeLog) {
        return NextResponse.json({ error: 'Must be timed in before taking a break.' }, { status: 400 });
      }
      targetAttendanceId = activeLog.id;
    }

    if (action === 'break_in') {
      // Check if break already ongoing
      const { data: openBreak } = await adminClient
        .from('breaks')
        .select('id')
        .eq('attendance_id', targetAttendanceId)
        .is('break_end', null)
        .single();

      if (openBreak) {
        return NextResponse.json({ error: 'You are already on an active break!' }, { status: 400 });
      }

      const { data: newBreak, error: breakErr } = await adminClient
        .from('breaks')
        .insert({
          attendance_id: targetAttendanceId,
          employee_id: user.id,
          break_start: serverNow.toISOString(),
          verification_method: verificationMethod,
        })
        .select()
        .single();

      if (breakErr) return NextResponse.json({ error: breakErr.message }, { status: 500 });

      return NextResponse.json({
        success: true,
        action: 'break_in',
        break: newBreak,
        verificationMethod,
        message: 'Break started. Enjoy your rest!',
      });
    } else {
      // action === 'break_out'
      const { data: activeBreak, error: bErr } = await adminClient
        .from('breaks')
        .select('*')
        .eq('attendance_id', targetAttendanceId)
        .is('break_end', null)
        .single();

      if (bErr || !activeBreak) {
        return NextResponse.json({ error: 'No active break found to conclude.' }, { status: 400 });
      }

      const startTime = new Date(activeBreak.break_start);
      const durationMinutes = Math.max(0, Math.round((serverNow.getTime() - startTime.getTime()) / 60000));

      const { data: updatedBreak, error: upErr } = await adminClient
        .from('breaks')
        .update({
          break_end: serverNow.toISOString(),
          duration_minutes: durationMinutes,
          verification_method: verificationMethod,
        })
        .eq('id', activeBreak.id)
        .select()
        .single();

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({
        success: true,
        action: 'break_out',
        break: updatedBreak,
        durationMinutes,
        verificationMethod,
        message: `Break concluded. Total break time: ${durationMinutes} minutes.`,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Break action error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
