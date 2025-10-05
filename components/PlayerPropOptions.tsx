import { PlayerProp } from '@/lib/types'

interface PlayerPropOptionsProps {
  props: PlayerProp[]
  playerName: string
  onSelectBet: (bet: any) => void
}

export default function PlayerPropOptions({ props, playerName, onSelectBet }: PlayerPropOptionsProps) {
  if (!props || props.length === 0) {
  return <div className="text-center text-[var(--vs-muted)] py-8">No player props available</div>;
  }

  // Group props by prop_type
  const groupedProps = props.reduce((acc, prop) => {
    if (!acc[prop.prop_type]) {
      acc[prop.prop_type] = []
    }
    acc[prop.prop_type].push(prop)
    return acc
  }, {} as Record<string, PlayerProp[]>)

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-[var(--vs-text)]">{playerName} Props</h3>
      {Object.entries(groupedProps).map(([propType, propsForType]) => {
        // Find over and under for the same line
        const uniqueLines = Array.from(new Set(propsForType.map(p => p.line)))
        return (
          <div key={propType} className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-[var(--vs-text)] mb-2">{propType}</h4>
            {uniqueLines.map(line => {
              const overProp = propsForType.find(p => p.line === line && p.over_odds !== undefined && p.over_odds !== null)
              const underProp = propsForType.find(p => p.line === line && p.under_odds !== undefined && p.under_odds !== null)
              return (
                <div key={line} className="grid grid-cols-2 gap-2 mb-2">
                  {overProp && overProp.over_odds != null && (
                    <button
                      onClick={() => onSelectBet({
                        type: 'Player Prop',
                        selection: `${playerName} ${propType} Over ${line}`,
                        odds: overProp.over_odds,
                        description: `${playerName} over ${line} ${propType}`
                      })}
                      className="bg-white border-2 border-gray-200 rounded-lg p-2 hover:border-green-500 hover:bg-green-50 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-green-400">Over {line}</span>
                        <span className="text-sm font-bold text-[var(--vs-text)]">
                          {overProp.over_odds > 0 ? '+' : ''}{overProp.over_odds}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--vs-muted)] mt-1">{overProp.sportsbook ?? 'N/A'}</p>
                    </button>
                  )}
                  {underProp && underProp.under_odds != null && (
                    <button
                      onClick={() => onSelectBet({
                        type: 'Player Prop',
                        selection: `${playerName} ${propType} Under ${line}`,
                        odds: underProp.under_odds,
                        description: `${playerName} under ${line} ${propType}`
                      })}
                      className="bg-white border-2 border-gray-200 rounded-lg p-2 hover:border-red-500 hover:bg-red-50 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-red-400">Under {line}</span>
                        <span className="text-sm font-bold text-[var(--vs-text)]">
                          {underProp.under_odds > 0 ? '+' : ''}{underProp.under_odds}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--vs-muted)] mt-1">{underProp.sportsbook ?? 'N/A'}</p>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}