// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'auth_token'

const PUBLIC_API_PREFIXES = ['/api/auth'] 
const PUBLIC_API_EXACT = new Set<string>([
  '/api/auth/logout',
])

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_EXACT.has(pathname)) return true
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    return NextResponse.next()
  }

  if (isPublicApi(pathname)) {
    return NextResponse.next()
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return NextResponse.json(
      { authenticated: false, error: 'Server configuration error.' },
      { status: 500 },
    )
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json(
      { authenticated: false, error: 'Unauthorized.' },
      { status: 401 },
    )
  }

  try {
    const key = new TextEncoder().encode(secret)
    await jwtVerify(token, key) 
    return NextResponse.next()
  } catch {
    return NextResponse.json(
      { authenticated: false, error: 'Session expired or invalid.' },
      { status: 401 },
    )
  }
}

export const config = {
  matcher: ['/api/:path*'],
}
