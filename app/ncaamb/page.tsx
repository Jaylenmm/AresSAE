import SportsHeader from '@/components/SportsHeader'

export default function NCAAMBPage() {
  return (
    <>
      <main className="w-full mx-auto p-4 min-h-[60vh] flex flex-col">
        <SportsHeader selectedSport="NCAAMB" />

        <div className="flex-1 flex items-center justify-center">
          <div className="bg-gray-900 text-white rounded-2xl border border-blue-600/40 px-8 py-10 max-w-xl text-center shadow-lg">
            <h1 className="text-3xl font-bold mb-4">NCAAMB is coming soon to Ares</h1>
            <p className="text-gray-300 text-sm mb-3">
              College hoops support is on the way with game lines, player props, and advanced edges.
            </p>
            <p className="text-gray-400 text-xs">
              You&apos;ll be able to build cards, analyze alt lines, and track performance for NCAAMB soon.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
