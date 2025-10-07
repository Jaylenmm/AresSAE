// ===== CREATE: lib/statistical-analysis.ts =====

/**
 * Statistical Analysis Module
 * Implements sharp betting principles:
 * - Use median instead of mean (resistant to outliers)
 * - Account for 54.5% Under hit rate on totals
 * - Realistic 2-5% edge expectations
 */

export interface PlayerPropStats {
  median: number
  mean: number
  stdDev: number
  sampleSize: number
  quartiles: {
    q1: number
    q2: number // Same as median
    q3: number
  }
  lastN: number[] // Recent performance
}

export interface TotalAnalysis {
  adjustedLine: number
  underBias: number // Expected under hit rate (typically 54.5%)
  recommendation: 'over' | 'under' | 'neutral'
  confidence: number // 0-100
  reasoning: string
}

/**
 * Calculate median from array of numbers
 * CRITICAL: Use median instead of mean for player props
 * Median is resistant to outliers (one monster game doesn't skew analysis)
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Calculate mean (average)
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = calculateMean(values)
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = calculateMean(squaredDiffs)
  return Math.sqrt(variance)
}

/**
 * Calculate quartiles for distribution analysis
 */
export function calculateQuartiles(values: number[]): { q1: number; q2: number; q3: number } {
  if (values.length === 0) return { q1: 0, q2: 0, q3: 0 }
  
  const sorted = [...values].sort((a, b) => a - b)
  const q2 = calculateMedian(sorted)
  
  const lowerHalf = sorted.slice(0, Math.floor(sorted.length / 2))
  const upperHalf = sorted.slice(Math.ceil(sorted.length / 2))
  
  const q1 = calculateMedian(lowerHalf)
  const q3 = calculateMedian(upperHalf)
  
  return { q1, q2, q3 }
}

/**
 * Analyze player prop using historical data
 * Returns comprehensive stats including median (not mean!)
 */
export function analyzePlayerPropStats(
  historicalValues: number[],
  recentN: number = 5
): PlayerPropStats {
  if (historicalValues.length === 0) {
    return {
      median: 0,
      mean: 0,
      stdDev: 0,
      sampleSize: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 },
      lastN: []
    }
  }

  const median = calculateMedian(historicalValues)
  const mean = calculateMean(historicalValues)
  const stdDev = calculateStdDev(historicalValues)
  const quartiles = calculateQuartiles(historicalValues)
  const lastN = historicalValues.slice(-recentN)

  return {
    median,
    mean,
    stdDev,
    sampleSize: historicalValues.length,
    quartiles,
    lastN
  }
}

/**
 * Compare player prop line vs statistical median
 * Returns expected hit probability based on historical distribution
 */
export function evaluatePlayerPropLine(
  line: number,
  stats: PlayerPropStats
): {
  overProbability: number
  underProbability: number
  edge: 'over' | 'under' | 'neutral'
  confidence: number
  reasoning: string
} {
  if (stats.sampleSize < 3) {
    return {
      overProbability: 50,
      underProbability: 50,
      edge: 'neutral',
      confidence: 0,
      reasoning: 'Insufficient historical data (need at least 3 games)'
    }
  }

  // Calculate z-score to determine probability
  const zScore = stats.stdDev > 0 ? (line - stats.median) / stats.stdDev : 0
  
  // Approximate probability using normal distribution
  // Positive z-score means line is above median (favor under)
  // Negative z-score means line is below median (favor over)
  const overProbability = normalCDF(-zScore) * 100
  const underProbability = normalCDF(zScore) * 100

  // Determine edge (need at least 52% to overcome juice)
  const threshold = 52 // Account for -110 odds
  let edge: 'over' | 'under' | 'neutral' = 'neutral'
  
  if (overProbability >= threshold) {
    edge = 'over'
  } else if (underProbability >= threshold) {
    edge = 'under'
  }

  // Confidence based on sample size and recent performance
  const recentMedian = calculateMedian(stats.lastN)
  const recentAlignment = Math.abs(recentMedian - stats.median) / stats.median
  const confidenceBase = Math.min(stats.sampleSize / 10, 1) * 70 // Max 70 from sample size
  const confidenceRecent = (1 - Math.min(recentAlignment, 0.3)) * 30 // Max 30 from recent form
  const confidence = Math.round(confidenceBase + confidenceRecent)

  // Build reasoning
  let reasoning = `Line: ${line}, Median: ${stats.median.toFixed(1)}, Recent: ${recentMedian.toFixed(1)}. `
  
  if (line > stats.median) {
    reasoning += `Line is ${((line - stats.median) / stats.median * 100).toFixed(1)}% above median. `
  } else if (line < stats.median) {
    reasoning += `Line is ${((stats.median - line) / stats.median * 100).toFixed(1)}% below median. `
  }
  
  if (edge !== 'neutral') {
    reasoning += `${overProbability.toFixed(1)}% chance of going over based on distribution.`
  }

  return {
    overProbability: Math.round(overProbability * 10) / 10,
    underProbability: Math.round(underProbability * 10) / 10,
    edge,
    confidence,
    reasoning
  }
}

