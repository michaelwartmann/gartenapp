import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip auth check for login page
  if (pathname === '/login') {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}