// lib/odds-calculations.ts
// Odds and EV calculations - EXACT formulas as specified

/**
 * Convert American odds to implied probability (includes vig)
 */
export function americanOddsToImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100)
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100)
  }
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return (odds / 100) + 1
  } else {
    return 1 + (100 / Math.abs(odds))
  }
}

/**
 * Remove vig to get TRUE probability (no-vig)
 */
export function removeVig(odds1: number, odds2: number): { prob1: number; prob2: number } {
  const implied1 = americanOddsToImpliedProbability(odds1)
  const implied2 = americanOddsToImpliedProbability(odds2)
  
  const total = implied1 + implied2
  
  const trueProbability1 = implied1 / total
  const trueProbability2 = implied2 / total
  
  return {
    prob1: trueProbability1,
    prob2: trueProbability2
  }
}

/**
 * Calculate amount won for $1 stake
 */
export function calculateAmountWon(odds: number): number {
  if (odds > 0) {
    return odds / 100
  } else {
    return 100 / Math.abs(odds)
  }
}

/**
 * Calculate Expected Value per dollar risked
 * FORMULA: EV = (true_win_prob × Awin) - (true_lose_prob × $1)
 */
export function calculateEV(trueProbability: number, odds: number): number {
  const stake = 1 // Always $1
  const Awin = calculateAmountWon(odds)
  const loseProbability = 1 - trueProbability
  
  const ev = (trueProbability * Awin) - (loseProbability * stake)
  
  return ev  // Return as percentage using "* 100"
}

/**
 * Calculate Edge
 * YOUR FORMULA:
 * Step 1: base = |odds| + 100
 * Step 2: adjusted = base × true_win_probability
 * Step 3: edge = (adjusted - |odds|) / |odds|
 */
export function calculateEdge(trueProbability: number, odds: number): number {
  const absOdds = Math.abs(odds)
  
  const base = absOdds + 100
  const adjusted = base * trueProbability
  const edgeDecimal = (adjusted - absOdds) / absOdds
  
  return edgeDecimal * 100 // Return as percentage
}

/**
 * Format odds for display
 */
export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

/**
 * Format probability as percentage
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}

/**
 * Format EV/Edge with sign
 */
export function formatEVorEdge(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}