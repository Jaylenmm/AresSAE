'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setLoading(false)
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  if (loading) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <div className="text-center py-8">Loading...</div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Sign In</h1>
          <p className="text-gray-600 mb-6">
            Sign in to save your picks and access Ares analysis
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Account</h1>

      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <p className="text-sm text-gray-600 mb-1">Signed in as</p>
        <p className="font-semibold text-gray-900">{user.email}</p>
      </div>

      <div className="space-y-3">
        <button className="w-full bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors">
          Subscription (Coming Soon)
        </button>
        
        <button
          onClick={signOut}
          className="w-full bg-red-600 text-white font-semibold py-3 rounded-lg hover:bg-red-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}