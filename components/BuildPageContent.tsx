'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BettingOptions from '@/components/BettingOptions'
import { Game, OddsData, PlayerProp } from '@/lib/types'
import { Search } from 'lucide-react'
import { analyzeGameBet, analyzePlayerProp } from '@/lib/betAnalysis'
import BetConfirmationModal from '@/components/BetConfirmationModal'

export default function BuildPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    games: Game[]
    playerProps: PlayerProp[]
  }>({ games: [], playerProps: [] })
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [gameOdds, setGameOdds] = useState<OddsData[]>([])
  const [playerProps, setPlayerProps] = useState<PlayerProp[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSportsbook, setSelectedSportsbook] = useState('best_odds')
  const [availableSportsbooks, setAvailableSportsbooks] = useState<string[]>([])
  const [selectedPropType, setSelectedPropType] = useState<string>('all')
  const [openPlayers, setOpenPlayers] = useState<Record<string, boolean>>({})
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState<any>(null)

  useEffect(() => {
    const gameId = searchParams.get('game_id')
    const propId = searchParams.get('prop_id')

    if (gameId) {
      loadGameById(gameId)
    } else if (propId) {
      loadGameByPropId(propId)
    }
  }, [searchParams])

  async function loadGameById(gameId: string) {
    try {
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (game) {
        await selectGame(game)
      }
    } catch (error) {
      console.error('Error loading game:', error)
    }
  }

  async function loadGameByPropId(propId: string) {
    try {
      const { data: prop } = await supabase
        .from('player_props')
        .select('*')
        .eq('id', propId)
        .single()

      if (prop && prop.game_id) {
        const { data: game } = await supabase
          .from('games')
          .select('*')
          .eq('id', prop.game_id)
          .single()

        if (game) {
          await selectGame(game)
        }
      }
    } catch (error) {
      console.error('Error loading game from prop:', error)
    }
  }

