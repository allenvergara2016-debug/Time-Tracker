import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: shifts, error } = await supabase
      .from('shifts')
      .select('*, profiles(id)')
      .order('start_time', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (shifts || []).map((s) => ({
      ...s,
      employeeCount: s.profiles?.length || 0,
    }));

    return NextResponse.json({ shifts: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Shifts fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      name,
      start_time,
      end_time,
      break_start = '12:00:00',
      break_end = '13:00:00',
      break_duration_mins = 60,
      grace_period_mins = 15,
      work_days = [1, 2, 3, 4, 5],
    } = body;

    if (!name || !start_time || !end_time) {
      return NextResponse.json({ error: 'Shift name, start time, and end time are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: newShift, error } = await adminClient
      .from('shifts')
      .insert({
        name,
        start_time,
        end_time,
        break_start,
        break_end,
        break_duration_mins: Number(break_duration_mins) || 60,
        grace_period_mins: Number(grace_period_mins) || 15,
        work_days,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, shift: newShift });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Shift creation error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 });

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('shifts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Shift deletion error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
