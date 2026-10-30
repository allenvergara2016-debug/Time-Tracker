import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: prefs, error } = await adminClient
      .from('notification_preferences')
      .select('*')
      .eq('employee_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: prefs || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Preferences fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const adminClient = createAdminClient();

    const { data: updated, error } = await adminClient
      .from('notification_preferences')
      .upsert({
        employee_id: user.id,
        ...body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, preferences: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Preferences update error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

