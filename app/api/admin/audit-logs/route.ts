import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required.' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

    const { data: logs, error } = await adminClient
      .from('audit_logs')
      .select('*, actor:profiles!audit_logs_actor_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Fallback query without foreign key alias if not mapped
      const { data: fallbackLogs, error: fallbackError } = await adminClient
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }

      // Fetch actors manually
      const actorIds = Array.from(new Set((fallbackLogs || []).map((l) => l.actor_id).filter(Boolean)));
      let actorsMap = new Map<string, { full_name: string; email: string }>();

      if (actorIds.length > 0) {
        const { data: actors } = await adminClient
          .from('profiles')
          .select('id, full_name, email')
          .in('id', actorIds);

        (actors || []).forEach((a) => {
          actorsMap.set(a.id, { full_name: a.full_name, email: a.email });
        });
      }

      const formatted = (fallbackLogs || []).map((l) => ({
        ...l,
        actor: l.actor_id ? actorsMap.get(l.actor_id) || null : null,
      }));

      return NextResponse.json({ auditLogs: formatted });
    }

    return NextResponse.json({ auditLogs: logs || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Audit log fetch error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

