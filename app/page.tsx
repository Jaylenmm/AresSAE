'use client'

import { useState, useEffect, useRef } from 'react'
// import GameCard from '@/components/GameCard'
import GameCard from '@/components/GameCardV2'
// import PropCard from '@/components/PropCard'
import PropCard from '@/components/PropCardV2'
import LegalFooter from '@/components/LegalFooter'
import { Game, OddsData, PlayerProp } from '@/lib/types'
import { supabase } from '@/lib/supabase'

const SPORTS = [
  { key: 'NFL', label: 'NFL' },
  { key: 'NBA', label: 'NBA' },
  { key: 'MLB', label: 'MLB' },
  { key: 'NCAAF', label: 'NCAAF' }
]

export default function Home() {
  const [selectedSport, setSelectedSport] = useState('NFL')
  const [games, setGames] = useState<Game[]>([])
  const [oddsData, setOddsData] = useState<Record<string, OddsData[]>>({})
  const [playerProps, setPlayerProps] = useState<PlayerProp[]>([])
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState<any[]>([])

  const tabsContainerRef = useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  useEffect(() => {
    loadData()
  }, [selectedSport])

  useEffect(() => {
    function updateIndicator() {
      const container = tabsContainerRef.current
      if (!container) return
      const active = container.querySelector<HTMLButtonElement>(`button[data-sport="${selectedSport}"]`)
      if (!active) return

      const containerRect = container.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()

      setIndicator({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      })
    }

    updateIndicator()

    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [selectedSport])

  async function loadData() {
    setLoading(true)
    try {
      // Fetch games
      const response = await fetch(`/api/games?sport=${selectedSport}`)
      const data = await response.json()
      
      // Remove duplicate games based on game ID
      const uniqueGames = data.games ? Array.from(
        new Map(data.games.map((game: Game) => [game.id, game])).values()
      ) as Game[] : []
      
      setGames(uniqueGames)
      setOddsData(data.odds || {})

      // Fetch player props via server API to avoid client RLS issues
      {
        const params = new URLSearchParams()
        params.set('limit', '80')
        params.set('sport', selectedSport)
        if (uniqueGames.length > 0) {
          const gameIds = uniqueGames.map((g: Game) => g.id).join(',')
          params.set('game_ids', gameIds)
        }
        const propsResponse = await fetch(`/api/featured-props?${params.toString()}`)
        const propsJson = (await propsResponse.json().catch(() => ({ props: [] }))) as { props: PlayerProp[] }
        const props = Array.isArray(propsJson?.props) ? (propsJson.props as PlayerProp[]) : []

        const uniqueProps: PlayerProp[] = props ? Array.from(
          new Map(props.map((prop: PlayerProp) => [prop.id, prop])).values()
        ).slice(0, 20) as PlayerProp[] : []

        setPlayerProps(uniqueProps)
      }

      // Fetch news
      try {
        const newsResponse = await fetch(`/api/news?sport=${selectedSport}`)
        const newsData = await newsResponse.json()
        setNews(newsData.articles || [])
      } catch (error) {
        console.error('Error loading news:', error)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="w-full mx-auto p-4">
      {/* Logo + Sport Selector */}
      <div className="mb-8 flex items-baseline gap-3 relative">
        <div className="flex-shrink-0 relative z-10">
          <img src="/ares-logo.svg" alt="Ares Logo" style={{ height: 40 }} className="mr-1" />
          <span className="sr-only">Ares - Smart betting analysis</span>
        </div>

        {/* Horizontally scrollable sports list that can move under the logo area */}
        <div className="flex-1 overflow-x-auto pb-1 -ml-4 pl-4 touch-pan-x">
          <div className="relative flex gap-4 min-w-max" ref={tabsContainerRef}>
            <div
              className="absolute bottom-0 h-[4px] bg-blue-600 transition-all duration-200 origin-left"
              style={{ transform: `translateX(${indicator.left}px) skewX(-20deg)`, width: indicator.width }}
            />
            {SPORTS.map((sport) => {
              const isSelected = selectedSport === sport.key
              const labelColorClass = isSelected ? 'text-blue-400' : 'text-white'
              return (
                <button
                  key={sport.key}
                  onClick={() => setSelectedSport(sport.key)}
                  data-sport={sport.key}
                  className="relative whitespace-nowrap text-2xl sm:text-3xl font-bold italic border-none focus:outline-none transition-colors duration-200"
                  style={{ background: 'transparent', padding: '0.25rem 0', border: 'none' }}
                >
                  <span className={`px-1 ${labelColorClass}`}>{sport.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* News Section (Top of page, replaces Ares Picks) */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Latest {selectedSport} News</h2>
              <a 
                href={`https://www.espn.com/${selectedSport.toLowerCase()}/`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                More on ESPN
              </a>
            </div>
            {news.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-4 text-center text-gray-500">
                No news available.
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {news.map((article, index) => (
                  <a
                    key={index}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gray-800 rounded-lg shadow-sm p-4 transition-colors border border-blue-600/20 relative"
                  >
                    <div className="font-semibold text-white mb-1">
                      {article.title}
                    </div>
                    <div className="text-xs text-white">
                      {new Date(article.pubDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      })} · Source: ESPN
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Featured Games */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Games</h2>
            {games.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600 mb-2">No games available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {games.slice(0, 6).map((game) => (
                  <GameCard key={game.id} game={game} odds={oddsData[game.id]} />
                ))}
              </div>
            )}
          </section>

          {/* Featured Player Props */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Props</h2>
            {playerProps.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600 mb-2">No player props available</p>
                <p className="text-sm text-gray-500">
                  Hang tight for updates!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {playerProps.slice(0, 8).map((prop) => (
                  <PropCard key={prop.id} prop={prop} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <LegalFooter />
    </main>
  )
}