'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Hammer, ClipboardList, User } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/build', icon: Hammer, label: 'Build' },
    { href: '/picks', icon: ClipboardList, label: 'Picks' },
    { href: '/account', icon: User, label: 'Account' }
  ]

  return (
  <nav className="fixed bottom-0 left-0 right-0 bg-[var(--vs-surface)] border-t border-[var(--vs-border)] px-4 py-2 safe-area-bottom z-50">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive 
                  ? 'text-[var(--vs-accent)]' 
                  : 'text-[var(--vs-muted)] hover:text-[var(--vs-text)]'
              }`}
            >
              <Icon size={24} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
              <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-normal'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}