import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = requestUrl.searchParams.get('redirect') || '/'

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to the specified page or home
  return NextResponse.redirect(new URL(redirect, request.url))
}