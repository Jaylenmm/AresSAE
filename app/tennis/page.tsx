import SportsHeader from '@/components/SportsHeader'

export default function TennisPage() {
  return (
    <>
      <main className="w-full mx-auto p-4 min-h-[60vh] flex flex-col">
        <SportsHeader selectedSport="TENNIS" />

        <div className="flex-1 flex items-center justify-center">
          <div className="bg-gray-900 text-white rounded-2xl border border-blue-600/40 px-8 py-10 max-w-xl text-center shadow-lg">
            <h1 className="text-3xl font-bold mb-4">Tennis is coming soon to Ares</h1>
            <p className="text-gray-300 text-sm mb-3">
              We&apos;re working on ATP/WTA match odds, game/sets markets, and player performance metrics.
            </p>
            <p className="text-gray-400 text-xs">
              Stay tuned for full tennis coverage, from straight bets to multi-leg slips.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
