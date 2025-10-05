'use client'

import { useState } from 'react'

const ADMIN_PASSWORD = 'aresJay' // Change this to whatever you want

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
    } else {
      alert('Incorrect password')
    }
  }

  async function collectData(sport: string) {
    setLoading(true)
    setResult('Collecting data...')
    
    try {
      const response = await fetch('/api/collect-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport })
      })
      
      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult('Error: ' + String(error))
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="max-w-md mx-auto p-4 flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700"
            >
              Login
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Admin - Data Collection</h1>
      
      <div className="space-y-3 mb-6">
        <button
          onClick={() => collectData('NFL')}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          Collect NFL Data
        </button>
        
        <button
          onClick={() => collectData('NBA')}
          disabled={loading}
          className="w-full bg-orange-600 text-white font-semibold py-3 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
        >
          Collect NBA Data
        </button>
        
        <button
          onClick={() => collectData('MLB')}
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          Collect MLB Data
        </button>
        
        <button
          onClick={() => collectData('CFB')}
          disabled={loading}
          className="w-full bg-purple-600 text-white font-semibold py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
        >
          Collect CFB Data
        </button>
      </div>

      {result && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
          <pre className="text-xs whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </main>
  )
}