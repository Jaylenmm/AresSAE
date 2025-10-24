'use client'

import { useState, useEffect } from 'react'
import { PlayerProp } from '@/lib/types'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'

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

export default function PlayerPropDisplay({ playerName, props, onSelectBet }: PlayerPropDisplayProps) {
  const [selectedLineIndex, setSelectedLineIndex] = useState<Record<string, number>>({})
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Fetch real stats - simplified approach
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true)
      try {
        const sport = determineSport(props[0]?.prop_type || '')
        
        // Try to get stats with aggressive timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch(
          `/api/scrape-player-stats?player=${encodeURIComponent(playerName)}&sport=${sport}`,
          { signal: controller.signal }
        )
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const statsData = await response.json()
          
          // Use scraped data directly
          setPlayerStats({
            recentGames: statsData.recentGames || [],
            seasonAverages: statsData.seasonAverages || {}
          })
        }
      } catch (error: any) {
        // Stats failed - that's okay, just don't show them
        console.log(`Stats unavailable for ${playerName}`)
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
  function determineSport(propType: string): 'football' | 'basketball' | 'baseball' {
    if (propType.includes('pass') || propType.includes('rush') || propType.includes('reception')) {
      return 'football'
    }
    if (propType.includes('points') || propType.includes('rebounds') || propType.includes('assists')) {
      return 'basketball'
    }
    if (propType.includes('batter') || propType.includes('pitcher') || propType.includes('hits')) {
      return 'baseball'
    }
    return 'football' // default
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

  return (
    <div className="space-y-4">
      {/* Markets List */}
      <div className="space-y-3">
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
              <div className="flex items-center justify-between gap-4">
                {/* Left: Sportsbook */}
                <div className="flex-shrink-0 min-w-[60px]">
                  {currentLine.sportsbook && (
                    <span className="text-xs text-gray-500">
                      {currentLine.sportsbook}
                    </span>
                  )}
                </div>

                {/* Center: Line Selector */}
                <div className="flex items-center gap-2 flex-1 justify-center">
                  {hasMultipleLines && (
                    <button
                      onClick={() => handlePrevLine(group.propType, currentIndex)}
                      disabled={currentIndex === 0}
                      className={`p-1 ${
                        currentIndex === 0 
                          ? 'text-gray-600 cursor-not-allowed' 
                          : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}

                  <div className="text-center min-w-[60px]">
                    <span className="text-lg font-bold text-white">{currentLine.line}</span>
                  </div>

                  {hasMultipleLines && (
                    <button
                      onClick={() => handleNextLine(group.propType, currentIndex, group.lines.length - 1)}
                      disabled={currentIndex === group.lines.length - 1}
                      className={`p-1 ${
                        currentIndex === group.lines.length - 1
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>

                {/* Right: Over/Under Buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  {currentLine.over_odds !== undefined && (
                    <button
                      onClick={() => handleSelectBet(group.propType, 'over', currentLine)}
                      className="bg-black text-white border border-green-600 rounded px-3 py-1.5 hover:bg-green-900/20 transition-all active:scale-95 min-w-[60px]"
                    >
                      <div className="text-xs text-green-500 font-semibold">O</div>
                      <div className="text-sm font-bold">
                        {currentLine.over_odds > 0 ? '+' : ''}{currentLine.over_odds}
                      </div>
                    </button>
                  )}
                  
                  {currentLine.under_odds !== undefined && (
                    <button
                      onClick={() => handleSelectBet(group.propType, 'under', currentLine)}
                      className="bg-black text-white border border-red-600 rounded px-3 py-1.5 hover:bg-red-900/20 transition-all active:scale-95 min-w-[60px]"
                    >
                      <div className="text-xs text-red-500 font-semibold">U</div>
                      <div className="text-sm font-bold">
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
        ) : playerStats && playerStats.recentGames.length > 0 ? (
          <div className="space-y-2">
            {playerStats.recentGames.map((game, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-sm text-gray-500">{game.date}</span>
                <span className="text-sm font-bold text-white">{getStatFromGame(game, groupedProps[0]?.propType || '')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-6">
            <p className="text-sm">No recent games</p>
            <p className="text-xs mt-1 text-gray-600">We're working on integrating player statistics</p>
          </div>
        )}
      </div>
    </div>
  )
}
