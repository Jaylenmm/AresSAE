'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export interface AnalysisItem {
  pickId: string
  description: string
  analyzedAt?: string
  status: 'pending' | 'running' | 'completed'
  // Optional structured fields for nicer display
  playerName?: string
  betLabel?: string
}

export interface AnalysisState {
  status: 'idle' | 'running' | 'completed'
  items: AnalysisItem[]
}

const STORAGE_KEY = 'ares_analysis_activity'
const HIDE_KEY = 'ares_analysis_hidden'

function readAnalysisState(): AnalysisState {
  if (typeof window === 'undefined') {
    return { status: 'idle', items: [] }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { status: 'idle', items: [] }
    const parsed = JSON.parse(raw) as AnalysisState
    if (!parsed || !Array.isArray(parsed.items)) return { status: 'idle', items: [] }
    return parsed
  } catch {
    return { status: 'idle', items: [] }
  }
}

export function updateAnalysisState(mutator: (prev: AnalysisState) => AnalysisState) {
  if (typeof window === 'undefined') return
  const current = readAnalysisState()
  const next = mutator(current)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(next) }))
}

export default function AnalysisStatusBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<AnalysisState>({ status: 'idle', items: [] })
  const [open, setOpen] = useState(false)
  // Default to hidden on first load; user preference in localStorage overrides this
  const [hidden, setHidden] = useState(true)

  const handleFlipOverUnder = async (item: AnalysisItem) => {
    try {
      const { data, error } = await supabase
        .from('user_picks')
        .select('picks')
        .eq('id', item.pickId)
        .single()

      if (error || !data) {
        alert('Unable to load pick details to edit.')
        return
      }

      const picks = data.picks as any
      const selection: string = picks?.selection || ''
      const lower = selection.toLowerCase()

      let newSelection: string | null = null
      if (lower === 'over') newSelection = 'under'
      else if (lower === 'under') newSelection = 'over'

      if (!newSelection) {
        alert('This pick is not an over/under selection.')
        return
      }

      const updatedPicks = {
        ...picks,
        selection: newSelection,
      }

      const { error: updateError } = await supabase
        .from('user_picks')
        .update({ picks: updatedPicks, analysis_snapshot: null })
        .eq('id', item.pickId)

      if (updateError) {
        alert('Error updating pick: ' + updateError.message)
        return
      }

      // Update local analysis activity description + structured fields
      const player = updatedPicks.player
      const line = updatedPicks.line
      const propType = updatedPicks.prop_type

      const newPlayerName = player || ''

      const baseLabelParts = [propType, line].filter(Boolean)
      let newBetLabel = baseLabelParts.join(' ')
      if (newSelection) {
        const lowerSel = newSelection.toLowerCase()
        const ouShort = lowerSel === 'over' ? 'O' : lowerSel === 'under' ? 'U' : newSelection
        newBetLabel = newBetLabel ? `${newBetLabel} - ${ouShort}` : ouShort
      }

      const newDescription = newPlayerName || newBetLabel || ''

      updateAnalysisState(prev => {
        const items = prev.items.map(existing =>
          existing.pickId === item.pickId
            ? {
                ...existing,
                description: newDescription,
                playerName: newPlayerName || existing.playerName,
                betLabel: newBetLabel || existing.betLabel,
              }
            : existing
        )

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
    } catch (err: any) {
      console.error('Error flipping over/under from analysis bar:', err)
      alert('Error updating pick. Please try again.')
    }
  }

  const handleAnalyzeItem = (item: AnalysisItem) => {
    // Mark this item as running in the global state, then navigate to Picks to auto-run analysis
    updateAnalysisState(prev => {
      const items = prev.items.map(existing =>
        existing.pickId === item.pickId
          ? { ...existing, status: 'running' as const }
          : existing
      )

      const anyRunning = items.some(i => i.status === 'running')
      const anyCompleted = items.some(i => i.status === 'completed')

      const nextStatus: AnalysisState['status'] =
        items.length === 0
          ? 'idle'
          : anyRunning
            ? 'running'
            : anyCompleted
              ? 'completed'
              : 'idle'

      return {
        status: nextStatus,
        items,
      }
    })

    const url = `/picks?focus_pick=${encodeURIComponent(item.pickId)}&auto_analyze=1`
    router.push(url)
  }

  useEffect(() => {
    const initialState = readAnalysisState()
    setState(initialState)

    // Always resync from pending picks on mount so state is fresh on app load/refresh
    async function syncFromPendingPicks() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: picks } = await supabase
          .from('user_picks')
          .select('*')
          .eq('status', 'pending')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!picks) return

        const items: AnalysisItem[] = picks.map((pick: any) => {
          const hasAnalysis = !!pick.analysis_snapshot
          const analyzedAt = hasAnalysis ? pick.analysis_snapshot.timestamp : undefined

          const playerName: string | undefined = pick.picks?.player || pick.picks?.team || pick.picks?.team_name

          const selection: string = pick.picks?.selection || ''
          const line = pick.picks?.line
          const propType = pick.picks?.prop_type

          const baseLabelParts = [propType, line].filter(Boolean)
          let betLabel = baseLabelParts.join(' ')
          if (selection) {
            const lowerSel = selection.toLowerCase()
            const ouShort = lowerSel === 'over' ? 'O' : lowerSel === 'under' ? 'U' : selection
            betLabel = betLabel ? `${betLabel} - ${ouShort}` : ouShort
          }

          const description = playerName || betLabel || ''

          return {
            pickId: pick.id,
            description,
            status: hasAnalysis ? 'completed' : 'pending',
            analyzedAt,
            playerName,
            betLabel,
          }
        })

        const anyRunning = items.some(i => i.status === 'running')
        const anyCompleted = items.some(i => i.status === 'completed')

        const nextStatus: AnalysisState['status'] =
          items.length === 0
            ? 'idle'
            : anyRunning
              ? 'running'
              : anyCompleted
                ? 'completed'
                : 'idle'

        const nextState: AnalysisState = { status: nextStatus, items }
        updateAnalysisState(() => nextState)
        setState(nextState)
      } catch (err) {
        console.error('Error syncing analysis bar from pending picks:', err)
      }
    }

    syncFromPendingPicks()

    if (typeof window !== 'undefined') {
      const hiddenValue = window.localStorage.getItem(HIDE_KEY)
      setHidden(hiddenValue === 'true')
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setState(readAnalysisState())
      }
      if (event.key === HIDE_KEY && typeof event.newValue === 'string') {
        setHidden(event.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const hasActivity = state.items.length > 0

  const runningCount = state.items.filter(i => i.status === 'running').length
  const completedCount = state.items.filter(i => i.status === 'completed').length
  const pendingCount = state.items.filter(i => i.status === 'pending').length

  const titleText = state.status === 'running'
    ? 'Analyzing picks'
    : hasActivity
      ? 'Your picks'
      : 'Analysis'

  const subtitleText = hasActivity
    ? [
        pendingCount > 0 ? `${pendingCount} saved` : null,
        runningCount > 0 ? `${runningCount} in progress` : null,
        completedCount > 0 ? `${completedCount} completed` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'No picks yet'

  const handleClickItem = (item: AnalysisItem) => {
    const url = `/picks?focus_pick=${encodeURIComponent(item.pickId)}`
    if (pathname === '/picks') {
      router.push(url)
    } else {
      router.push(url)
    }
  }

  const handleHide = () => {
    setHidden(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HIDE_KEY, 'true')
    }
  }

  const handleShow = () => {
    setHidden(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HIDE_KEY, 'false')
    }
  }

  return (
    <>
      {/* When hidden but there is recent activity, show a small floating button */}
      {hidden && hasActivity && (
        <button
          type="button"
          onClick={handleShow}
          className="fixed bottom-24 right-4 z-50 bg-blue-700 text-white text-[11px] font-semibold px-3 py-2 rounded-full shadow-lg border border-white/30 hover:bg-blue-600 flex items-center gap-1"
        >
          <span>View analysis</span>
          <span className="text-[9px] uppercase tracking-wide bg-white/15 px-1.5 py-0.5 rounded-full border border-white/30">
            BETA
          </span>
        </button>
      )}

      {/* Collapsed bar (summary view) - always visible unless hidden */}
      {!hidden && !open && (
      <div
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[95%] bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-4 rounded-2xl shadow-2xl border border-white/20 flex items-center justify-between cursor-pointer"
        onClick={() => {
          if (!hasActivity) return
          setOpen(prev => !prev)
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center border border-white/30 overflow-hidden">
            <img
              src="/ares-logo.svg"
              alt="Ares logo"
              className="h-7 w-7 object-contain"
            />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              {titleText}
            </p>
            <p className="text-sm text-blue-100">
              {subtitleText}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleHide()
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-transparent border border-white/40 text-blue-50 hover:bg-white/10 hover:border-white/70 font-medium transition-colors"
          >
            Hide
          </button>
          <span className="text-xs text-blue-100 font-semibold">
            {hasActivity ? 'View details' : ''}
          </span>
        </div>
      </div>
      )}

      {/* Expanded panel (detail view) with slide animation */}
      {!hidden && hasActivity && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[95%] pb-4 px-4 pointer-events-none">
          <div
            className={`bg-[#050814] rounded-2xl border border-white/15 overflow-hidden overflow-y-auto touch-pan-y
              [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-500 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-color:rgb(59_130_246)_transparent]
              transform transition-all duration-200 ease-out origin-bottom
              ${open ? 'max-h-80 opacity-100 translate-y-0 pointer-events-auto' : 'max-h-0 opacity-0 translate-y-2'}
            `}
          >
            {/* Header strip */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between bg-gradient-to-r from-blue-700 to-blue-500">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center border border-white/30 overflow-hidden">
                  <img
                    src="/ares-logo.svg"
                    alt="Ares logo"
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {state.status === 'running' ? 'Analyzing picks' : 'Your picks'}
                  </p>
                  <p className="text-xs text-blue-100">
                    {subtitleText}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/30 text-blue-50 hover:bg-white/20 hover:border-white/60 font-medium transition-colors"
                >
                  Collapse
                </button>
                <button
                  type="button"
                  onClick={handleHide}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-transparent border border-white/40 text-blue-50 hover:bg-white/10 hover:border-white/70 font-medium transition-colors"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="space-y-0 bg-[#050814]">
              {state.items.map(item => (
                <div
                  key={item.pickId}
                  className="w-full px-4 py-3 flex flex-col gap-1 bg-[#181b23] border-t border-white/10 transition-colors"
                >
                  <button
                    onClick={() => handleClickItem(item)}
                    className="w-full flex items-center justify-between text-left bg-transparent border-0 outline-none shadow-none appearance-none"
                  >
                    <div>
                      <p className="text-sm text-white font-semibold truncate">{item.playerName || item.description}</p>
                      <p className="text-xs text-gray-300 mt-0.5 truncate">{item.betLabel || item.description}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        item.status === 'completed'
                          ? 'bg-green-600/20 text-green-300 border border-green-500/40'
                          : item.status === 'running'
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                            : 'bg-gray-500/20 text-gray-300 border border-gray-400/40'
                      }`}
                    >
                      {item.status === 'completed'
                        ? 'Done'
                        : item.status === 'running'
                          ? 'Running'
                          : 'Pending'}
                    </span>
                  </button>
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleAnalyzeItem(item)}
                      className="text-[11px] px-2.5 py-1 rounded bg-[#2a2f3a] border border-white/25 text-gray-100 hover:bg-[#343a48] hover:border-white/50 font-medium"
                    >
                      Analyze
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFlipOverUnder(item)}
                      className="text-[11px] px-2.5 py-1 rounded bg-[#2a2f3a] border border-white/25 text-gray-100 hover:bg-[#343a48] hover:border-white/50 font-medium"
                    >
                      Flip Over/Under
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClickItem(item)}
                      className="text-[11px] px-2.5 py-1 rounded bg-[#2a2f3a] border border-white/25 text-gray-100 hover:bg-[#343a48] hover:border-white/50 font-medium"
                    >
                      View in Picks
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
