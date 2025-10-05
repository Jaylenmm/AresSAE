import Link from 'next/link'
import { PlayerProp } from '@/lib/types'

interface PropCardProps {
  prop: PlayerProp
}

export default function PropCard({ prop }: PropCardProps) {
  return (
    <Link href={`/build?prop_id=${prop.id}`}>
      <div className="bg-white rounded-lg shadow-md p-3 hover:shadow-lg transition-shadow border border-gray-100">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{prop.player_name}</p>
            {prop.team && <p className="text-xs text-gray-500">{prop.team}</p>}
          </div>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded ml-2 whitespace-nowrap">
            {prop.prop_type}
          </span>
        </div>

        <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">Line</p>
            <p className="font-bold text-gray-900">{prop.line}</p>
          </div>
          {prop.over_odds && (
            <div className="text-center flex-1 border-l border-gray-100">
              <p className="text-xs text-gray-500">Over</p>
              <p className="font-medium text-green-600">{prop.over_odds}</p>
            </div>
          )}
          {prop.under_odds && (
            <div className="text-center flex-1 border-l border-gray-100">
              <p className="text-xs text-gray-500">Under</p>
              <p className="font-medium text-red-600">{prop.under_odds}</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}