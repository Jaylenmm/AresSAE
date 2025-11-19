import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '../public/vscode-dark.css'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import AnalysisStatusBar from '@/components/AnalysisStatusBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ares - Smart Analytics Engine',
  description: 'Powerful sports analytics engine',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <div className="w-full bg-amber-500/10 border-b border-amber-400/40 text-amber-100 text-xs sm:text-sm py-2 px-3 text-center">
            We are currently updating the Ares app. If there is an issue you are seeing, please hang tight as this could be due to current work being done on the app. Thanks for using Ares today!
          </div>
          <div className="flex-1 pb-20">
            {children}
          </div>
          <Footer />
        </div>
        <AnalysisStatusBar />
        <BottomNav />
      </body>
    </html>
  )
}