# Sharp Player Prop Analysis - Research & Implementation Plan

## Executive Summary

Professional sports bettors use **median-based analysis** with **Monte Carlo simulations** to beat player prop markets. The key insight: **sportsbooks set lines at the median (50th percentile), NOT the mean (average)**.

---

## The Critical Distinction: Mean vs Median

### Why This Matters

**Player performance is NOT normally distributed** - it's **positively skewed** (right-skewed):
- **Floor:** Can't go below 0 (can't score negative points)
- **Ceiling:** Can have explosive outlier games (e.g., 50+ points)
- **Result:** Mean > Median

### Example: Deebo Samuel Receiving Yards (Last 5 Games)
```
Games: 21, 37, 47, 48, 149 yards

Mean (Average): 60.4 yards
Median (50th %): 47 yards

Sportsbook Line: ~47.5 yards (median)
```

**If you bet using the mean:**
- You'll bet OVER 60.4 yards
- Line is at 47.5
- You think you have edge
- **But you're WRONG** - the median is 47, so it's actually 50/50

**The Sharp Approach:**
- Calculate the **median** from your projections
- Compare median to sportsbook line
- Only bet when there's a true median-based edge

---

## How Sharp Bettors Analyze Props

### Step 1: Build a Distribution (Monte Carlo Simulation)

**Don't use simple averages** - simulate the player's performance 10,000+ times:

```typescript
// Pseudo-code
function simulatePlayerPerformance(player, opponent, iterations = 10000) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    // Simulate one game
    const performance = {
      fieldGoalsAttempted: randomNormal(player.avgFGA, player.stdDevFGA),
      fieldGoalPct: randomNormal(player.avgFG%, player.stdDevFG%),
      threePointsAttempted: randomNormal(player.avg3PA, player.stdDev3PA),
      threePointPct: randomNormal(player.avg3P%, player.stdDev3P%),
      freeThrowsAttempted: randomNormal(player.avgFTA, player.stdDevFTA),
      freeThrowPct: randomNormal(player.avgFT%, player.stdDevFT%),
      minutes: randomNormal(player.avgMIN, player.stdDevMIN)
    };
    
    // Calculate points for this simulation
    const points = 
      (performance.fieldGoalsAttempted * performance.fieldGoalPct * 2) +
      (performance.threePointsAttempted * performance.threePointPct * 3) +
      (performance.freeThrowsAttempted * performance.freeThrowPct);
    
    results.push(points);
  }
  
  return results;
}
```

### Step 2: Calculate Adjusted Median

From the simulation results, calculate percentiles:

```typescript
function calculatePercentiles(results) {
  const sorted = results.sort((a, b) => a - b);
  
  return {
    p10: sorted[Math.floor(results.length * 0.10)],  // 10th percentile
    p25: sorted[Math.floor(results.length * 0.25)],  // 25th percentile
    median: sorted[Math.floor(results.length * 0.50)], // 50th percentile (MEDIAN)
    p75: sorted[Math.floor(results.length * 0.75)],  // 75th percentile
    p90: sorted[Math.floor(results.length * 0.90)],  // 90th percentile
    mean: results.reduce((a, b) => a + b) / results.length
  };
}
```

**Adjusted Median Factors:**
1. **Opponent Defense Ranking** - Adjust distribution based on matchup
2. **Recent Form** - Weight recent games more heavily
3. **Minutes Projection** - Adjust for expected playing time
4. **Injury to Supporting Cast** - Adjust for increased/decreased usage
5. **Back-to-Back Games** - Adjust for fatigue
6. **Home/Away** - Adjust for venue

### Step 3: Calculate True Edge

