import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip auth check for login + password-reset routes
  if (
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/admin/reset/')
  ) {
    return NextResponse.next()
  }
  
  // Check for auth cookie
  const authCookie = request.cookies.get('garten_auth')
  
  if (!authCookie || authCookie.value !== 'true') {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  // Exclude Next.js internals, favicon, the PWA manifest, and any static
  // asset by extension. Without these the middleware redirects /manifest
  // .webmanifest and /icon-*.png to /login, which makes Chrome's PWA
  // install prompt criteria fail (it can't read the manifest).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|webmanifest)$).*)',
  ],
}