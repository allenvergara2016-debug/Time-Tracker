import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: locations, error } = await adminClient
      .from('locations')
      .select('*, employee_locations(employee_id)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (locations || []).map((loc) => ({
      ...loc,
      assignedCount: loc.employee_locations?.length || 0,
    }));

    return NextResponse.json({ locations: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Locations fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const { name, address, lat, lng, radius_meters = 100, is_active = true, assigned_employee_ids } = body;

    if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Name, latitude, and longitude are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: newLoc, error: locErr } = await adminClient
      .from('locations')
      .insert({
        name,
        address,
        lat,
        lng,
        radius_meters: Number(radius_meters),
        is_active,
      })
      .select()
      .single();

    if (locErr || !newLoc) {
      return NextResponse.json({ error: locErr?.message || 'Failed to create location' }, { status: 500 });
    }

    // Assign specific employees if provided
    if (Array.isArray(assigned_employee_ids) && assigned_employee_ids.length > 0) {
      const inserts = assigned_employee_ids.map((empId: string) => ({
        location_id: newLoc.id,
        employee_id: empId,
      }));
      await adminClient.from('employee_locations').insert(inserts);
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'CREATE_LOCATION',
      target_type: 'location',
      target_id: newLoc.id,
      details: { name, lat, lng, radius_meters },
    });

    return NextResponse.json({ success: true, location: newLoc });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Location creation error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

