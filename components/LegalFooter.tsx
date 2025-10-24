'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

export default function LegalFooter() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <footer className="w-full border-t border-white/10 bg-black/50 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Collapsed View */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
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
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
          >
            Legal Info
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div>
              <h3 className="text-white font-semibold mb-2">Disclaimer</h3>
              <p className="text-gray-400 leading-relaxed">
                Ares provides sports analytics and betting insights for informational and entertainment purposes only. 
                We are not a gambling operator and do not accept wagers. All betting decisions are made at your own risk.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-2">Responsible Gaming</h3>
              <p className="text-gray-400 leading-relaxed mb-2">
                If you or someone you know has a gambling problem, help is available:
              </p>
              <ul className="text-gray-400 space-y-1">
                <li>• Call 1-800-GAMBLER</li>
                <li>• Visit <a href="https://www.ncpgambling.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">NCPG</a></li>
                <li>• Must be 21+ to use this service</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-2">Legal</h3>
              <ul className="text-gray-400 space-y-1">
                <li>
                  <Link href="/legal/terms" className="text-blue-400 hover:text-blue-300 underline">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/legal/privacy" className="text-blue-400 hover:text-blue-300 underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/legal/disclaimer" className="text-blue-400 hover:text-blue-300 underline">
                    Full Disclaimer
                  </Link>
                </li>
              </ul>
              <p className="text-gray-500 mt-3">
                © {new Date().getFullYear()} Ares. All rights reserved.
              </p>
            </div>
          </div>
        )}
      </div>
    </footer>
  )
}
