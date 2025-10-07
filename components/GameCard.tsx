'use client'

import Link from 'next/link'
import { Game, OddsData } from '@/lib/types'

interface GameCardProps {
  game: Game
  odds?: OddsData[]
}

export default function GameCard({ game, odds }: GameCardProps) {
  const mainOdds = odds?.[0]
  
  return (
    <Link href={`/build?game_id=${game.id}`}>
      <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-xl transition-all border border-gray-200 hover:border-blue-400">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            {game.sport}
          </span>
          <span className="text-xs font-medium text-gray-600">
            {new Date(game.game_date).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit' 
            })}
          </span>
        </div>

        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900 text-base">{game.away_team}</span>
            {mainOdds?.moneyline_away !== undefined && (
              <span className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-900 px-2 py-0.5 rounded">
                {mainOdds.moneyline_away > 0 ? '+' : ''}{mainOdds.moneyline_away}
              </span>
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900 text-base">{game.home_team}</span>
            {mainOdds?.moneyline_home !== undefined && (
              <span className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-900 px-2 py-0.5 rounded">
                {mainOdds.moneyline_home > 0 ? '+' : ''}{mainOdds.moneyline_home}
              </span>
            )}
          </div>
        </div>

        {mainOdds?.total && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 font-medium">Total:</span>
              <span className="font-bold text-gray-900">O/U {mainOdds.total}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}