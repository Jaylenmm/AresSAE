import { MarketAnalysis } from '@/lib/types'
import ConfidenceBar from './ConfidenceBar'

interface AnalysisDisplayProps {
  analysis: MarketAnalysis
}

export default function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  const getTierInfo = (score: number) => {
    if (score >= 80) return { tier: 'Highly Recommended', color: 'bg-green-100 text-green-800 border-green-300' }
    if (score >= 60) return { tier: 'Recommended', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
    return { tier: 'Alternative Available', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  }

  const tierInfo = getTierInfo(analysis.recommendation_score || 0)

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg text-gray-900">Ares Analysis</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${tierInfo.color}`}>
          {tierInfo.tier}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">{analysis.selection}</h4>
          <p className="text-sm text-gray-600 leading-relaxed">{analysis.reasoning}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {analysis.ev_percentage !== undefined && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Expected Value</p>
              <p className="text-lg font-bold text-blue-600">+{analysis.ev_percentage}%</p>
            </div>
          )}
          
          {analysis.has_edge && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Edge Detected</p>
              <p className="text-lg font-bold text-green-600">✓ Yes</p>
            </div>
          )}
        </div>

        {analysis.hit_probability && (
          <ConfidenceBar confidence={Math.round(analysis.hit_probability)} />
        )}

        {analysis.best_book && (
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-1">Best Available</p>
            <p className="font-semibold text-gray-900">
              {analysis.best_book} ({analysis.best_odds})
            </p>
          </div>
        )}
      </div>
    </div>
  )
}