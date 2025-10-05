import { OddsData } from '@/lib/types'

interface BettingOptionsProps {
  odds: OddsData[]
  homeTeam: string
  awayTeam: string
  onSelectBet: (bet: any) => void
}

export default function BettingOptions({ odds, homeTeam, awayTeam, onSelectBet }: BettingOptionsProps) {
  if (!odds || odds.length === 0 || !odds[0]) {
    return (
      <div className="text-center text-[var(--vs-muted)] py-8">
        No betting options available
      </div>
    )
  }

  const primaryOdds = odds[0]
  if (!primaryOdds) {
    return (
      <div className="text-center text-gray-500 py-8">
        No betting options available
      </div>
    )
  }

  const bettingOptions = [
    // Moneylines
    {
      type: 'moneyline',
      team: awayTeam,
      selection: 'away',
      line: undefined,
      odds: primaryOdds.moneyline_away ?? null,
      sportsbook: primaryOdds.sportsbook,
      display: `${awayTeam} ML`,
      description: `${awayTeam} to win`
    },
    {
      type: 'moneyline',
      team: homeTeam,
      selection: 'home',
      line: undefined,
      odds: primaryOdds.moneyline_home ?? null,
      sportsbook: primaryOdds.sportsbook,
      display: `${homeTeam} ML`,
      description: `${homeTeam} to win`
    },
    // Spreads
    {
      type: 'spread',
      team: awayTeam,
      selection: 'away',
      line: primaryOdds.spread_away,
      odds: primaryOdds.spread_away_odds ?? null,
      sportsbook: primaryOdds.sportsbook,
      display: `${awayTeam} ${primaryOdds.spread_away !== undefined && primaryOdds.spread_away > 0 ? '+' : ''}${primaryOdds.spread_away ?? ''}`,
      description: `${awayTeam} to cover`
    },
    {
      type: 'spread',
      team: homeTeam,
      selection: 'home',
      line: primaryOdds.spread_home,
      odds: primaryOdds.spread_home_odds ?? null,
      sportsbook: primaryOdds.sportsbook,
      display: `${homeTeam} ${primaryOdds.spread_home !== undefined && primaryOdds.spread_home > 0 ? '+' : ''}${primaryOdds.spread_home ?? ''}`,
      description: `${homeTeam} to cover`
    },
    // Totals
    {
      type: 'total',
      team: undefined,
      selection: 'over',
      line: primaryOdds.total,
      odds: primaryOdds.over_odds ?? null,
      sportsbook: primaryOdds.sportsbook,
      display: `Over ${primaryOdds.total ?? ''}`,
      description: 'Combined score over'
    },
    {
      type: 'total',
      team: undefined,
      selection: 'under',
      line: primaryOdds.total,
      odds: primaryOdds.under_odds ?? null,
      sportsbook: primaryOdds.sportsbook,
      display: `Under ${primaryOdds.total ?? ''}`,
      description: 'Combined score under'
    }
  ].filter(opt => opt.odds != null) // Remove options without odds

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-[var(--vs-text)] mb-3">Available Bets</h3>
      <div className="grid grid-cols-2 gap-2">
        {bettingOptions.map((option, index) => (
          <button
            key={index}
            onClick={() => onSelectBet(option)}
            className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-[var(--vs-accent)] capitalize">
                {option.type}
              </span>
              <span className="text-sm font-bold text-[var(--vs-text)]">
                {option.odds !== null && option.odds !== undefined
                  ? `${option.odds > 0 ? '+' : ''}${option.odds}`
                  : '--'}
              </span>
            </div>
            <p className="text-sm font-semibold text-[var(--vs-text)]">{option.display}</p>
            <p className="text-xs text-[var(--vs-muted)] mt-1">{option.description}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--vs-muted)] mt-2">
        Odds from {primaryOdds.sportsbook ?? 'N/A'}
      </p>
    </div>
  )
}