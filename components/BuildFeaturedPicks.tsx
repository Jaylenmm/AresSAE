'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface FeaturedPick {
  id: string
  sport: string
  game_id: string
  game_info: string
  pick_type: string
  selection: string
  odds: number
  confidence: number
  hit_probability: number
  ev_percentage: number
  sportsbook: string
  bet_details: any
}

export default function BuildFeaturedPicks() {
  const router = useRouter()
  const [picks, setPicks] = useState<FeaturedPick[]>([])
  const [loading, setLoading] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    loadAllSportsPicks()
  }, [])

  // Auto-scroll effect
  useEffect(() => {
    if (picks.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % picks.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [picks.length])

  // Smooth scroll when index changes
  useEffect(() => {
    if (scrollContainerRef.current && picks.length > 0) {
      const cardWidth = scrollContainerRef.current.children[0]?.clientWidth || 280
      const gap = 12
      scrollContainerRef.current.scrollTo({
        left: currentIndex * (cardWidth + gap),
        behavior: 'smooth'
      })
    }
  }, [currentIndex, picks])

  async function loadAllSportsPicks() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('featured_picks')
        .select('*')
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .order('confidence', { ascending: false })

      if (data && data.length > 0) {
        const shuffled = data.sort(() => 0.5 - Math.random())
        const randomPicks = shuffled.slice(0, 10)
        setPicks(randomPicks)
      }
    } catch (error) {
      console.error('Error loading featured picks:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleCardClick(bet: FeaturedPick) {
    if (bet.pick_type === 'player_prop' && bet.bet_details?.prop?.id) {
      router.push(`/build?prop_id=${bet.bet_details.prop.id}`)
    } else {
      router.push(`/build?game_id=${bet.game_id}`)
    }
  }

  if (loading) {
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Ares Picks</h2>
        </div>
        <div className="text-center py-8 text-gray-500">Loading picks...</div>
      </section>
    )
  }

  if (picks.length === 0) {
    return null
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">Ares Picks</h2>
        </div>
        <p className="text-xs text-gray-500">Best hit probability with the best odds</p>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {picks.map((bet) => (
          <div
            key={bet.id}
            onClick={() => handleCardClick(bet)}
            className="flex-shrink-0 w-[280px] snap-start bg-gradient-to-br from-blue-600 to-blue-900 rounded-lg p-4 text-white cursor-pointer hover:shadow-xl transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">{bet.selection}</p>
                <p className="text-sm text-blue-100">{bet.pick_type.replace('_', ' ')}</p>
              </div>
              <div className="text-right ml-2">
                <p className="text-2xl font-bold">
                  {bet.odds > 0 ? '+' : ''}{bet.odds}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-blue-400/30">
              <div>
                <p className="text-xs text-blue-200">Hit Probability</p>
                <p className="text-sm font-semibold">{Math.round(bet.hit_probability)}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-blue-200">EV</p>
                <p className="text-sm font-semibold">+{bet.ev_percentage.toFixed(1)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-200">Book</p>
                <p className="text-sm font-semibold">{bet.sportsbook}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {picks.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </section>
  )
}