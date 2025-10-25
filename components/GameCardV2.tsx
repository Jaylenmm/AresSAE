'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Game, OddsData } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import BetConfirmationModal from './BetConfirmationModal'

interface GameCardV2Props {
  game: Game
  odds?: OddsData[]
}

export default function GameCardV2({ game, odds }: GameCardV2Props) {
  const router = useRouter()
  const mainOdds = odds?.[0]
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingBet, setPendingBet] = useState<any>(null)
  
  // Format date and time with timezone
  const gameDate = new Date(game.game_date)
  const dateStr = gameDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  })
  const timeStr = gameDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    timeZoneName: 'short'
  })

  const handlePickClick = (pickType: string, team: string, odds: number, line?: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    let selection = ''
    if (pickType === 'spread') {
      selection = `${team} ${line && line > 0 ? '+' : ''}${line}`
    } else if (pickType === 'ml') {
      selection = `${team} ML`
    } else if (pickType === 'over') {
      selection = `Over ${line}`
    } else if (pickType === 'under') {
      selection = `Under ${line}`
    }
    
    setPendingBet({
      team,
      selection,
      line,
      odds,
      sportsbook: mainOdds?.sportsbook || 'Best Available'
    })
    setIsModalOpen(true)
  }

  const handleConfirmBet = async () => {
    if (!pendingBet) return

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      const redirectUrl = `/build?game_id=${game.id}`
      sessionStorage.setItem('pending_bet', JSON.stringify(pendingBet))
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
      return
    }

    const pickData = {
      user_id: user.id,
      pick_type: 'straight',
      picks: {
        bet_type: 'game',
        selection: pendingBet.selection,
        team: pendingBet.team,
        line: pendingBet.line,
        odds: pendingBet.odds,
        sportsbook: pendingBet.sportsbook,
        game_id: game.id
      },
      total_odds: pendingBet.odds,
      status: 'pending'
    }

    console.log('Attempting to save pick:', pickData)

    const { data, error } = await supabase
      .from('user_picks')
      .insert([pickData])
      .select()

    console.log('Save result - data:', data, 'error:', error)

    setIsModalOpen(false)
    setPendingBet(null)

    if (error) {
      console.error('Error saving pick:', error)
      alert(`Error saving bet: ${error.message}`)
    } else {
      console.log('Pick saved successfully:', data)
      alert('Bet saved successfully!')
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setPendingBet(null)
  }

  const buttonClass = "bg-black text-white text-sm font-medium px-3 py-2.5 rounded-lg transition-all active:scale-95 border-[3px] border-blue-600"

  return (
    <div className="bg-gray-900 rounded-lg p-5 border-1 border-white/20 transition-all">
      {/* Sport Badge */}
      <div className="mb-3">
        <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2.5 py-1 rounded-full">
          {game.sport}
        </span>
      </div>

      {/* Column Headers */}
      <div className="flex justify-between items-center mb-2">
        <span className="flex-1"></span>
        <div className="flex gap-2 text-center">
          {mainOdds?.spread_away !== undefined && (
            <div className="text-[10px] text-gray-500 uppercase font-semibold flex-1">Spread</div>
          )}
          {mainOdds?.moneyline_away !== undefined && (
            <div className="text-[10px] text-gray-500 uppercase font-semibold flex-1">ML</div>
          )}
          {mainOdds?.total !== undefined && (
            <div className="text-[10px] text-gray-500 uppercase font-semibold flex-1">Total</div>
          )}
        </div>
      </div>

      {/* Away Team Row */}
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold text-white text-lg flex-1">{game.away_team}</span>
        <div className="flex gap-2">
          {/* Spread */}
          {mainOdds?.spread_away !== undefined && (
            <button
              onClick={(e) => handlePickClick('spread', game.away_team, mainOdds.spread_away_odds!, mainOdds.spread_away!, e)}
              className={buttonClass}
            >
              {mainOdds.spread_away > 0 ? '+' : ''}{mainOdds.spread_away} ({mainOdds.spread_away_odds})
            </button>
          )}
          
          {/* Moneyline */}
          {mainOdds?.moneyline_away !== undefined && (
            <button
              onClick={(e) => handlePickClick('ml', game.away_team, mainOdds.moneyline_away!, undefined, e)}
              className={buttonClass}
            >
              {mainOdds.moneyline_away > 0 ? '+' : ''}{mainOdds.moneyline_away}
            </button>
          )}
          
          {/* Total Over */}
          {mainOdds?.total !== undefined && mainOdds?.over_odds !== undefined && (
            <button
              onClick={(e) => handlePickClick('over', game.away_team, mainOdds.over_odds!, mainOdds.total!, e)}
              className={buttonClass}
            >
              O{mainOdds.total} ({mainOdds.over_odds})
            </button>
          )}
        </div>
      </div>

      {/* Home Team Row */}
      <div className="flex justify-between items-center mb-5">
        <span className="font-bold text-white text-lg flex-1">{game.home_team}</span>
        <div className="flex gap-2">
          {/* Spread */}
          {mainOdds?.spread_home !== undefined && (
            <button
              onClick={(e) => handlePickClick('spread', game.home_team, mainOdds.spread_home_odds!, mainOdds.spread_home!, e)}
              className={buttonClass}
            >
              {mainOdds.spread_home > 0 ? '+' : ''}{mainOdds.spread_home} ({mainOdds.spread_home_odds})
            </button>
          )}
          
          {/* Moneyline */}
          {mainOdds?.moneyline_home !== undefined && (
            <button
              onClick={(e) => handlePickClick('ml', game.home_team, mainOdds.moneyline_home!, undefined, e)}
              className={buttonClass}
            >
              {mainOdds.moneyline_home > 0 ? '+' : ''}{mainOdds.moneyline_home}
            </button>
          )}
          
          {/* Total Under */}
          {mainOdds?.total !== undefined && mainOdds?.under_odds !== undefined && (
            <button
              onClick={(e) => handlePickClick('under', game.home_team, mainOdds.under_odds!, mainOdds.total!, e)}
              className={buttonClass}
            >
              U{mainOdds.total} ({mainOdds.under_odds})
            </button>
          )}
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="pt-3 mt-3 -mx-5 -mb-5 px-5 pb-3 bg-gradient-to-r from-blue-900/30 to-blue-400/30 flex justify-between items-center rounded-b-lg">
        <div className="text-xs text-gray-400">
          <span className="font-medium">{dateStr}</span>
          <span className="mx-2">•</span>
          <span>{timeStr}</span>
          {(game as any).venue && (
            <>
              <span className="mx-2">•</span>
              <span>{(game as any).venue}</span>
            </>
          )}
        </div>
        <Link 
          href={`/build?game_id=${game.id}`}
          className="text-sm text-gray-200 font-medium flex items-center gap-1 active:text-blue-300"
        >
          Deeper Look →
        </Link>
      </div>

      {/* Bet Confirmation Modal */}
      {pendingBet && (
        <BetConfirmationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onConfirm={handleConfirmBet}
          betDetails={pendingBet}
        />
      )}
    </div>
  )
}
