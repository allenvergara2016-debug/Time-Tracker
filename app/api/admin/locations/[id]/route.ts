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

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, address, lat, lng, radius_meters, is_active, assigned_employee_ids } = body;

    const adminClient = createAdminClient();

    const { data: updated, error } = await adminClient
      .from('locations')
      .update({
        name,
        address,
        lat,
        lng,
        radius_meters: Number(radius_meters),
        is_active,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update assigned employees if provided
    if (Array.isArray(assigned_employee_ids)) {
      await adminClient.from('employee_locations').delete().eq('location_id', id);
      if (assigned_employee_ids.length > 0) {
        const inserts = assigned_employee_ids.map((empId: string) => ({
          location_id: id,
          employee_id: empId,
        }));
        await adminClient.from('employee_locations').insert(inserts);
      }
    }

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE_LOCATION',
      target_type: 'location',
      target_id: id,
      details: body,
    });

    return NextResponse.json({ success: true, location: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Location update error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient.from('locations').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'DELETE_LOCATION',
      target_type: 'location',
      target_id: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Location delete error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

