import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { data: employees, error } = await supabase
      .from('profiles')
      .select(`
        *,
        department:departments(id, name),
        shift:shifts(id, name, start_time, end_time),
        passkeys:passkey_credentials(id, device_name, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ employees });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      full_name,
      email,
      password,
      department_id,
      shift_id,
      phone,
      daily_rate = 0,
      hourly_rate,
      overtime_rate_per_hour = 0,
      overtime_multiplier = 1.25,
      role = 'employee',
    } = body;

    const computedDailyRate = Number(daily_rate) || 0;
    const computedHourlyRate = hourly_rate !== undefined && hourly_rate !== null && Number(hourly_rate) > 0
      ? Number(hourly_rate)
      : computedDailyRate > 0 ? Number((computedDailyRate / 8).toFixed(2)) : 0;
    const computedOtRate = Number(overtime_rate_per_hour) || (computedHourlyRate > 0 ? Number((computedHourlyRate * 1.25).toFixed(2)) : 0);

    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'Full name, email, and password are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Create auth user with temporary password and email pre-confirmed
    const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

    if (authError || !newAuthUser.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 400 });
    }

    const userId = newAuthUser.user.id;

    // 2. Insert or update profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        role,
        full_name,
        email,
        department_id: department_id || null,
        shift_id: shift_id || null,
        phone: phone || null,
        daily_rate: computedDailyRate,
        hourly_rate: computedHourlyRate,
        overtime_rate_per_hour: computedOtRate,
        overtime_multiplier: Number(overtime_multiplier) || 1.25,
        is_active: true,
        must_change_password: true, // Force password change on first login!
        consent_given: false,
      });

    if (profileError) {
      // rollback auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // 3. Insert notification preferences default
    await adminClient
      .from('notification_preferences')
      .upsert({
        employee_id: userId,
      });

    // 4. Log admin audit action
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'CREATE_EMPLOYEE',
      target_type: 'profile',
      target_id: userId,
      details: { email, full_name, role, department_id, shift_id },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        full_name,
        role,
        must_change_password: true,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

