'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { PlayerProp } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import BetConfirmationModal from './BetConfirmationModal'

interface PropCardV2Props {
  prop: PlayerProp
}

export default function PropCardV2({ prop }: PropCardV2Props) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingBet, setPendingBet] = useState<any>(null)

  const handlePickClick = (pickType: 'over' | 'under', odds: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const selection = pickType === 'over' ? 'Over' : 'Under'
    
    setPendingBet({
      player: prop.player_name,
      selection,
      line: prop.line,
      propType: prop.prop_type,
      odds,
      sportsbook: prop.sportsbook || 'Best Available'
    })
    setIsModalOpen(true)
  }

  const handleConfirmBet = async () => {
    if (!pendingBet) return

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      const redirectUrl = `/build?prop_id=${prop.id}`
      sessionStorage.setItem('pending_bet', JSON.stringify(pendingBet))
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
      return
    }

    const pickData = {
      user_id: user.id,
      pick_type: 'straight',
      picks: {
        bet_type: 'player_prop',
        selection: pendingBet.selection,
        player: pendingBet.player,
        prop_type: pendingBet.propType,
        line: pendingBet.line,
        odds: pendingBet.odds,
        sportsbook: pendingBet.sportsbook,
        game_id: prop.game_id
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
      {/* Player Name & Prop Type */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-lg leading-tight">{prop.player_name}</p>
          {(prop as any).team && <p className="text-xs text-gray-400 mt-1 font-medium">{(prop as any).team}</p>}
        </div>
        <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2.5 py-1 rounded-full ml-2">
          {prop.prop_type}
        </span>
      </div>

      {/* Column Headers */}
      <div className="flex items-center gap-2 mb-2">
        {prop.over_odds && (
          <div className="text-[10px] text-green-500 uppercase font-semibold text-center flex-1">Over</div>
        )}
        <div className="text-[10px] text-gray-500 uppercase font-semibold text-center w-[80px]">Line</div>
        {prop.under_odds && (
          <div className="text-[10px] text-red-500 uppercase font-semibold text-center flex-1">Under</div>
        )}
      </div>

      {/* Betting Options Row */}
      <div className="flex items-center gap-2 mb-3">
        {/* Over Button */}
        {prop.over_odds && (
          <button
            onClick={(e) => handlePickClick('over', prop.over_odds!, e)}
            className={`${buttonClass} flex-1`}
          >
            {prop.over_odds > 0 ? '+' : ''}{prop.over_odds}
          </button>
        )}
        
        {/* Line Display */}
        <div className="text-center w-[80px]">
          <p className="font-bold text-white text-xl">{prop.line}</p>
        </div>
        
        {/* Under Button */}
        {prop.under_odds && (
          <button
            onClick={(e) => handlePickClick('under', prop.under_odds!, e)}
            className={`${buttonClass} flex-1`}
          >
            {prop.under_odds > 0 ? '+' : ''}{prop.under_odds}
          </button>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="pt-3 mt-3 -mx-5 -mb-5 px-5 pb-3 bg-gradient-to-r from-blue-900/30 to-blue-400/30 flex justify-between items-center rounded-b-lg">
        <Image 
          src="/icon.svg" 
          alt="Ares" 
          width={10} 
          height={10}
          className="opacity-60"
        />
        <Link 
          href={`/build?prop_id=${prop.id}`}
          className="text-sm text-white-200 font-medium flex items-center gap-1 active:text-blue-300"
        >
          Analyze →
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
