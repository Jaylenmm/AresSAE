'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-800 bg-black/50 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="text-center text-xs text-gray-400 space-y-1">
          <p>
            Ares is a sports analytics platform. Not a gambling service. 21+.
          </p>
          <p>
            <Link
              href="/legal/disclaimer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Full Disclaimer
            </Link>
            {' | '}
            <Link
              href="/legal/terms"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Terms of Service
            </Link>
            {' | '}
            <Link
              href="/legal/privacy"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Privacy Policy
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
      </div>
    </footer>
  )
}
