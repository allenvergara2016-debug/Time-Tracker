import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { password } = body;

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters long.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Update in Supabase auth
    const { error: authErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password,
    });

    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

    // 2. Mark must_change_password = false
    await adminClient
      .from('profiles')
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({ success: true, message: 'Password updated successfully!' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Password update error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

