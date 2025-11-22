"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

export const SPORTS = [
  { key: "NFL", label: "NFL" },
  { key: "NBA", label: "NBA" },
  { key: "MLB", label: "MLB" },
  { key: "NCAAF", label: "NCAAF" },
  // Coming soon sports route to their teaser pages
  { key: "NHL", label: "NHL", comingSoon: true, path: "/nhl" },
  { key: "NCAAMB", label: "NCAAMB", comingSoon: true, path: "/ncaamb" },
  { key: "EPL", label: "EPL", comingSoon: true, path: "/epl" },
  { key: "TENNIS", label: "Tennis", comingSoon: true, path: "/tennis" },
] as const

export type SportKey = (typeof SPORTS)[number]["key"]

interface SportsHeaderProps {
  selectedSport: SportKey | string
  onSelectSport?: (sportKey: SportKey) => void
}

export default function SportsHeader({ selectedSport, onSelectSport }: SportsHeaderProps) {
  const router = useRouter()
  const tabsContainerRef = useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  useEffect(() => {
    function updateIndicator() {
      const container = tabsContainerRef.current
      if (!container) return
      const active = container.querySelector<HTMLButtonElement>(
        `button[data-sport="${selectedSport}"]`
      )
      if (!active) return

      const containerRect = container.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()

      setIndicator({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      })
    }

    updateIndicator()
    window.addEventListener("resize", updateIndicator)
    return () => window.removeEventListener("resize", updateIndicator)
  }, [selectedSport])

  return (
    <div className="mb-8 flex items-baseline gap-3 relative">
      <div className="flex-shrink-0 relative z-10">
        <img src="/ares-logo.svg" alt="Ares Logo" style={{ height: 40 }} className="mr-1" />
        <span className="sr-only">Ares - Smart betting analysis</span>
      </div>

      <div className="flex-1 overflow-x-auto pb-1 -ml-4 pl-4 touch-pan-x no-scrollbar">
        <div className="relative flex gap-4 min-w-max" ref={tabsContainerRef}>
          <div
            className="absolute bottom-0 h-[4px] bg-blue-600 transition-all duration-200 origin-left"
            style={{ transform: `translateX(${indicator.left}px) skewX(-20deg)`, width: indicator.width }}
          />
          {SPORTS.map((sport) => {
            const isSelected = selectedSport === sport.key
            const labelColorClass = isSelected ? "text-blue-400" : "text-white"
            return (
              <button
                key={sport.key}
                onClick={() => {
                  if ((sport as any).comingSoon && (sport as any).path) {
                    router.push((sport as any).path)
                  } else if (onSelectSport) {
                    onSelectSport(sport.key as SportKey)
                  } else {
                    router.push('/')
                  }
                }}
                data-sport={sport.key}
                className="relative whitespace-nowrap text-xl sm:text-2xl font-bold italic border-none focus:outline-none transition-colors duration-200"
                style={{ background: "transparent", padding: "0.25rem 0", border: "none" }}
              >
                <span className={`px-1 ${labelColorClass}`}>{sport.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
