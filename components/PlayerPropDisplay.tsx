'use client'

import { useState, useEffect } from 'react'
import { PlayerProp } from '@/lib/types'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { getPlayerStats } from '@/lib/nba-stats-service'
import type { PlayerGameLog } from '@/lib/nba-stats-service'

interface PlayerPropDisplayProps {
  playerName: string
  props: PlayerProp[]
  onSelectBet: (bet: any) => void
}

interface GroupedProp {
  propType: string
  lines: {
    line: number
    over_odds?: number
    under_odds?: number
    sportsbook?: string
    propId: string
  }[]
}

interface PlayerStats {
  recentGames: Array<{
    date: string
    opponent: string
    stats: Record<string, number>
    result: string
  }>
  seasonAverages: Record<string, number>
}

interface NflGameLog {
  gameDate: string
  opponent: string
  stats: Record<string, number>
}

export default function PlayerPropDisplay({ playerName, props, onSelectBet }: PlayerPropDisplayProps) {
  const [selectedLineIndex, setSelectedLineIndex] = useState<Record<string, number>>({})
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [nbaGameLogs, setNbaGameLogs] = useState<PlayerGameLog[]>([])
  const [nflGameLogs, setNflGameLogs] = useState<NflGameLog[]>([])

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true)
      try {
        const sport = determineSport(props[0]?.prop_type || '')

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        if (sport === 'basketball') {
          const response = await fetch(
            `/api/nba-stats?player=${encodeURIComponent(playerName)}`,
            { signal: controller.signal }
          )

          clearTimeout(timeoutId)

          if (response.ok) {
            const stats = await response.json()
            setNbaGameLogs((stats.recentGames || []).slice(0, 5))
            console.log(`Loaded ${stats.recentGames?.length || 0} NBA games for ${playerName}`)
          } else {
            const error = await response.json()
            console.log(`${error.error || 'No NBA stats found'} for ${playerName}`)
          }
        } else if (sport === 'football') {
          const response = await fetch(
            `/api/nfl-stats?player=${encodeURIComponent(playerName)}`,
            { signal: controller.signal }
          )

          clearTimeout(timeoutId)

          if (response.ok) {
            const stats = await response.json()
            setNflGameLogs((stats.recentGames || []).slice(0, 5))
            console.log(`Loaded ${stats.recentGames?.length || 0} NFL games for ${playerName}`)
          } else {
            const error = await response.json()
            console.log(`${error.error || 'No NFL stats found'} for ${playerName}`)
          }
        } else {
          console.log(`Stats not available for ${sport}`)
          clearTimeout(timeoutId)
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`Stats request timeout for ${playerName}`)
        } else {
          console.log(`Stats unavailable for ${playerName}`)
        }
      } finally {
        setLoadingStats(false)
      }
    }

    fetchStats()
  }, [playerName, props])

  // Group props by prop_type and collect all unique lines
  const groupedProps: GroupedProp[] = []
  const propTypeMap = new Map<string, GroupedProp>()

  props.forEach(prop => {
    if (!propTypeMap.has(prop.prop_type)) {
      propTypeMap.set(prop.prop_type, {
        propType: prop.prop_type,
        lines: []
      })
    }
    
    const group = propTypeMap.get(prop.prop_type)!
    group.lines.push({
      line: prop.line,
      over_odds: prop.over_odds ?? undefined,
      under_odds: prop.under_odds ?? undefined,
      sportsbook: prop.sportsbook,
      propId: prop.id
    })
  })

  // Sort lines within each prop type
  propTypeMap.forEach(group => {
    group.lines.sort((a, b) => a.line - b.line)
    groupedProps.push(group)
  })

  const handlePrevLine = (propType: string, currentIndex: number) => {
    if (currentIndex > 0) {
      setSelectedLineIndex(prev => ({
        ...prev,
        [propType]: currentIndex - 1
      }))
    }
  }

  const handleNextLine = (propType: string, currentIndex: number, maxIndex: number) => {
    if (currentIndex < maxIndex) {
      setSelectedLineIndex(prev => ({
        ...prev,
        [propType]: currentIndex + 1
      }))
    }
  }

  const handleSelectBet = (propType: string, selection: 'over' | 'under', lineData: any) => {
    onSelectBet({
      type: 'player_prop',
      player: playerName,
      propType,
      selection,
      line: lineData.line,
      odds: selection === 'over' ? lineData.over_odds : lineData.under_odds,
      sportsbook: lineData.sportsbook
    })
  }

  // Helper: Determine sport from prop type
  function determineSport(propType: string): 'football' | 'basketball' | 'baseball' | 'hockey' {
    const lowerProp = propType.toLowerCase()
    
    // Football keywords
    if (lowerProp.includes('pass') || lowerProp.includes('rush') || lowerProp.includes('reception') || 
        lowerProp.includes('touchdown') || lowerProp.includes('yard') || lowerProp.includes('completion') ||
        lowerProp.includes('interception') || lowerProp.includes('sack')) {
      return 'football'
    }
    
    // Basketball keywords
    if (lowerProp.includes('point') || lowerProp.includes('rebound') || lowerProp.includes('assist') || 
        lowerProp.includes('three') || lowerProp.includes('steal') || lowerProp.includes('block') ||
        lowerProp.includes('turnover') || lowerProp.includes('foul')) {
      return 'basketball'
    }
    
    // Baseball keywords
    if (lowerProp.includes('batter') || lowerProp.includes('pitcher') || lowerProp.includes('hit') || 
        lowerProp.includes('strikeout') || lowerProp.includes('home run') || lowerProp.includes('rbi')) {
      return 'baseball'
    }
    
    // Hockey keywords
    if (lowerProp.includes('goal') || lowerProp.includes('save') || lowerProp.includes('shot')) {
      return 'hockey'
    }
    
    console.log(`Could not determine sport for prop type: "${propType}", defaulting to basketball`)
    return 'basketball'
  }

  // Helper: Get stat value from recent games for a specific prop type
  function getStatFromGame(game: any, propType: string): number | null {
    const statKey = mapPropToStatKey(propType)
    return game.stats[statKey] ?? null
  }

  function mapPropToStatKey(propType: string): string {
    const mapping: Record<string, string> = {
      'player_pass_yds': 'passingYards',
      'player_pass_tds': 'passingTouchdowns',
      'player_rush_yds': 'rushingYards',
      'player_receptions': 'receptions',
      'player_reception_yds': 'receivingYards',
      'player_points': 'points',
      'player_rebounds': 'rebounds',
      'player_assists': 'assists',
      'player_threes': 'threePointFieldGoalsMade',
    }
    return mapping[propType] || propType
  }

  const sport = determineSport(props[0]?.prop_type || '')

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Markets List */}
      <div className="space-y-3 overflow-x-hidden">
        {groupedProps.map(group => {
          const currentIndex = selectedLineIndex[group.propType] || 0
          const currentLine = group.lines[currentIndex]
          const hasMultipleLines = group.lines.length > 1

          return (
            <div key={group.propType} className="bg-black/30 rounded-lg p-3 border border-white/10">
              {/* Market Name */}
              <div className="mb-2">
                <span className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
                  {group.propType}
                </span>
              </div>

              {/* Book, Line Selector, and Odds */}
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                {/* Left: Sportsbook */}
                <div className="flex-shrink-0 min-w-[50px] sm:min-w-[60px]">
                  {currentLine.sportsbook && (
                    <span className="text-[10px] sm:text-xs text-gray-500 truncate">
                      {currentLine.sportsbook}
                    </span>
                  )}
                </div>

                {/* Center: Line Selector with Swipe Support */}
                <div 
                  className="flex items-center flex-1 justify-center touch-pan-x"
                  onTouchStart={(e) => {
                    if (!hasMultipleLines) return
                    const touch = e.touches[0]
                    ;(e.currentTarget as any).touchStartX = touch.clientX
                  }}
                  onTouchEnd={(e) => {
                    if (!hasMultipleLines) return
                    const touch = e.changedTouches[0]
                    const startX = (e.currentTarget as any).touchStartX
                    const diff = touch.clientX - startX
                    
                    if (Math.abs(diff) > 50) {
                      if (diff > 0 && currentIndex > 0) {
                        handlePrevLine(group.propType, currentIndex)
                      } else if (diff < 0 && currentIndex < group.lines.length - 1) {
                        handleNextLine(group.propType, currentIndex, group.lines.length - 1)
                      }
                    }
                  }}
                >
                  {hasMultipleLines && (
                    <button
                      onClick={() => handlePrevLine(group.propType, currentIndex)}
                      disabled={currentIndex === 0}
                      style={{ background: 'none', border: 'none', padding: 0, margin: 0 }}
                      className={`${
                        currentIndex === 0 
                          ? 'text-gray-700 cursor-not-allowed' 
                          : 'text-blue-400 hover:text-blue-300 active:scale-90'
                      } transition-all`}
                    >
                      <ChevronLeft size={20} />
                    </button>
                  )}

                  <div className="text-center min-w-[50px] sm:min-w-[60px] px-1 sm:px-2">
                    <span className="text-base sm:text-lg font-bold text-white">{currentLine.line}</span>
                  </div>

                  {hasMultipleLines && (
                    <button
                      onClick={() => handleNextLine(group.propType, currentIndex, group.lines.length - 1)}
                      disabled={currentIndex === group.lines.length - 1}
                      style={{ background: 'none', border: 'none', padding: 0, margin: 0 }}
                      className={`${
                        currentIndex === group.lines.length - 1
                          ? 'text-gray-700 cursor-not-allowed'
                          : 'text-blue-400 hover:text-blue-300 active:scale-90'
                      } transition-all`}
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>

                {/* Right: Over/Under Buttons */}
                <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                  {currentLine.over_odds !== undefined && (
                    <button
                      onClick={() => handleSelectBet(group.propType, 'over', currentLine)}
                      className="bg-black text-white border border-green-600 rounded px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-green-900/20 transition-all active:scale-95 min-w-[55px] sm:min-w-[60px]"
                    >
                      <div className="text-[10px] sm:text-xs text-green-500 font-semibold">O</div>
                      <div className="text-xs sm:text-sm font-bold">
                        {currentLine.over_odds > 0 ? '+' : ''}{currentLine.over_odds}
                      </div>
                    </button>
                  )}
                  
                  {currentLine.under_odds !== undefined && (
                    <button
                      onClick={() => handleSelectBet(group.propType, 'under', currentLine)}
                      className="bg-black text-white border border-red-600 rounded px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-red-900/20 transition-all active:scale-95 min-w-[55px] sm:min-w-[60px]"
                    >
                      <div className="text-[10px] sm:text-xs text-red-500 font-semibold">U</div>
                      <div className="text-xs sm:text-sm font-bold">
                        {currentLine.under_odds > 0 ? '+' : ''}{currentLine.under_odds}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Stats */}
      <div className="bg-black/30 rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Recent Performance
        </h4>
        
        {loadingStats ? (
          <div className="text-center text-gray-500 py-6">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className="h-4 w-32 bg-gray-700 rounded"></div>
              <div className="h-3 w-24 bg-gray-700 rounded"></div>
            </div>
          </div>
        ) : sport === 'basketball' && nbaGameLogs.length > 0 ? (
          <div className="overflow-x-auto -mx-4 px-4 touch-pan-x [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-500 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-color:rgb(59_130_246)_transparent]">
            <table className="w-full text-xs sm:text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-gray-400 font-semibold sticky left-0 bg-black/30 backdrop-blur-sm z-20 min-w-[50px] shadow-[4px_0_8px_rgba(0,0,0,0.5)]">Date</th>
                  <th className="text-left py-2 px-2 text-blue-400 font-semibold sticky left-[50px] bg-black/30 backdrop-blur-sm z-20 min-w-[55px] shadow-[4px_0_8px_rgba(0,0,0,0.5)]">Opp</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">MIN</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">PTS</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">REB</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">AST</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">STL</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">BLK</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">TO</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">FGM</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">FGA</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">FG%</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">3PM</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">3PA</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">3P%</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">FTM</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">FTA</th>
                  <th className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap">FT%</th>
                </tr>
              </thead>
              <tbody>
                {nbaGameLogs.map((game, index) => {
                  // Format date as M/D
                  const date = new Date(game.gameDate)
                  const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`
                  
                  // Calculate percentages
                  const fgPct = game.fieldGoalsAttempted > 0 
                    ? ((game.fieldGoalsMade / game.fieldGoalsAttempted) * 100).toFixed(1)
                    : '0.0'
                  const threePct = game.threePointsAttempted > 0
                    ? ((game.threePointsMade / game.threePointsAttempted) * 100).toFixed(1)
                    : '0.0'
                  const ftPct = game.freeThrowsAttempted > 0
                    ? ((game.freeThrowsMade / game.freeThrowsAttempted) * 100).toFixed(1)
                    : '0.0'
                  
                  return (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-2 px-2 text-gray-300 sticky left-0 bg-black/30 backdrop-blur-sm z-20 whitespace-nowrap shadow-[4px_0_8px_rgba(0,0,0,0.5)]">{formattedDate}</td>
                      <td className="py-2 px-2 text-blue-400 font-medium sticky left-[50px] bg-black/30 backdrop-blur-sm z-20 whitespace-nowrap shadow-[4px_0_8px_rgba(0,0,0,0.5)]">{game.opponent}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-white whitespace-nowrap">{game.minutesPlayed}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-white font-bold whitespace-nowrap">{game.points}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-white whitespace-nowrap">{game.rebounds}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-white whitespace-nowrap">{game.assists}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-white whitespace-nowrap">{game.steals}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-white whitespace-nowrap">{game.blocks}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-red-400 whitespace-nowrap">{game.turnovers}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-gray-300 whitespace-nowrap">{game.fieldGoalsMade}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-gray-400 whitespace-nowrap">{game.fieldGoalsAttempted}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-gray-300 whitespace-nowrap">{fgPct}%</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-blue-300 whitespace-nowrap">{game.threePointsMade}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-gray-400 whitespace-nowrap">{game.threePointsAttempted}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-blue-300 whitespace-nowrap">{threePct}%</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-gray-300 whitespace-nowrap">{game.freeThrowsMade}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-gray-400 whitespace-nowrap">{game.freeThrowsAttempted}</td>
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-gray-300 whitespace-nowrap">{ftPct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : sport === 'football' && nflGameLogs.length > 0 ? (
          <div className="overflow-x-auto -mx-4 px-4 touch-pan-x [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-500 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-color:rgb(59_130_246)_transparent]">
            {(() => {
              const firstGame = nflGameLogs[0]
              const statKeys = Object.keys(firstGame.stats || {}).slice(0, 8)

              return (
                <table className="w-full text-xs sm:text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 px-2 text-gray-400 font-semibold sticky left-0 bg-black/30 backdrop-blur-sm z-20 min-w-[60px] shadow-[4px_0_8px_rgba(0,0,0,0.5)]">Date</th>
                      <th className="text-left py-2 px-2 text-blue-400 font-semibold sticky left-[60px] bg-black/30 backdrop-blur-sm z-20 min-w-[70px] shadow-[4px_0_8px_rgba(0,0,0,0.5)]">Opp</th>
                      {statKeys.map(key => (
                        <th
                          key={key}
                          className="text-center py-1.5 sm:py-2 px-1 sm:px-2 text-gray-400 font-semibold whitespace-nowrap"
                        >
                          {key.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nflGameLogs.map((game, index) => {
                      const date = game.gameDate ? new Date(game.gameDate) : null
                      const formattedDate = date && !Number.isNaN(date.getTime())
                        ? `${date.getMonth() + 1}/${date.getDate()}`
                        : game.gameDate

                      return (
                        <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 px-2 text-gray-300 sticky left-0 bg-black/30 backdrop-blur-sm z-20 whitespace-nowrap shadow-[4px_0_8px_rgba(0,0,0,0.5)]">{formattedDate}</td>
                          <td className="py-2 px-2 text-blue-400 font-medium sticky left-[60px] bg-black/30 backdrop-blur-sm z-20 whitespace-nowrap shadow-[4px_0_8px_rgba(0,0,0,0.5)]">{game.opponent}</td>
                          {statKeys.map(key => (
                            <td
                              key={key}
                              className="py-1.5 sm:py-2 px-1 sm:px-2 text-center text-white whitespace-nowrap"
                            >
                              {game.stats[key] ?? 0}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })()}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-6">
            <p className="text-sm">No recent games</p>
            <p className="text-xs mt-1 text-gray-600">Stats will load when available</p>
          </div>
        )}
      </div>
    </div>
  )
}
