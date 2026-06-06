import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Não autenticado tentando acessar área protegida
  if (!user && (path.startsWith('/admin') || path.startsWith('/painel'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (path.startsWith('/admin') || path.startsWith('/painel') || path === '/login')) {
    // Busca role + active. Se a coluna 'active' ainda não existir no banco,
    // a query falha — então caímos para um select só de 'role' (resiliente).
    let profile: { role?: string; active?: boolean | null } | null = null
    const full = await supabase.from('profiles').select('role, active').eq('id', user.id).single()
    if (full.error) {
      const fallback = await supabase.from('profiles').select('role').eq('id', user.id).single()
      profile = fallback.data
    } else {
      profile = full.data
    }

    const isAdmin   = profile?.role === 'admin'
    const isBlocked = !isAdmin && profile?.active === false

    // Cliente suspenso: encerra a sessão e manda para o login com aviso
    if (isBlocked) {
      await supabase.auth.signOut()
      if (path === '/login') return supabaseResponse
      return NextResponse.redirect(new URL('/login?blocked=1', request.url))
    }

    // Só faz roteamento por papel quando o perfil foi lido com sucesso
    // (evita loops caso o perfil não possa ser carregado)
    if (profile) {
      // Autenticado tentando acessar a tela de login → vai para o painel certo
      if (path === '/login') {
        return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/painel', request.url))
      }

      // Cliente tentando acessar área admin
      if (path.startsWith('/admin') && !isAdmin) {
        return NextResponse.redirect(new URL('/painel', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
