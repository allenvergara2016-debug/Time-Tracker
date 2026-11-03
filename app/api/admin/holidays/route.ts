import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: holidays, error } = await adminClient
      .from('holidays')
      .select('*')
      .order('date', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ holidays: holidays || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching holidays';
    return NextResponse.json({ error: msg }, { status: 500 });
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
    const { name, date, type } = body;

    if (!name || !date || !type) {
      return NextResponse.json({ error: 'Name, date, and holiday type are required.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: holiday, error } = await adminClient
      .from('holidays')
      .insert({
        name: name.trim(),
        date,
        type,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'CREATE_HOLIDAY',
      target_type: 'holiday',
      target_id: holiday.id,
      new_value: holiday,
      details: { name, date, type },
    });

    return NextResponse.json({ success: true, holiday });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error adding holiday';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Holiday ID required.' }, { status: 400 });

    const adminClient = createAdminClient();

    const { data: oldHoliday } = await adminClient
      .from('holidays')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await adminClient.from('holidays').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'DELETE_HOLIDAY',
      target_type: 'holiday',
      target_id: id,
      old_value: oldHoliday,
      details: { holiday_name: oldHoliday?.name, date: oldHoliday?.date },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting holiday';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

