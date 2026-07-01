import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'kaamlee.in';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // Strip port for local dev comparison
  const hostWithoutPort = hostname.split(':')[0];

  const isSubdomain =
    hostWithoutPort.endsWith(`.${ROOT_DOMAIN}`) &&
    !hostWithoutPort.startsWith('www.');

  if (isSubdomain) {
    const username = hostWithoutPort.replace(`.${ROOT_DOMAIN}`, '');
    if (username) {
      const url = request.nextUrl.clone();
      url.pathname = `/portfolio/${username}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
