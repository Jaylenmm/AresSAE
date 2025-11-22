import SportsHeader from '@/components/SportsHeader'

export default function NHLPage() {
  return (
    <>
      <main className="w-full mx-auto p-4 min-h-[60vh] flex flex-col">
        <SportsHeader selectedSport="NHL" />

        <div className="flex-1 flex items-center justify-center">
          <div className="bg-gray-900 text-white rounded-2xl border border-blue-600/40 px-8 py-10 max-w-xl text-center shadow-lg">
            <h1 className="text-3xl font-bold mb-4">NHL is coming soon to Ares</h1>
            <p className="text-gray-300 text-sm mb-3">
              We&apos;re putting the finishing touches on NHL odds, props, and stat-powered analysis.
            </p>
            <p className="text-gray-400 text-xs">
              Check back soon for full NHL coverage, including game edges, player props, and live slip analysis.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
