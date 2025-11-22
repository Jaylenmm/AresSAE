import SportsHeader from '@/components/SportsHeader'

export default function EPLPage() {
  return (
    <>
      <main className="w-full mx-auto p-4 min-h-[60vh] flex flex-col">
        <SportsHeader selectedSport="EPL" />

        <div className="flex-1 flex items-center justify-center">
          <div className="bg-gray-900 text-white rounded-2xl border border-blue-600/40 px-8 py-10 max-w-xl text-center shadow-lg">
            <h1 className="text-3xl font-bold mb-4">EPL is coming soon to Ares</h1>
            <p className="text-gray-300 text-sm mb-3">
              Premier League odds and prop analysis are in development.
            </p>
            <p className="text-gray-400 text-xs">
              Soon you&apos;ll see full-match edges, goal/assist props, and parlay analysis for EPL fixtures.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
