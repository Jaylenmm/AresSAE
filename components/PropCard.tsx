import Link from 'next/link'
import { PlayerProp } from '@/lib/types'

interface PropCardProps {
  prop: PlayerProp
}

export default function PropCard({ prop }: PropCardProps) {
  return (
    <Link href={`/build?prop_id=${prop.id}`}>
      <div className="bg-white rounded-lg shadow-md p-3 hover:shadow-xl transition-all border border-gray-200 hover:border-blue-400 h-full">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">{prop.player_name}</p>
            {prop.team && <p className="text-xs text-gray-500 mt-0.5 font-medium">{prop.team}</p>}
          </div>
          <span className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-900 px-2 py-0.5 rounded">
            {prop.prop_type}
          </span>
        </div>

        <div className="flex justify-between items-center mt-3 pt-2.5">
          {prop.over_odds && (
            <div className="text-center flex-1 pl-2">
              <p className="text-xs text-gray-500 font-medium mb-0.5">Over</p>
              <p className="font-bold text-blue-600">{prop.over_odds}</p>
            </div>
          )}
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500 font-medium mb-0.5">Line</p>
            <p className="font-bold text-black text-base">{prop.line}</p>
          </div>
          {prop.under_odds && (
            <div className="text-center flex-1 pl-2">
              <p className="text-xs text-gray-500 font-medium mb-0.5">Under</p>
              <p className="font-bold text-blue-600">{prop.under_odds}</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}