'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BettingOptions from '@/components/BettingOptions'
import BuildFeaturedPicks from '@/components/BuildFeaturedPicks'
import GameCardV2 from '@/components/GameCardV2'
import PlayerPropDisplay from '@/components/PlayerPropDisplay'
import { Game, OddsData, PlayerProp } from '@/lib/types'
import { updateAnalysisState, type AnalysisItem, type AnalysisState } from '@/components/AnalysisStatusBar'
import { Search } from 'lucide-react'
import BetConfirmationModal from '@/components/BetConfirmationModal'
import { getBookmakerDisplayName } from '@/lib/bookmakers'

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
  const [selectedSportsbook] = useState('best_odds') // Always use best odds
  const [availableSportsbooks, setAvailableSportsbooks] = useState<string[]>([])
  const [sportsbookPropCounts, setSportsbookPropCounts] = useState<Record<string, number>>({})
  const [selectedPropType, setSelectedPropType] = useState<string>('all')
  const [openPlayers, setOpenPlayers] = useState<Record<string, boolean>>({})
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState<any>(null)
  
  const playerSectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const gameId = searchParams.get('game_id')
    const propId = searchParams.get('prop_id')

    if (gameId) {
      loadGameById(gameId)
    } else if (propId) {
      loadGameByPropId(propId)
    }
  }, [searchParams])

  useEffect(() => {
    const player = searchParams.get('player')
    if (player && selectedGame) {
      setOpenPlayers(prev => ({
        ...prev,
        [player]: true
      }))
      setTimeout(() => {
        const element = playerSectionRefs.current[player]
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [selectedGame, searchParams])

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
      // Try v2 first
      const { data: prop } = await supabase
        .from('player_props_v2')
        .select('*')
        .eq('id', propId)
        .maybeSingle()

      if (prop && prop.game_id) {
        const { data: game } = await supabase
          .from('games')
          .select('*')
          .eq('id', prop.game_id)
          .single()

        if (game) {
          await selectGame(game)
          
          setTimeout(() => {
            if (prop.player_name) {
              setOpenPlayers(prev => ({
                ...prev,
                [prop.player_name]: true
              }))
              
              setTimeout(() => {
                const element = playerSectionRefs.current[prop.player_name]
                if (element) {
                  element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                  })
                }
              }, 300)
            }
          }, 100)
        }
      }
    } catch (error) {
      console.error('Error loading game from prop:', error)
    }
  }

  function extractSportsbooksFromData(props: PlayerProp[], _odds: OddsData[]) {
    const counts: Record<string, number> = {}
    for (const p of props) {
      const key = (p.sportsbook as string | undefined)?.toLowerCase()
      if (!key) continue
      counts[key] = (counts[key] || 0) + 1
    }
    const list = ['best_odds', ...Object.keys(counts).sort()]
    setSportsbookPropCounts(counts)
    setAvailableSportsbooks(list)
    // Always use best_odds, no need to set
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
      
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .or(`home_team.ilike.%${query}%,away_team.ilike.%${query}%`)
        .gte('game_date', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // Show games up to 4 hours after start
        .order('game_date', { ascending: true })

      const uniqueGames = games ? Array.from(
        new Map(games.map(game => [game.id, game])).values()
      ).slice(0, 5) : []

      const { data: props } = await supabase
        .from('player_props_v2')
        .select('*')
        .ilike('player_name', `%${query}%`)
        .order('updated_at', { ascending: false })
      
      const uniquePlayerNames = props ? Array.from(
        new Set(props.map(p => p.player_name))
      ).slice(0, 10) : []

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

    const [propsRes, v2Res] = await Promise.all([
      fetch(`/api/featured-props?game_ids=${encodeURIComponent(game.id)}&limit=200&sport=${encodeURIComponent(game.sport)}&strict=1`)
        .then(r => r.json()).catch(() => ({ props: [] })),
      supabase.from('odds_data_v2').select('*').eq('game_id', game.id),
    ])

    const props = (Array.isArray(propsRes?.props) ? propsRes.props : []) as PlayerProp[]
    const v2 = (v2Res.data || []) as any[]

    // Aggregate v2 baseline markets into legacy OddsData per book
    const byBook: Record<string, OddsData> = {}
    v2.forEach((row: any) => {
      if (!row || !['spread','total','moneyline'].includes(row.market)) return
      const book = (row.book_name || row.book_key) as string
      if (!byBook[book]) {
        byBook[book] = {
          id: `${game.id}-${book}`,
          game_id: game.id,
          sportsbook: book,
        } as OddsData
      }
      const agg = byBook[book]
      if (row.market === 'spread') {
        agg.spread_home = row.spread_home
        agg.spread_away = row.spread_away
        agg.spread_home_odds = row.spread_home_odds
        agg.spread_away_odds = row.spread_away_odds
      } else if (row.market === 'total') {
        agg.total = row.line
        agg.over_odds = row.over_odds
        agg.under_odds = row.under_odds
      } else if (row.market === 'moneyline') {
        agg.moneyline_home = row.moneyline_home
        agg.moneyline_away = row.moneyline_away
      }
    })

    const oddsArray = Object.values(byBook)
    setGameOdds(oddsArray)
    setPlayerProps(props)
    extractSportsbooksFromData(props, oddsArray)
    setSearchQuery('')
    setSearchResults({ games: [], playerProps: [] })
  }

  async function handleSelectBet(bet: any) {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      const currentPath = window.location.pathname
      const gameId = selectedGame?.id
      const propId = bet.type === 'player_prop' ? `${bet.player}-${bet.propType}` : null
      
      let redirectUrl = `${currentPath}?`
      if (gameId) redirectUrl += `game_id=${gameId}`
      if (propId) redirectUrl += `&prop_search=${encodeURIComponent(propId)}`
      if (selectedSportsbook) redirectUrl += `&sportsbook=${selectedSportsbook}`
      
      sessionStorage.setItem('pending_bet', JSON.stringify(bet))
      
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
      return
    }
    if (!selectedGame) {
      alert('No game selected')
      return
    }

    setModalData({ betDetails: bet })
    setShowModal(true)
  }

  useEffect(() => {
    const checkPendingBet = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const pendingBet = sessionStorage.getItem('pending_bet')
        if (pendingBet) {
          try {
            const bet = JSON.parse(pendingBet)
            sessionStorage.removeItem('pending_bet')
            
            setTimeout(() => {
              setModalData({ betDetails: bet })
              setShowModal(true)
            }, 500)
          } catch (e) {
            console.error('Error loading pending bet:', e)
          }
        }
      }
    }
    
    checkPendingBet()
  }, [selectedGame])

  async function confirmAndSaveBet() {
    if (!modalData || !selectedGame) return

    const bet = modalData.betDetails
    
    /* Ensure we have the authenticated user for FK user_id */
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('You need to be logged in to save a bet.')
      setShowModal(false)
      setModalData(null)
      router.push('/login')
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
        game_id: selectedGame.id
      },
      total_odds: bet.odds,
      status: 'pending'
    }

    console.log('Attempting to save pick:', pickData)

    const { data, error } = await supabase
      .from('user_picks')
      .insert([pickData])
      .select()

    console.log('Save result - data:', data, 'error:', error)

    setShowModal(false)
    setModalData(null)

    if (error) {
      console.error('Error saving pick:', error)
      alert(`Error saving bet: ${error.message}`)
    } else {
      console.log('Pick saved successfully:', data)
      alert('Bet saved successfully!')

      // Seed/update the global AnalysisStatusBar so this pick appears immediately
      const saved = Array.isArray(data) && data.length > 0 ? data[0] as any : null
      if (saved && saved.id) {
        const description = bet.player
          ? `${bet.player} ${bet.selection} ${bet.line} ${bet.propType || ''}`
          : `${bet.selection} ${bet.line ?? ''}`

        const newItem: AnalysisItem = {
          pickId: saved.id,
          description,
          status: 'pending',
        }

        updateAnalysisState((prev: AnalysisState) => {
          const filtered = prev.items.filter(i => i.pickId !== newItem.pickId)
          const items = [newItem, ...filtered]

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
      }
    }
  }

  const displayOdds = gameOdds.length > 0 ? [getOddsForSportsbook(gameOdds)] : []
  
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

  const currentSport = selectedGame?.sport || 'NFL'

  return (
    <main className="w-full mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Build Your Bets</h1>
        <div className="w-16"></div>
      </div>

      <div className="mb-6">
        <BuildFeaturedPicks />
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search teams or players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
        />
      </div>

      {(searchResults.games.length > 0 || searchResults.playerProps.length > 0) && (
        <div className="bg-gray-900 border border-white/20 rounded-lg shadow-lg mb-6 max-h-96 overflow-y-auto">
          {searchResults.games.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-500 px-3 py-2">GAMES</p>
              {searchResults.games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => selectGame(game)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded transition-colors"
                >
                  <p className="font-semibold text-sm text-white">
                    {game.away_team} @ {game.home_team}
                  </p>
                  <p className="text-xs text-gray-400 pb-2">
                    {new Date(game.game_date).toLocaleDateString()} • {game.sport}
                  </p>
                </button>
              ))}
            </div>
          )}
          {searchResults.playerProps.length > 0 && (
            <div className="p-2 border-t border-white/20">
              <p className="text-xs font-semibold text-gray-500 px-3 py-2">PLAYERS</p>
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
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded transition-colors"
                >
                  <p className="font-semibold text-sm text-white">{prop.player_name}</p>
                  <p className="text-xs text-gray-400">{prop.prop_type}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}


      {selectedGame && (
        <div className="space-y-4">
          {/* Game Card */}
          <GameCardV2 game={selectedGame} odds={displayOdds} />

          {filteredPlayerProps.length > 0 && (
            <div>
              <h3 className="!text-white font-semibold text-lg mb-3">Player Props</h3>
              <div className="space-y-3">
                {Array.from(new Set(filteredPlayerProps.map(p => p.player_name))).map(playerName => {
                  const playerPropsForName = filteredPlayerProps.filter(p => p.player_name === playerName)
                  const isOpen = openPlayers[playerName]
                  
                  return (
                    <div 
                      key={playerName} 
                      className="bg-gray-900 rounded-lg border-1 border-white/20 overflow-hidden transition-all"
                      ref={(el) => { playerSectionRefs.current[playerName] = el }}
                    >
                      <button
                        onClick={() => togglePlayer(playerName)}
                        className="w-full flex items-center justify-between px-5 py-1.5 transition-colors"
                        style={{ background: 'linear-gradient(to right, rgba(30, 58, 138, 0.3), rgba(96, 165, 250, 0.3))' }}
                      >
                        <div className="text-left">
                          <p className="text-white font-semibold text-base">{playerName}</p>
                          <p className="text-xs text-blue-300">{playerPropsForName.length} props available</p>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-500">
                          <div className="border-t border-white/20 pt-4">
                            <PlayerPropDisplay
                              playerName={playerName}
                              props={playerPropsForName}
                              onSelectBet={handleSelectBet}
                            />
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

      {modalData && (
        <BetConfirmationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onConfirm={confirmAndSaveBet}
          betDetails={modalData.betDetails}
        />
      )}
    </main>
  )
}