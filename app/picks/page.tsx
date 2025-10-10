'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ConfidenceBar from '@/components/ConfidenceBar'
import { UserPick, Game } from '@/lib/types'
import { Trash2, TrendingUp, DollarSign, Target } from 'lucide-react'

export default function PicksPage() {
  const [picks, setPicks] = useState<UserPick[]>([])
  const [games, setGames] = useState<Record<string, Game>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPicks()
  }, [])

  async function loadPicks() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('user_picks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (data) {
      setPicks(data)
      
      // Load game data for all picks that have game_ids
      const gameIds = data
        .map(pick => pick.picks?.game_id)
        .filter(Boolean)
      
      if (gameIds.length > 0) {
        const { data: gamesData } = await supabase
          .from('games')
          .select('*')
          .in('id', gameIds)
        
        if (gamesData) {
          const gamesMap: Record<string, Game> = {}
          gamesData.forEach(game => {
            gamesMap[game.id] = game
          })
          setGames(gamesMap)
        }
      }
    }
    setLoading(false)
  }

  async function deletePick(pickId: string) {
    const confirmed = confirm('Delete this pick?')
    if (!confirmed) return

    const { error } = await supabase
      .from('user_picks')
      .delete()
      .eq('id', pickId)

    if (error) {
      alert('Error deleting pick')
      console.error(error)
    } else {
      setPicks(picks.filter(p => p.id !== pickId))
    }
  }

  // Calculate portfolio stats
  const totalPicks = picks.length
  const avgEV = picks.reduce((sum, p) => sum + (p.analysis_snapshot?.ev_percentage || 0), 0) / totalPicks || 0
  const avgHitProb = picks.reduce((sum, p) => sum + (p.analysis_snapshot?.hit_probability || 0), 0) / totalPicks || 0
  const strongPicks = picks.filter(p => (p.analysis_snapshot?.recommendation_score || 0) >= 70).length

  if (loading) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <div className="text-center py-8">Loading picks...</div>
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">What You're Cookin'</h1>

      {picks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600 mb-2">No saved picks yet</p>
          <p className="text-sm text-gray-500">
            Go to Build and start adding bets!
          </p>
        </div>
      ) : (
        <>
          {/* Portfolio Summary */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 mb-6 text-white">
            <h2 className="text-lg font-bold mb-3">Portfolio Analysis</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/20 rounded p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target size={16} />
                  <p className="text-xs">Total Bets</p>
                </div>
                <p className="text-2xl font-bold">{totalPicks}</p>
              </div>
              <div className="bg-white/20 rounded p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp size={16} />
                  <p className="text-xs">Avg EV</p>
                </div>
                <p className="text-2xl font-bold">{avgEV.toFixed(1)}%</p>
              </div>
              <div className="bg-white/20 rounded p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign size={16} />
                  <p className="text-xs">Hit Prob</p>
                </div>
                <p className="text-2xl font-bold">{avgHitProb.toFixed(0)}%</p>
              </div>
            </div>
            {strongPicks > 0 && (
              <p className="text-sm text-center mt-3 bg-white/10 rounded py-2">
                 {strongPicks} Strong Play{strongPicks > 1 ? 's' : ''} (70+ Score)
              </p>
            )}
          </div>

          {/* Individual Picks */}
          <div className="space-y-4">
            {picks.map((pick) => {
              const analysis = pick.analysis_snapshot
              const score = analysis?.recommendation_score || 0
              const game = pick.picks?.game_id ? games[pick.picks.game_id] : null
              
              return (
                <div key={pick.id} className={`bg-white rounded-lg shadow-md border-2 overflow-hidden`}>
                  <div className="p-4 pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 mb-1">
                          {analysis?.selection || 'Bet'}
                        </p>
                        <div className="flex gap-2 text-xs mb-2">
                          <span className="text-white bg-gradient-to-r from-blue-600 to-blue-900 px-2 py-1 rounded">
                            {pick.picks?.sportsbook || 'N/A'}
                          </span>
                          <span className="text-white bg-gradient-to-r from-blue-600 to-blue-900 px-2 py-1 rounded">
                            {pick.picks?.odds > 0 ? '+' : ''}{pick.picks?.odds}
                          </span>
                        </div>
                        {game && (
                          <div className="text-xs text-gray-600">
                            <div className="font-semibold">{game.away_team} @ {game.home_team}</div>
                            <div className="flex gap-2 mt-1">
                              <span>
                                {new Date(game.game_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                              <span>•</span>
                              <span>
                                {new Date(game.game_date).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  timeZoneName: 'short'
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-2xl font-bold`}>
                          {score}
                        </span>
                        <button
                          onClick={() => deletePick(pick.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Delete pick"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
                      <div className="bg-white rounded p-2 text-center border border-gray-200">
                        <p className="text-xs text-gray-500">EV</p>
                        <p className={`font-bold ${analysis?.ev_percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {analysis?.ev_percentage > 0 ? '+' : ''}{analysis?.ev_percentage?.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-white rounded p-2 text-center border border-gray-200">
                        <p className="text-xs text-gray-500">Edge</p>
                        <p className={`font-bold ${analysis?.has_edge ? 'text-green-600' : 'text-gray-400'}`}>
                          {analysis?.has_edge ? '✓' : '✗'}
                        </p>
                      </div>
                      <div className="bg-white rounded p-2 text-center border border-gray-200">
                        <p className="text-xs text-gray-500">Hit %</p>
                        <p className="font-bold text-blue-600">
                          {analysis?.hit_probability?.toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    {analysis?.hit_probability && (
                      <div className="mb-3">
                        <ConfidenceBar confidence={Math.round(analysis.hit_probability)} />
                      </div>
                    )}

                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Ares Analysis:</p>
                      <p className="text-sm text-gray-800">{analysis?.reasoning}</p>
                    </div>

                    {analysis?.comparison_odds && analysis.comparison_odds.length > 1 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Odds Comparison:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {analysis.comparison_odds.slice(0, 4).map((odd: any, idx: number) => (
                            <div 
                              key={idx} 
                              className={`text-xs p-2 rounded border ${
                                odd.sportsbook === analysis.best_book 
                                  ? 'bg-green-50 border-green-300 font-semibold' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <span className="text-gray-600">{odd.sportsbook}:</span>{' '}
                              <span className="text-gray-900">
                                {odd.odds > 0 ? '+' : ''}{odd.odds}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-100 px-4 py-2 text-xs text-gray-500">
                    Pick added {new Date(pick.created_at).toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}