'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UserPick, Game, PlayerProp } from '@/lib/types'
import { Trash2 } from 'lucide-react'
import { getBookmakerDisplayName } from '@/lib/bookmakers'
import { analyzeBet, BetOption, AnalysisResult, BetType, BookmakerOdds } from '@/lib/analysis-engine'
import { updateAnalysisState, AnalysisItem, AnalysisState } from '@/components/AnalysisStatusBar'
import { transformGameToAnalysisFormat, transformPlayerPropsToAnalysisFormat, createBetOptionFromSelection } from '@/lib/supabase-adapter'
import AnalyzeConfirmationModal from '@/components/AnalyzeConfirmationModal'
import LineSelector from '@/components/LineSelector'
import ValueMeter from '@/components/ValueMeter'
import LegalFooter from '@/components/LegalFooter'

interface AlternateLine {
  line: number
  over_odds: number | null
  under_odds: number | null
  sportsbook: string
  is_alternate: boolean
}

function PicksPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [picks, setPicks] = useState<UserPick[]>([])
  const [games, setGames] = useState<Record<string, Game>>({})
  const [loading, setLoading] = useState(true)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [showLineSelector, setShowLineSelector] = useState(false)
  const [selectedPickForAnalysis, setSelectedPickForAnalysis] = useState<UserPick | null>(null)
  const [availableLines, setAvailableLines] = useState<AlternateLine[]>([])
  const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({})
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'running' | 'completed'>('idle')
  const [completedAnalyses, setCompletedAnalyses] = useState(0)
  const pickRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const autoAnalyzedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    loadPicks()
  }, [])

  // If a focus_pick query param is present, scroll that pick into view
  useEffect(() => {
    const focusPickId = searchParams.get('focus_pick')
    if (focusPickId && pickRefs.current[focusPickId]) {
      setTimeout(() => {
        const el = pickRefs.current[focusPickId]
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [searchParams, picks])

  // If auto_analyze=1 is present, automatically run analysis for the focused pick
  useEffect(() => {
    const focusPickId = searchParams.get('focus_pick')
    const autoAnalyze = searchParams.get('auto_analyze') === '1'

    if (!autoAnalyze || !focusPickId || picks.length === 0) return

    if (autoAnalyzedRef.current.has(focusPickId)) return

    const targetPick = picks.find(p => String(p.id) === focusPickId)
    if (!targetPick) return

    autoAnalyzedRef.current.add(focusPickId)
    setSelectedPickForAnalysis(targetPick)
    // Run analysis without showing the confirmation modal
    ;(async () => {
      await runAnalysis()
    })()
  }, [searchParams, picks])

  async function loadPicks() {

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?redirect=/picks')
      return
    }

    console.log('Loading picks for user:', user.id)

    const { data, error } = await supabase
      .from('user_picks')
      .select('*')
      .eq('status', 'pending')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    console.log('Picks query result - data:', data, 'error:', error)
    
    if (data) {
      console.log('Setting picks:', data.length, 'picks found')
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

      // Keep global analysis activity in sync with current pending picks
      // Seed the analysis bar with all saved picks so they are always visible there
      const itemsFromPicks: AnalysisItem[] = data.map(pick => {
        const hasAnalysis = !!pick.analysis_snapshot
        const analyzedAt = hasAnalysis ? pick.analysis_snapshot.timestamp : undefined

        const description = pick.picks?.player
          ? `${pick.picks.player} ${pick.picks.selection} ${pick.picks.line} ${pick.picks.prop_type || ''}`
          : `${pick.picks?.selection || ''} ${pick.picks?.line || ''}`

        return {
          pickId: pick.id,
          description,
          status: hasAnalysis ? 'completed' : 'pending',
          analyzedAt,
        }
      })

      updateAnalysisState(() => {
        const anyRunning = itemsFromPicks.some(i => i.status === 'running')
        const anyCompleted = itemsFromPicks.some(i => i.status === 'completed')

        const nextStatus: AnalysisState['status'] =
          itemsFromPicks.length === 0
            ? 'idle'
            : anyRunning
              ? 'running'
              : anyCompleted
                ? 'completed'
                : 'idle'

        return {
          status: nextStatus,
          items: itemsFromPicks,
        }
      })
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

      // Remove this pick from global analysis activity
      updateAnalysisState(prev => {
        const remaining = prev.items.filter(item => item.pickId !== pickId)
        const nextStatus: typeof prev.status =
          remaining.some(i => i.status === 'running')
            ? 'running'
            : remaining.length > 0
              ? 'completed'
              : 'idle'
        return {
          status: nextStatus,
          items: remaining,
        }
      })
    }
  }

  async function toggleOverUnder(pick: UserPick) {
    const selection = pick.picks?.selection || ''
    const lower = selection.toLowerCase()

    let newSelection: string | null = null
    if (lower === 'over') newSelection = 'under'
    else if (lower === 'under') newSelection = 'over'

    if (!newSelection) {
      alert('This pick is not an over/under selection.')
      return
    }

    let updatedPicks = {
      ...pick.picks,
      selection: newSelection,
    }

    // If this is a player prop with a known game, try to pull the opposite-side odds
    const gameId = pick.picks?.game_id
    const playerName = pick.picks?.player
    const propType = pick.picks?.prop_type
    const line = pick.picks?.line
    const sportsbook = pick.picks?.sportsbook

    if (gameId && playerName && propType && typeof line === 'number' && sportsbook) {
      const { data: propsRow, error: propsError } = await supabase
        .from('player_props_v2')
        .select('over_odds, under_odds')
        .eq('game_id', gameId)
        .eq('player_name', playerName)
        .eq('prop_type', propType)
        .eq('line', line)
        .eq('sportsbook', sportsbook)
        .eq('is_alternate', false)
        .maybeSingle()

      if (!propsError && propsRow) {
        const oppositeOdds = newSelection === 'over' ? propsRow.over_odds : propsRow.under_odds
        if (typeof oppositeOdds === 'number') {
          updatedPicks = {
            ...updatedPicks,
            odds: oppositeOdds,
          }
        }
      }
    }

    const { error } = await supabase
      .from('user_picks')
      .update({ picks: updatedPicks, analysis_snapshot: null })
      .eq('id', pick.id)

    if (error) {
      alert('Error updating pick: ' + error.message)
      return
    }

    // Update local state
    setPicks(prev => prev.map(p =>
      p.id === pick.id
        ? { ...p, picks: updatedPicks, analysis_snapshot: null }
        : p
    ))

    // Keep analysis bar description roughly in sync
    updateAnalysisState(prev => {
      const items = prev.items.map(item => {
        if (item.pickId !== pick.id) return item

        const desc = pick.picks?.player
          ? `${pick.picks.player} ${newSelection} ${pick.picks.line} ${pick.picks.prop_type || ''}`
          : `${newSelection.toUpperCase()} ${pick.picks?.line || ''}`

        return {
          ...item,
          description: desc,
        }
      })

      const nextStatus: typeof prev.status =
        items.some(i => i.status === 'running')
          ? 'running'
          : items.length > 0
            ? 'completed'
            : 'idle'

      return {
        status: nextStatus,
        items,
      }
    })
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
      const params = new URLSearchParams()
      params.set('game_ids', game.id)
      params.set('limit', '200')
      params.set('strict', '1')
      const resp = await fetch(`/api/featured-props?${params.toString()}`)
      const json = await resp.json().catch(() => ({ props: [] }))
      const allLines = Array.isArray(json?.props) ? (json.props as PlayerProp[]) : []
      const filtered = allLines
        .filter(l => l.player_name === pick.picks.player && l.prop_type === pick.picks.prop_type)
        .sort((a, b) => a.line - b.line)

      if (filtered.length > 1) {
        const formattedLines: AlternateLine[] = filtered.map(line => ({
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
      .from('odds_data_v2')
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

  async function runAnalysisForPick(pick: UserPick) {
    // Show analyzing status bar
    setAnalysisLoading(true)
    setAnalysisStatus('running')
    setShowAnalyzeModal(false)

    // Register this analysis job globally so it appears in the status bar
    updateAnalysisState(prev => {
      const description = pick.picks?.player
        ? `${pick.picks.player} ${pick.picks.selection} ${pick.picks.line} ${pick.picks.prop_type || ''}`
        : `${pick.picks?.selection} ${pick.picks?.line || ''}`

      const filtered: AnalysisItem[] = prev.items.filter(i => i.pickId !== pick.id)
      return {
        status: 'running',
        items: [
          { pickId: pick.id, description, status: 'running' as const },
          ...filtered,
        ] as AnalysisItem[],
      }
    })

    const game = pick.picks?.game_id ? games[pick.picks.game_id] : null

    if (!game) {
      alert('Cannot analyze - game data not found')
      setAnalysisLoading(false)
      setAnalysisStatus('idle')
      return
    }

    let transformed: { bookmakers: BookmakerOdds[] }
    let betOption: BetOption

    if (pick.picks.player) {
      const params = new URLSearchParams()
      params.set('game_ids', game.id)
      params.set('limit', '200')
      params.set('strict', '1')
      const resp = await fetch(`/api/featured-props?${params.toString()}`)
      const json = await resp.json().catch(() => ({ props: [] }))
      const playerPropsData = Array.isArray(json?.props) ? (json.props as PlayerProp[]) : []

      if (!playerPropsData || playerPropsData.length === 0) {
        alert('No player props data available for analysis')
        setAnalysisLoading(false)
        setAnalysisStatus('idle')
        return
      }

      const bookmakers = transformPlayerPropsToAnalysisFormat(game, playerPropsData)
      transformed = { bookmakers }
      
    } else {
      const { data: oddsData } = await supabase
        .from('odds_data_v2')
        .select('*')
        .eq('game_id', game.id)

      if (!oddsData || oddsData.length === 0) {
        alert('No odds data available for analysis')
        setAnalysisLoading(false)
        setAnalysisStatus('idle')
        return
      }

      transformed = transformGameToAnalysisFormat(game, oddsData)
    }

    betOption = createBetOptionFromSelection(pick.picks, game)

    // Guard against extremely long analysis by adding a timeout
    const ANALYSIS_TIMEOUT_MS = 20000

    let analysis: AnalysisResult
    try {
      const analysisPromise = analyzeBet(betOption, transformed.bookmakers)
      const timeoutPromise = new Promise<AnalysisResult>((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timed out')), ANALYSIS_TIMEOUT_MS)
      })

      analysis = await Promise.race([analysisPromise, timeoutPromise]) as AnalysisResult
    } catch (error: any) {
      console.error('Error during analysis:', error)
      alert('Analysis took too long or failed. Please try again in a moment.')
      setAnalysisLoading(false)
      setAnalysisStatus('idle')
      return
    }

    const currentSnapshot = pick.analysis_snapshot || {}
    const existingHistory = currentSnapshot.history || []

    // Generate natural-language summary for "Ares thinks:" via server API (Claude), if configured
    let reasoning: string | null = null
    try {
      const desc = pick.picks?.player
        ? `${pick.picks.player} ${pick.picks.selection} ${pick.picks.line} ${pick.picks.prop_type || ''}`
        : `${pick.picks?.team || ''} ${pick.picks?.selection || ''} ${pick.picks?.line ?? ''}`

      console.log('📡 Calling /api/ares-summary for pick', pick.id, 'with desc:', desc)

      const summaryResp = await fetch('/api/ares-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          context: {
            description: desc.trim(),
            sport: pick.picks?.sport,
          },
        }),
      })

      console.log('📡 /api/ares-summary response', summaryResp.status)

      const json = await summaryResp
        .json()
        .catch(() => null)

      if (!summaryResp.ok) {
        console.error('❌ /api/ares-summary non-OK response:', summaryResp.status, json)
      } else {
        console.log('✅ /api/ares-summary OK payload:', json)
        if (json) {
          console.log('🔑 /api/ares-summary hasKey:', json.hasKey)
        }
      }

      if (json && typeof json.summary === 'string' && json.summary.trim().length > 0) {
        reasoning = json.summary.trim()
      }
    } catch (err) {
      console.error('Error generating Ares summary via API:', err)
    }

    const newAnalysisEntry = {
      timestamp: new Date().toISOString(),
      analyzedLine: pick.picks.line,
      analyzedOdds: pick.picks.odds,
      ...(reasoning ? { reasoning } : {}),
      ...analysis,
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
      setSelectedPickForAnalysis(null)
      loadPicks()
      setCompletedAnalyses(prev => prev + 1)
      setAnalysisStatus('completed')

      // Mark this analysis job as completed
      updateAnalysisState(prev => {
        const updated: AnalysisItem[] = prev.items.map(item =>
          item.pickId === pick.id
            ? { ...item, status: 'completed' as const, analyzedAt: new Date().toISOString() }
            : item
        )

        const anyRunning = updated.some(i => i.status === 'running')
        return {
          status: anyRunning ? 'running' : 'completed',
          items: updated,
        }
      })
    } else {
      alert('Error saving analysis: ' + error.message)
      setAnalysisStatus('idle')
    }

    setAnalysisLoading(false)
  }

  async function runAnalysis() {
    if (!selectedPickForAnalysis) return
    await runAnalysisForPick(selectedPickForAnalysis)
  }

  async function analyzeAtBestOdds(pick: UserPick) {
    const analysis = pick.analysis_snapshot
    if (!analysis || !analysis.bestOdds || !analysis.bestSportsbook) {
      alert('Best odds not available for this pick yet. Try running an analysis first.')
      return
    }

    const pickWithBest = {
      ...pick,
      picks: {
        ...pick.picks,
        odds: analysis.bestOdds,
        sportsbook: analysis.bestSportsbook,
      },
    } as UserPick

    await runAnalysisForPick(pickWithBest)
  }

  async function analyzeAtUserOdds(pick: UserPick) {
    // Re-run analysis using the user's currently saved odds/book
    await runAnalysisForPick(pick)
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

      // Clear all analysis activity when all picks are deleted
      updateAnalysisState(() => ({ status: 'idle', items: [] }))
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="max-w-4xl mx-auto p-4">
          <p className="text-center text-gray-500">Loading picks...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-4xl mx-auto p-4 pb-24">
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
          <div className="bg-gradient-to-br from-blue-900 to-blue rounded-lg p-6 mb-6 text-white">
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
                <div
                  key={pick.id}
                  ref={el => { pickRefs.current[pick.id] = el }}
                  className="bg-gray-900 rounded-xl shadow-2xl border border-white/10 overflow-hidden backdrop-blur-sm"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {game && (
                          <div className="text-xs text-gray-300">
                            <div className="font-semibold mb-1 text-white">{game.away_team} @ {game.home_team}</div>
                            <div className="flex gap-2 text-gray-400">
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

                        <p 
                          className="font-bold text-white text-lg mb-1 cursor-pointer hover:text-blue-400 transition-colors"
                          onClick={() => {
                            if (game) {
                              const player = pick.picks?.player
                              const qs = player ? `&player=${encodeURIComponent(player)}` : ''
                              router.push(`/build?game_id=${game.id}${qs}`)
                            }
                          }}
                        >
                          {pick.picks?.player 
                            ? `${pick.picks.player}`
                            : `${pick.picks?.team || pick.picks?.selection}`
                          }
                        </p>
                        <p className="text-sm text-gray-400 mb-3">
                          {pick.picks?.player 
                            ? `${pick.picks.selection} ${pick.picks.line} ${pick.picks.prop_type}`
                            : `${pick.picks?.selection} ${pick.picks?.line || ''}`
                          }
                        </p>

                        <div className="flex gap-2 mb-3">
                          <span className="text-white bg-gradient-to-r from-blue-900 to-blue-400 px-3 py-1.5 rounded-lg text-sm shadow-lg">
                            {pick.picks?.odds > 0 ? '+' : ''}{pick.picks?.odds}
                          </span>
                          <span className="text-white bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-semibold border border-white/20">
                            {getBookmakerDisplayName(pick.picks?.sportsbook || 'N/A')}
                          </span>
                        </div>
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
                    <div className="border-t border-white/10 p-4 bg-black/30 backdrop-blur-sm">
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400">
                            Latest Analysis: {new Date(analysis.timestamp).toLocaleString()}
                          </span>
                          {analysis.history && analysis.history.length > 1 && (
                            <button
                              onClick={() => toggleAnalysisHistory(pick.id)}
                              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                            >
                              {expandedAnalyses[pick.id] ? '▼' : '▶'} View History ({analysis.history.length})
                            </button>
                          )}
                        </div>

                        {analysis.analyzedLine && (
                          <div className="text-xs text-blue-400 bg-blue-500/20 backdrop-blur-sm rounded-lg px-3 py-1.5 mb-2 inline-block border border-blue-500/30">
                            Analyzed at line: {analysis.analyzedLine} ({analysis.analyzedOdds > 0 ? '+' : ''}{analysis.analyzedOdds})
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 text-center border border-white/10">
                            <p className="text-xs text-gray-200">EV ($/1)</p>
                            <p className={`font-bold ${((analysis.expectedValue ?? 0) / 100) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {analysis.expectedValue !== undefined && analysis.expectedValue !== null 
                                ? `${(((analysis.expectedValue) / 100) > 0 ? '+' : '')}$${((analysis.expectedValue) / 100).toFixed(2)}` 
                                : '$0.00'}
                            </p>
                          </div>
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 text-center border border-white/10">
                            <p className="text-xs text-gray-200">Edge</p>
                            <p className={`font-bold ${(analysis.edge ?? 0) > 0 ? 'text-green-400' : 'text-gray-200'}`}>
                              {analysis.edge !== undefined && analysis.edge !== null 
                                ? `${analysis.edge > 0 ? '+' : ''}${analysis.edge}%` 
                                : '0%'}
                            </p>
                          </div>
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 text-center border border-white/10">
                            <p className="text-xs text-gray-200">Confidence</p>
                            <p className="font-bold text-white">
                              {analysis.confidence ?? 0}%
                            </p>
                          </div>
                        </div>

                        {/* VALUE METER - REPLACES "NO EDGE" BADGE */}
                        <ValueMeter edge={analysis.edge ?? 0} />

                        {analysis.bestSportsbook && analysis.bestOdds && (
                          <div className="text-xs text-gray-300 mb-3 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold">Best in market:</p>
                                <p>{analysis.bestOdds > 0 ? '+' : ''}{analysis.bestOdds} @ {getBookmakerDisplayName(analysis.bestSportsbook)}</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              Analyzed at best odds in the market. Select your odds to see if you're getting value.
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <label className="text-[11px] text-gray-400">Shop odds:</label>
                              <select
                                className="bg-gray-900 border border-white/15 rounded px-2 py-1 text-[11px] text-gray-100"
                                value={pick.picks?.odds !== undefined ? 'user' : 'best'}
                                onChange={async (e) => {
                                  const choice = e.target.value
                                  if (choice === 'user') {
                                    await analyzeAtUserOdds(pick)
                                  } else {
                                    await analyzeAtBestOdds(pick)
                                  }
                                }}
                              >
                                {pick.picks?.odds !== undefined && (
                                  <option value="user">
                                    Your odds: {pick.picks.odds > 0 ? '+' : ''}{pick.picks.odds} @ {getBookmakerDisplayName(pick.picks?.sportsbook || 'Your book')}
                                  </option>
                                )}
                                <option value="best">
                                  Best in market: {analysis.bestOdds > 0 ? '+' : ''}{analysis.bestOdds} @ {getBookmakerDisplayName(analysis.bestSportsbook)}
                                </option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Ares summary */}
                        {(() => {
                          const reasoning = (analysis as any).reasoning as string | undefined

                          let fallback: string | null = null
                          if (!reasoning) {
                            const ev = analysis.expectedValue ?? null
                            const edge = analysis.edge ?? null
                            const confidence = analysis.confidence ?? null

                            if (ev !== null || edge !== null || confidence !== null) {
                              const evPerDollar = ev !== null ? (ev / 100).toFixed(2) : null
                              const edgeText = edge !== null ? `${edge > 0 ? '+' : ''}${edge}% edge` : null
                              const confText = confidence !== null ? `${confidence}% confidence` : null

                              const parts = [
                                evPerDollar !== null ? `$${evPerDollar} expected value per $1 staked` : null,
                                edgeText,
                                confText,
                              ].filter(Boolean)

                              if (parts.length) {
                                fallback = `This price looks ${edge !== null && edge > 0 ? 'favorable' : 'marginal'} based on our model — ${parts.join(', ')}.`
                              }
                            }
                          }

                          const summaryText = reasoning || fallback
                          if (!summaryText) return null

                          return (
                            <div className="text-xs text-gray-300 bg-blue-500/20 backdrop-blur-sm rounded-lg p-3 mb-2 border border-blue-500/30">
                              <p className="font-semibold mb-1">Ares thinks:</p>
                              <p className="text-[11px] text-gray-100">
                                {summaryText}
                              </p>
                            </div>
                          )
                        })()}

                        {/* Detailed analysis notes (expandable) */}
                        {(() => {
                          const allNotes = [
                            ...(analysis.reasons || []),
                            ...(analysis.warnings || []),
                          ] as string[]
                          if (!allNotes.length) return null
                          const isExpanded = !!expandedNotes[pick.id]
                          return (
                            <div className="text-xs text-blue-300 flex flex-col items-center mt-2 mb-1">
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-400 bg-gray-900 text-[12px] font-semibold text-blue-200 hover:bg-blue-500/15 hover:border-blue-300 hover:text-blue-100 transition-colors"
                                onClick={() =>
                                  setExpandedNotes(prev => ({
                                    ...prev,
                                    [pick.id]: !isExpanded,
                                  }))
                                }
                              >
                                <span className="text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                                <span>Analysis Notes</span>
                              </button>
                              <div
                                className={`w-full mt-2 max-w-xl transition-all duration-200 ease-out origin-top overflow-hidden ${
                                  isExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                                }`}
                              >
                                <div className="bg-blue-500/20 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30">
                                  <ul className="list-disc list-inside space-y-1">
                                    {allNotes.map((note, i) => {
                                      // Special handling for stats-service failures so the user sees a clear retry affordance
                                      if (note === "Hmm... We weren't able to get stats for some reason.") {
                                        return (
                                          <li key={i} className="list-none text-red-300 text-[11px]">
                                            <span className="mr-1">Hmm... We weren't able to get stats for some reason.</span>
                                            <button
                                              type="button"
                                              className="underline text-blue-300 hover:text-blue-100"
                                              onClick={() => {
                                                // Full reload is safest to wake any sleeping backend services
                                                if (typeof window !== 'undefined') {
                                                  window.location.reload();
                                                }
                                              }}
                                            >
                                              Try again
                                            </button>
                                          </li>
                                        );
                                      }

                                      return (
                                        <li key={i}>{note}</li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      {expandedAnalyses[pick.id] && analysis.history && analysis.history.length > 1 && (
                        <div className="border-t border-white/10 pt-3 mt-3">
                          <p className="text-xs font-semibold text-gray-400 mb-2">Previous Analyses:</p>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {analysis.history.slice(0, -1).reverse().map((oldAnalysis: any, idx: number) => (
                              <div key={idx} className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                                <p className="text-xs text-gray-400 mb-2">
                                  {new Date(oldAnalysis.timestamp).toLocaleString()}
                                </p>
                                
                                {oldAnalysis.analyzedLine && (
                                  <div className="text-xs text-blue-400 mb-2">
                                    Line: {oldAnalysis.analyzedLine} ({oldAnalysis.analyzedOdds > 0 ? '+' : ''}{oldAnalysis.analyzedOdds})
                                  </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 mb-2">
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">EV ($/1)</p>
                                    <p className={`text-sm font-bold ${((oldAnalysis.expectedValue ?? 0) / 100) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {oldAnalysis.expectedValue !== undefined && oldAnalysis.expectedValue !== null 
                                        ? `${(((oldAnalysis.expectedValue) / 100) > 0 ? '+' : '')}$${((oldAnalysis.expectedValue) / 100).toFixed(2)}` 
                                        : '$0.00'}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">Edge</p>
                                    <p className={`text-sm font-bold ${(oldAnalysis.edge ?? 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                      {oldAnalysis.edge !== undefined && oldAnalysis.edge !== null 
                                        ? `${oldAnalysis.edge > 0 ? '+' : ''}${oldAnalysis.edge}%` 
                                        : '0%'}
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
                        {(pick.picks?.selection === 'over' || pick.picks?.selection === 'under') && (
                          <button
                            onClick={() => toggleOverUnder(pick)}
                            className="w-full bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                          >
                            Flip Over/Under
                          </button>
                        )}
                        <button
                          onClick={() => promptAlternateLineAnalysis(pick)}
                          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Analyze Alternate Line
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-white/10 p-4 bg-black/30 backdrop-blur-sm">
                      <div className="space-y-2">
                        <button
                          onClick={() => promptAnalysis(pick)}
                          className="w-full bg-[#2d2d2d] text-white font-semibold py-3 rounded-lg hover:bg-[#3d3d3d] transition-colors text-sm border border-gray-700"
                        >
                          Analyze This Pick
                        </button>
                        {(pick.picks?.selection === 'over' || pick.picks?.selection === 'under') && (
                          <button
                            onClick={() => toggleOverUnder(pick)}
                            className="w-full bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                          >
                            Flip Over/Under
                          </button>
                        )}
                        <button
                          onClick={() => promptAlternateLineAnalysis(pick)}
                          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Analyze Alternate Line
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-gradient-to-r from-blue-900 to-blue-400 px-4 py-2 text-xs text-gray-200">
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
      <LegalFooter />
      </div>
    </main>
  )
}

export default function PicksPage() {
  return (
    <Suspense
      fallback={(
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
          <div className="max-w-4xl mx-auto p-4">
            <p className="text-center text-gray-500">Loading picks...</p>
          </div>
        </main>
      )}
    >
      <PicksPageInner />
    </Suspense>
  )
}