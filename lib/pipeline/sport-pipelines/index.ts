import type { SupportedSport } from '@/lib/pipeline/config'
import { runNFL } from './nfl'
import { runNBA } from './nba'
import { runMLB } from './mlb'
import { runNCAAF } from './ncaaf'

export function getRunner(sport: SupportedSport) {
  switch (sport) {
    case 'NFL': return runNFL
    case 'NBA': return runNBA
    case 'MLB': return runMLB
    case 'NCAAF': return runNCAAF
  }
}
