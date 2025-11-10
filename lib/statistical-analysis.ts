/**
 * Statistical Analysis Utilities
 * Median-based analysis for player prop betting
 */

export interface StatisticalSummary {
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  p10: number;  // 10th percentile
  p25: number;  // 25th percentile
  p75: number;  // 75th percentile
  p90: number;  // 90th percentile
  min: number;
  max: number;
  skewness: number;
  sampleSize: number;
}

/**
 * Calculate comprehensive statistical summary from array of values
 */
export function calculateStats(values: number[]): StatisticalSummary {
  if (values.length === 0) {
    throw new Error('Cannot calculate stats on empty array');
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  // Mean
  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  
  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  // Variance and Standard Deviation
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  // Percentiles
  const p10 = percentile(sorted, 0.10);
  const p25 = percentile(sorted, 0.25);
  const p75 = percentile(sorted, 0.75);
  const p90 = percentile(sorted, 0.90);
  
  // Skewness (measure of asymmetry)
  const skewness = calculateSkewness(values, mean, stdDev);
  
  return {
    mean,
    median,
    stdDev,
    variance,
    p10,
    p25,
    p75,
    p90,
    min: sorted[0],
    max: sorted[n - 1],
    skewness,
    sampleSize: n
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) {
    return sorted[lower];
  }
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate skewness (measure of distribution asymmetry)
 * Positive skew = right-skewed (long tail on right)
 * Negative skew = left-skewed (long tail on left)
 */
function calculateSkewness(values: number[], mean: number, stdDev: number): number {
  const n = values.length;
  const m3 = values.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / n;
  return m3 / Math.pow(stdDev, 3);
}

/**
 * Calculate hit probability based on historical distribution
 */
export function calculateHitProbability(
  values: number[],
  line: number,
  selection: 'over' | 'under'
): number {
  const hits = values.filter(val => 
    selection === 'over' ? val > line : val < line
  ).length;
  
  return hits / values.length;
}

/**
 * Calculate weighted average (more weight on recent games)
 */
export function calculateWeightedAverage(values: number[], recencyWeight: number = 0.7): number {
  if (values.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  values.forEach((val, i) => {
    // More recent games get higher weight
    const weight = Math.pow(recencyWeight, values.length - 1 - i);
    weightedSum += val * weight;
    totalWeight += weight;
  });
  
  return weightedSum / totalWeight;
}

/**
 * Calculate weighted median (more weight on recent games)
 */
export function calculateWeightedMedian(values: number[], recencyWeight: number = 0.7): number {
  if (values.length === 0) return 0;
  
  // Create weighted array
  const weighted: Array<{ value: number; weight: number }> = values.map((val, i) => ({
    value: val,
    weight: Math.pow(recencyWeight, values.length - 1 - i)
  }));
  
  // Sort by value
  weighted.sort((a, b) => a.value - b.value);
  
  // Find weighted median
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const halfWeight = totalWeight / 2;
  
  let cumulativeWeight = 0;
  for (const item of weighted) {
    cumulativeWeight += item.weight;
    if (cumulativeWeight >= halfWeight) {
      return item.value;
    }
  }
  
  return weighted[weighted.length - 1].value;
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(values: number[]): { outliers: number[]; cleaned: number[] } {
  const stats = calculateStats(values);
  const iqr = stats.p75 - stats.p25;
  const lowerBound = stats.p25 - 1.5 * iqr;
  const upperBound = stats.p75 + 1.5 * iqr;
  
  const outliers: number[] = [];
  const cleaned: number[] = [];
  
  values.forEach(val => {
    if (val < lowerBound || val > upperBound) {
      outliers.push(val);
    } else {
      cleaned.push(val);
    }
  });
  
  return { outliers, cleaned };
}

/**
 * Calculate confidence interval
 */
export function calculateConfidenceInterval(
  values: number[],
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  const stats = calculateStats(values);
  const n = values.length;
  
  // Z-score for confidence level (95% = 1.96)
  const zScore = confidenceLevel === 0.95 ? 1.96 : 
                 confidenceLevel === 0.90 ? 1.645 : 
                 confidenceLevel === 0.99 ? 2.576 : 1.96;
  
  const marginOfError = zScore * (stats.stdDev / Math.sqrt(n));
  
  return {
    lower: stats.mean - marginOfError,
    upper: stats.mean + marginOfError
  };
}

/**
 * Compare two distributions
 */
export function compareDistributions(
  values1: number[],
  values2: number[]
): {
  meanDiff: number;
  medianDiff: number;
  effectSize: number; // Cohen's d
} {
  const stats1 = calculateStats(values1);
  const stats2 = calculateStats(values2);
  
  const meanDiff = stats1.mean - stats2.mean;
  const medianDiff = stats1.median - stats2.median;
  
  // Cohen's d (effect size)
  const pooledStdDev = Math.sqrt(
    ((values1.length - 1) * stats1.variance + (values2.length - 1) * stats2.variance) /
    (values1.length + values2.length - 2)
  );
  const effectSize = meanDiff / pooledStdDev;
  
  return {
    meanDiff,
    medianDiff,
    effectSize
  };
}
