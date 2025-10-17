export interface Game {
  id: string
  sport: string
  espn_game_id?: string
  home_team: string
  away_team: string
  game_date: string
  status: string
  home_score?: number
  away_score?: number
}

export interface OddsData {
  id: string
  game_id: string
  sportsbook: string
  spread_home?: number
  spread_away?: number
  spread_home_odds?: number
  spread_away_odds?: number
  total?: number
  over_odds?: number
  under_odds?: number
  moneyline_home?: number
  moneyline_away?: number
}

export interface PlayerProp {
  id: string
  game_id: string
  player_name: string
  prop_type: string
  line: number
  over_odds: number | null
  under_odds: number | null
  sportsbook: string
  is_alternate?: boolean 
  updated_at: string
  created_at?: string
}

export interface MarketAnalysis {
  id: string
  bet_identifier: string
  game_id: string
  bet_type: string
  selection: string
  ev_percentage?: number
  has_edge: boolean
  hit_probability?: number
  recommendation_score?: number
  reasoning?: string
  best_book?: string
  best_odds?: number
}

export interface UserPick {
  id: string
  user_id: string
  pick_type: 'straight' | 'parlay'
  picks: any
  analysis_snapshot?: any
  total_odds?: number
  status: 'pending' | 'won' | 'lost'
  created_at: string
}