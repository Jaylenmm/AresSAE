import BuildPageContentTEST from '@/components/BuildPageContentTEST'

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

export default function BuildTestPage() {
  return <BuildPageContentTEST />
}