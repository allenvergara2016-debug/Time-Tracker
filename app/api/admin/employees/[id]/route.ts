import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      role,
      department_id,
      shift_id,
      phone,
      whatsapp_number,
      daily_rate,
      hourly_rate,
      overtime_rate_per_hour,
      overtime_multiplier,
      is_active,
    } = body;

    const adminClient = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      full_name,
      role,
      department_id: department_id || null,
      shift_id: shift_id || null,
      phone,
      whatsapp_number,
      is_active,
      updated_at: new Date().toISOString(),
    };

    if (daily_rate !== undefined) {
      updatePayload.daily_rate = Number(daily_rate) || 0;
      if (hourly_rate === undefined) {
        updatePayload.hourly_rate = Number(daily_rate) > 0 ? Number((Number(daily_rate) / 8).toFixed(2)) : 0;
      }
    }
    if (hourly_rate !== undefined) {
      updatePayload.hourly_rate = Number(hourly_rate) || 0;
    }
    if (overtime_rate_per_hour !== undefined) {
      updatePayload.overtime_rate_per_hour = Number(overtime_rate_per_hour) || 0;
    }
    if (overtime_multiplier !== undefined) {
      updatePayload.overtime_multiplier = Number(overtime_multiplier) || 1.25;
    }

    const { error } = await adminClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE_EMPLOYEE',
      target_type: 'profile',
      target_id: id,
      details: body,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

