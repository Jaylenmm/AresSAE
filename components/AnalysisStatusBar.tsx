'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export interface AnalysisItem {
  pickId: string
  description: string
  analyzedAt?: string
  status: 'running' | 'completed'
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
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setState(readAnalysisState())

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

  const hasActivity = state.items.length > 0 && state.status !== 'idle'

  if (!hasActivity && !hidden) {
    return null
  }

  const runningCount = state.items.filter(i => i.status === 'running').length
  const completedCount = state.items.filter(i => i.status === 'completed').length

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
          className="fixed bottom-16 right-4 z-50 bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-full shadow-lg border border-white/30 hover:bg-blue-600"
        >
          View analysis
        </button>
      )}

      {/* Collapsed bar (summary view) */}
      {!hidden && hasActivity && !open && (
      <div
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[95%] bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-4 rounded-2xl shadow-2xl border border-white/20 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center border border-white/30 text-white text-sm font-bold">
            A
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              {state.status === 'running' ? 'Analyzing picks' : 'Analysis complete'}
            </p>
            <p className="text-sm text-blue-100">
              {runningCount > 0 && `${runningCount} in progress`}
              {runningCount > 0 && completedCount > 0 && ' · '}
              {completedCount > 0 && `${completedCount} completed`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleHide()
            }}
            className="text-xs text-blue-100 hover:text-white font-semibold"
          >
            Hide
          </button>
          <span className="text-xs text-blue-100 font-semibold">
            {open ? 'Collapse' : 'View details'}
          </span>
        </div>
      </div>
      )}

      {/* Expanded panel (detail view) with slide animation */}
      {!hidden && hasActivity && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[95%] pb-4 px-4 pointer-events-none">
          <div
            className={`bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-y-auto transform transition-all duration-200 ease-out origin-bottom
              ${open ? 'max-h-80 opacity-100 translate-y-0 pointer-events-auto' : 'max-h-0 opacity-0 translate-y-2'}
            `}
          >
            {/* Header mimics the collapsed bar so it feels like one component */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-blue-700 to-blue-500 rounded-t-2xl">
              <div>
                <p className="text-sm font-semibold text-white">
                  {state.status === 'running' ? 'Analyzing picks' : 'Analysis complete'}
                </p>
                <p className="text-xs text-blue-100">
                  {runningCount > 0 && `${runningCount} in progress`}
                  {runningCount > 0 && completedCount > 0 && ' · '}
                  {completedCount > 0 && `${completedCount} completed`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs text-blue-100 hover:text-white font-semibold"
                >
                  Collapse
                </button>
                <button
                  onClick={handleHide}
                  className="text-xs text-blue-100 hover:text-white font-semibold"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="divide-y divide-white/10">
              {state.items.map(item => (
                <button
                  key={item.pickId}
                  onClick={() => handleClickItem(item)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div>
                    <p className="text-sm text-white font-semibold truncate">{item.description}</p>
                    {item.analyzedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(item.analyzedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      item.status === 'completed'
                        ? 'bg-green-600/20 text-green-300 border border-green-500/40'
                        : 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    {item.status === 'completed' ? 'Done' : 'Running'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
