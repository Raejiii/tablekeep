import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refreshes the Supabase session on every navigation and guards signed-in pages.
export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet, headers) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
                    // keep CDNs from caching responses that carry a session cookie
                    Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
                },
            },
        },
    )

    // getClaims verifies the token and refreshes it when needed
    const { data } = await supabase.auth.getClaims()
    const signedIn = Boolean(data?.claims?.sub)

    const path = request.nextUrl.pathname
    if (!signedIn && path.startsWith('/campaigns')) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', path)
        return NextResponse.redirect(url)
    }

    return response
}

export const config = {
    // skip static files and images
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
