'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`
      }
    })
    
    if (error) {
      alert('Error signing in')
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto p-4 flex items-center justify-center min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </main>
  )
}