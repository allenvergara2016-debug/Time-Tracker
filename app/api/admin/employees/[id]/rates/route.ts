import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Management privileges required.' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { data: rates, error } = await adminClient
      .from('employee_rates')
      .select('*, creator:profiles!employee_rates_created_by_fkey(full_name, email)')
      .eq('employee_id', id)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback if foreign key alias differs
      const { data: fallbackRates, error: fbErr } = await adminClient
        .from('employee_rates')
        .select('*')
        .eq('employee_id', id)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false });

      if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 });
      return NextResponse.json({ rates: fallbackRates || [] });
    }

    return NextResponse.json({ rates: rates || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching rate history';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Management privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      regular_rate,
      overtime_rate_per_hour,
      rest_day_ot_rate,
      holiday_ot_rate,
      effective_from,
    } = body;

    const numRegularRate = Number(regular_rate);
    const numOtRate = Number(overtime_rate_per_hour);

    if (isNaN(numRegularRate) || numRegularRate <= 0) {
      return NextResponse.json({ error: 'A valid regular daily rate (₱) is required.' }, { status: 400 });
    }
    if (isNaN(numOtRate) || numOtRate < 0) {
      return NextResponse.json({ error: 'A valid flat overtime rate per hour (₱) is required.' }, { status: 400 });
    }

    const effectiveDate = effective_from ? String(effective_from).trim() : new Date().toISOString().split('T')[0];

    const adminClient = createAdminClient();

    // Fetch existing latest rate for audit trail
    const { data: latestRate } = await adminClient
      .from('employee_rates')
      .select('*')
      .eq('employee_id', id)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newRatePayload: Record<string, any> = {
      employee_id: id,
      regular_rate: numRegularRate,
      overtime_rate_per_hour: numOtRate,
      rest_day_ot_rate: rest_day_ot_rate !== undefined && rest_day_ot_rate !== null && rest_day_ot_rate !== '' ? Number(rest_day_ot_rate) : null,
      holiday_ot_rate: holiday_ot_rate !== undefined && holiday_ot_rate !== null && holiday_ot_rate !== '' ? Number(holiday_ot_rate) : null,
      effective_from: effectiveDate,
      created_by: user.id,
      created_at: new Date().toISOString(),
    };

    const { data: insertedRate, error: insertErr } = await adminClient
      .from('employee_rates')
      .insert(newRatePayload)
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Also update profiles cache for convenience in directory listing
    await adminClient
      .from('profiles')
      .update({
        daily_rate: numRegularRate,
        overtime_rate_per_hour: numOtRate,
        hourly_rate: Number((numRegularRate / 8).toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Fetch target employee profile name
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', id)
      .single();

    // Log to immutable audit log with old and new values
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE_EMPLOYEE_RATE',
      target_type: 'employee_rates',
      target_id: insertedRate.id,
      old_value: latestRate,
      new_value: insertedRate,
      details: {
        employee_id: id,
        employee_name: targetProfile?.full_name,
        employee_email: targetProfile?.email,
        effective_from: effectiveDate,
        regular_rate: numRegularRate,
        overtime_rate_per_hour: numOtRate,
      },
    });

    return NextResponse.json({ success: true, rate: insertedRate });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error saving employee rate';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

