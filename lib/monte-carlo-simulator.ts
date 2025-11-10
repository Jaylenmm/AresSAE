/**
 * Monte Carlo Simulation Engine for NBA Player Props
 * Simulates player performance thousands of times to get true probability distribution
 */

import type { PlayerGameLog, PlayerSeasonStats } from './nba-stats-service';

export interface SimulationParams {
  playerStats: PlayerSeasonStats;
  recentGames: PlayerGameLog[];
  propType: string;
  iterations?: number;
  adjustments?: {
    opponentDefenseRating?: number; // 100-120 scale
    pace?: number; // possessions per game
    backToBack?: boolean;
    minutesAdjustment?: number; // +/- minutes from average
  };
}

export interface SimulationResult {
  results: number[];
  mean: number;
  median: number;
  stdDev: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  distribution: { bucket: number; count: number }[];
}

export interface PropProbability {
  line: number;
  overProbability: number;
  underProbability: number;
  expectedValue: number;
  fairOdds: { over: number; under: number };
}

/**
 * Box-Muller transform for generating normally distributed random numbers
 */
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Calculate standard deviation from array of values
 */
function calculateStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Simulate NBA player points
 */
function simulatePoints(params: SimulationParams): number {
  const { playerStats, recentGames, adjustments } = params;
  const avg = playerStats.averages;
  
  // Calculate standard deviations from recent games
  const recentPoints = recentGames.map(g => g.points);
  const recentFGM = recentGames.map(g => g.fieldGoalsMade);
  const recentFGA = recentGames.map(g => g.fieldGoalsAttempted);
  const recent3PM = recentGames.map(g => g.threePointsMade);
  const recent3PA = recentGames.map(g => g.threePointsAttempted);
  const recentFTM = recentGames.map(g => g.freeThrowsMade);
  const recentFTA = recentGames.map(g => g.freeThrowsAttempted);
  const recentMinutes = recentGames.map(g => g.minutesPlayed);
  
  const stdDevPoints = calculateStdDev(recentPoints);
  const stdDevMinutes = calculateStdDev(recentMinutes);
  
  // Simulate minutes played
  let minutes = randomNormal(avg.minutesPerGame, stdDevMinutes);
  if (adjustments?.minutesAdjustment) {
    minutes += adjustments.minutesAdjustment;
  }
  if (adjustments?.backToBack) {
    minutes *= 0.95; // 5% reduction for back-to-back
  }
  minutes = Math.max(0, Math.min(48, minutes)); // Cap at 0-48 minutes
  
  // Minutes factor (if player plays more/less than average)
  const minutesFactor = minutes / avg.minutesPerGame;
  
  // Simulate field goals
  const avgFGA = recentFGA.reduce((a, b) => a + b, 0) / recentFGA.length;
  const stdDevFGA = calculateStdDev(recentFGA);
  let fga = randomNormal(avgFGA, stdDevFGA) * minutesFactor;
  
  const avgFGPct = recentFGM.reduce((a, b) => a + b, 0) / recentFGA.reduce((a, b) => a + b, 0);
  const stdDevFGPct = 0.08; // Typical shooting variance
  let fgPct = randomNormal(avgFGPct, stdDevFGPct);
  fgPct = Math.max(0.2, Math.min(0.7, fgPct)); // Realistic bounds
  
  // Opponent defense adjustment
  if (adjustments?.opponentDefenseRating) {
    const leagueAvgDefense = 112;
    const defenseFactor = leagueAvgDefense / adjustments.opponentDefenseRating;
    fgPct *= defenseFactor;
    fga *= (1 + (defenseFactor - 1) * 0.5); // More shots against weak defense
  }
  
  const fgm = fga * fgPct;
  
  // Simulate three-pointers
  const avg3PA = recent3PA.reduce((a, b) => a + b, 0) / recent3PA.length;
  const stdDev3PA = calculateStdDev(recent3PA);
  let threePA = randomNormal(avg3PA, stdDev3PA) * minutesFactor;
  
  const avg3PPct = recent3PM.reduce((a, b) => a + b, 0) / recent3PA.reduce((a, b) => a + b, 0) || 0;
  const stdDev3PPct = 0.12; // Higher variance for 3PT
  let threePct = randomNormal(avg3PPct, stdDev3PPct);
  threePct = Math.max(0.15, Math.min(0.55, threePct));
  
  const threePM = threePA * threePct;
  
  // Simulate free throws
  const avgFTA = recentFTA.reduce((a, b) => a + b, 0) / recentFTA.length;
  const stdDevFTA = calculateStdDev(recentFTA);
  let fta = randomNormal(avgFTA, stdDevFTA) * minutesFactor;
  
  const avgFTPct = recentFTM.reduce((a, b) => a + b, 0) / recentFTA.reduce((a, b) => a + b, 0) || 0;
  const stdDevFTPct = 0.05; // Low variance for FT
  let ftPct = randomNormal(avgFTPct, stdDevFTPct);
  ftPct = Math.max(0.5, Math.min(1.0, ftPct));
  
  const ftm = fta * ftPct;
  
  // Calculate total points
  const twoPointFGM = fgm - threePM;
  const points = (twoPointFGM * 2) + (threePM * 3) + ftm;
  
  return Math.max(0, Math.round(points * 10) / 10); // Round to 1 decimal
}

