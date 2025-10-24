'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-800 bg-black/50 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-center text-xs text-gray-400">
          Ares is a sports analytics platform. Not a gambling service. 21+.{' '}
          <Link 
            href="/legal/disclaimer" 
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Full Disclaimer
          </Link>
          {' | '}
          <a 
            href="https://www.ncpgambling.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Problem Gambling Help
          </a>
        </p>
      </div>
    </footer>
  )
}
