import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkGeofence, calculateHaversineDistance } from '@/lib/geofence';
import { getWebAuthnConfig, base64UrlToBuffer } from '@/lib/webauthn';
import { getPHDateString, parseShiftToPHDate, formatPHTime, getTimezoneOffsetString } from '@/lib/ph-time';
import { getCompanyTimezone } from '@/lib/company-timezone';
import { VerificationMethod, AttendanceStatus } from '@/types/database.types';

export async function POST(req: NextRequest) {
  try {
    const { rpID, origin } = getWebAuthnConfig(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      action, // 'time_in' | 'time_out'
      lat,
      lng,
      accuracy,
      device_id,
      authResponse, // WebAuthn authentication response
      fallbackPassword, // If user used fallback
      selfieUrl,
    } = body;

    const adminClient = createAdminClient();

    // 1. Fetch user profile and shift
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('*, shift:shifts(*)')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || !profile.is_active) {
      return NextResponse.json({ error: 'User profile not found or account is deactivated' }, { status: 403 });
    }

    // 2. Device binding check (Enforced from Passkey Enrollment)
    if (profile.device_id) {
      if (!device_id || profile.device_id !== device_id) {
        await adminClient.from('failed_attempts').insert({
          employee_id: user.id,
          attempt_type: action || 'time_in',
          lat,
          lng,
          accuracy,
          device_id,
          reason: `Device not recognized. Registered device: ${profile.device_id}, Request device: ${device_id || 'none'}.`,
        });

        return NextResponse.json(
          { error: 'Device not recognized, contact your admin.' },
          { status: 403 }
        );
      }
    }

    // 3. Fetch app settings
    const { data: appSettings } = await adminClient
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    const maxAccuracy = appSettings?.gps_accuracy_threshold_meters ?? 50.0;
    const biometricMode = appSettings?.biometric_mode ?? 'always';
    const allowFallback = appSettings?.allow_fallback ?? true;

    // 4. GPS Accuracy Check
    if (typeof accuracy !== 'number' || accuracy > maxAccuracy) {
      const reason = `GPS accuracy is too low (${Math.round(accuracy || 0)}m, required ≤ ${maxAccuracy}m). Please enable high-accuracy location or step near a window.`;
      await adminClient.from('failed_attempts').insert({
        employee_id: user.id,
        attempt_type: action || 'time_in',
        lat,
        lng,
        accuracy,
        device_id,
        reason,
      });

      return NextResponse.json({ error: reason }, { status: 400 });
    }

    // 5. Geofence Check
    // First check if employee is assigned to specific locations
    const { data: assignedRows } = await adminClient
      .from('employee_locations')
      .select('location_id')
      .eq('employee_id', user.id);

    let candidateLocations: Array<{ id: string; name: string; lat: number; lng: number; radius_meters: number }> = [];

    if (assignedRows && assignedRows.length > 0) {
      const locIds = assignedRows.map((r: { location_id: string }) => r.location_id);
      const { data: assignedLocs } = await adminClient
        .from('locations')
        .select('id, name, lat, lng, radius_meters')
        .in('id', locIds)
        .eq('is_active', true);
      candidateLocations = assignedLocs || [];
    }

    // If no specific locations assigned, use all active locations
    if (candidateLocations.length === 0) {
      const { data: allActiveLocations } = await adminClient
        .from('locations')
        .select('id, name, lat, lng, radius_meters')
        .eq('is_active', true);
      candidateLocations = allActiveLocations || [];
    }

    if (candidateLocations.length === 0) {
      return NextResponse.json({ error: 'No active office locations configured. Contact admin.' }, { status: 400 });
    }

    const geofenceResult = checkGeofence(lat, lng, candidateLocations);

    if (!geofenceResult.isInside) {
      const nearest = geofenceResult.nearestLocation;
      const distanceAway = nearest ? Math.round(nearest.distance - nearest.radius_meters) : 0;
      const nearestName = nearest?.name || 'Office';
      const reason = `You are ${distanceAway}m away from ${nearestName}. Attendance can only be recorded inside the designated perimeter.`;

      await adminClient.from('failed_attempts').insert({
        employee_id: user.id,
        attempt_type: action || 'time_in',
        lat,
        lng,
        accuracy,
        device_id,
        reason,
        distance_meters: nearest?.distance || null,
        nearest_location_name: nearestName,
      });

      return NextResponse.json({ error: reason }, { status: 400 });
    }

    const matchedLocation = geofenceResult.matchedLocation!;

    // 6. Biometric / WebAuthn Verification Check
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
        // Fallback attempted
        if (!allowFallback) {
          const reason = 'Biometric fallback is currently disabled by Admin.';
          await adminClient.from('failed_attempts').insert({
            employee_id: user.id,
            attempt_type: action || 'time_in',
            lat,
            lng,
            accuracy,
            device_id,
            reason,
          });
          return NextResponse.json({ error: reason }, { status: 403 });
        }

        // Verify user password for fallback
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: profile.email,
          password: fallbackPassword,
        });

        if (signInErr) {
          const reason = 'Invalid fallback password provided.';
          await adminClient.from('failed_attempts').insert({
            employee_id: user.id,
            attempt_type: action || 'time_in',
            lat,
            lng,
            accuracy,
            device_id,
            reason,
          });
          return NextResponse.json({ error: reason }, { status: 401 });
        }

        verificationMethod = 'fallback';
      } else if (authResponse) {
        // WebAuthn Biometric assertion verification
        const { data: challengeRecord } = await adminClient
          .from('webauthn_challenges')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'authentication')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!challengeRecord || new Date(challengeRecord.expires_at) < new Date()) {
          return NextResponse.json({ error: 'Authentication challenge expired. Please retry.' }, { status: 400 });
        }

        const credentialId = authResponse.id;
        const { data: credential } = await adminClient
          .from('passkey_credentials')
          .select('*')
          .eq('credential_id', credentialId)
          .eq('employee_id', user.id)
          .single();

        if (!credential) {
          const reason = 'Fingerprint credential not registered to this employee account.';
          await adminClient.from('failed_attempts').insert({
            employee_id: user.id,
            attempt_type: action || 'time_in',
            lat,
            lng,
            accuracy,
            device_id,
            reason,
          });
          return NextResponse.json({ error: reason }, { status: 400 });
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
          const reason = 'Fingerprint verification failed';
          await adminClient.from('failed_attempts').insert({
            employee_id: user.id,
            attempt_type: action || 'time_in',
            lat,
            lng,
            accuracy,
            device_id,
            reason,
          });
          return NextResponse.json({ error: 'Biometric verification could not be validated.' }, { status: 400 });
        }

        // Update signature counter
        await adminClient
          .from('passkey_credentials')
          .update({ counter: verification.authenticationInfo.newCounter })
          .eq('id', credential.id);

        // Delete used challenge
        await adminClient.from('webauthn_challenges').delete().eq('id', challengeRecord.id);

        verificationMethod = 'biometric';
      } else {
        return NextResponse.json(
          { error: 'Biometric prompt required. Please tap the fingerprint sensor.' },
          { status: 400 }
        );
      }
    }

    // 7. Anti-Cheat & Suspicious Entry Check
    let isFlagged = false;
    let flagReason: string | null = null;

    if (verificationMethod === 'fallback') {
      isFlagged = true;
      flagReason = 'Logged via fallback password without fingerprint passkey.';
    }

    // 8. Server Clock Time & Shift Calculation in Configured Company Timezone
    const activeTz = await getCompanyTimezone();
    const tzOffset = getTimezoneOffsetString(activeTz);
    const serverNow = new Date();
    const serverTimestamp = serverNow.toISOString();
    const today = getPHDateString(serverNow, activeTz);

    // Check last attendance log for GPS mock coordinates or impossible travel
    const { data: lastLog } = await adminClient
      .from('attendance_logs')
      .select('lat_in, lng_in, time_in')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastLog && lastLog.lat_in !== null && lastLog.lng_in !== null) {
      // Identical coordinates repeatedly (real GPS always has micro-variance)
      if (
        Math.abs(Number(lastLog.lat_in) - lat) < 0.000001 &&
        Math.abs(Number(lastLog.lng_in) - lng) < 0.000001
      ) {
        isFlagged = true;
        flagReason = (flagReason ? flagReason + ' ' : '') + 'Identical coordinates detected repeatedly (mock location suspected).';
      }

      // Impossible travel check (>180 km/h between taps)
      if (lastLog.time_in) {
        const distMeters = calculateHaversineDistance(Number(lastLog.lat_in), Number(lastLog.lng_in), lat, lng);
        const elapsedSecs = Math.max(1, (serverNow.getTime() - new Date(lastLog.time_in).getTime()) / 1000);
        const speedKmh = (distMeters / 1000) / (elapsedSecs / 3600);
        if (elapsedSecs < 7200 && distMeters > 50000 && speedKmh > 180) {
          isFlagged = true;
          flagReason = (flagReason ? flagReason + ' ' : '') + `Impossible travel speed detected (${Math.round(speedKmh)} km/h across ${Math.round(distMeters / 1000)} km).`;
        }
      }
    }

    // Check failed attempts today
    const { count: failedCount } = await adminClient
      .from('failed_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', user.id)
      .gte('created_at', `${today}T00:00:00${tzOffset}`);

    if ((failedCount ?? 0) >= 3) {
      isFlagged = true;
      flagReason = (flagReason ? flagReason + ' ' : '') + `Multiple failed attempts recorded today (${failedCount}).`;
    }

    // Compute wage snapshots
    const snapDaily = Number(profile.daily_rate) || 610;
    const snapHourly = Number(profile.hourly_rate) || Number((snapDaily / 8).toFixed(2));
    const snapOtMultiplier = Number(appSettings?.overtime_multiplier_ordinary) || 1.25;
    const snapOtRate = Number(profile.overtime_rate_per_hour) || Number((snapHourly * snapOtMultiplier).toFixed(2));

    const shift = profile.shift;

    if (action === 'time_in') {
      // Check if already timed in today
      const { data: existingLog } = await adminClient
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', user.id)
        .eq('date', today)
        .single();

      if (existingLog && !existingLog.time_out) {
        return NextResponse.json({ error: 'Already timed in today! Tap TIME OUT to conclude your shift.' }, { status: 400 });
      }

      // Calculate late minutes in configured Company Timezone
      let lateMinutes = 0;
      let status: AttendanceStatus = 'present';

      if (shift && shift.start_time) {
        const shiftStart = parseShiftToPHDate(shift.start_time, today, activeTz);
        const graceMinutes = shift.grace_period_mins ?? 15;
        const graceDeadline = new Date(shiftStart.getTime() + graceMinutes * 60 * 1000);

        if (serverNow > graceDeadline) {
          lateMinutes = Math.round((serverNow.getTime() - shiftStart.getTime()) / (60 * 1000));
          status = 'late';
        }
      }

      const { data: newLog, error: logErr } = await adminClient
        .from('attendance_logs')
        .insert({
          employee_id: user.id,
          date: today,
          time_in: serverTimestamp,
          lat_in: lat,
          lng_in: lng,
          accuracy_in: accuracy,
          location_in_id: matchedLocation.id,
          device_id,
          verification_method: verificationMethod,
          status,
          late_minutes: lateMinutes,
          daily_rate: snapDaily,
          hourly_rate: snapHourly,
          overtime_rate_per_hour: snapOtRate,
          overtime_multiplier: snapOtMultiplier,
          selfie_url: selfieUrl || null,
          flagged: isFlagged,
          flag_reason: flagReason,
        })
        .select()
        .single();

      if (logErr) {
        return NextResponse.json({ error: logErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'time_in',
        record: newLog,
        locationName: matchedLocation.name,
        serverTime: serverTimestamp,
        verificationMethod,
        lateMinutes,
        status,
        message: status === 'late'
          ? `Timed In at ${matchedLocation.name} (${lateMinutes}m late)`
          : `Timed In successfully at ${matchedLocation.name}!`,
      });
    } else {
      // action === 'time_out'
      // Find today's active time_in log
      const { data: activeLog, error: findErr } = await adminClient
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', user.id)
        .eq('date', today)
        .is('time_out', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (findErr || !activeLog) {
        return NextResponse.json({ error: 'No active Time In found for today. Please Time In first.' }, { status: 400 });
      }

      const timeInDate = new Date(activeLog.time_in);
      const totalHours = Math.max(0, (serverNow.getTime() - timeInDate.getTime()) / (1000 * 60 * 60));

      // Calculate undertime and overtime (counting both pre-shift early clock-in and post-shift late clock-out)
      let undertimeMinutes = 0;
      let preShiftOtMinutes = 0;
      let postShiftOtMinutes = 0;

      if (shift) {
        // 1. Pre-shift Overtime: Early clock-in before shift start time
        if (shift.start_time && activeLog.time_in) {
          const shiftStart = parseShiftToPHDate(shift.start_time, today, activeTz);
          if (timeInDate < shiftStart) {
            preShiftOtMinutes = Math.round((shiftStart.getTime() - timeInDate.getTime()) / (60 * 1000));
          }
        }

        // 2. Post-shift Overtime or Undertime: Clock-out relative to shift end time
        if (shift.end_time) {
          const shiftEnd = parseShiftToPHDate(shift.end_time, today, activeTz);

          if (serverNow < shiftEnd) {
            undertimeMinutes = Math.round((shiftEnd.getTime() - serverNow.getTime()) / (60 * 1000));
          } else if (serverNow > shiftEnd) {
            postShiftOtMinutes = Math.round((serverNow.getTime() - shiftEnd.getTime()) / (60 * 1000));
          }
        }
      }

      const totalOvertimeMinutes = preShiftOtMinutes + postShiftOtMinutes;

      const { data: updatedLog, error: updateErr } = await adminClient
        .from('attendance_logs')
        .update({
          time_out: serverTimestamp,
          lat_out: lat,
          lng_out: lng,
          accuracy_out: accuracy,
          location_out_id: matchedLocation.id,
          hours_worked: Number(totalHours.toFixed(2)),
          undertime_minutes: undertimeMinutes,
          overtime_minutes: totalOvertimeMinutes,
          daily_rate: activeLog.daily_rate || snapDaily,
          hourly_rate: activeLog.hourly_rate || snapHourly,
          overtime_rate_per_hour: activeLog.overtime_rate_per_hour || snapOtRate,
          overtime_multiplier: activeLog.overtime_multiplier || snapOtMultiplier,
          flagged: activeLog.flagged || isFlagged,
          flag_reason: activeLog.flag_reason || flagReason,
          status: activeLog.status === 'late' ? 'late' : 'completed',
          updated_at: serverTimestamp,
        })
        .eq('id', activeLog.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'time_out',
        record: updatedLog,
        locationName: matchedLocation.name,
        serverTime: serverTimestamp,
        verificationMethod,
        hoursWorked: Number(totalHours.toFixed(2)),
        overtimeMinutes: totalOvertimeMinutes,
        undertimeMinutes,
        message: totalOvertimeMinutes > 0
          ? `Timed Out at ${matchedLocation.name}. Hours worked: ${totalHours.toFixed(1)} hrs (${totalOvertimeMinutes}m total OT: ${preShiftOtMinutes}m before shift, ${postShiftOtMinutes}m after shift).`
          : `Timed Out successfully at ${matchedLocation.name}. Hours worked: ${totalHours.toFixed(1)} hrs.`,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Attendance recording failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
