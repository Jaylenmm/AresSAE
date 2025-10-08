'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Game, OddsData, PlayerProp } from '@/lib/types'
import { analyzeGameBet, analyzePlayerProp } from '@/lib/betAnalysis'

interface FeaturedBet {
  id: string
  type: 'spread' | 'moneyline' | 'total' | 'player_prop'
  display_title: string
  display_subtitle: string
  odds: number
  sportsbook: string
  hit_probability: number
  game_id: string
  betData: any
}

export default function FeaturedPicks({ sport }: { sport: string }) {
  const router = useRouter()
  const [featuredBets, setFeaturedBets] = useState<FeaturedBet[]>([])
  const [loading, setLoading] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    analyzeFeaturedBets()
  }, [sport])

  // Auto-scroll effect
  useEffect(() => {
    if (featuredBets.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredBets.length)
    }, 5000) // Scroll every 5 seconds

    return () => clearInterval(interval)
  }, [featuredBets.length])

  // Smooth scroll when index changes
  useEffect(() => {
    if (scrollContainerRef.current && featuredBets.length > 0) {
      const cardWidth = scrollContainerRef.current.children[0]?.clientWidth || 280
      const gap = 12 // gap-3 = 12px
      scrollContainerRef.current.scrollTo({
        left: currentIndex * (cardWidth + gap),
        behavior: 'smooth'
      })
    }
  }, [currentIndex, featuredBets])

  async function analyzeFeaturedBets() {
    setLoading(true)
    try {
      // Fetch all games and odds for the selected sport
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('sport', sport)
        .gte('game_date', new Date().toISOString())
        .order('game_date', { ascending: true })

      if (!games || games.length === 0) {
        setFeaturedBets([])
        setLoading(false)
        return
      }

      const gameIds = games.map(g => g.id)

      // Fetch all odds
      const { data: allOdds } = await supabase
        .from('odds_data')
        .select('*')
        .in('game_id', gameIds)

      // Fetch all player props
      const { data: allProps } = await supabase
        .from('player_props')
        .select('*')
        .in('game_id', gameIds)

      const scoredBets: (FeaturedBet & { score: number })[] = []

      // Analyze spreads
      if (allOdds) {
        for (const game of games) {
          const gameOdds = allOdds.filter(o => o.game_id === game.id)
          if (gameOdds.length === 0) continue

          // Analyze home spread
          if (gameOdds.some(o => o.spread_home && o.spread_home_odds)) {
            const bestHomeSpread = gameOdds.reduce((best, curr) => {
              if (!curr.spread_home_odds) return best
              if (!best.spread_home_odds) return curr
              return Math.abs(curr.spread_home_odds) < Math.abs(best.spread_home_odds) ? curr : best
            })

            try {
              const analysis = await analyzeGameBet({
                type: 'spread',
                selection: 'home',
                team: game.home_team,
                line: bestHomeSpread.spread_home,
                odds: bestHomeSpread.spread_home_odds!,
                sportsbook: bestHomeSpread.sportsbook,
                game_id: game.id
              }, gameOdds)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${game.id}-spread-home`,
                type: 'spread',
                display_title: game.home_team,
                display_subtitle: `${bestHomeSpread.spread_home! > 0 ? '+' : ''}${bestHomeSpread.spread_home}`,
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: game.id,
                betData: { game, odds: gameOdds, selection: 'home', type: 'spread' },
                score
              })
            } catch (e) {
              console.error('Error analyzing spread:', e)
            }
          }

          // Analyze away spread
          if (gameOdds.some(o => o.spread_away && o.spread_away_odds)) {
            const bestAwaySpread = gameOdds.reduce((best, curr) => {
              if (!curr.spread_away_odds) return best
              if (!best.spread_away_odds) return curr
              return Math.abs(curr.spread_away_odds) < Math.abs(best.spread_away_odds) ? curr : best
            })

            try {
              const analysis = await analyzeGameBet({
                type: 'spread',
                selection: 'away',
                team: game.away_team,
                line: bestAwaySpread.spread_away,
                odds: bestAwaySpread.spread_away_odds!,
                sportsbook: bestAwaySpread.sportsbook,
                game_id: game.id
              }, gameOdds)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${game.id}-spread-away`,
                type: 'spread',
                display_title: game.away_team,
                display_subtitle: `${bestAwaySpread.spread_away! > 0 ? '+' : ''}${bestAwaySpread.spread_away}`,
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: game.id,
                betData: { game, odds: gameOdds, selection: 'away', type: 'spread' },
                score
              })
            } catch (e) {
              console.error('Error analyzing spread:', e)
            }
          }

          // Analyze totals (over/under)
          if (gameOdds.some(o => o.total && o.over_odds)) {
            const bestOver = gameOdds.reduce((best, curr) => {
              if (!curr.over_odds) return best
              if (!best.over_odds) return curr
              return Math.abs(curr.over_odds) < Math.abs(best.over_odds) ? curr : best
            })

            try {
              const analysis = await analyzeGameBet({
                type: 'total',
                selection: 'over',
                line: bestOver.total,
                odds: bestOver.over_odds!,
                sportsbook: bestOver.sportsbook,
                game_id: game.id
              }, gameOdds)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${game.id}-total-over`,
                type: 'total',
                display_title: `${game.away_team} @ ${game.home_team}`,
                display_subtitle: `Over ${bestOver.total}`,
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: game.id,
                betData: { game, odds: gameOdds, selection: 'over', type: 'total' },
                score
              })
            } catch (e) {
              console.error('Error analyzing total:', e)
            }
          }

          if (gameOdds.some(o => o.total && o.under_odds)) {
            const bestUnder = gameOdds.reduce((best, curr) => {
              if (!curr.under_odds) return best
              if (!best.under_odds) return curr
              return Math.abs(curr.under_odds) < Math.abs(best.under_odds) ? curr : best
            })

            try {
              const analysis = await analyzeGameBet({
                type: 'total',
                selection: 'under',
                line: bestUnder.total,
                odds: bestUnder.under_odds!,
                sportsbook: bestUnder.sportsbook,
                game_id: game.id
              }, gameOdds)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${game.id}-total-under`,
                type: 'total',
                display_title: `${game.away_team} @ ${game.home_team}`,
                display_subtitle: `Under ${bestUnder.total}`,
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: game.id,
                betData: { game, odds: gameOdds, selection: 'under', type: 'total' },
                score
              })
            } catch (e) {
              console.error('Error analyzing total:', e)
            }
          }

          // Analyze moneylines
          if (gameOdds.some(o => o.moneyline_home)) {
            const bestHomeML = gameOdds.reduce((best, curr) => {
              if (!curr.moneyline_home) return best
              if (!best.moneyline_home) return curr
              return curr.moneyline_home > best.moneyline_home ? curr : best
            })

            try {
              const analysis = await analyzeGameBet({
                type: 'moneyline',
                selection: 'home',
                team: game.home_team,
                odds: bestHomeML.moneyline_home!,
                sportsbook: bestHomeML.sportsbook,
                game_id: game.id
              }, gameOdds)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${game.id}-ml-home`,
                type: 'moneyline',
                display_title: game.home_team,
                display_subtitle: 'ML',
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: game.id,
                betData: { game, odds: gameOdds, selection: 'home', type: 'moneyline' },
                score
              })
            } catch (e) {
              console.error('Error analyzing moneyline:', e)
            }
          }

          if (gameOdds.some(o => o.moneyline_away)) {
            const bestAwayML = gameOdds.reduce((best, curr) => {
              if (!curr.moneyline_away) return best
              if (!best.moneyline_away) return curr
              return curr.moneyline_away > best.moneyline_away ? curr : best
            })

            try {
              const analysis = await analyzeGameBet({
                type: 'moneyline',
                selection: 'away',
                team: game.away_team,
                odds: bestAwayML.moneyline_away!,
                sportsbook: bestAwayML.sportsbook,
                game_id: game.id
              }, gameOdds)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${game.id}-ml-away`,
                type: 'moneyline',
                display_title: game.away_team,
                display_subtitle: 'ML',
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: game.id,
                betData: { game, odds: gameOdds, selection: 'away', type: 'moneyline' },
                score
              })
            } catch (e) {
              console.error('Error analyzing moneyline:', e)
            }
          }
        }
      }

      // Analyze player props (limit to first 20 to avoid overload)
      if (allProps) {
        const propsToAnalyze = allProps.slice(0, 20)
        
        for (const prop of propsToAnalyze) {
          const propGame = games.find(g => g.id === prop.game_id)
          if (!propGame) continue

          const gameProps = allProps.filter(p => p.game_id === prop.game_id)

          // Analyze over (skip if already analyzed for this player/prop combo)
          if (prop.over_odds) {
            const alreadyAnalyzed = scoredBets.some(
              b => b.type === 'player_prop' && 
              b.display_title === prop.player_name && 
              b.display_subtitle.includes(prop.prop_type)
            )
            
            if (alreadyAnalyzed) continue

            try {
              const analysis = await analyzePlayerProp({
                type: 'player_prop',
                player: prop.player_name,
                propType: prop.prop_type,
                selection: 'over',
                line: prop.line,
                odds: prop.over_odds,
                sportsbook: prop.sportsbook,
                game_id: prop.game_id
              }, gameProps)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${prop.id}-over`,
                type: 'player_prop',
                display_title: prop.player_name,
                display_subtitle: `Over ${prop.line} ${prop.prop_type}`,
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: prop.game_id,
                betData: { prop, game: propGame, selection: 'over' },
                score
              })
            } catch (e) {
              console.error('Error analyzing prop over:', e)
              continue // Skip this prop and move to next
            }
          }

          // Analyze under (skip if already analyzed for this player/prop combo)
          if (prop.under_odds) {
            const alreadyAnalyzed = scoredBets.some(
              b => b.type === 'player_prop' && 
              b.display_title === prop.player_name && 
              b.display_subtitle.includes(prop.prop_type)
            )
            
            if (alreadyAnalyzed) continue

            try {
              const analysis = await analyzePlayerProp({
                type: 'player_prop',
                player: prop.player_name,
                propType: prop.prop_type,
                selection: 'under',
                line: prop.line,
                odds: prop.under_odds,
                sportsbook: prop.sportsbook,
                game_id: prop.game_id
              }, gameProps)

              const score = analysis.hit_probability * 0.6 + (analysis.best_odds > 0 ? analysis.best_odds / 10 : 100 / Math.abs(analysis.best_odds)) * 0.4

              scoredBets.push({
                id: `${prop.id}-under`,
                type: 'player_prop',
                display_title: prop.player_name,
                display_subtitle: `Under ${prop.line} ${prop.prop_type}`,
                odds: analysis.best_odds,
                sportsbook: analysis.best_book,
                hit_probability: analysis.hit_probability,
                game_id: prop.game_id,
                betData: { prop, game: propGame, selection: 'under' },
                score
              })
            } catch (e) {
              console.error('Error analyzing prop under:', e)
              continue // Skip this prop and move to next
            }
          }
        }
      }

      // Sort by score and categorize bets
      scoredBets.sort((a, b) => b.score - a.score)
      
      const featuredSelection: FeaturedBet[] = []
      
      // Get top moneyline bet
      const topML = scoredBets.find(b => b.type === 'moneyline')
      if (topML) featuredSelection.push(topML)
      
      // Get top spread bet
      const topSpread = scoredBets.find(b => b.type === 'spread')
      if (topSpread) featuredSelection.push(topSpread)
      
      // Get top total bet
      const topTotal = scoredBets.find(b => b.type === 'total')
      if (topTotal) featuredSelection.push(topTotal)
      
      // Get top 3 specific player props: Pass Yds, Pass TDs, Rush Yds
      const passYdProps = scoredBets.filter(b => 
        b.type === 'player_prop' && 
        (b.display_subtitle.toLowerCase().includes('pass') && b.display_subtitle.toLowerCase().includes('yd'))
      )
      if (passYdProps.length > 0) featuredSelection.push(passYdProps[0])
      
      const passTdProps = scoredBets.filter(b => 
        b.type === 'player_prop' && 
        (b.display_subtitle.toLowerCase().includes('pass') && b.display_subtitle.toLowerCase().includes('td'))
      )
      if (passTdProps.length > 0) featuredSelection.push(passTdProps[0])
      
      const rushYdProps = scoredBets.filter(b => 
        b.type === 'player_prop' && 
        (b.display_subtitle.toLowerCase().includes('rush') && b.display_subtitle.toLowerCase().includes('yd'))
      )
      if (rushYdProps.length > 0) featuredSelection.push(rushYdProps[0])
      
      setFeaturedBets(featuredSelection)

    } catch (error) {
      console.error('Error analyzing featured bets:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleCardClick(bet: FeaturedBet) {
    // For player props, navigate with prop_id to auto-scroll to that player
    if (bet.type === 'player_prop' && bet.betData?.prop?.id) {
      router.push(`/build?prop_id=${bet.betData.prop.id}`)
    } else {
      // For game bets, navigate with game_id
      router.push(`/build?game_id=${bet.game_id}`)
    }
  }

  if (loading) {
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Ares Picks</h2>
        </div>
        <div className="text-center py-8 text-gray-500">Analyzing bets...</div>
      </section>
    )
  }

  if (featuredBets.length === 0) {
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
        {featuredBets.map((bet) => (
          <div
            key={bet.id}
            onClick={() => handleCardClick(bet)}
            className="flex-shrink-0 w-[280px] snap-start bg-gradient-to-br from-blue-600 to-blue-900 rounded-lg p-4 text-white cursor-pointer hover:shadow-xl transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">{bet.display_title}</p>
                <p className="text-sm text-blue-100">{bet.display_subtitle}</p>
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
              <div className="text-right">
                <p className="text-xs text-blue-200">Book</p>
                <p className="text-sm font-semibold">{bet.sportsbook}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manual navigation dots */}
      <div className="flex justify-center gap-2 mt-4">
        {featuredBets.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  )
}