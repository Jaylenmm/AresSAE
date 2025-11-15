// components/ui/OddsComponents.tsx
// Reusable UI components for displaying odds and analysis

import React from 'react';
import { 
  AnalysisResult, 
  formatOdds, 
  getConfidenceColor, 
  getRecommendationColor 
} from '@/lib/analysis-engine';
import { getBookmakerDisplayName } from '@/lib/bookmakers';

// ==================== CONFIDENCE INDICATOR ====================

interface ConfidenceIndicatorProps {
  confidence: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceIndicator({ 
  confidence, 
  showLabel = true,
  size = 'md' 
}: ConfidenceIndicatorProps) {
  const sizeClasses = {
    sm: 'w-16 h-2',
    md: 'w-24 h-3',
    lg: 'w-32 h-4'
  };
  
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  
  const getColor = () => {
    if (confidence >= 75) return 'bg-green-500';
    if (confidence >= 60) return 'bg-blue-500';
    if (confidence >= 45) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} bg-gray-700 rounded-full overflow-hidden`}>
        <div 
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      {showLabel && (
        <span className={`${textSizes[size]} font-semibold ${getConfidenceColor(confidence)}`}>
          {confidence}%
        </span>
      )}
    </div>
  );
}

// ==================== ODDS DISPLAY ====================

interface OddsDisplayProps {
  odds: number;
  sportsbook?: string;
  showBookmaker?: boolean;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}

export function OddsDisplay({ 
  odds, 
  sportsbook,
  showBookmaker = true,
  size = 'md',
  highlight = false
}: OddsDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl'
  };
  
  const oddsColor = odds > 0 ? 'text-green-400' : 'text-white';
  
  return (
    <div className={`flex items-center gap-2 ${highlight ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-2 rounded-lg' : ''}`}>
      <span className={`${sizeClasses[size]} font-bold ${oddsColor}`}>
        {formatOdds(odds)}
      </span>
      {showBookmaker && sportsbook && (
        <span className="text-xs text-gray-400">
          @ {getBookmakerDisplayName(sportsbook)}
        </span>
      )}
    </div>
  );
}

// ==================== RECOMMENDATION BADGE ====================

interface RecommendationBadgeProps {
  recommendation: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RecommendationBadge({ 
  recommendation, 
  size = 'md' 
}: RecommendationBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  const labels: Record<string, string> = {
    strong_bet: 'STRONG BET',
    bet: 'BET',
    consider: 'CONSIDER',
    avoid: 'AVOID',
    no_edge: 'NO EDGE'
  };
  
  return (
    <span className={`${sizeClasses[size]} ${getRecommendationColor(recommendation)} text-white font-bold rounded-full uppercase`}>
      {labels[recommendation] || recommendation}
    </span>
  );
}

// ==================== BOOKMAKER COMPARISON ====================

interface BookmakerComparisonProps {
  allOdds: Array<{ sportsbook: string; odds: number; isSharp: boolean }>;
  maxDisplay?: number;
}

export function BookmakerComparison({ 
  allOdds, 
  maxDisplay = 5 
}: BookmakerComparisonProps) {
  const displayOdds = allOdds.slice(0, maxDisplay);
  const hasMore = allOdds.length > maxDisplay;
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-400">Odds Comparison</h4>
      <div className="space-y-1">
        {displayOdds.map((item, idx) => (
          <div 
            key={`${item.sportsbook}-${idx}`}
            className="flex justify-between items-center p-2 bg-gray-800/50 rounded"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">
                {getBookmakerDisplayName(item.sportsbook)}
              </span>
              {item.isSharp && (
                <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded">
                  SHARP
                </span>
              )}
            </div>
            <span className={`text-sm font-bold ${item.odds > 0 ? 'text-green-400' : 'text-white'}`}>
              {formatOdds(item.odds)}
            </span>
          </div>
        ))}
        {hasMore && (
          <p className="text-xs text-gray-500 text-center pt-1">
            +{allOdds.length - maxDisplay} more bookmakers
          </p>
        )}
      </div>
    </div>
  );
}

// ==================== ANALYSIS SUMMARY ====================

interface AnalysisSummaryProps {
  analysis: AnalysisResult;
  compact?: boolean;
}

export function AnalysisSummary({ 
  analysis, 
  compact = false 
}: AnalysisSummaryProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <ConfidenceIndicator confidence={analysis.confidence} size="sm" />
        <RecommendationBadge recommendation={analysis.recommendation} size="sm" />
        <OddsDisplay odds={analysis.bestOdds} sportsbook={analysis.bestSportsbook} size="sm" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Analysis</h3>
        <RecommendationBadge recommendation={analysis.recommendation} />
      </div>
      
      {/* Confidence */}
      <div>
        <p className="text-sm text-gray-400 mb-2">Confidence</p>
        <ConfidenceIndicator confidence={analysis.confidence} size="lg" />
      </div>
      
      {/* Best Odds */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">Best Odds</p>
          <OddsDisplay 
            odds={analysis.bestOdds} 
            sportsbook={analysis.bestSportsbook} 
            size="lg"
            highlight 
          />
        </div>
        {analysis.edge !== null && analysis.edge > 0 && (
          <div>
            <p className="text-sm text-gray-400 mb-1">Edge</p>
            <span className="text-lg font-bold text-green-400">
              +{(analysis.edge * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      
      {/* Sharp Book Info */}
      {analysis.sharpBookOdds && (
        <div>
          <p className="text-sm text-gray-400 mb-1">Sharp Book Line</p>
          <OddsDisplay 
            odds={analysis.sharpBookOdds} 
            sportsbook={analysis.sharpBookName || undefined}
            size="md" 
          />
        </div>
      )}
      
      {/* Market Insights */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-400">Market</p>
          <p className="text-white capitalize">{analysis.marketEfficiency.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-gray-400">Sharp Consensus</p>
          <p className="text-white capitalize">{analysis.sharpConsensus}</p>
        </div>
      </div>
      
      {/* Reasons */}
      {analysis.reasons.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-green-400 mb-1">Why This Bet:</p>
          <ul className="space-y-1">
            {analysis.reasons.map((reason, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-green-400">-</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-yellow-400 mb-1">Considerations:</p>
          <ul className="space-y-1">
            {analysis.warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-yellow-400">!</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ==================== GAME CARD ====================

interface GameCardProps {
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport: string;
  bestOdds?: { odds: number; sportsbook: string };
  confidence?: number;
  onClick?: () => void;
}

export function GameCard({
  homeTeam,
  awayTeam,
  commenceTime,
  sport,
  bestOdds,
  confidence,
  onClick
}: GameCardProps) {
  const gameDate = new Date(commenceTime);
  const dateStr = gameDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  const timeStr = gameDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  return (
    <div 
      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Sport Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded uppercase">
          {sport.replace('_', ' ')}
        </span>
        {confidence !== undefined && (
          <ConfidenceIndicator confidence={confidence} showLabel={false} size="sm" />
        )}
      </div>
      
      {/* Teams */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold">{awayTeam}</span>
          <span className="text-gray-400 text-sm">@</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold">{homeTeam}</span>
        </div>
      </div>
      
      {/* Game Info */}
      <div className="flex items-center justify-between text-sm border-t border-gray-700 pt-3">
        <div className="text-gray-400">
          <p>{dateStr}</p>
          <p>{timeStr}</p>
        </div>
        {bestOdds && (
          <OddsDisplay 
            odds={bestOdds.odds} 
            sportsbook={bestOdds.sportsbook}
            size="sm"
            showBookmaker={false}
          />
        )}
      </div>
    </div>
  );
}

// ==================== PLAYER PROP CARD ====================

interface PlayerPropCardProps {
  playerName: string;
  market: string;
  line: number;
  odds: { over: number; under: number };
  sportsbook: string;
  confidence?: number;
  recommendation?: string;
  onClick?: () => void;
}

export function PlayerPropCard({
  playerName,
  market,
  line,
  odds,
  sportsbook,
  confidence,
  recommendation,
  onClick
}: PlayerPropCardProps) {
  const marketLabel = market
    .replace('player_', '')
    .replace('_', ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return (
    <div 
      className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-xs sm:text-sm text-gray-400 truncate">{marketLabel}</p>
          <h4 className="text-sm sm:text-base text-white font-bold truncate">{playerName}</h4>
        </div>
        {recommendation && (
          <RecommendationBadge recommendation={recommendation} size="sm" />
        )}
      </div>
      
      {/* Line */}
      <div className="text-center mb-2 sm:mb-3">
        <span className="text-xl sm:text-2xl font-bold text-blue-400">{line}</span>
      </div>
      
      {/* Odds */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="text-center p-1.5 sm:p-2 bg-gray-700/50 rounded min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">OVER</p>
          <span className="text-xs sm:text-base md:text-lg font-bold text-green-400 block truncate">{formatOdds(odds.over)}</span>
        </div>
        <div className="text-center p-1.5 sm:p-2 bg-gray-700/50 rounded min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">UNDER</p>
          <span className="text-xs sm:text-base md:text-lg font-bold text-white block truncate">{formatOdds(odds.under)}</span>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between text-xs sm:text-sm border-t border-gray-700 pt-2 sm:pt-3">
        <span className="text-gray-400 truncate flex-1 min-w-0 pr-2">{getBookmakerDisplayName(sportsbook)}</span>
        {confidence !== undefined && (
          <ConfidenceIndicator confidence={confidence} showLabel={false} size="sm" />
        )}
      </div>
    </div>
  );
}