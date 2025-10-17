export const dynamic = 'force-dynamic'

if (typeof window !== 'undefined') {
  const originalError = console.error
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('Hydration') || args[0].includes('hydrated'))
    ) {
      return
    }
    originalError.apply(console, args)
  }
} 

import BuildPageContent from '@/components/BuildPageContent'

export default function BuildPage() {
  return <BuildPageContent />
}