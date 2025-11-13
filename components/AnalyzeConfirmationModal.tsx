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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-700 p-6 rounded-t-xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white">Analyze This Pick?</h2>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <p className="text-sm text-white/90">
            Run Ares analysis on this bet
          </p>
        </div>

        {/* Bet Details */}
        <div className="p-6">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/10">
            <div className="mb-3">
              <p className="text-lg font-bold text-white">
                {betDetails.player 
                  ? `${betDetails.player}`
                  : `${betDetails.team || betDetails.selection}`
                }
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {betDetails.player 
                  ? `${betDetails.selection} ${betDetails.line} ${betDetails.propType}`
                  : `${betDetails.selection} ${betDetails.line || ''}`
                }
              </p>
            </div>
            
            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Odds:</span>
                <span className="text-xl font-bold text-white">
                  {betDetails.odds > 0 ? '+' : ''}{betDetails.odds}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-6 backdrop-blur-sm">
            <p className="text-sm text-blue-200">
              💡 Analysis will check market efficiency, edge detection, and provide recommendations
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold py-3 rounded-lg hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-gradient-to-r from-blue-900 to-blue-600 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              Analyze
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}