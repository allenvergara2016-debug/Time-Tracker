import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, google_email, facebook_url, facebook_name, whatsapp_number, whatsapp_verified')
      .eq('id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile, identities: user.identities || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching social links';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { google_email, facebook_url, facebook_name } = body;

    let formattedFbUrl = facebook_url ? String(facebook_url).trim() : null;
    if (formattedFbUrl && !formattedFbUrl.startsWith('http://') && !formattedFbUrl.startsWith('https://')) {
      if (formattedFbUrl.startsWith('facebook.com') || formattedFbUrl.startsWith('fb.com')) {
        formattedFbUrl = `https://${formattedFbUrl}`;
      } else if (!formattedFbUrl.includes('/')) {
        formattedFbUrl = `https://facebook.com/${formattedFbUrl.replace(/^@/, '')}`;
      } else {
        formattedFbUrl = `https://${formattedFbUrl}`;
      }
    }

    const trimmedGoogleEmail = google_email ? String(google_email).trim().toLowerCase() : null;
    const trimmedFbName = facebook_name ? String(facebook_name).trim() : null;

    const adminClient = createAdminClient();

    const { data: updatedProfile, error } = await adminClient
      .from('profiles')
      .update({
        google_email: trimmedGoogleEmail,
        facebook_url: formattedFbUrl,
        facebook_name: trimmedFbName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also sync to auth user_metadata
    await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        google_email: trimmedGoogleEmail,
        facebook_url: formattedFbUrl,
        facebook_name: trimmedFbName,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Connected accounts updated successfully',
      profile: updatedProfile,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating social links';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST endpoint to auto-sync linked OAuth identities from Supabase Auth
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const identities = user.identities || [];

    let googleEmail: string | null = null;
    let fbUrl: string | null = null;
    let fbName: string | null = null;

    for (const identity of identities) {
      if (identity.provider === 'google') {
        const idData = identity.identity_data as Record<string, any> | undefined;
        if (idData?.email) googleEmail = String(idData.email).toLowerCase();
      }
      if (identity.provider === 'facebook') {
        const idData = identity.identity_data as Record<string, any> | undefined;
        if (idData?.name) fbName = String(idData.name);
        if (idData?.user_id || idData?.sub) {
          fbUrl = `https://facebook.com/${idData.user_id || idData.sub}`;
        }
      }
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (googleEmail) updates.google_email = googleEmail;
    if (fbUrl) updates.facebook_url = fbUrl;
    if (fbName) updates.facebook_name = fbName;

    const { data: profile, error } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile,
      synced: { googleEmail, fbUrl, fbName },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error syncing identities';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

