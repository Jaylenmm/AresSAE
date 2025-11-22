// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = requestUrl.searchParams.get('redirect') || '/'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.session?.user) {
      const user = data.session.user
      const email = user.email || null
      const now = new Date().toISOString()

      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email,
          joined_via: 'google',
          last_login_at: now,
        },
        { onConflict: 'id' }
      )
    }
  }

  // Redirect to the original page they were on
  return NextResponse.redirect(new URL(redirect, request.url))
}