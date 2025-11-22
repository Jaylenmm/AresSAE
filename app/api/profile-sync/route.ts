import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const source = typeof body.source === 'string' ? body.source : 'unknown'

  const email = user.email || null
  const now = new Date().toISOString()

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email,
      joined_via: source,
      last_login_at: now,
    },
    { onConflict: 'id' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
