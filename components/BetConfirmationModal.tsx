'use client'

interface BetConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  analysis: {
    ev_percentage: number
    hit_probability: number
    recommendation_score: number
    reasoning: string
    best_book?: string
    best_odds?: number
  }
  betDetails: {
    player?: string
    team?: string
    selection: string
    line?: number
    propType?: string
    odds: number
  }
}

export default function BetConfirmationModal({ 
  isOpen, 
  onClose, 
  analysis, 
  betDetails 
}: BetConfirmationModalProps) {
  if (!isOpen) return null

  const scoreColor = analysis.recommendation_score >= 70 ? 'text-green-600' : 
                     analysis.recommendation_score >= 50 ? 'text-blue-600' : 
                     analysis.recommendation_score >= 30 ? 'text-yellow-600' : 'text-red-600'

  const bgColor = analysis.recommendation_score >= 70 ? 'bg-green-50' : 
                  analysis.recommendation_score >= 50 ? 'bg-blue-50' : 
                  analysis.recommendation_score >= 30 ? 'bg-yellow-50' : 'bg-red-50'

  // Clean reasoning: remove emojis and format professionally
  const cleanReasoning = (text: string) => {
    // Remove all emojis
    let cleaned = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    
    // Split by common separators
    const parts = cleaned.split(/\||;|\. (?=[A-Z])/).filter(line => line.trim().length > 0)
    
    return parts.map(part => {
      const trimmed = part.trim()
      // Check if line contains a colon (key-value format)
      if (trimmed.includes(':')) {
        const [key, value] = trimmed.split(':')
        return { key: key.trim(), value: value.trim() }
      }
      return { key: null, value: trimmed }
    })
  }

  const reasoningPoints = cleanReasoning(analysis.reasoning)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-black p-6 border-b border-gray-200`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Bet Saved!</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600">
            {betDetails.player 
              ? `${betDetails.player} ${betDetails.selection} ${betDetails.line} ${betDetails.propType}`
              : `${betDetails.team || betDetails.selection} ${betDetails.line || ''}`
            }
          </p>
        </div>

        {/* Analysis Stats */}
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {analysis.ev_percentage > 0 ? '+' : ''}{analysis.ev_percentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Expected Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{Math.round(analysis.hit_probability)}%</div>
              <div className="text-xs text-gray-500 mt-1">Hit Probability</div>
            </div>
            <div className="text-center">
              <div className={`text-black text-2xl font-bold`}>{Math.round(analysis.recommendation_score)}/100</div>
              <div className="text-xs text-gray-500 mt-1">Confidence</div>
            </div>
          </div>

          {/* Reasoning */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Analysis Breakdown</h3>
            <div className="space-y-2">
              {reasoningPoints.map((point, idx) => (
                <div key={idx} className="text-sm text-gray-700 leading-relaxed">
                  {point.key ? (
                    <>
                      <span className="font-semibold">{point.key}:</span> {point.value}
                    </>
                  ) : (
                    <span>{point.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Best Odds Info */}
          {analysis.best_book && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Best available odds:</span> {analysis.best_odds && (analysis.best_odds > 0 ? '+' : '')}{analysis.best_odds} at {analysis.best_book}
              </p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full bg-black text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}