/**
 * Analyze game totals with built-in under bias
 * CRITICAL: Historical data shows totals go under 54.5% of the time
 */
export function analyzeTotalWithUnderBias(
  totalLine: number,
  historicalTotals: number[] = []
): TotalAnalysis {
  const UNDER_HIT_RATE = 0.545 // 54.5% historical under rate
  
  if (historicalTotals.length === 0) {
    return {
      adjustedLine: totalLine,
      underBias: UNDER_HIT_RATE,
      recommendation: 'under',
      confidence: 35, // Low confidence without data
      reasoning: 'No historical data. Default to under bias (54.5% historical hit rate).'
    }
  }

  const median = calculateMedian(historicalTotals)
  const mean = calculateMean(historicalTotals)
  
  // Adjust line for under bias
  const adjustedLine = totalLine * (1 + (UNDER_HIT_RATE - 0.5))
  
  let recommendation: 'over' | 'under' | 'neutral' = 'neutral'
  let confidence = 50
  let reasoning = ''

  // Compare total line to historical median
  const lineVsMedian = ((totalLine - median) / median) * 100
  
  if (totalLine > median * 1.05) {
    // Line is 5%+ above historical median - strong under lean
    recommendation = 'under'
    confidence = Math.min(75, 50 + Math.abs(lineVsMedian))
    reasoning = `Line (${totalLine}) is ${Math.abs(lineVsMedian).toFixed(1)}% above historical median (${median.toFixed(1)}). Combined with 54.5% under bias = strong under play.`
  } else if (totalLine < median * 0.95) {
    // Line is 5%+ below historical median - consider over
    recommendation = 'over'
    confidence = Math.min(65, 40 + Math.abs(lineVsMedian))
    reasoning = `Line (${totalLine}) is ${Math.abs(lineVsMedian).toFixed(1)}% below historical median (${median.toFixed(1)}). Overcomes typical under bias.`
  } else {
    // Line is close to median - lean under due to bias
    recommendation = 'under'
    confidence = 52
    reasoning = `Line (${totalLine}) near historical median (${median.toFixed(1)}). Default to under based on 54.5% historical hit rate.`
  }

  return {
    adjustedLine,
    underBias: UNDER_HIT_RATE,
    recommendation,
    confidence,
    reasoning
  }
}

/**
 * Normal CDF approximation (for probability calculations)
 */
function normalCDF(z: number): number {
  // Using Hart's approximation (accurate to ~7 decimal places)
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  
  return z > 0 ? 1 - probability : probability
}

/**
 * Detect if recent performance suggests injury or role change
 */
export function detectPerformanceAnomaly(
  recentGames: number[],
  seasonAverage: number
): {
  anomalyDetected: boolean
  type: 'decline' | 'surge' | 'normal'
  severity: number // 0-10
  reasoning: string
} {
  if (recentGames.length < 3) {
    return {
      anomalyDetected: false,
      type: 'normal',
      severity: 0,
      reasoning: 'Insufficient recent data'
    }
  }

  const recentAvg = calculateMean(recentGames)
  const percentChange = ((recentAvg - seasonAverage) / seasonAverage) * 100

  if (Math.abs(percentChange) < 15) {
    return {
      anomalyDetected: false,
      type: 'normal',
      severity: 0,
      reasoning: 'Recent performance aligned with season average'
    }
  }

  const anomalyDetected = true
  const type = percentChange < 0 ? 'decline' : 'surge'
  const severity = Math.min(Math.round(Math.abs(percentChange) / 5), 10)

  const reasoning = type === 'decline'
    ? `Recent ${recentGames.length}-game average (${recentAvg.toFixed(1)}) is ${Math.abs(percentChange).toFixed(1)}% below season average (${seasonAverage.toFixed(1)}). Possible injury or reduced role.`
    : `Recent ${recentGames.length}-game average (${recentAvg.toFixed(1)}) is ${percentChange.toFixed(1)}% above season average (${seasonAverage.toFixed(1)}). Hot streak or increased usage.`

  return {
    anomalyDetected,
    type,
    severity,
    reasoning
  }
}