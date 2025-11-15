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