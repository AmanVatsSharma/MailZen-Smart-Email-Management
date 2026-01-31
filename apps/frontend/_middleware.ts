import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define paths that don't require authentication
const publicPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// Check if the request is for a public path
const isPublicPath = (path: string) => {
  return publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(`${publicPath}/`)
  );
};

// This function runs for every request
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip for API routes, assets, etc.
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') ||
    pathname.includes('.') || // static files
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }
  
  // Check for the existence of the auth token
  const token = request.cookies.get('token')?.value;
  const isAuthenticated = !!token;

  // Root route behavior: always send users to the right place.
  // This avoids client-side token checks (HttpOnly cookie cannot be read by JS).
  if (pathname === '/') {
    return NextResponse.redirect(new URL(isAuthenticated ? '/dashboard' : '/auth/login', request.url));
  }

  // Handle authentication redirects
  if (!isAuthenticated && !isPublicPath(pathname)) {
    // Redirect unauthenticated users to login when accessing protected routes
    const url = new URL('/auth/login', request.url);
    url.searchParams.set('redirect', encodeURIComponent(pathname));
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isPublicPath(pathname)) {
    // Redirect authenticated users away from auth pages
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Configure which paths this middleware applies to
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (static assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 