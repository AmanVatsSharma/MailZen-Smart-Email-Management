import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicAuthPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/oauth-success',
];

const legacyRedirects: Record<string, string> = {
  '/login': '/auth/login',
  '/register': '/auth/register',
  '/forgot-password': '/auth/forgot-password',
  '/dashboard': '/',
};

const isPublicPath = (path: string): boolean =>
  publicAuthPaths.some((publicPath) => {
    return path === publicPath || path.startsWith(`${publicPath}/`);
  });

const isBypassPath = (path: string): boolean => {
  return (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.includes('.') ||
    path === '/favicon.ico'
  );
};

const isAllowedAuthedPublicPath = (path: string): boolean => {
  return path === '/auth/oauth-success';
};

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  const legacyTarget = legacyRedirects[pathname];
  if (legacyTarget) {
    return NextResponse.redirect(new URL(`${legacyTarget}${search}`, request.url));
  }

  const token = request.cookies.get('token')?.value;
  const isAuthenticated = Boolean(token);

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (
    isAuthenticated &&
    isPublicPath(pathname) &&
    !isAllowedAuthedPublicPath(pathname)
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
