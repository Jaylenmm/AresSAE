// ===== CREATE: lib/odds-historicalTEST.ts =====

import { getFromCache, cacheHistoricalData, generateHistoricalOddsCacheKey } from './cache-manager'

const API_KEY = process.env.THE_ODDS_API_KEY
const BASE_URL = 'https://api.the-odds-api.com/v4'

/**
 * CRITICAL NOTES ABOUT HISTORICAL DATA:
 * 
 * 1. Historical data costs 10x regular pricing
 * 2. Format: cost = 10 × [markets returned] × [regions]
 * 3. Available from May 3, 2023 onwards
 * 4. Snapshots at 5-minute intervals
 * 5. ALWAYS check cache before making API calls
 */

export interface HistoricalOddsParams {
  sport: string
  eventId?: string
  date: string // ISO format: "2024-10-09T22:00:00Z"
  regions: string
  markets: string
  oddsFormat?: 'decimal' | 'american'
}

export interface HistoricalOddsResponse {
  timestamp: string
  sport_key: string
  bookmakers: Array<{
    key: string
    title: string
    markets: Array<{
      key: string
      outcomes: Array<{
        name: string
        description?: string // For player props
        price: number
        point?: number
      }>
    }>
  }>
}

/**
 * Fetch historical odds for a specific event and timestamp
 * EXPENSIVE: Costs 10x regular credits - USE SPARINGLY
 */
export async function fetchHistoricalOdds(
  params: HistoricalOddsParams
): Promise<HistoricalOddsResponse | null> {
  try {
    // Check cache first
    const cacheKey = generateHistoricalOddsCacheKey(
      params.sport,
      params.date,
      params.markets
    )
    
    const cached = await getFromCache(cacheKey)
    if (cached) {
      console.log('📦 Using cached historical data')
      return cached
    }
    
    // If no cache, make API call (EXPENSIVE)
    console.warn('⚠️ Making EXPENSIVE historical API call (10x cost)')
    
    const url = params.eventId
      ? `${BASE_URL}/historical/sports/${params.sport}/events/${params.eventId}/odds`
      : `${BASE_URL}/historical/sports/${params.sport}/odds`
    
    const queryParams = new URLSearchParams({
      apiKey: API_KEY!,
      date: params.date,
      regions: params.regions,
      markets: params.markets,
      oddsFormat: params.oddsFormat || 'american'
    })
    
    const response = await fetch(`${url}?${queryParams}`)
    
    if (!response.ok) {
      console.error(`Historical API error: ${response.status} ${response.statusText}`)
      return null
    }
    
    // Track cost
    const remaining = response.headers.get('x-requests-remaining')
    const used = response.headers.get('x-requests-used')
    const lastCost = response.headers.get('x-requests-last')
    
    console.log(`💰 API Usage - Remaining: ${remaining}, Last Cost: ${lastCost} credits`)
    
    const data = await response.json()
    
    // Cache for 30 days (historical data doesn't change)
    await cacheHistoricalData(cacheKey, data, 30)
    
    return data
  } catch (error) {
    console.error('Error fetching historical odds:', error)
    return null
  }
}

/**
 * Build a dataset of historical player prop lines over time
 * This is for analyzing line movement and finding player's typical lines
 * 
 * STRATEGY: Sample weekly, not daily, to minimize costs
 */
export async function buildHistoricalPlayerPropDataset(
  sport: string,
  playerName: string,
  propType: string,
  dateRange: { start: Date; end: Date }
): Promise<number[]> {
  const values: number[] = []
  const currentDate = new Date(dateRange.start)
  const endDate = new Date(dateRange.end)
  
  console.log(`🔍 Building historical dataset for ${playerName} ${propType}`)
  console.log(`📅 Date range: ${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}`)
  
  // Sample every 7 days to reduce costs
  let callsMade = 0
  const maxCalls = 10 // Safety limit
  
  while (currentDate <= endDate && callsMade < maxCalls) {
    const isoDate = currentDate.toISOString()
    
    console.log(`Fetching ${isoDate}...`)
    
    // Fetch historical player props for this date
    const data = await fetchHistoricalOdds({
      sport,
      date: isoDate,
      regions: 'us',
      markets: propType
    })
    
    if (data && data.bookmakers) {
      // Extract player's line from data
      data.bookmakers.forEach((bookmaker: any) => {
        bookmaker.markets?.forEach((market: any) => {
          if (market.key === propType) {
            market.outcomes?.forEach((outcome: any) => {
              if (outcome.description?.toLowerCase() === playerName.toLowerCase() && outcome.point) {
                values.push(outcome.point)
              }
            })
          }
        })
      })
    }
    
    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7)
    callsMade++
    
    // Rate limiting - wait 200ms between calls
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  console.log(`✅ Collected ${values.length} historical data points in ${callsMade} API calls`)
  return values
}

/**
 * Get median historical line for a player prop
 * Useful for determining if current line is inflated/deflated
 */
export async function getHistoricalMedianLine(
  sport: string,
  playerName: string,
  propType: string,
  daysBack: number = 30
): Promise<number | null> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)
  
  const values = await buildHistoricalPlayerPropDataset(
    sport,
    playerName,
    propType,
    { start: startDate, end: endDate }
  )
  
  if (values.length === 0) return null
  
  // Calculate median
  const sorted = values.sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
  
  console.log(`📊 Historical median for ${playerName} ${propType}: ${median} (from ${values.length} samples)`)
  return median
}

/**
 * Analyze line movement over time
 * Detects trends in how lines have moved (sharp action indicator)
 */
export async function analyzeLineMovement(
  sport: string,
  playerName: string,
  propType: string,
  hoursBack: number = 24
): Promise<{
  currentLine: number | null
  openingLine: number | null
  movement: number
  direction: 'up' | 'down' | 'stable'
  sharpAction: boolean
}> {
  const now = new Date()
  const opening = new Date()
  opening.setHours(opening.getHours() - hoursBack)
  
  // Get opening line
  const openingData = await fetchHistoricalOdds({
    sport,
    date: opening.toISOString(),
    regions: 'us',
    markets: propType
  })
  
  // Get current line (use regular API, not historical)
  // For now, return mock data - integrate with your current odds API
  
  return {
    currentLine: null,
    openingLine: null,
    movement: 0,
    direction: 'stable',
    sharpAction: false
  }
}

/**
 * USAGE EXAMPLE:
 * 
 * // Get historical median for LeBron's points
 * const median = await getHistoricalMedianLine(
 *   'basketball_nba',
 *   'LeBron James',
 *   'player_points',
 *   30 // Last 30 days
 * )
 * 
 * // Build custom dataset
 * const values = await buildHistoricalPlayerPropDataset(
 *   'basketball_nba',
 *   'LeBron James',
 *   'player_points',
 *   { 
 *     start: new Date('2024-10-01'), 
 *     end: new Date('2024-10-09') 
 *   }
 * )
 * 
 * // Analyze recent line movement
 * const movement = await analyzeLineMovement(
 *   'basketball_nba',
 *   'LeBron James',
 *   'player_points',
 *   24 // Last 24 hours
 * )
 */

/**
 * COST MANAGEMENT TIPS:
 * 
 * 1. Always check cache before calling API
 * 2. Sample weekly, not daily (reduces calls by 7x)
 * 3. Set maxCalls limits to prevent runaway costs
 * 4. Cache historical data for 30 days (it never changes)
 * 5. Build cache during off-peak hours
 * 6. Monitor x-requests-remaining header
 * 7. Use for key players only, not all players
 */