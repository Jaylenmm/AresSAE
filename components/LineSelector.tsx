'use client'

// components/LineSelector.tsx
import { useState } from 'react'

interface LineSelectorProps {
  playerName?: string
  propType: string
  selection: 'over' | 'under' | 'spread' | 'home' | 'away'
  currentLine: number
  onSelectLine: (line: number, odds: number) => void
  onClose: () => void
}

export default function LineSelector({
  playerName,
  propType,
  selection,
  currentLine,
  onSelectLine,
  onClose
}: LineSelectorProps) {
  const [lineValue, setLineValue] = useState<string>(
    typeof currentLine === 'number' ? String(currentLine) : ''
  )
  const [oddsValue, setOddsValue] = useState<string>('')

  const handleAnalyze = () => {
    const parsedLine = parseFloat(lineValue)
    if (Number.isNaN(parsedLine)) {
      alert('Please enter a valid line to analyze.')
      return
    }

    const trimmedOdds = oddsValue.trim()
    const parsedOdds = trimmedOdds === '' ? Number.NaN : parseInt(trimmedOdds, 10)

    onSelectLine(parsedLine, parsedOdds)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg max-w-md w-full overflow-hidden flex flex-col border border-gray-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
          <h2 className="text-xl font-bold text-white mb-1">Analyze Alternate Line</h2>
          {playerName && (
            <p className="text-sm text-blue-100">
              {playerName}
            </p>
          )}
          <p className="text-xs text-blue-200 mt-1">
            {propType.toUpperCase()} • {selection.toUpperCase()}
          </p>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4 bg-[#0a0a0a]">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Alternate line <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.5"
              value={lineValue}
              onChange={(e) => setLineValue(e.target.value)}
              className="w-full bg-[#111] border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 18.5"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Enter the line you want Ares to analyze (for example, a safer alt line you found at another book).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Odds / price (optional)
            </label>
            <input
              type="number"
              step="1"
              value={oddsValue}
              onChange={(e) => setOddsValue(e.target.value)}
              className="w-full bg-[#111] border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. -150 or 120"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              If you leave this blank, Ares will reuse the odds from your saved pick.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-800 p-4 space-y-2 bg-[#1a1a1a]">
          <button
            onClick={handleAnalyze}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Analyze This Line
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-800 text-gray-300 font-semibold py-3 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}