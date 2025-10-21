'use client'

// components/ValueMeterTEST.tsx
// Bar-style value meter visualization

interface ValueMeterProps {
  edge: number
}

export default function ValueMeterTEST({ edge }: ValueMeterProps) {
  // Clamp edge to ±10% for visual display
  const displayEdge = Math.max(-10, Math.min(10, edge))
  
  // Calculate position (0% = center = 50% position)
  // -10% = 0% position, 0% = 50% position, +10% = 100% position
  const position = ((displayEdge + 10) / 20) * 100
  
  // Determine if edge is beyond ±10%
  const isCapped = Math.abs(edge) > 10
  const displayLabel = isCapped
    ? edge > 10 ? '+10%+' : '-10%-'
    : `${edge > 0 ? '+' : ''}${edge.toFixed(1)}%`
  
  // Determine bar color and direction
  const isPositive = edge > 0.5
  const isNegative = edge < -3
  const isNeutral = !isPositive && !isNegative
  
  // Bar styling
  const barColor = isPositive
    ? 'bg-gradient-to-r from-blue-500 to-blue-700'
    : isNegative
    ? 'bg-gradient-to-r from-red-500 to-red-700'
    : 'bg-gray-400'
  
  // Bar fills from center (50%) to position
  const barLeft = Math.min(50, position)
  const barWidth = Math.abs(position - 50)
  
  return (
    <div className="my-4">
      <p className="text-xs text-gray-600 mb-2 font-medium">Value Meter: Analyze your pick's value. Sharp bettors tend to look for +2%-5% edges. Fair value is also a good pick though!</p>
      
      <div className="relative h-16 rounded-lg overflow-hidden border border-blue-500 bg-gray-50">
        {/* Zone labels */}
        <div className="absolute inset-x-0 top-1 flex justify-between px-2 text-xs text-gray-600 font-medium">
          <span>Overpriced</span>
          <span>Fair</span>
          <span>Sharp Value</span>
        </div>
        
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400" />
        
        {/* Bar visualization */}
        <div 
          className={`absolute top-1/2 transform -translate-y-1/2 h-3 ${barColor} transition-all duration-300`}
          style={{
            left: `${barLeft}%`,
            width: `${barWidth}%`
          }}
        />
        
        {/* Scale marks */}
        <div className="absolute inset-x-0 bottom-1 flex justify-between px-2 text-xs text-gray-500">
          <span>-10%</span>
          <span>-3%</span>
          <span>0%</span>
          <span>+2%</span>
          <span>+10%</span>
        </div>
      </div>
      
      {/* Edge label below meter */}
      <div className="text-center mt-2">
        <span className={`text-lg font-bold ${
          isPositive ? 'text-green-600' : 
          isNegative ? 'text-red-600' : 
          'text-gray-600'
        }`}>
          {displayLabel}
        </span>
      </div>
    </div>
  )
}