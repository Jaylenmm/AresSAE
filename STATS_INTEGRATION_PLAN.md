# Stats Integration Plan - Year-Round Solution

## The Problem

**Current State:**
- Analysis engine uses placeholder/fake data
- No real player statistics
- Can't provide accurate prop analysis
- Seasonal APIs (BallDontLie) are useless in off-season

**What We Need:**
- Year-round data for ALL major sports (NBA, NFL, MLB, NHL, etc.)
- Historical stats + current season stats
- Player averages, recent performance, trends
- Injury data
- Matchup data (opponent defense rankings, etc.)

---

## API Options Research

### Option 1: MySportsFeeds
**Coverage:** NFL, NBA, MLB, NHL
**Pricing:** 
- Personal: $150 CAD/year (~$110 USD/year)
- FREE for first year (startups/students)
- 3-day free trial
**Pros:**
- ✅ Year-round data (historical + current)
- ✅ Affordable
- ✅ Covers major sports
- ✅ Free first year for startups
**Cons:**
- ❌ No college sports
- ❌ Limited to 4 sports

### Option 2: SportsData.IO
**Coverage:** NFL, NBA, MLB, NHL, PGA, NASCAR, Soccer, eSports
**Pricing:** 
- $500-1000+/month (enterprise)
- Free trial available
**Pros:**
- ✅ Comprehensive coverage
- ✅ Real-time data
- ✅ Betting odds included
**Cons:**
- ❌ EXPENSIVE ($6k-12k/year minimum)
- ❌ Overkill for MVP

### Option 3: The Odds API
**Coverage:** Betting odds for all major sports
**Pricing:**
- Free tier: 500 requests/month
- $10/month: 10k requests
**Pros:**
- ✅ FREE tier
- ✅ Betting odds (what sportsbooks use)
- ✅ Year-round
**Cons:**
- ❌ Only odds, not player stats
- ❌ Need to combine with stats API

### Option 4: Hybrid Approach (RECOMMENDED)
**Combine multiple free/cheap APIs:**
1. **BallDontLie** (FREE) - NBA stats during season
2. **ESPN Hidden API** (FREE) - NFL/NBA/MLB stats
3. **The Odds API** (FREE tier) - Betting lines
4. **Supabase** (existing) - Cache everything

**Pros:**
- ✅ FREE or very cheap
- ✅ Year-round coverage
- ✅ Can scale later
**Cons:**
- ❌ More complex integration
- ❌ Need to handle multiple sources

---

## Recommended Approach

### Phase 1: MVP Stats (FREE)
**Goal:** Get basic stats working for player prop analysis

**Data Sources:**
1. **ESPN Hidden API** (FREE)
   - Player season averages
   - Recent game logs (last 5-10 games)
   - Team stats
   - Injury reports

2. **BallDontLie** (FREE)
   - NBA player stats
   - Game-by-game data
   - Season averages

3. **The Odds API** (FREE tier)
   - Current betting lines
   - Line movement
   - Consensus picks

**Implementation:**
```typescript
// lib/stats-service.ts
interface PlayerStats {
  playerId: string
  playerName: string
  season: string
  gamesPlayed: number
  averages: {
    points: number
    rebounds: number
    assists: number
    // ... other stats
  }
  last5Games: GameLog[]
  trends: {
    pointsPerGame: number
    trend: 'up' | 'down' | 'stable'
  }
}

// Fetch from multiple sources, cache in Supabase
async function getPlayerStats(playerName: string, sport: string): Promise<PlayerStats>
```

**Storage:**
```sql
-- Supabase tables
CREATE TABLE player_stats (
  id UUID PRIMARY KEY,
  player_name TEXT,
  sport TEXT,
  season TEXT,
  games_played INT,
  averages JSONB,
  last_updated TIMESTAMP,
  UNIQUE(player_name, sport, season)
);

CREATE TABLE game_logs (
  id UUID PRIMARY KEY,
  player_name TEXT,
  game_date DATE,
  opponent TEXT,
  stats JSONB,
  UNIQUE(player_name, game_date)
);
```

### Phase 2: Enhanced Analysis
**Use stats to power analysis engine:**

```typescript
// lib/enhanced-analysis-engine.ts
async function analyzeBet(bet: ParsedBet): Promise<Analysis> {
  // 1. Get player stats
  const stats = await getPlayerStats(bet.player, bet.sport)
  
  // 2. Get opponent defense ranking
  const oppDefense = await getTeamDefense(bet.opponent, bet.propType)
  
  // 3. Get injury status
  const injury = await getInjuryStatus(bet.player)
  
  // 4. Calculate edge
  const edge = calculateEdge({
    playerAverage: stats.averages[bet.propType],
    recentTrend: stats.trends,
    line: bet.line,
    selection: bet.selection,
    oppDefense: oppDefense.ranking
  })
  
  // 5. Generate recommendation
  return {
    recommendation: edge > 0.05 ? 'bet' : 'pass',
    confidence: calculateConfidence(stats, injury),
    edge: edge,
    reasons: generateReasons(stats, oppDefense, injury),
    warnings: generateWarnings(injury, stats.gamesPlayed)
  }
}
```

### Phase 3: Scale (Paid APIs)
**When revenue justifies it:**
- Upgrade to MySportsFeeds ($150/year)
- Or SportsData.IO if we need real-time
- Add more sports (college, international)

---

## Implementation Timeline

### Week 1: Data Layer
- [ ] Create Supabase tables for stats
- [ ] Build ESPN API scraper
- [ ] Build BallDontLie integration
- [ ] Implement caching strategy
- [ ] Test data fetching

### Week 2: Analysis Engine
- [ ] Redesign analysis engine to use real stats
- [ ] Implement edge calculation
- [ ] Add trend analysis
- [ ] Test with real bets

### Week 3: Integration & Testing
- [ ] Connect stats to slip reader
- [ ] Test end-to-end flow
- [ ] Validate analysis accuracy
- [ ] Deploy to production

---

## Key Decisions Needed

1. **Which free APIs to start with?**
   - ESPN Hidden API (recommended)
   - BallDontLie
   - The Odds API

2. **How much historical data?**
   - Current season only?
   - Last 3 seasons?
   - All-time?

3. **Caching strategy?**
   - Update frequency (daily? hourly?)
   - Cache duration
   - Invalidation rules

4. **Analysis algorithm?**
   - Simple average comparison?
   - Weighted recent games?
   - Advanced regression models?

---

## Next Steps

**Tell me:**
1. Do you want to start with FREE APIs (ESPN + BallDontLie)?
2. Or pay for MySportsFeeds ($150/year, FREE first year)?
3. Which sports are priority? (NBA, NFL, both?)
4. How sophisticated should the analysis be? (simple vs. advanced)

Then I'll build it.
