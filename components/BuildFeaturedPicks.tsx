'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'

interface FeaturedPick {
  id: string
  sport: string
  game_info: string
  pick_type: string
  selection: string
  odds: number
  confidence: number
  reasoning: string
  sportsbook: string
}

export default function BuildFeaturedPicks() {
  const [picks, setPicks] = useState<FeaturedPick[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const PICKS_PER_PAGE = 10 // 2x5 grid

  useEffect(() => {
    loadAllSportsPicks()
  }, [])

  async function loadAllSportsPicks() {
    setLoading(true)
    try {
      // Fetch featured picks from ALL sports
      const { data } = await supabase
        .from('featured_picks')
        .select('*')
        .order('confidence', { ascending: false })
        .limit(30) // Get top 30 picks across all sports

      if (data) {
        setPicks(data)
      }
    } catch (error) {
      console.error('Error loading featured picks:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(picks.length / PICKS_PER_PAGE)
  const currentPicks = picks.slice(
    currentPage * PICKS_PER_PAGE,
    (currentPage + 1) * PICKS_PER_PAGE
  )

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-blue-900 rounded-lg p-4 mb-6">
        <div className="text-center text-white py-4">Loading picks...</div>
      </div>
    )
  }

  if (picks.length === 0) {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-blue-900 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="text-white" size={20} />
          <h2 className="text-lg font-bold text-white">Ares Picks - All Sports</h2>
        </div>
        <div className="text-center text-white/80 py-2 text-sm">
          No featured picks available right now
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-900 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-white" size={20} />
          <h2 className="text-lg font-bold text-white">Ares Picks - All Sports</h2>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="text-white disabled:opacity-30 hover:bg-white/20 rounded p-1 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-white text-sm">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages - 1}
              className="text-white disabled:opacity-30 hover:bg-white/20 rounded p-1 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* 2x5 Grid */}
      <div className="grid grid-cols-2 gap-2">
        {currentPicks.map((pick) => (
          <button
            key={pick.id}
            className="bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg p-3 text-left transition-all border border-white/20 hover:border-white/40 active:scale-[0.98]"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-semibold text-white/90 bg-white/20 px-2 py-0.5 rounded">
                {pick.sport}
              </span>
              <span className="text-lg font-bold text-white">
                {pick.confidence}
              </span>
            </div>

            <div className="mb-2">
              <p className="text-xs text-white/70 mb-1">{pick.game_info}</p>
              <p className="text-sm font-bold text-white leading-tight">
                {pick.selection}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-white/80">{pick.pick_type}</span>
              <span className="text-sm font-bold text-white">
                {pick.odds > 0 ? '+' : ''}{pick.odds}
              </span>
            </div>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-3">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentPage 
                  ? 'bg-white w-6' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}