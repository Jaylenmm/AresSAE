interface ConfidenceBarProps {
  confidence: number
  label?: string
}

export default function ConfidenceBar({ confidence, label = 'Hit Probability' }: ConfidenceBarProps) {
  const getColor = (conf: number) => {
    if (conf >= 70) return 'bg-green-500'
    if (conf >= 55) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">{confidence}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full transition-all ${getColor(confidence)}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  )
}