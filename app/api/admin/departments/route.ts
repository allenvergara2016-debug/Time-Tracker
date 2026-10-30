import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*, profiles(id)')
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (departments || []).map((d) => ({
      ...d,
      employeeCount: d.profiles?.length || 0,
    }));

    return NextResponse.json({ departments: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Departments fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, description } = body;

    const adminClient = createAdminClient();
    const { data: newDept, error } = await adminClient
      .from('departments')
      .insert({ name, description })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, department: newDept });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Department creation error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

