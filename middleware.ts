import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Skip middleware if supabase isn't configured yet
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder') || supabaseUrl.includes('dummy')) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Static and public exemption paths
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/forgot-password') || pathname.startsWith('/auth/callback');
  const isPublicApi = pathname.startsWith('/api/auth/webauthn') || pathname.startsWith('/api/health');
  const isStatic = pathname.startsWith('/_next') || pathname.includes('.') || pathname.startsWith('/icon') || pathname.startsWith('/manifest');

  if (isStatic) return response;

  // 2. Unauthenticated check
  if (!user) {
    if (!isAuthPage && !isPublicApi) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // 3. User is authenticated -> Fetch user profile status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, must_change_password, consent_given')
    .eq('id', user.id)
    .single();

  // If account is deactivated, block immediately
  if (profile && !profile.is_active) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Your account has been deactivated. Please contact an administrator.' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'deactivated');
    return NextResponse.redirect(url);
  }

  // 4. Force password change check
  const isPasswordChangeRoute = pathname === '/change-password' || pathname === '/api/profile/password' || pathname === '/api/auth/signout';
  if (profile?.must_change_password) {
    if (!isPasswordChangeRoute && !isAuthPage) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Password change required before accessing system.', must_change_password: true }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/change-password';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // If user already changed password and visits /change-password, send them to dashboard
  if (pathname === '/change-password' && !profile?.must_change_password) {
    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'admin' ? '/admin' : '/dashboard';
    return NextResponse.redirect(url);
  }

  // 5. Admin-only Route & API Protection (Server-Side Role Check)
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (isAdminRoute && profile?.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required.' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(url);
  }

  // 6. If user visits auth page while already logged in
  if (isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'admin' ? '/admin' : '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