function extractSportsbooks(odds: OddsData[]) {
  const books = new Set<string>(['best_odds'])
  
  odds.forEach(odd => {
    if (odd.sportsbook) {
      books.add(odd.sportsbook.toLowerCase())
    }
  })
  
  setAvailableSportsbooks(Array.from(books))
  
  // Preset to FanDuel if available, otherwise first available book
  const booksList = Array.from(books)
  if (booksList.includes('fanduel')) {
    setSelectedSportsbook('fanduel')
  } else if (books.size > 1) {
    const firstBook = booksList.find(b => b !== 'best_odds')
    if (firstBook) setSelectedSportsbook(firstBook)
  }
}
  function getOddsForSportsbook(allOdds: OddsData[]) {
    if (selectedSportsbook === 'best_odds') {
      return getBestOdds(allOdds)
    }
    
    return allOdds.find(odd => 
      odd.sportsbook?.toLowerCase() === selectedSportsbook
    ) || allOdds[0]
  }

  function getBestOdds(allOdds: OddsData[]): OddsData {
    if (allOdds.length === 0) return {} as OddsData
    
    const bestOdds: OddsData = {
      id: 'best',
      game_id: allOdds[0].game_id,
      sportsbook: 'Best Odds',
      spread_home: allOdds[0].spread_home,
      spread_away: allOdds[0].spread_away,
      spread_home_odds: allOdds[0].spread_home_odds,
      spread_away_odds: allOdds[0].spread_away_odds,
      moneyline_home: allOdds[0].moneyline_home,
      moneyline_away: allOdds[0].moneyline_away,
      total: allOdds[0].total,
      over_odds: allOdds[0].over_odds,
      under_odds: allOdds[0].under_odds
    }

    allOdds.forEach(odd => {
      if (odd.spread_home_odds && (!bestOdds.spread_home_odds || 
          Math.abs(Number(odd.spread_home_odds)) < Math.abs(Number(bestOdds.spread_home_odds)))) {
        bestOdds.spread_home = odd.spread_home
        bestOdds.spread_home_odds = odd.spread_home_odds
      }
      if (odd.spread_away_odds && (!bestOdds.spread_away_odds || 
          Math.abs(Number(odd.spread_away_odds)) < Math.abs(Number(bestOdds.spread_away_odds)))) {
        bestOdds.spread_away = odd.spread_away
        bestOdds.spread_away_odds = odd.spread_away_odds
      }
      
      if (odd.moneyline_home && (!bestOdds.moneyline_home || 
          Number(odd.moneyline_home) > Number(bestOdds.moneyline_home))) {
        bestOdds.moneyline_home = odd.moneyline_home
      }
      if (odd.moneyline_away && (!bestOdds.moneyline_away || 
          Number(odd.moneyline_away) > Number(bestOdds.moneyline_away))) {
        bestOdds.moneyline_away = odd.moneyline_away
      }

      if (odd.over_odds && (!bestOdds.over_odds || 
          Math.abs(Number(odd.over_odds)) < Math.abs(Number(bestOdds.over_odds)))) {
        bestOdds.total = odd.total
        bestOdds.over_odds = odd.over_odds
      }
      if (odd.under_odds && (!bestOdds.under_odds || 
          Math.abs(Number(odd.under_odds)) < Math.abs(Number(bestOdds.under_odds)))) {
        bestOdds.total = odd.total
        bestOdds.under_odds = odd.under_odds
      }
    })

    return bestOdds
  }

  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch()
    } else {
      setSearchResults({ games: [], playerProps: [] })
    }
  }, [searchQuery])

  async function performSearch() {
    setSearching(true)
    try {
      const query = searchQuery.toLowerCase()

      // Search games
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .or(`home_team.ilike.%${query}%,away_team.ilike.%${query}%`)
        .gte('game_date', new Date().toISOString())
        .order('game_date', { ascending: true })

      const uniqueGames = games ? Array.from(
        new Map(games.map(game => [game.id, game])).values()
      ).slice(0, 5) : []

      // Search player props by player name - get ALL matching props
      const { data: props } = await supabase
        .from('player_props')
        .select('*')
        .ilike('player_name', `%${query}%`)
        .order('updated_at', { ascending: false })

      // Group by player name and take only unique players
      const uniquePlayerNames = props ? Array.from(
        new Set(props.map(p => p.player_name))
      ).slice(0, 10) : []

      // Get one prop per player for the search results
      const uniqueProps = uniquePlayerNames.map(playerName => 
        props?.find(p => p.player_name === playerName)
      ).filter(Boolean) as PlayerProp[]

      setSearchResults({
        games: uniqueGames,
        playerProps: uniqueProps
      })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  async function selectGame(game: Game) {
    setSelectedGame(game)

    const { data: odds } = await supabase
      .from('odds_data')
      .select('*')
      .eq('game_id', game.id)

    setGameOdds(odds || [])
    extractSportsbooks(odds || [])

    const { data: props } = await supabase
      .from('player_props')
      .select('*')
      .eq('game_id', game.id)

    setPlayerProps(props || [])
    setSearchQuery('')
    setSearchResults({ games: [], playerProps: [] })
  }

async function handleSelectBet(bet: any) {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    alert('Please sign in to save bets')
    return
  }

  let analysis
  
  try {
    if (bet.type === 'player_prop') {
      analysis = analyzePlayerProp(bet, playerProps)
    } else {
      analysis = analyzeGameBet(bet, gameOdds)
    }
  } catch (e) {
    alert('Analysis failed: ' + e)
    return
  }

  const pickData = {
    user_id: user.id,
    pick_type: 'straight',
    picks: {
      bet_type: bet.type,
      selection: bet.selection,
      team: bet.team,
      player: bet.player,
      prop_type: bet.propType,
      line: bet.line,
      odds: bet.odds,
      sportsbook: bet.sportsbook,
      game_id: selectedGame?.id
    },
    analysis_snapshot: {
      selection: bet.type === 'player_prop' 
        ? `${bet.player} ${bet.selection} ${bet.line} ${bet.propType}`
        : `${bet.team || bet.selection} ${bet.line || ''}`,
      ev_percentage: analysis.ev_percentage,
      has_edge: analysis.has_edge,
      hit_probability: analysis.hit_probability,
      recommendation_score: analysis.recommendation_score,
      reasoning: analysis.reasoning,
      best_book: analysis.best_book,
      best_odds: analysis.best_odds,
      comparison_odds: analysis.comparison_odds
    },
    total_odds: bet.odds,
    status: 'pending'
  }

  const { error } = await supabase
    .from('user_picks')
    .insert([pickData])

  if (error) {
    alert(`Error saving bet: ${error.message}`)
  } else {
    // Show modal instead of alert
    setModalData({ analysis, betDetails: bet })
    setShowModal(true)
  }
}

  const displayOdds = gameOdds.length > 0 ? [getOddsForSportsbook(gameOdds)] : []
  
  // Filter player props by selected sportsbook only
  const filteredPlayerProps = playerProps.filter(p => {
    if (selectedSportsbook === 'best_odds') return true
    return p.sportsbook?.toLowerCase() === selectedSportsbook.toLowerCase()
  })

  const togglePlayer = (playerName: string) => {
    setOpenPlayers(prev => ({
      ...prev,
      [playerName]: !prev[playerName]
    }))
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Build Your Bets</h1>
        <div className="w-16"></div>
      </div>

      {selectedGame && availableSportsbooks.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Sportsbook
          </label>
          <select
            value={selectedSportsbook}
            onChange={(e) => setSelectedSportsbook(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableSportsbooks.map(book => (
              <option key={book} value={book}>
                {book === 'best_odds' 
                  ? 'Best Odds' 
                  : book.charAt(0).toUpperCase() + book.slice(1).replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search teams or players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
        />
      </div>

      {(searchResults.games.length > 0 || searchResults.playerProps.length > 0) && (
        <div className="bg-white rounded-lg shadow-lg mb-6 max-h-96 overflow-y-auto">
          {searchResults.games.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-400 px-3 py-2">GAMES</p>
              {searchResults.games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => selectGame(game)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-200 rounded transition-colors"
                >
                  <p className="font-semibold text-sm text-white">
                    {game.away_team} @ {game.home_team}
                  </p>
                  <p className="text-xs text-gray-500 pb-2">
                    {new Date(game.game_date).toLocaleDateString()} • {game.sport}
                  </p>
                </button>
              ))}
            </div>
          )}
          {searchResults.playerProps.length > 0 && (
            <div className="p-2 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-400 px-3 py-2">PLAYERS</p>
              {searchResults.playerProps.map((prop) => (
                <button
                  key={prop.id}
                  onClick={async () => {
                    const { data: game } = await supabase
                      .from('games')
                      .select('*')
                      .eq('id', prop.game_id)
                      .single()
                    if (game) await selectGame(game)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <p className="font-semibold text-sm text-white">{prop.player_name}</p>
                  <p className="text-xs text-gray-500">{prop.prop_type}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedGame && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-600 to-blue-900 rounded-lg p-4 text-white">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">
                {selectedGame.sport}
              </span>
              <span className="text-xs">
                {new Date(selectedGame.game_date).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">{selectedGame.away_team}</span>
                {displayOdds[0]?.spread_away && (
                  <span className="text-sm">
                    {displayOdds[0].spread_away > 0 ? '+' : ''}{displayOdds[0].spread_away}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">{selectedGame.home_team}</span>
                {displayOdds[0]?.spread_home && (
                  <span className="text-sm">
                    {displayOdds[0].spread_home > 0 ? '+' : ''}{displayOdds[0].spread_home}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-black bg-white rounded-lg shadow-md p-4"> 
            <h3 className="!text-gray-600 font-semibold text-lg mb-3">Available Bets</h3>
                <BettingOptions
                odds={displayOdds}
                homeTeam={selectedGame.home_team}
                awayTeam={selectedGame.away_team}
                onSelectBet={handleSelectBet}
                />
          </div>

          {filteredPlayerProps.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="!text-gray-600 font-semibold text-lg mb-3">Player Props</h3>
                <div className="space-y-2">
                {Array.from(new Set(filteredPlayerProps.map(p => p.player_name))).map(playerName => {
                    const playerPropsForName = filteredPlayerProps.filter(p => p.player_name === playerName)
                    const isOpen = openPlayers[playerName]
                    
                    return (
                    <div key={playerName} className="text-gray-700 border border-gray-200 rounded-lg overflow-hidden">
                        <button
                        onClick={() => togglePlayer(playerName)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                        <div className="text-left">
                            <p className="text-white">{playerName}</p>
                            <p className="text-xs text-gray-500">{playerPropsForName.length} props available</p>
                        </div>
                        <svg
                            className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M19 9l-7 7-7-7"></path>
                        </svg>
                        </button>

                        {isOpen && (
                        <div className="p-3 bg-white">
                            <div className="grid grid-cols-2 gap-2">
                            {playerPropsForName.map(prop => (
                                <React.Fragment key={prop.id}>
                                <button
                                    onClick={() => handleSelectBet({
                                    type: 'player_prop',
                                    player: prop.player_name,
                                    propType: prop.prop_type,
                                    selection: 'over',
                                    line: prop.line,
                                    odds: prop.over_odds ?? 0,
                                    sportsbook: prop.sportsbook
                                    })}
                                    className="bg-gray-400 border-2 border-gray-200 rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-all text-left active:scale-[0.98]"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                                        {prop.prop_type}
                                    </span>
                                    <span className="text-base font-bold text-white">
                                        {prop.over_odds ? `${prop.over_odds > 0 ? '+' : ''}${prop.over_odds}` : '--'}
                                    </span>
                                    </div>
                                    <p className="text-sm font-semibold text-white leading-tight">Over {prop.line}</p>
                                    <p className="text-xs text-gray-300 mt-1">Over the line</p>
                                </button>
                                
                                <button
                                    onClick={() => handleSelectBet({
                                    type: 'player_prop',
                                    player: prop.player_name,
                                    propType: prop.prop_type,
                                    selection: 'under',
                                    line: prop.line,
                                    odds: prop.under_odds ?? 0,
                                    sportsbook: prop.sportsbook
                                    })}
                                    className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-all text-left active:scale-[0.98]"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                                        {prop.prop_type}
                                    </span>
                                    <span className="text-base font-bold text-white">
                                        {prop.under_odds ? `${prop.under_odds > 0 ? '+' : ''}${prop.under_odds}` : '--'}
                                    </span>
                                    </div>
                                    <p className="text-sm font-semibold text-white leading-tight">Under {prop.line}</p>
                                    <p className="text-xs text-gray-300 mt-1">Under the line</p>
                                </button>
                                </React.Fragment>
                            ))}
                            </div>
                        </div>
                        )}
                    </div>
                    )
                })}
                </div>
            </div>
            )}
        </div>
      )}
      {/* Bet Confirmation Modal */}
      {modalData && (
        <BetConfirmationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          analysis={modalData.analysis}
          betDetails={modalData.betDetails}
        />
      )}
    </main>
  )
}