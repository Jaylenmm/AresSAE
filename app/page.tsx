'use client'

import { useState, useEffect } from 'react'
import GameCard from '@/components/GameCard'
import PropCard from '@/components/PropCard'
import FeaturedPicks from '@/components/FeaturedPicks'
import { Game, OddsData, PlayerProp } from '@/lib/types'
import { supabase } from '@/lib/supabase'

const SPORTS = [
  { key: 'NFL', label: 'NFL' },
  { key: 'NBA', label: 'NBA' },
  { key: 'MLB', label: 'MLB' },
  { key: 'CFB', label: 'CFB' }
]

export default function Home() {
  const [selectedSport, setSelectedSport] = useState('NFL')
  const [games, setGames] = useState<Game[]>([])
  const [oddsData, setOddsData] = useState<Record<string, OddsData[]>>({})
  const [playerProps, setPlayerProps] = useState<PlayerProp[]>([])
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState<any[]>([])

  useEffect(() => {
    loadData()
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

      // Fetch player props directly from Supabase
      if (uniqueGames.length > 0) {
        const gameIds = uniqueGames.map((g: Game) => g.id)
        
        console.log('Fetching props for game IDs:', gameIds)
        
        const { data: props, error } = await supabase
          .from('player_props')
          .select('*')
          .in('game_id', gameIds)
          .order('updated_at', { ascending: false })

        console.log('Props fetched:', props?.length, 'Error:', error)
        
        if (error) {
          console.error('Error fetching props:', error)
        } else {
          const uniqueProps = props ? Array.from(
            new Map(props.map(prop => [prop.id, prop])).values()
          ).slice(0, 20) : []
          
          console.log('Unique props after dedup:', uniqueProps.length)
          setPlayerProps(uniqueProps)
        }
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
    <main className="max-w-lg mx-auto p-4">
      <div className="mb-6 flex items-center">
        <img src="/ares-logo.svg" alt="Ares Logo" style={{ height: 40 }} className="mr-2" />
        <span className="sr-only">Ares - Smart betting analysis</span>
      </div>

      {/* Interactive Sport Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {SPORTS.map((sport) => (
          <button
            key={sport.key}
            onClick={() => setSelectedSport(sport.key)}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              selectedSport === sport.key
                ? '!bg-gradient-to-r from-blue-600 to-blue-900 text-white shadow-lg scale-105'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {sport.label}
          </button>
        ))}
      </div>

      <FeaturedPicks sport={selectedSport} />

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Featured Games */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Featured Games</h2>
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Featured Props</h2>
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

          {/* News Section */}
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
              <div className="space-y-3">
                {news.map((article, index) => (
                  <a
                    key={index}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white rounded-lg shadow-sm p-4 hover:bg-gray-50 transition-colors border border-gray-200"
                  >
                    <div className="font-semibold text-gray-900 mb-2">
                      {article.title}
                    </div>
                    {article.description && (
                      <div className="text-sm text-gray-700 mb-2">
                        {article.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
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
        </>
      )}
    </main>
  )
}