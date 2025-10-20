'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UserPick, Game, PlayerProp } from '@/lib/types'
import { Trash2 } from 'lucide-react'
import { getBookmakerDisplayName } from '@/lib/bookmakers'
import { analyzeBet, BetOption, AnalysisResult, BetType, BookmakerOdds } from '@/lib/analysis-engine'
import { transformGameToAnalysisFormat, transformPlayerPropsToAnalysisFormat, createBetOptionFromSelection } from '@/lib/supabase-adapter'
import AnalyzeConfirmationModal from '@/components/AnalyzeConfirmationModal'
import LineSelector from '@/components/LineSelector'
import ValueMeter from '@/components/ValueMeter'

interface AlternateLine {
  line: number
  over_odds: number | null
  under_odds: number | null
  sportsbook: string
  is_alternate: boolean
}

export default function PicksPage() {
  const router = useRouter()
  const [picks, setPicks] = useState<UserPick[]>([])
  const [games, setGames] = useState<Record<string, Game>>({})
  const [loading, setLoading] = useState(true)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [showLineSelector, setShowLineSelector] = useState(false)
  const [selectedPickForAnalysis, setSelectedPickForAnalysis] = useState<UserPick | null>(null)
  const [availableLines, setAvailableLines] = useState<AlternateLine[]>([])
  const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadPicks()
  }, [])

  async function loadPicks() {

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('user_picks')
      .select('*')
      .eq('status', 'pending')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) {
      setPicks(data)
      
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

    if (!error) {
      setPicks(picks.filter(p => p.id !== pickId))
    }
  }

  async function promptAnalysis(pick: UserPick) {
    setSelectedPickForAnalysis(pick)
    setShowAnalyzeModal(true)
  }

  async function promptAlternateLineAnalysis(pick: UserPick) {
    setSelectedPickForAnalysis(pick)
    
    const game = pick.picks?.game_id ? games[pick.picks.game_id] : null
    
    if (!game) {
      alert('Cannot analyze - game data not found')
      return
    }

    if (pick.picks.player && pick.picks.prop_type) {
      const { data: allLines } = await supabase
        .from('player_props')
        .select('*')
        .eq('game_id', game.id)
        .eq('player_name', pick.picks.player)
        .eq('prop_type', pick.picks.prop_type)
        .order('line', { ascending: true })

      if (allLines && allLines.length > 1) {
        const formattedLines: AlternateLine[] = allLines.map(line => ({
          line: line.line,
          over_odds: line.over_odds,
          under_odds: line.under_odds,
          sportsbook: line.sportsbook,
          is_alternate: (line as any).is_alternate || false
        }))
        setAvailableLines(formattedLines)
        setShowLineSelector(true)
        return
      } else {
        alert('No alternate lines available for this prop')
        return
      }
    } 
    
    const { data: oddsData } = await supabase
      .from('odds_data')
      .select('*')
      .eq('game_id', game.id)

    if (!oddsData || oddsData.length === 0) {
      alert('No odds data available')
      return
    }

    const selection = pick.picks.selection?.toLowerCase() || ''
    const isSpread = pick.picks.team && pick.picks.line && !selection.includes('over') && !selection.includes('under')
    const isTotal = selection.includes('over') || selection.includes('under')
    const isMoneyline = pick.picks.team && !pick.picks.line
    
    if (isMoneyline) {
      alert('Moneyline bets do not have alternate lines')
      return
    }
    
    const uniqueLinesMap = new Map<string, AlternateLine>()
    
    if (isSpread) {
      oddsData.forEach(odds => {
        if (odds.spread_home !== null && odds.spread_away !== null) {
          const isHome = pick.picks.team === game.home_team
          const line = isHome ? odds.spread_home : odds.spread_away
          const oddsValue = isHome ? odds.spread_home_odds : odds.spread_away_odds
          
          const absLine = Math.abs(line)
          const key = `${absLine}-${oddsValue}-${odds.sportsbook}`
          
          if (!uniqueLinesMap.has(key)) {
            uniqueLinesMap.set(key, {
              line: absLine,
              over_odds: line < 0 ? oddsValue : null,
              under_odds: line > 0 ? oddsValue : null,
              sportsbook: odds.sportsbook,
              is_alternate: odds.is_alternate || false
            })
          }
        }
      })
    } else if (isTotal) {
      oddsData.forEach(odds => {
        if (odds.total !== null && odds.over_odds !== null && odds.under_odds !== null) {
          const key = `${odds.total}-${odds.over_odds}-${odds.under_odds}-${odds.sportsbook}`
          
          if (!uniqueLinesMap.has(key)) {
            uniqueLinesMap.set(key, {
              line: odds.total,
              over_odds: odds.over_odds,
              under_odds: odds.under_odds,
              sportsbook: odds.sportsbook,
              is_alternate: odds.is_alternate || false
            })
          }
        }
      })
    }

    const uniqueLines = Array.from(uniqueLinesMap.values())
      .sort((a, b) => a.line - b.line)

    if (uniqueLines.length > 1) {
      setAvailableLines(uniqueLines)
      setShowLineSelector(true)
    } else {
      alert('No alternate lines available')
    }
  }

  function handleLineSelected(selectedLine: number, selectedOdds: number) {
    setShowLineSelector(false)
    
    if (selectedPickForAnalysis) {
      const updatedPick = {
        ...selectedPickForAnalysis,
        picks: {
          ...selectedPickForAnalysis.picks,
          line: selectedLine,
          odds: selectedOdds
        }
      }
      setSelectedPickForAnalysis(updatedPick)
    }
    
    setShowAnalyzeModal(true)
  }

  async function runAnalysis() {
    if (!selectedPickForAnalysis) return

    const pick = selectedPickForAnalysis
    const game = pick.picks?.game_id ? games[pick.picks.game_id] : null

    if (!game) {
      alert('Cannot analyze - game data not found')
      return
    }

    let transformed: { bookmakers: BookmakerOdds[] }
    let betOption: BetOption

    if (pick.picks.player) {
      const { data: playerPropsData } = await supabase
        .from('player_props')
        .select('*')
        .eq('game_id', game.id)

      if (!playerPropsData || playerPropsData.length === 0) {
        alert('No player props data available for analysis')
        return
      }

      const bookmakers = transformPlayerPropsToAnalysisFormat(game, playerPropsData)
      transformed = { bookmakers }
      
    } else {
      const { data: oddsData } = await supabase
        .from('odds_data')
        .select('*')
        .eq('game_id', game.id)

      if (!oddsData || oddsData.length === 0) {
        alert('No odds data available for analysis')
        return
      }

      transformed = transformGameToAnalysisFormat(game, oddsData)
    }

    betOption = createBetOptionFromSelection(pick.picks, game)

    const analysis = analyzeBet(betOption, transformed.bookmakers)

    const currentSnapshot = pick.analysis_snapshot || {}
    const existingHistory = currentSnapshot.history || []
    
    const newAnalysisEntry = {
      timestamp: new Date().toISOString(),
      analyzedLine: pick.picks.line,
      analyzedOdds: pick.picks.odds,
      ...analysis
    }

    const { error } = await supabase
      .from('user_picks')
      .update({
        analysis_snapshot: {
          ...newAnalysisEntry,
          history: [...existingHistory, newAnalysisEntry]
        }
      })
      .eq('id', pick.id)

    if (!error) {
      setShowAnalyzeModal(false)
      setSelectedPickForAnalysis(null)
      loadPicks()
    } else {
      alert('Error saving analysis: ' + error.message)
    }
  }

  function toggleAnalysisHistory(pickId: string) {
    setExpandedAnalyses(prev => ({
      ...prev,
      [pickId]: !prev[pickId]
    }))
  }

  async function deleteAllPicks() {
    const confirmed = confirm('Delete all pending picks? This cannot be undone.')
    if (!confirmed) return

    const pickIds = picks.map(p => p.id)

    const { error } = await supabase
      .from('user_picks')
      .delete()
      .in('id', pickIds)

    if (!error) {
      setPicks([])
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-4">
        <p className="text-center text-gray-500">Loading picks...</p>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Your Picks</h1>
        {picks.length > 0 && (
          <button
            onClick={deleteAllPicks}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Clear All
          </button>
        )}
      </div>

      {picks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-4">No pending picks</p>
          <p className="text-gray-500 text-sm">
            Head to the Build page to create some picks!
          </p>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-lg p-6 mb-6 text-white">
            <h2 className="text-xl font-bold mb-2">Your Active Bets</h2>
            <div className="flex gap-4">
              <div>
                <p className="text-3xl font-bold">{picks.length}</p>
                <p className="text-sm opacity-90">Total Picks</p>
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {picks.filter(p => (p.analysis_snapshot?.confidence || 0) >= 70).length}
                </p>
                <p className="text-sm opacity-90">High Confidence (70+ Score)</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {picks.map((pick) => {
              const analysis = pick.analysis_snapshot
              const game = pick.picks?.game_id ? games[pick.picks.game_id] : null
              
              return (
                <div key={pick.id} className="bg-white rounded-lg shadow-md border-2 overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 mb-1">
                          {pick.picks?.player 
                            ? `${pick.picks.player}`
                            : `${pick.picks?.team || pick.picks?.selection}`
                          }
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                          {pick.picks?.player 
                            ? `${pick.picks.selection} ${pick.picks.line} ${pick.picks.prop_type}`
                            : `${pick.picks?.selection} ${pick.picks?.line || ''}`
                          }
                        </p>

                        <div className="flex gap-2 mb-3">
                          <span className="text-white bg-gradient-to-r from-blue-600 to-blue-900 px-3 py-1 rounded text-sm font-bold">
                            {pick.picks?.odds > 0 ? '+' : ''}{pick.picks?.odds}
                          </span>
                          <span className="text-gray-700 bg-gray-100 px-3 py-1 rounded text-sm font-semibold">
                            {getBookmakerDisplayName(pick.picks?.sportsbook || 'N/A')}
                          </span>
                        </div>

                        {game && (
                          <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                            <div className="font-semibold mb-1">{game.away_team} @ {game.home_team}</div>
                            <div className="flex gap-2">
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

                      <button
                        onClick={() => deletePick(pick.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-2"
                        title="Delete pick"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>

                  {analysis ? (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">
                            Latest Analysis: {new Date(analysis.timestamp).toLocaleString()}
                          </span>
                          {analysis.history && analysis.history.length > 1 && (
                            <button
                              onClick={() => toggleAnalysisHistory(pick.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              {expandedAnalyses[pick.id] ? '▼' : '▶'} View History ({analysis.history.length})
                            </button>
                          )}
                        </div>

                        {analysis.analyzedLine && (
                          <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mb-2 inline-block">
                            Analyzed at line: {analysis.analyzedLine} ({analysis.analyzedOdds > 0 ? '+' : ''}{analysis.analyzedOdds})
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-white rounded p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-500">EV</p>
                            <p className={`font-bold ${(analysis.expectedValue ?? 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {analysis.expectedValue !== undefined && analysis.expectedValue !== null 
                                ? `${analysis.expectedValue > 0 ? '+' : ''}${analysis.expectedValue.toFixed(1)}%` 
                                : '0.0%'}
                            </p>
                          </div>
                          <div className="bg-white rounded p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-500">Edge</p>
                            <p className={`font-bold ${(analysis.edge ?? 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {analysis.edge !== undefined && analysis.edge !== null 
                                ? `${analysis.edge > 0 ? '+' : ''}${analysis.edge.toFixed(1)}%` 
                                : '0.0%'}
                            </p>
                          </div>
                          <div className="bg-white rounded p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-500">Confidence</p>
                            <p className="font-bold text-gray-900">
                              {analysis.confidence ?? 0}%
                            </p>
                          </div>
                        </div>

                        {/* VALUE METER - REPLACES "NO EDGE" BADGE */}
                        <ValueMeter edge={analysis.edge ?? 0} />

                        {analysis.bestSportsbook && analysis.bestOdds && (
                          <div className="text-xs text-gray-600 mb-2">
                            <p className="font-semibold">Best available:</p>
                            <p>{analysis.bestOdds > 0 ? '+' : ''}{analysis.bestOdds} @ {getBookmakerDisplayName(analysis.bestSportsbook)}</p>
                          </div>
                        )}

                        {analysis.reasons && analysis.reasons.length > 0 && (
                          <div className="text-xs text-gray-700 bg-blue-50 rounded p-2 mb-2">
                            <p className="font-semibold mb-1">Why this pick:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {analysis.reasons.map((reason: string, i: number) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {analysis.warnings && analysis.warnings.length > 0 && (
                          <div className="text-xs text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
                            <p className="font-semibold mb-1">ℹ️ Analysis Notes:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {analysis.warnings.map((warning: string, i: number) => (
                                <li key={i}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {expandedAnalyses[pick.id] && analysis.history && analysis.history.length > 1 && (
                        <div className="border-t border-gray-300 pt-3 mt-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Previous Analyses:</p>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {analysis.history.slice(0, -1).reverse().map((oldAnalysis: any, idx: number) => (
                              <div key={idx} className="bg-white rounded p-3 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-2">
                                  {new Date(oldAnalysis.timestamp).toLocaleString()}
                                </p>
                                
                                {oldAnalysis.analyzedLine && (
                                  <div className="text-xs text-blue-600 mb-2">
                                    Line: {oldAnalysis.analyzedLine} ({oldAnalysis.analyzedOdds > 0 ? '+' : ''}{oldAnalysis.analyzedOdds})
                                  </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 mb-2">
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">EV</p>
                                    <p className={`text-sm font-bold ${(oldAnalysis.expectedValue ?? 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {oldAnalysis.expectedValue !== undefined && oldAnalysis.expectedValue !== null 
                                        ? `${oldAnalysis.expectedValue > 0 ? '+' : ''}${oldAnalysis.expectedValue.toFixed(1)}%` 
                                        : '0.0%'}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">Edge</p>
                                    <p className={`text-sm font-bold ${(oldAnalysis.edge ?? 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                      {oldAnalysis.edge !== undefined && oldAnalysis.edge !== null 
                                        ? `${oldAnalysis.edge > 0 ? '+' : ''}${oldAnalysis.edge.toFixed(1)}%` 
                                        : '0.0%'}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">Conf</p>
                                    <p className="text-sm font-bold text-gray-900">
                                      {oldAnalysis.confidence ?? 0}%
                                    </p>
                                  </div>
                                </div>

                                {oldAnalysis.bestOdds && (
                                  <p className="text-xs text-gray-600 mt-2">
                                    Best: {oldAnalysis.bestOdds > 0 ? '+' : ''}{oldAnalysis.bestOdds} @ {getBookmakerDisplayName(oldAnalysis.bestSportsbook)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 mt-3">
                        <button
                          onClick={() => promptAnalysis(pick)}
                          className="w-full bg-[#2d2d2d] text-white font-semibold py-3 rounded-lg hover:bg-[#3d3d3d] transition-colors text-sm border border-gray-700"
                        >
                          Re-analyze with Current Odds
                        </button>
                        <button
                          onClick={() => promptAlternateLineAnalysis(pick)}
                          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Analyze Alternate Line
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="space-y-2">
                        <button
                          onClick={() => promptAnalysis(pick)}
                          className="w-full bg-[#2d2d2d] text-white font-semibold py-3 rounded-lg hover:bg-[#3d3d3d] transition-colors text-sm border border-gray-700"
                        >
                          Analyze This Pick
                        </button>
                        <button
                          onClick={() => promptAlternateLineAnalysis(pick)}
                          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Analyze Alternate Line
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-100 px-4 py-2 text-xs text-gray-500">
                    Saved {new Date(pick.created_at).toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {showLineSelector && selectedPickForAnalysis && (
        <LineSelector
          playerName={selectedPickForAnalysis.picks.player}
          propType={selectedPickForAnalysis.picks.prop_type || selectedPickForAnalysis.picks.selection || 'Game Line'}
          selection={
            selectedPickForAnalysis.picks.player 
              ? (selectedPickForAnalysis.picks.selection as 'over' | 'under')
              : selectedPickForAnalysis.picks.selection?.toLowerCase().includes('over') 
                ? 'over' as const
                : selectedPickForAnalysis.picks.selection?.toLowerCase().includes('under')
                  ? 'under' as const
                  : 'spread' as const
          }
          currentLine={selectedPickForAnalysis.picks.line || 0}
          availableLines={availableLines}
          onSelectLine={handleLineSelected}
          onClose={() => {
            setShowLineSelector(false)
            setSelectedPickForAnalysis(null)
          }}
        />
      )}

      {selectedPickForAnalysis && (
        <AnalyzeConfirmationModal
          isOpen={showAnalyzeModal}
          onClose={() => {
            setShowAnalyzeModal(false)
            setSelectedPickForAnalysis(null)
          }}
          onConfirm={runAnalysis}
          betDetails={selectedPickForAnalysis.picks}
        />
      )}
    </main>
  )
}