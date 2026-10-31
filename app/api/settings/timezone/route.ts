import { NextResponse } from 'next/server';
import { getCompanyTimezone } from '@/lib/company-timezone';
import { getTimezoneLabel } from '@/lib/ph-time';

export async function GET() {
  try {
    const timezone = await getCompanyTimezone();
    return NextResponse.json({
      timezone,
      label: getTimezoneLabel(timezone),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resolving timezone';
    return NextResponse.json({ error: message, timezone: 'Asia/Manila' }, { status: 500 });
  }
}