/**
 * Simulate NBA player rebounds
 */
function simulateRebounds(params: SimulationParams): number {
  const { playerStats, recentGames, adjustments } = params;
  const avg = playerStats.averages;
  
  const recentRebounds = recentGames.map(g => g.rebounds);
  const recentMinutes = recentGames.map(g => g.minutesPlayed);
  
  const stdDevRebounds = calculateStdDev(recentRebounds);
  const stdDevMinutes = calculateStdDev(recentMinutes);
  
  // Simulate minutes
  let minutes = randomNormal(avg.minutesPerGame, stdDevMinutes);
  if (adjustments?.minutesAdjustment) {
    minutes += adjustments.minutesAdjustment;
  }
  if (adjustments?.backToBack) {
    minutes *= 0.95;
  }
  minutes = Math.max(0, Math.min(48, minutes));
  
  const minutesFactor = minutes / avg.minutesPerGame;
  
  // Simulate rebounds
  let rebounds = randomNormal(avg.rebounds, stdDevRebounds) * minutesFactor;
  
  // Pace adjustment (more possessions = more rebounds)
  if (adjustments?.pace) {
    const leagueAvgPace = 100;
    const paceFactor = adjustments.pace / leagueAvgPace;
    rebounds *= paceFactor;
  }
  
  return Math.max(0, Math.round(rebounds * 10) / 10);
}

/**
 * Simulate NBA player assists
 */
function simulateAssists(params: SimulationParams): number {
  const { playerStats, recentGames, adjustments } = params;
  const avg = playerStats.averages;
  
  const recentAssists = recentGames.map(g => g.assists);
  const recentMinutes = recentGames.map(g => g.minutesPlayed);
  
  const stdDevAssists = calculateStdDev(recentAssists);
  const stdDevMinutes = calculateStdDev(recentMinutes);
  
  // Simulate minutes
  let minutes = randomNormal(avg.minutesPerGame, stdDevMinutes);
  if (adjustments?.minutesAdjustment) {
    minutes += adjustments.minutesAdjustment;
  }
  if (adjustments?.backToBack) {
    minutes *= 0.95;
  }
  minutes = Math.max(0, Math.min(48, minutes));
  
  const minutesFactor = minutes / avg.minutesPerGame;
  
  // Simulate assists
  let assists = randomNormal(avg.assists, stdDevAssists) * minutesFactor;
  
  // Pace adjustment
  if (adjustments?.pace) {
    const leagueAvgPace = 100;
    const paceFactor = adjustments.pace / leagueAvgPace;
    assists *= paceFactor;
  }
  
  return Math.max(0, Math.round(assists * 10) / 10);
}

/**
 * Simulate other stats (steals, blocks, turnovers, 3PM)
 */
