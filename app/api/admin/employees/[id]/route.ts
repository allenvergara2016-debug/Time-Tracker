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
      action, // 'archive' | 'reactivate' | undefined
      full_name,
      role,
      department_id,
      shift_id,
      phone,
      whatsapp_number,
      google_email,
      daily_rate,
      hourly_rate,
      overtime_rate_per_hour,
      overtime_multiplier,
      is_active,
      company_tag,
    } = body;

    const adminClient = createAdminClient();

    // Fetch previous state for audit log
    const { data: oldProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldProfile) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    let auditAction = 'UPDATE_EMPLOYEE';

    if (action === 'archive' || is_active === false) {
      updatePayload.is_active = false;
      updatePayload.archived_at = new Date().toISOString();
      updatePayload.archived_by = user.id;
      auditAction = 'DEACTIVATE_EMPLOYEE';
    } else if (action === 'reactivate' || (is_active === true && oldProfile.is_active === false)) {
      updatePayload.is_active = true;
      updatePayload.archived_at = null;
      updatePayload.archived_by = null;
      auditAction = 'REACTIVATE_EMPLOYEE';
    } else {
      if (full_name !== undefined) updatePayload.full_name = full_name;
      if (role !== undefined) updatePayload.role = role;
      if (department_id !== undefined) updatePayload.department_id = department_id || null;
      if (shift_id !== undefined) updatePayload.shift_id = shift_id || null;
      if (phone !== undefined) updatePayload.phone = phone;
      if (whatsapp_number !== undefined) updatePayload.whatsapp_number = whatsapp_number || null;
      if (google_email !== undefined) updatePayload.google_email = google_email ? String(google_email).trim().toLowerCase() : null;
      if (company_tag !== undefined) updatePayload.company_tag = company_tag ? String(company_tag).trim() : null;
      if (is_active !== undefined) updatePayload.is_active = is_active;
    }

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

    const { data: updatedProfile, error } = await adminClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record audit log with old and new values
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: auditAction,
      target_type: 'profile',
      target_id: id,
      old_value: oldProfile,
      new_value: updatedProfile,
      details: {
        employee_name: oldProfile.full_name,
        employee_email: oldProfile.email,
        action: auditAction,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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
      .select('id, role, is_super_admin')
      .eq('id', user.id)
      .single();

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Safety guard 1: Admin cannot delete their own account
    if (user.id === id) {
      return NextResponse.json(
        { error: 'You cannot delete your own administrator account.' },
        { status: 400 }
      );
    }

    // Safety guard 2: Super Admin privilege required for permanent deletion
    if (!adminProfile.is_super_admin) {
      return NextResponse.json(
        { error: 'Permanent deletion is strictly restricted to Super Administrators. Use Deactivate / Archive instead.' },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    // Fetch target employee profile
    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }

    // Safety guard 3: Super Admin accounts cannot be deleted
    if (targetProfile.is_super_admin) {
      return NextResponse.json(
        { error: 'Super Admin accounts are protected and cannot be deleted.' },
        { status: 403 }
      );
    }

    // Check confirmation name from body or query
    const url = new URL(req.url);
    let confirmName = url.searchParams.get('confirmation_name') || '';
    try {
      const body = await req.json();
      if (body?.confirmation_name) confirmName = body.confirmation_name;
    } catch {
      // ignore empty body
    }

    if (!confirmName || confirmName.trim().toLowerCase() !== targetProfile.full_name.trim().toLowerCase()) {
      return NextResponse.json(
        { error: `Please type the employee's exact full name ("${targetProfile.full_name}") to confirm permanent deletion.` },
        { status: 400 }
      );
    }

    // Check attendance records and retention policy
    const { count: attendanceCount } = await adminClient
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', id);

    if ((attendanceCount ?? 0) > 0) {
      const { data: latestLog } = await adminClient
        .from('attendance_logs')
        .select('date')
        .eq('employee_id', id)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      // Fetch retention years from app_settings
      const { data: settings } = await adminClient
        .from('app_settings')
        .select('data_retention_years')
        .eq('id', 'global')
        .single();

      const retentionYears = settings?.data_retention_years || 3;
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

      if (latestLog && new Date(latestLog.date) > cutoff) {
        return NextResponse.json(
          {
            error: `Permanent deletion blocked: Employee has ${attendanceCount} attendance records within the ${retentionYears}-year data retention period. Please deactivate/archive the employee instead to preserve labor records.`,
          },
          { status: 400 }
        );
      }
    }

    // Clean up relations
    await Promise.allSettled([
      adminClient.from('passkey_credentials').delete().eq('employee_id', id),
      adminClient.from('employee_locations').delete().eq('employee_id', id),
      adminClient.from('webauthn_challenges').delete().eq('user_id', id),
      adminClient.from('message_reactions').delete().eq('user_id', id),
      adminClient.from('messages').delete().eq('sender_id', id),
      adminClient.from('conversation_members').delete().eq('employee_id', id),
      adminClient.from('notification_preferences').delete().eq('employee_id', id),
      adminClient.from('failed_attempts').delete().eq('employee_id', id),
      adminClient.from('leave_requests').delete().eq('employee_id', id),
      adminClient.from('correction_requests').delete().eq('employee_id', id),
      adminClient.from('breaks').delete().eq('employee_id', id),
      adminClient.from('attendance_logs').delete().eq('employee_id', id),
    ]);

    // Delete profile row
    await adminClient.from('profiles').delete().eq('id', id);

    // Delete auth user
    await adminClient.auth.admin.deleteUser(id);

    // Record audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'PERMANENT_DELETE_EMPLOYEE',
      target_type: 'profile',
      target_id: id,
      old_value: targetProfile,
      new_value: null,
      details: {
        full_name: targetProfile.full_name,
        email: targetProfile.email,
        role: targetProfile.role,
        records_purged: attendanceCount,
        deleted_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${targetProfile.full_name} and credentials permanently deleted.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
