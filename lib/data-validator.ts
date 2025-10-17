// lib/data-validator.ts
// Validates and normalizes all incoming data from The Odds API

import { BookmakerOdds, OddsOutcome } from './analysis-engine';

// ==================== TYPE DEFINITIONS ====================

interface RawOddsAPIResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: RawBookmaker[];
}

interface RawBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: RawMarket[];
}

interface RawMarket {
  key: string;
  last_update?: string;
  outcomes: RawOutcome[];
}

interface RawOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface NormalizedGameData {
  eventId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: BookmakerOdds[];
  metadata: {
    bookmakerCount: number;
    marketCount: number;
    totalOutcomes: number;
    hasSharpBooks: boolean;
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

// ==================== VALIDATION RULES ====================

const REQUIRED_FIELDS = {
  game: ['id', 'sport_key', 'commence_time', 'home_team', 'away_team'],
  bookmaker: ['key', 'title', 'last_update', 'markets'],
  market: ['key', 'outcomes'],
  outcome: ['name', 'price']
};

const VALID_ODDS_RANGE = {
  min: -10000,
  max: 10000
};

const MIN_BOOKMAKERS = 2; // Need at least 2 books for comparison
const MIN_OUTCOMES_PER_MARKET = 2; // Most markets should have at least 2 outcomes

// Sharp bookmakers for quality checks
const SHARP_BOOKS = ['pinnacle', 'betonlineag', 'bookmaker'];

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate a complete game/event response
 */
function validateGameData(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required fields
  REQUIRED_FIELDS.game.forEach(field => {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate event ID format (should be 32 chars)
  if (data.id && data.id.length !== 32) {
    warnings.push(`Event ID has unusual length: ${data.id.length} chars (expected 32)`);
  }
  
  // Validate commence time
  if (data.commence_time) {
    const commenceTime = new Date(data.commence_time);
    if (isNaN(commenceTime.getTime())) {
      errors.push('Invalid commence_time format');
    } else {
      const now = new Date();
      const hoursDiff = (commenceTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < -3) {
        warnings.push('Game appears to have already started or finished');
      }
    }
  }
  
  // Validate bookmakers array
  if (!Array.isArray(data.bookmakers)) {
    errors.push('Bookmakers must be an array');
  } else if (data.bookmakers.length === 0) {
    errors.push('No bookmakers data available');
  } else if (data.bookmakers.length < MIN_BOOKMAKERS) {
    warnings.push(`Only ${data.bookmakers.length} bookmaker(s) available (recommended: ${MIN_BOOKMAKERS}+)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate bookmaker data
 */
function validateBookmaker(bookmaker: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  REQUIRED_FIELDS.bookmaker.forEach(field => {
    if (!bookmaker[field]) {
      errors.push(`Bookmaker missing required field: ${field}`);
    }
  });
  
  if (!Array.isArray(bookmaker.markets) || bookmaker.markets.length === 0) {
    errors.push(`Bookmaker ${bookmaker.title || 'unknown'} has no markets`);
  }
  
  // Validate last_update timestamp
  if (bookmaker.last_update) {
    const updateTime = new Date(bookmaker.last_update);
    if (isNaN(updateTime.getTime())) {
      warnings.push(`Invalid last_update timestamp for ${bookmaker.title}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate market data
 */
function validateMarket(market: any, bookmakerTitle: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  REQUIRED_FIELDS.market.forEach(field => {
    if (!market[field]) {
      errors.push(`Market missing required field: ${field}`);
    }
  });
  
  if (!Array.isArray(market.outcomes)) {
    errors.push('Market outcomes must be an array');
  } else if (market.outcomes.length === 0) {
    errors.push(`Market ${market.key} has no outcomes`);
  } else if (market.outcomes.length < MIN_OUTCOMES_PER_MARKET) {
    warnings.push(`Market ${market.key} from ${bookmakerTitle} only has ${market.outcomes.length} outcome(s)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate outcome data
 */
function validateOutcome(outcome: any, marketKey: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  REQUIRED_FIELDS.outcome.forEach(field => {
    if (outcome[field] === undefined || outcome[field] === null) {
      errors.push(`Outcome in market ${marketKey} missing required field: ${field}`);
    }
  });
  
  // Validate odds value
  if (typeof outcome.price === 'number') {
    if (outcome.price < VALID_ODDS_RANGE.min || outcome.price > VALID_ODDS_RANGE.max) {
      errors.push(`Invalid odds value: ${outcome.price} (must be between ${VALID_ODDS_RANGE.min} and ${VALID_ODDS_RANGE.max})`);
    }
    
    // Warn about unusual odds
    if (outcome.price === 0) {
      warnings.push('Odds value is 0 - this is unusual');
    }
  }
  
  // Validate point value if present
  if (outcome.point !== undefined && typeof outcome.point !== 'number') {
    errors.push(`Invalid point value type in market ${marketKey}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ==================== NORMALIZATION FUNCTIONS ====================

/**
 * Normalize bookmaker key to standard format
 */
function normalizeBookmakerKey(key: string): string {
  return key.toLowerCase().trim();
}

/**
 * Normalize outcome data
 */
function normalizeOutcome(outcome: RawOutcome): OddsOutcome | null {
  const validation = validateOutcome(outcome, 'unknown');
  
  if (!validation.isValid) {
    console.warn('Invalid outcome data:', validation.errors);
    return null;
  }
  
  return {
    name: outcome.name.trim(),
    price: Math.round(outcome.price), // Round to nearest integer
    point: outcome.point !== undefined ? Math.round(outcome.point * 2) / 2 : undefined, // Round to nearest 0.5
    description: outcome.description?.trim()
  };
}

/**
 * Normalize market data
 */
function normalizeMarket(market: RawMarket, bookmakerTitle: string): { key: string; outcomes: OddsOutcome[] } | null {
  const validation = validateMarket(market, bookmakerTitle);
  
  if (!validation.isValid) {
    console.warn(`Invalid market data from ${bookmakerTitle}:`, validation.errors);
    return null;
  }
  
  const normalizedOutcomes = market.outcomes
    .map(outcome => normalizeOutcome(outcome))
    .filter((outcome): outcome is OddsOutcome => outcome !== null);
  
  // Skip market if no valid outcomes
  if (normalizedOutcomes.length === 0) {
    console.warn(`Market ${market.key} from ${bookmakerTitle} has no valid outcomes`);
    return null;
  }
  
  return {
    key: market.key,
    outcomes: normalizedOutcomes
  };
}

/**
 * Normalize bookmaker data
 */
function normalizeBookmaker(bookmaker: RawBookmaker): BookmakerOdds | null {
  const validation = validateBookmaker(bookmaker);
  
  if (!validation.isValid) {
    console.warn('Invalid bookmaker data:', validation.errors);
    return null;
  }
  
  const normalizedMarkets = bookmaker.markets
    .map(market => normalizeMarket(market, bookmaker.title))
    .filter((market): market is NonNullable<typeof market> => market !== null);
  
  // Skip bookmaker if no valid markets
  if (normalizedMarkets.length === 0) {
    console.warn(`Bookmaker ${bookmaker.title} has no valid markets`);
    return null;
  }
  
  return {
    key: normalizeBookmakerKey(bookmaker.key),
    title: bookmaker.title,
    lastUpdate: bookmaker.last_update,
    markets: normalizedMarkets
  };
}

// ==================== MAIN NORMALIZATION FUNCTION ====================

/**
 * Validate and normalize complete game data from The Odds API
 */
export function normalizeGameData(rawData: RawOddsAPIResponse): NormalizedGameData | null {
  // Validate game-level data
  const gameValidation = validateGameData(rawData);
  
  if (!gameValidation.isValid) {
    console.error('Invalid game data:', gameValidation.errors);
    return null;
  }
  
  // Log warnings if present
  if (gameValidation.warnings.length > 0) {
    console.warn('Game data warnings:', gameValidation.warnings);
  }
  
  // Normalize all bookmakers
  const normalizedBookmakers = rawData.bookmakers
    .map(bookmaker => normalizeBookmaker(bookmaker))
    .filter((bookmaker): bookmaker is BookmakerOdds => bookmaker !== null);
  
  // Check if we have enough valid bookmakers
  if (normalizedBookmakers.length === 0) {
    console.error('No valid bookmakers after normalization');
    return null;
  }
  
  // Calculate metadata
  const marketCount = normalizedBookmakers.reduce((sum, b) => sum + b.markets.length, 0);
  const totalOutcomes = normalizedBookmakers.reduce((sum, b) => 
    sum + b.markets.reduce((mSum, m) => mSum + m.outcomes.length, 0), 0
  );
  const hasSharpBooks = normalizedBookmakers.some(b => SHARP_BOOKS.includes(b.key));
  
  // Assess data quality
  let dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  if (normalizedBookmakers.length >= 8 && hasSharpBooks && marketCount >= 3) {
    dataQuality = 'excellent';
  } else if (normalizedBookmakers.length >= 5 && marketCount >= 2) {
    dataQuality = 'good';
  } else if (normalizedBookmakers.length >= 3) {
    dataQuality = 'fair';
  } else {
    dataQuality = 'poor';
  }
  
  return {
    eventId: rawData.id,
    sport: rawData.sport_key,
    homeTeam: rawData.home_team,
    awayTeam: rawData.away_team,
    commenceTime: rawData.commence_time,
    bookmakers: normalizedBookmakers,
    metadata: {
      bookmakerCount: normalizedBookmakers.length,
      marketCount,
      totalOutcomes,
      hasSharpBooks,
      dataQuality
    }
  };
}

/**
 * Normalize multiple games at once
 */
export function normalizeGamesData(rawGames: RawOddsAPIResponse[]): NormalizedGameData[] {
  const normalized = rawGames
    .map(game => normalizeGameData(game))
    .filter((game): game is NormalizedGameData => game !== null);
  
  console.log(`Normalized ${normalized.length} of ${rawGames.length} games`);
  
  return normalized;
}

/**
 * Check if game data is fresh enough to use
 */
export function isDataFresh(lastUpdate: string, maxAgeMinutes: number = 5): boolean {
  const updateTime = new Date(lastUpdate);
  const now = new Date();
  const ageMinutes = (now.getTime() - updateTime.getTime()) / (1000 * 60);
  
  return ageMinutes <= maxAgeMinutes;
}

/**
 * Filter out stale bookmaker data
 */
export function filterFreshBookmakers(
  bookmakers: BookmakerOdds[],
  maxAgeMinutes: number = 5
): BookmakerOdds[] {
  return bookmakers.filter(b => isDataFresh(b.lastUpdate, maxAgeMinutes));
}

/**
 * Sanitize team names for consistent matching
 */
export function sanitizeTeamName(teamName: string): string {
  return teamName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Check if two team names match (fuzzy matching)
 */
export function teamsMatch(team1: string, team2: string): boolean {
  const sanitized1 = sanitizeTeamName(team1);
  const sanitized2 = sanitizeTeamName(team2);
  
  // Exact match
  if (sanitized1 === sanitized2) return true;
  
  // One contains the other (handles "LA Lakers" vs "Lakers")
  if (sanitized1.includes(sanitized2) || sanitized2.includes(sanitized1)) {
    return true;
  }
  
  return false;
}

/**
 * Extract player name from various formats
 */
export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validate player prop data specifically
 */
export function validatePlayerProp(
  market: string,
  outcomes: OddsOutcome[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if market is a player prop
  const isPlayerProp = market.startsWith('player_') || market.startsWith('batter_') || market.startsWith('pitcher_');
  
  if (!isPlayerProp) {
    return { isValid: true, errors, warnings };
  }
  
  // Player props should have description field
  const missingDescriptions = outcomes.filter(o => !o.description);
  if (missingDescriptions.length > 0) {
    warnings.push(`${missingDescriptions.length} outcome(s) missing player name in ${market}`);
  }
  
  // Player props typically have Over/Under
  const hasOver = outcomes.some(o => o.name === 'Over');
  const hasUnder = outcomes.some(o => o.name === 'Under');
  
  if (!hasOver || !hasUnder) {
    warnings.push(`Player prop ${market} missing Over/Under outcomes`);
  }
  
  // Check for consistent point values
  const points = outcomes
    .filter(o => o.point !== undefined)
    .map(o => o.point);
  
  const uniquePoints = new Set(points);
  if (uniquePoints.size > 1) {
    warnings.push(`Player prop ${market} has inconsistent point values: ${Array.from(uniquePoints).join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get data quality score (0-100)
 */
export function calculateDataQualityScore(metadata: NormalizedGameData['metadata']): number {
  let score = 0;
  
  // Bookmaker count (max 40 points)
  score += Math.min(40, metadata.bookmakerCount * 5);
  
  // Sharp books presence (20 points)
  if (metadata.hasSharpBooks) score += 20;
  
  // Market diversity (max 20 points)
  score += Math.min(20, metadata.marketCount * 5);
  
  // Outcome count (max 20 points)
  score += Math.min(20, metadata.totalOutcomes * 0.5);
  
  return Math.round(score);
}

/**
 * Batch validate multiple games and return report
 */
export function validateBatch(rawGames: RawOddsAPIResponse[]): {
  valid: NormalizedGameData[];
  invalid: Array<{ game: any; errors: string[] }>;
  totalGames: number;
  validCount: number;
  invalidCount: number;
  averageQuality: number;
} {
  const valid: NormalizedGameData[] = [];
  const invalid: Array<{ game: any; errors: string[] }> = [];
  
  for (const game of rawGames) {
    const validation = validateGameData(game);
    
    if (validation.isValid) {
      const normalized = normalizeGameData(game);
      if (normalized) {
        valid.push(normalized);
      } else {
        invalid.push({ game, errors: ['Normalization failed'] });
      }
    } else {
      invalid.push({ game, errors: validation.errors });
    }
  }
  
  const averageQuality = valid.length > 0
    ? valid.reduce((sum, g) => sum + calculateDataQualityScore(g.metadata), 0) / valid.length
    : 0;
  
  return {
    valid,
    invalid,
    totalGames: rawGames.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    averageQuality: Math.round(averageQuality)
  };
}

// ==================== EXPORT TYPES ====================

export type {
  RawOddsAPIResponse,
  RawBookmaker,
  RawMarket,
  RawOutcome,
  ValidationResult,
  NormalizedGameData
};