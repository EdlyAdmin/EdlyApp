import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = decodeURIComponent(request.nextUrl.pathname)

  // Publika routes — ingen auth krävs
  const publicRoutes = [
    '/',
    '/familj/logga-in',
    '/familj/registrera',
    '/familj/glomt-losenord',
    '/larare/logga-in',
    '/larare/registrera',
    '/larare/glomt-losenord',
    '/admin/logga-in',
    '/nytt-losenord',
    '/vantar',
    '/nekad',
    '/integritetspolicy',
  ]

  // Startsidan — redirect inloggade användare till rätt dashboard
  if (pathname === '/') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role === 'admin') return NextResponse.redirect(new URL('/admin', request.url))
      if (profile?.role === 'teacher') return NextResponse.redirect(new URL('/larare', request.url))
      if (profile?.role === 'family') return NextResponse.redirect(new URL('/hem', request.url))
    }
    return supabaseResponse
  }

  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return supabaseResponse
  }

  // Ej inloggad — redirect till rätt inloggningssida
  if (!user) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/logga-in', request.url))
    }
    if (pathname.startsWith('/larare')) {
      return NextResponse.redirect(new URL('/larare/logga-in', request.url))
    }
    return NextResponse.redirect(new URL('/familj/logga-in', request.url))
  }

  // Hämta roll och teacher-status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Admin-routes: kräver admin-roll
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/familj/logga-in', request.url))
  }

  // Lärar-routes: kräver approved teacher
  if (pathname.startsWith('/larare') && role === 'teacher') {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('status')
      .eq('profile_id', user.id)
      .single()

    if (teacher?.status === 'pending') {
      return NextResponse.redirect(new URL('/vantar', request.url))
    }
    if (teacher?.status === 'rejected') {
      return NextResponse.redirect(new URL('/nekad', request.url))
    }
  }

  // Familj-routes: kräver family-roll
  if (pathname.startsWith('/hem') && role !== 'family') {
    return NextResponse.redirect(new URL('/familj/logga-in', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
