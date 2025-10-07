// ===== CREATE: components/ComprehensiveAnalysisDisplay.tsx =====

'use client'

import { ComprehensiveBetAnalysis } from '@/lib/analysis-engine'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, DollarSign, Target, BarChart3 } from 'lucide-react'

interface AnalysisDisplayProps {
  analysis: ComprehensiveBetAnalysis
  betDescription: string
}

export default function ComprehensiveAnalysisDisplay({ analysis, betDescription }: AnalysisDisplayProps) {
  
  // Recommendation badge color
  const getRecommendationStyle = () => {
    switch (analysis.recommendation) {
      case 'strong_bet':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'bet':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'lean':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }
  
  const getRecommendationText = () => {
    switch (analysis.recommendation) {
      case 'strong_bet':
        return '🔥 Strong Bet'
      case 'bet':
        return '✅ Recommended Bet'
      case 'lean':
        return '⚖️ Slight Lean'
      default:
        return '❌ Pass'
    }
  }
  
  const getConfidenceColor = () => {
    if (analysis.confidence >= 70) return 'text-green-600'
    if (analysis.confidence >= 50) return 'text-yellow-600'
    return 'text-gray-600'
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      
      {/* Header - Bet Description */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{betDescription}</h2>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-full border-2 font-bold ${getRecommendationStyle()}`}>
            {getRecommendationText()}
          </span>
          <span className={`text-3xl font-bold ${getConfidenceColor()}`}>
            {analysis.confidence}% Confidence
          </span>
        </div>
      </div>
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Edge */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="text-blue-600" size={20} />
            <span className="text-sm font-semibold text-blue-900">Edge</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {analysis.edgePercent > 0 ? '+' : ''}{analysis.edgePercent.toFixed(1)}%
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {analysis.edgePercent >= 2 && analysis.edgePercent <= 5 && '✓ Realistic edge'}
            {analysis.edgePercent > 5 && analysis.edgePercent <= 8 && '✓ Strong edge'}
            {analysis.edgePercent > 8 && '⚠️ Verify analysis'}
            {analysis.edgePercent < 2 && 'Below threshold'}
          </div>
        </div>
        
        {/* Expected Value */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-green-600" size={20} />
            <span className="text-sm font-semibold text-green-900">EV per $100</span>
          </div>
          <div className="text-2xl font-bold text-green-700">
            ${analysis.evDollars > 0 ? '+' : ''}{analysis.evDollars.toFixed(2)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            {analysis.evDollars > 0 ? 'Positive EV' : 'Negative EV'}
          </div>
        </div>
        
        {/* Hit Probability */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="text-purple-600" size={20} />
            <span className="text-sm font-semibold text-purple-900">Hit Rate</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {analysis.hitProbability}%
          </div>
          <div className="text-xs text-purple-600 mt-1">
            Implied: {analysis.impliedProbability}%
          </div>
        </div>
        
        {/* Kelly Bet Size */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-orange-600" size={20} />
            <span className="text-sm font-semibold text-orange-900">Kelly Size</span>
          </div>
          <div className="text-2xl font-bold text-orange-700">
            ${analysis.kellySizing.recommended}
          </div>
          <div className="text-xs text-orange-600 mt-1">
            {analysis.kellySizing.percentage.toFixed(1)}% of $1k bankroll
          </div>
        </div>
      </div>
      
      {/* Best Line */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 border-2 border-indigo-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-indigo-900 mb-1">📊 Best Available Line</div>
            <div className="text-2xl font-bold text-indigo-700">
              {analysis.bestBook} at {analysis.bestOdds > 0 ? '+' : ''}{analysis.bestOdds}
            </div>
          </div>
          {analysis.potentialSavings > 0 && (
            <div className="text-right">
              <div className="text-sm text-indigo-600">Line shopping saves</div>
              <div className="text-xl font-bold text-green-600">
                +{analysis.potentialSavings.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Sharp vs Soft Analysis */}
      {analysis.sharpVsSoft.sharpConsensus !== null && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Info size={18} />
            Sharp vs Soft Book Analysis
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Sharp Books</div>
              <div className="text-xl font-bold text-gray-900">
                {analysis.sharpVsSoft.sharpConsensus?.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Soft Books</div>
              <div className="text-xl font-bold text-gray-900">
                {analysis.sharpVsSoft.softConsensus?.toFixed(1)}
              </div>
            </div>
          </div>
          {analysis.sharpVsSoft.divergence > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {analysis.sharpVsSoft.edge === 'sharp' ? (
                <TrendingUp className="text-green-600" size={18} />
              ) : analysis.sharpVsSoft.edge === 'soft' ? (
                <TrendingDown className="text-red-600" size={18} />
              ) : (
                <div className="w-[18px]" />
              )}
              <span className="text-sm font-medium text-gray-700">
                {analysis.sharpVsSoft.divergence.toFixed(1)} point divergence
                {analysis.sharpVsSoft.edge !== 'neutral' && ` - Edge on ${analysis.sharpVsSoft.edge} side`}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Market Efficiency */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <BarChart3 size={18} />
          Market Efficiency: {analysis.marketEfficiency}/100
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
          <div 
            className={`h-3 rounded-full transition-all ${
              analysis.marketEfficiency > 70 ? 'bg-green-500' : 
              analysis.marketEfficiency > 50 ? 'bg-yellow-500' : 
              'bg-red-500'
            }`}
            style={{ width: `${analysis.marketEfficiency}%` }}
          />
        </div>
        {analysis.marketOpportunities.length > 0 && (
          <div className="space-y-1">
            {analysis.marketOpportunities.map((opp, idx) => (
              <div key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">⚡</span>
                <span>{opp}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Reasoning */}
      <div className="space-y-3">
        <div className="font-semibold text-gray-900 text-lg">Analysis Breakdown</div>
        <div className="space-y-2">
          {analysis.reasoning.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-3 text-sm text-gray-700 bg-gray-50 rounded p-3">
              <CheckCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
          <div className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
            <AlertTriangle size={18} />
            Important Considerations
          </div>
          <div className="space-y-2">
            {analysis.warnings.map((warning, idx) => (
              <div key={idx} className="text-sm text-yellow-800">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Disclaimer */}
      <div className="text-xs text-gray-500 text-center pt-4 border-t">
        Analysis based on current market data and statistical modeling. 
        Past performance does not guarantee future results. 
        Bet responsibly and within your means.
      </div>
    </div>
  )
}