function simulateOtherStat(params: SimulationParams, statType: string): number {
  const { playerStats, recentGames, adjustments } = params;
  const avg = playerStats.averages;
  
  let statValues: number[] = [];
  let avgValue: number = 0;
  
  switch (statType) {
    case 'steals':
      statValues = recentGames.map(g => g.steals);
      avgValue = avg.steals;
      break;
    case 'blocks':
      statValues = recentGames.map(g => g.blocks);
      avgValue = avg.blocks;
      break;
    case 'turnovers':
      statValues = recentGames.map(g => g.turnovers);
      avgValue = avg.turnovers;
      break;
    case 'threePointsMade':
      statValues = recentGames.map(g => g.threePointsMade);
      // Calculate average 3PM from recent games since it's not in season averages
      avgValue = statValues.reduce((a, b) => a + b, 0) / statValues.length;
      break;
    default:
      return 0;
  }
  
  const stdDev = calculateStdDev(statValues);
  const recentMinutes = recentGames.map(g => g.minutesPlayed);
  const stdDevMinutes = calculateStdDev(recentMinutes);
  
  // Simulate minutes
  let minutes = randomNormal(avg.minutesPerGame, stdDevMinutes);
  if (adjustments?.minutesAdjustment) {
    minutes += adjustments.minutesAdjustment;
  }
  if (adjustments?.backToBack) {
    minutes *= 0.95;
  }
  minutes = Math.max(0, Math.min(48, minutes));
  
  const minutesFactor = minutes / avg.minutesPerGame;
  
  let value = randomNormal(avgValue, stdDev) * minutesFactor;
  
  return Math.max(0, Math.round(value * 10) / 10);
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(params: SimulationParams): SimulationResult {
  const iterations = params.iterations || 10000;
  const results: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    let value: number;
    
    const propType = params.propType.toLowerCase();
    
    if (propType.includes('point')) {
      value = simulatePoints(params);
    } else if (propType.includes('rebound')) {
      value = simulateRebounds(params);
    } else if (propType.includes('assist')) {
      value = simulateAssists(params);
    } else if (propType.includes('steal')) {
      value = simulateOtherStat(params, 'steals');
    } else if (propType.includes('block')) {
      value = simulateOtherStat(params, 'blocks');
    } else if (propType.includes('turnover')) {
      value = simulateOtherStat(params, 'turnovers');
    } else if (propType.includes('three') || propType.includes('3pt')) {
      value = simulateOtherStat(params, 'threePointsMade');
    } else if (propType.includes('pra') || propType.includes('pts+reb+ast')) {
      // Combo stat: Points + Rebounds + Assists
      value = simulatePoints(params) + simulateRebounds(params) + simulateAssists(params);
    } else if (propType.includes('pts+reb') || propType.includes('points+rebounds')) {
      value = simulatePoints(params) + simulateRebounds(params);
    } else if (propType.includes('pts+ast') || propType.includes('points+assists')) {
      value = simulatePoints(params) + simulateAssists(params);
    } else if (propType.includes('reb+ast') || propType.includes('rebounds+assists')) {
      value = simulateRebounds(params) + simulateAssists(params);
    } else {
      // Default to points
      value = simulatePoints(params);
    }
    
    results.push(value);
  }
  
  // Calculate statistics
  const sorted = [...results].sort((a, b) => a - b);
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  
  const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / results.length;
  const stdDev = Math.sqrt(variance);
  
  const p10 = sorted[Math.floor(sorted.length * 0.10)];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];
  
  // Create distribution histogram
  const bucketSize = 1;
  const min = Math.floor(sorted[0]);
  const max = Math.ceil(sorted[sorted.length - 1]);
  const distribution: { bucket: number; count: number }[] = [];
  
  for (let bucket = min; bucket <= max; bucket += bucketSize) {
    const count = results.filter(r => r >= bucket && r < bucket + bucketSize).length;
    distribution.push({ bucket, count });
  }
  
  return {
    results,
    mean,
    median,
    stdDev,
    p10,
    p25,
    p75,
    p90,
    distribution
  };
}

/**
 * Calculate probability of hitting a prop line
 */
export function calculatePropProbability(
  simulation: SimulationResult,
  line: number,
  bookOdds: number
): PropProbability {
  const { results } = simulation;
  
  // Calculate hit probabilities
  const overHits = results.filter(r => r > line).length;
  const underHits = results.filter(r => r < line).length;
  
  const overProbability = overHits / results.length;
  const underProbability = underHits / results.length;
  
  // Calculate expected value (median of results)
  const expectedValue = simulation.median;
  
  // Calculate fair odds (no vig)
  const fairOverOdds = overProbability >= 0.5
    ? Math.round(-100 * overProbability / (1 - overProbability))
    : Math.round(100 * (1 - overProbability) / overProbability);
  
  const fairUnderOdds = underProbability >= 0.5
    ? Math.round(-100 * underProbability / (1 - underProbability))
    : Math.round(100 * (1 - underProbability) / underProbability);
  
  return {
    line,
    overProbability,
    underProbability,
    expectedValue,
    fairOdds: {
      over: fairOverOdds,
      under: fairUnderOdds
    }
  };
}
