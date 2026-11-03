import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BulkRateRow {
  employee_id?: string;
  email?: string;
  name?: string;
  regular_rate: number;
  overtime_rate_per_hour: number;
  rest_day_ot_rate?: number | null;
  holiday_ot_rate?: number | null;
  effective_from: string;
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
      return NextResponse.json({ error: 'Forbidden: Management privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { mode, rows } = body; // mode: 'preview' | 'confirm'

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rate rows provided.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch all active profiles for matching
    const { data: allProfiles } = await adminClient
      .from('profiles')
      .select('id, full_name, email, daily_rate, overtime_rate_per_hour');

    type ProfileMatch = NonNullable<typeof allProfiles>[number];
    const profileByEmail = new Map<string, ProfileMatch>();
    const profileById = new Map<string, ProfileMatch>();
    const profileByName = new Map<string, ProfileMatch>();

    (allProfiles || []).forEach((p) => {
      if (p.email) profileByEmail.set(p.email.toLowerCase().trim(), p);
      if (p.id) profileById.set(p.id, p);
      if (p.full_name) profileByName.set(p.full_name.toLowerCase().trim(), p);
    });

    const parsedResults: Array<{
      matched: boolean;
      employeeId?: string;
      fullName?: string;
      email?: string;
      oldRegularRate?: number | null;
      oldOtRate?: number | null;
      newRegularRate: number;
      newOtRate: number;
      restDayOtRate?: number | null;
      holidayOtRate?: number | null;
      effectiveFrom: string;
      error?: string;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    for (const r of rows) {
      const email = r.email ? String(r.email).toLowerCase().trim() : '';
      const id = r.employee_id ? String(r.employee_id).trim() : '';
      const name = r.name ? String(r.name).toLowerCase().trim() : '';

      const matchedProfile = (id && profileById.get(id)) ||
        (email && profileByEmail.get(email)) ||
        (name && profileByName.get(name));

      const regularRate = Number(r.regular_rate);
      const otRate = Number(r.overtime_rate_per_hour);
      const restDayRate = r.rest_day_ot_rate !== undefined && r.rest_day_ot_rate !== null && r.rest_day_ot_rate !== '' ? Number(r.rest_day_ot_rate) : null;
      const holidayRate = r.holiday_ot_rate !== undefined && r.holiday_ot_rate !== null && r.holiday_ot_rate !== '' ? Number(r.holiday_ot_rate) : null;
      const effectiveFrom = r.effective_from ? String(r.effective_from).trim() : todayStr;

      if (!matchedProfile) {
        parsedResults.push({
          matched: false,
          email: email || undefined,
          fullName: name || undefined,
          newRegularRate: regularRate,
          newOtRate: otRate,
          restDayOtRate: restDayRate,
          holidayOtRate: holidayRate,
          effectiveFrom,
          error: 'Employee not found in directory',
        });
        continue;
      }

      if (isNaN(regularRate) || regularRate <= 0) {
        parsedResults.push({
          matched: false,
          employeeId: matchedProfile.id,
          fullName: matchedProfile.full_name,
          email: matchedProfile.email,
          newRegularRate: regularRate,
          newOtRate: otRate,
          effectiveFrom,
          error: 'Invalid regular daily rate (₱)',
        });
        continue;
      }

      if (isNaN(otRate) || otRate < 0) {
        parsedResults.push({
          matched: false,
          employeeId: matchedProfile.id,
          fullName: matchedProfile.full_name,
          email: matchedProfile.email,
          newRegularRate: regularRate,
          newOtRate: otRate,
          effectiveFrom,
          error: 'Invalid overtime rate (₱/hr)',
        });
        continue;
      }

      parsedResults.push({
        matched: true,
        employeeId: matchedProfile.id,
        fullName: matchedProfile.full_name,
        email: matchedProfile.email,
        oldRegularRate: matchedProfile.daily_rate,
        oldOtRate: matchedProfile.overtime_rate_per_hour,
        newRegularRate: regularRate,
        newOtRate: otRate,
        restDayOtRate: restDayRate,
        holidayOtRate: holidayRate,
        effectiveFrom,
      });
    }

    // If preview mode, return validated diffs
    if (mode === 'preview') {
      return NextResponse.json({
        totalRows: rows.length,
        validCount: parsedResults.filter((r) => r.matched).length,
        errorCount: parsedResults.filter((r) => !r.matched).length,
        preview: parsedResults,
      });
    }

    // If confirm mode, commit valid rows to employee_rates
    const validRows = parsedResults.filter((r) => r.matched && r.employeeId);
    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows to commit.' }, { status: 400 });
    }

    const insertPayloads = validRows.map((r) => ({
      employee_id: r.employeeId!,
      regular_rate: r.newRegularRate,
      overtime_rate_per_hour: r.newOtRate,
      rest_day_ot_rate: r.restDayOtRate,
      holiday_ot_rate: r.holidayOtRate,
      effective_from: r.effectiveFrom,
      created_by: user.id,
      created_at: new Date().toISOString(),
    }));

    const { data: insertedRecords, error: insertErr } = await adminClient
      .from('employee_rates')
      .insert(insertPayloads)
      .select();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Update profiles cache
    for (const r of validRows) {
      await adminClient
        .from('profiles')
        .update({
          daily_rate: r.newRegularRate,
          overtime_rate_per_hour: r.newOtRate,
          hourly_rate: Number((r.newRegularRate / 8).toFixed(2)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.employeeId!);
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'BULK_UPDATE_RATES',
      target_type: 'employee_rates',
      details: {
        total_updated: validRows.length,
        employees: validRows.map((v) => ({
          id: v.employeeId,
          name: v.fullName,
          new_regular: v.newRegularRate,
          new_ot: v.newOtRate,
          effective_from: v.effectiveFrom,
        })),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully updated rates for ${validRows.length} employee(s).`,
      count: validRows.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Bulk rate update error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
