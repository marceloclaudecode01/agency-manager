import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  // Root path: redirect based on auth state
  if (pathname === '/') {
    const target = token ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    // If authenticated user visits login/register, redirect to dashboard
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes: redirect to login if no token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
