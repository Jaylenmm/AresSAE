'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')

  async function syncProfile(source: string) {
    try {
      await fetch('/api/profile-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
    } catch (err) {
      return
    }
  }

  async function signInWithGoogle() {
    try {
      setLoading(true)
      setError(null)

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${baseUrl}/auth/callback?redirect=${redirect}`,

          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      if (!email || !password) {
        setError('Email and password are required')
        setLoading(false)
        return
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }

        await syncProfile('password_signup')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }

        await syncProfile('password_signin')
      }

      router.push(redirect)
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/ares-logo.svg"
            alt="Ares SAE"
            className="w-48 h-48 mx-auto mb-4"
          />
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-900 rounded-2xl shadow-2xl p-8 border border-gray-700">

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-200">
              Sign in to save your picks and track your performance
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="flex gap-2 mb-2 text-sm text-gray-200 justify-center">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={mode === 'signup' ? 'font-semibold text-white underline' : 'opacity-70'}
              >
                Create account
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={mode === 'signin' ? 'font-semibold text-white underline' : 'opacity-70'}
              >
                Sign in
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900/60 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={loading}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900/60 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-px bg-blue-300/40" />
            <span className="text-xs text-blue-100 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-blue-300/40" />
          </div>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="mt-4 w-full bg-black/80 hover:bg-black text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              By signing in, you agree to our{' '}
              <button className="text-blue-400 hover:text-blue-300 underline">
                Terms of Service
              </button>
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-white">
          <h3 className="text-white font-semibold mb-4 text-center">
            Why sign in?
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-gray-300">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Save and track your betting picks</span>
            </li>
            <li className="flex items-start gap-3 text-gray-300">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Access personalized analytics and insights</span>
            </li>
            <li className="flex items-start gap-3 text-gray-300">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Compete on team leaderboards</span>
            </li>
            <li className="flex items-start gap-3 text-gray-300">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">View detailed performance history</span>
            </li>
          </ul>
        </div>

        {/* Browse without login */}
        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Continue browsing without signing in →
          </button>
        </div>
      </div>
    </main>
  )
}