```typescript
function calculatePropEdge(simulatedMedian, bookmakerLine, selection) {
  // Calculate probability of hitting based on simulation
  const hitProbability = selection === 'over' 
    ? simulatedResults.filter(r => r > bookmakerLine).length / simulatedResults.length
    : simulatedResults.filter(r => r < bookmakerLine).length / simulatedResults.length;
  
  // Fair odds (no vig)
  const fairOdds = hitProbability >= 0.5
    ? -100 * hitProbability / (1 - hitProbability)
    : 100 * (1 - hitProbability) / hitProbability;
  
  // Edge calculation
  const impliedProbability = americanOddsToImpliedProbability(bookOdds);
  const edge = (hitProbability - impliedProbability) * 100;
  
  return {
    hitProbability,
    fairOdds,
    edge,
    expectedValue: calculateEV(hitProbability, bookOdds) * 100
  };
}
```

---

## Key Variables for NBA Props

### Points Props
**Distribution:** Positively skewed (can't go below 0, can explode for 50+)

**Key Inputs:**
- Field Goal Attempts (mean, std dev)
- Field Goal % (mean, std dev)
- 3-Point Attempts (mean, std dev)
- 3-Point % (mean, std dev)
- Free Throw Attempts (mean, std dev)
- Free Throw % (mean, std dev)
- Minutes Played (mean, std dev)

**Adjustments:**
- Opponent defensive rating (points allowed per 100 possessions)
- Pace of game (possessions per game)
- Usage rate changes (injuries to teammates)
- Back-to-back fatigue factor

### Rebounds Props
**Distribution:** Positively skewed (can't go below 0)

**Key Inputs:**
- Offensive Rebound Rate
- Defensive Rebound Rate
- Team Rebound %
- Minutes Played
- Opponent Rebound Rate

**Adjustments:**
- Opponent rebounding weakness
- Pace of game
- Teammate injuries (more rebounds available)

### Assists Props
**Distribution:** Positively skewed

**Key Inputs:**
- Assist Rate
- Usage Rate
- Team Pace
- Minutes Played

**Adjustments:**
- Opponent defensive scheme (zone vs man)
- Teammate shooting % (assists require made shots)
- Pace of game

### Combo Props (PRA, Pts+Reb, etc.)
**Distribution:** More normally distributed (sum of multiple variables)

**Approach:** Simulate each component separately, then sum

---

## Implementation Strategy for AresSAE

### Phase 1: Enhanced Statistical Analysis (Week 1)

**Goal:** Move from simple averages to median-based analysis

**Tasks:**
1. Calculate median from last 10 games (not mean)
2. Calculate standard deviation for each stat
3. Implement percentile calculations (25th, 50th, 75th)
4. Add variance analysis

**Code Changes:**
```typescript
// lib/nba-prop-analyzer.ts
interface EnhancedStats {
  mean: number;
  median: number;
  stdDev: number;
  p25: number;
  p75: number;
  variance: number;
}

function calculateEnhancedStats(gameLogs: number[]): EnhancedStats {
  const sorted = [...gameLogs].sort((a, b) => a - b);
  const mean = gameLogs.reduce((a, b) => a + b) / gameLogs.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  
  const variance = gameLogs.reduce((sum, val) => 
    sum + Math.pow(val - mean, 2), 0) / gameLogs.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    mean,
    median,
    stdDev,
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    variance
  };
}
```

### Phase 2: Monte Carlo Simulation (Week 2)

**Goal:** Simulate player performance 10,000 times to get true distribution

**Tasks:**
1. Build simulation engine for points, rebounds, assists
2. Implement random sampling with normal distribution
3. Calculate hit probability from simulation
4. Adjust for opponent, minutes, fatigue

**Code Structure:**
```typescript
// lib/monte-carlo-simulator.ts
interface SimulationParams {
  player: PlayerStats;
  opponent: TeamDefense;
  minutes: number;
  adjustments: {
    backToBack: boolean;
    homeAway: 'home' | 'away';
    injuriesToCast: number;
  };
}

function runMonteCarlo(
  params: SimulationParams,
  propType: string,
  iterations: number = 10000
): SimulationResult {
  const results: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const simulated = simulateOneGame(params, propType);
    results.push(simulated);
  }
  
  return {
    results,
    median: calculateMedian(results),
    mean: calculateMean(results),
    percentiles: calculatePercentiles(results),
    distribution: createHistogram(results)
  };
}
```

### Phase 3: Advanced Edge Calculation (Week 3)

**Goal:** Calculate true EV using simulation-based probabilities

**Tasks:**
1. Calculate hit probability from simulation
2. Compare to implied probability from odds
3. Calculate Kelly Criterion bet sizing
4. Add confidence intervals

**Formula:**
```
True Edge = (Simulated Hit Probability - Implied Probability) × 100

EV = (Hit Probability × Payout) - (Miss Probability × Stake)

Kelly % = (Hit Probability × (Decimal Odds - 1) - (1 - Hit Probability)) / (Decimal Odds - 1)
```

---

## Data Requirements

### Per-Game Stats (Last 10-20 Games)
- Points, Rebounds, Assists, Steals, Blocks
- FGA, FGM, FG%
- 3PA, 3PM, 3P%
- FTA, FTM, FT%
- Minutes Played
- Usage Rate

### Opponent Data
- Defensive Rating (points allowed per 100 possessions)
- Pace (possessions per game)
- Position-specific defense (points allowed to PG, SG, SF, PF, C)
- Rebound Rate Allowed
- Assist Rate Allowed

### Contextual Data
- Home/Away splits
- Back-to-back game indicator
- Injury report (player + teammates)
- Recent minutes trend
- Days rest

---

## Expected Improvements

### Current Approach (Simple Average)
```
Kevin Durant Season Average: 24.8 PPG
Line: 25.5
Analysis: "Below average, bet UNDER"
Edge: Estimated 2-3%
Accuracy: ~55%
```

### Sharp Approach (Median + Monte Carlo)
```
Kevin Durant Simulation (10,000 iterations):
  Mean: 24.8 PPG
  Median: 23.5 PPG (50th percentile)
  P75: 28.2 PPG
  
Line: 25.5
Hit Probability (Over): 42.3%
Implied Probability: 52.4% (at -110)
True Edge: -10.1%
Recommendation: STRONG PASS

vs. Opponent with weak defense:
  Adjusted Median: 26.1 PPG
  Hit Probability (Over): 53.7%
  True Edge: +1.3%
  Recommendation: SMALL BET
```

**Expected Accuracy:** 60-65% (vs current 55%)

---

## Implementation Priority

1. **Week 1:** Median-based analysis (quick win)
2. **Week 2:** Monte Carlo simulation (big improvement)
3. **Week 3:** Advanced adjustments (opponent, context)
4. **Week 4:** UI/UX for displaying simulation results

---

## Tools & Libraries Needed

```bash
# Statistical functions
npm install mathjs
npm install simple-statistics

# Random number generation (for Monte Carlo)
npm install seedrandom
npm install gaussian

# Charting (for distribution visualization)
npm install recharts
```

---

## References

1. **Unabated:** "Profitable Prop Betting in 3 Easy Steps"
   - Key insight: Sportsbooks set lines at median, not mean
   - Must simulate to find median from mean projections

2. **Quant Aurelius:** "NBA Player Props with Monte Carlo Simulations"
   - 10,000 iteration standard
   - Model shooting % as normal distribution
   - Adjust for opponent, minutes, fatigue

3. **Unabated:** "Market-Based Prop Projections"
   - Blend your projections with market consensus
   - Use market as regression tool (Bill Benter approach)
   - Don't blindly trust your model

4. **Key Formula:** Median ≠ Mean for skewed distributions
   - Points, Rebounds, Assists are all positively skewed
   - Mean will overestimate hit probability on OVER bets
   - Must use median for accurate probability calculation

---

## Next Steps

**Decision Point:** Which phase do you want to start with?

**Option A:** Quick Win (Median-based analysis) - 2-3 days
**Option B:** Full Implementation (Monte Carlo) - 2 weeks
**Option C:** Research more advanced techniques first

Let me know and I'll start building.
