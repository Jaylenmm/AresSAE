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
      <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {game.sport}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(game.game_date).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit' 
            })}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">{game.away_team}</span>
            {mainOdds?.spread_away && (
              <span className="text-sm text-gray-600">
                {mainOdds.spread_away > 0 ? '+' : ''}{mainOdds.spread_away}
              </span>
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">{game.home_team}</span>
            {mainOdds?.spread_home && (
              <span className="text-sm text-gray-600">
                {mainOdds.spread_home > 0 ? '+' : ''}{mainOdds.spread_home}
              </span>
            )}
          </div>
        </div>

        {mainOdds?.total && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total:</span>
              <span className="font-medium text-gray-900">O/U {mainOdds.total}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}