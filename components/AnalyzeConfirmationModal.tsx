'use client'

interface AnalyzeConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  betDetails: {
    player?: string
    team?: string
    selection: string
    line?: number
    propType?: string
    odds: number
    sportsbook?: string
  }
}

export default function AnalyzeConfirmationModal({ 
  isOpen, 
  onClose,
  onConfirm,
  betDetails 
}: AnalyzeConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-900 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white">Analyze This Pick?</h2>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <p className="text-sm text-white opacity-90">
            Run Ares analysis on this bet
          </p>
        </div>

        {/* Bet Details */}
        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="mb-3">
              <p className="text-lg font-bold text-gray-900">
                {betDetails.player 
                  ? `${betDetails.player}`
                  : `${betDetails.team || betDetails.selection}`
                }
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {betDetails.player 
                  ? `${betDetails.selection} ${betDetails.line} ${betDetails.propType}`
                  : `${betDetails.selection} ${betDetails.line || ''}`
                }
              </p>
            </div>
            
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Odds:</span>
                <span className="text-xl font-bold text-gray-900">
                  {betDetails.odds > 0 ? '+' : ''}{betDetails.odds}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-purple-900">
              💡 Analysis will check market efficiency, edge detection, and provide recommendations
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white border-2 border-gray-300 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-900 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Analyze
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}