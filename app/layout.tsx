import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '../public/vscode-dark.css'
import BottomNav from '@/components/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ares - Smart Sports Betting Analysis',
  description: 'AI-powered sports betting analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="pb-20 min-h-screen">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}