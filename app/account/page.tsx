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
    
    if (!user) {
      // Not logged in - redirect to login page, then home after auth
      router.push('/login?redirect=/')
      return
    }
    
    setUser(user)
    setLoading(false)
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

  // If no user at this point, they're being redirected
  if (!user) {
    return null
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