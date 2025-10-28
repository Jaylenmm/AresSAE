'use client'

import { useState } from 'react'
import { Shield } from 'lucide-react'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_SLIP_READER_PASSWORD || 'ares2024'

export default function SlipReaderPage() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('Invalid password')
      setPassword('')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-2xl p-8 border border-blue-500/30">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-full">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white text-center mb-4">
            Slip Reader
          </h1>

          {/* Description */}
          <div className="bg-gray-900/50 rounded-lg p-4 mb-6 border border-gray-700">
            <p className="text-gray-300 text-center mb-3">
              Slip Reader will allow you to screenshot your betslip and receive quick analysis so you don't have to keep waiting on your buddies in the group chat.
            </p>
            <p className="text-blue-400 text-center font-semibold">
              Slip Reader coming soon.
            </p>
          </div>

          {/* Admin Access */}
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm">Admin access only</p>
          </div>

          {/* Password Form */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Authenticated view
  return <SlipReaderInterface />
}

function SlipReaderInterface() {
  const [image, setImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setImage(base64)
      setResults(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUpload(e)
  }

  const analyzeSlip = async () => {
    if (!image) return

    setAnalyzing(true)
    setError(null)

    try {
      // Remove data URL prefix for API
      const base64Image = image.split(',')[1]

      const response = await fetch('/api/analyze-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      })

      const data = await response.json()

      if (!response.ok) {
        // Show debug info in error
        const errorMsg = data.error || 'Failed to analyze slip'
        const debugInfo = data.ocrText ? `\n\nExtracted text:\n${data.ocrText}` : ''
        throw new Error(errorMsg + debugInfo)
      }

      setResults(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const reset = () => {
    setImage(null)
    setResults(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Slip Reader</h1>

        {!image && !results && (
          <div className="bg-gray-800 rounded-lg p-8 border border-blue-500/30">
            <div className="text-center mb-6">
              <p className="text-gray-300 mb-4">
                Upload a screenshot of your bet slip to get instant analysis
              </p>
            </div>

            {/* Upload Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Camera Capture */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <div className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-center">
                  📷 Take Photo
                </div>
              </label>

              {/* File Upload */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-center">
                  📁 Upload Image
                </div>
              </label>
            </div>
          </div>
        )}

        {image && !results && (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="bg-gray-800 rounded-lg p-4 border border-blue-500/30">
              <img
                src={image}
                alt="Bet slip"
                className="w-full max-h-96 object-contain rounded"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={reset}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={analyzeSlip}
                disabled={analyzing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {analyzing ? 'Analyzing...' : 'Analyze Slip'}
              </button>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
                <p className="text-red-400 whitespace-pre-wrap">{error}</p>
              </div>
            )}
          </div>
        )}

        {results && (
          <div className="space-y-4">
            {/* Results Header */}
            <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/30">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {results.isParlay ? 'Parlay Analysis' : 'Straight Bet Analysis'}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {results.betsMatched} of {results.betsFound} bets matched
                  </p>
                  {results.parsingMethod && (
                    <p className="text-gray-500 text-xs mt-1">
                      Method: {results.parsingMethod}
                    </p>
                  )}
                </div>
                <button
                  onClick={reset}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  New Slip
                </button>
              </div>

              {/* Debug: Show OCR Text */}
              {results.ocrText && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                    🔍 Show extracted text (debug)
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-40">
                    {results.ocrText}
                  </pre>
                </details>
              )}
            </div>

            {/* Bet Results */}
            {results.results.map((result: any, idx: number) => (
              <div
                key={idx}
                className="bg-gray-800 rounded-lg p-6 border border-blue-500/30"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-2">
                    Bet #{idx + 1}
                  </h3>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>Type: {result.bet.type}</p>
                    {result.bet.player && <p>Player: {result.bet.dbPlayer || result.bet.player}</p>}
                    {result.bet.team1 && <p>Teams: {result.bet.dbTeam1 || result.bet.team1} vs {result.bet.dbTeam2 || result.bet.team2}</p>}
                    {result.bet.line && <p>Line: {result.bet.line}</p>}
                    <p>Odds: {result.bet.odds > 0 ? '+' : ''}{result.bet.odds}</p>
                    <p>Match Confidence: {(result.bet.matchConfidence * 100).toFixed(0)}%</p>
                  </div>
                </div>

                {result.analysis ? (
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        result.analysis.recommendation === 'strong_bet' ? 'bg-green-600' :
                        result.analysis.recommendation === 'bet' ? 'bg-blue-600' :
                        result.analysis.recommendation === 'consider' ? 'bg-yellow-600' :
                        'bg-red-600'
                      }`}>
                        {result.analysis.recommendation.toUpperCase().replace('_', ' ')}
                      </span>
                      <span className="text-white font-bold">
                        {result.analysis.confidence}% Confidence
                      </span>
                    </div>

                    {result.analysis.edge > 0 && (
                      <p className="text-green-400 mb-2">
                        Edge: +{(result.analysis.edge * 100).toFixed(1)}%
                      </p>
                    )}

                    {result.analysis.reasons.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-semibold text-green-400 mb-1">Why:</p>
                        <ul className="text-sm text-gray-300 space-y-1">
                          {result.analysis.reasons.map((reason: string, i: number) => (
                            <li key={i}>✓ {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.analysis.warnings.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-yellow-400 mb-1">Warnings:</p>
                        <ul className="text-sm text-gray-300 space-y-1">
                          {result.analysis.warnings.map((warning: string, i: number) => (
                            <li key={i}>⚠ {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
                    <p className="text-red-400">{result.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
