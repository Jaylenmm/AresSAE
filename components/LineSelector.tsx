'use client'

// components/LineSelector.tsx
import { useState } from 'react'

interface AlternateLine {
  line: number
  over_odds: number | null
  under_odds: number | null
  sportsbook: string
  is_alternate?: boolean
}

interface LineSelectorProps {
  playerName?: string
  propType: string
  selection: 'over' | 'under' | 'spread' | 'home' | 'away'
  currentLine: number
  availableLines: AlternateLine[]
  onSelectLine: (line: number, odds: number) => void
  onClose: () => void
}

export default function LineSelector({
  playerName,
  propType,
  selection,
  currentLine,
  availableLines,
  onSelectLine,
  onClose
}: LineSelectorProps) {
  const [selectedLine, setSelectedLine] = useState<number>(currentLine)

  // Group lines by value and get best odds for each
  const uniqueLines = Array.from(
    new Map(
      availableLines.map(line => [
        line.line,
        {
          line: line.line,
          odds: selection === 'over' ? line.over_odds : line.under_odds,
          sportsbook: line.sportsbook,
          is_alternate: line.is_alternate
        }
      ])
    ).values()
  ).sort((a, b) => a.line - b.line)

  const handleAnalyze = () => {
    const selected = uniqueLines.find(l => l.line === selectedLine)
    if (selected && selected.odds !== null) {
      onSelectLine(selectedLine, selected.odds)
    }
  }

  const getLineDifference = (line: number) => {
    let diff = 0
    
    if (selection === 'over') {
      diff = line - currentLine  // Higher line = harder over
    } else if (selection === 'under') {
      diff = currentLine - line  // Lower line = harder under
    } else if (selection === 'spread') {
      diff = Math.abs(line - currentLine)  // Just show difference for spreads
    }
    
    if (diff < 0) return { text: `${Math.abs(diff).toFixed(1)} easier`, color: 'text-green-600' }
    if (diff === 0) return { text: 'Your saved line', color: 'text-blue-600' }
    if (diff > 0) return { text: `${diff.toFixed(1)} harder`, color: 'text-orange-600' }
    return { text: '', color: '' }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col border border-gray-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
          <h2 className="text-xl font-bold text-white mb-1">Select Alternate Line</h2>
          {playerName && (
            <p className="text-sm text-blue-100">
              {playerName}
            </p>
          )}
          <p className="text-xs text-blue-200 mt-1">
            {propType.toUpperCase()} • {selection.toUpperCase()}
          </p>
        </div>

        {/* Line Options */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0a0a0a]">
          {uniqueLines.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              No alternate lines available
            </p>
          ) : (
            uniqueLines.map((lineOption) => {
              const lineDiff = getLineDifference(lineOption.line)
              const isSelected = lineOption.line === selectedLine
              const isOriginal = lineOption.line === currentLine

              return (
                <button
                  key={lineOption.line}
                  onClick={() => setSelectedLine(lineOption.line)}
                  className={`w-full p-4 rounded-lg transition-all text-left ${
                    isSelected
                      ? 'bg-blue-600 border-2 border-blue-400 shadow-lg shadow-blue-500'
                      : 'bg-[#1a1a1a] border-2 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-3xl font-bold ${isSelected ? 'text-white' : 'text-white'}`}>
                        {lineOption.line}
                      </span>
                      {isOriginal && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded font-semibold">
                          SAVED
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-white'}`}>
                        {lineOption.odds && lineOption.odds > 0 ? '+' : ''}
                        {lineOption.odds || 'N/A'}
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                        {lineOption.sportsbook}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {lineOption.is_alternate && (
                      <span className={`text-xs italic ${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>
                        Alternate
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-800 p-4 space-y-2 bg-[#1a1a1a]">
          <button
            onClick={handleAnalyze}
            disabled={uniqueLines.length === 0}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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