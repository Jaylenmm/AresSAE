import { PIPELINE_CONFIG } from '@/lib/pipeline/config'
import { createInstrumentation } from '@/lib/pipeline/instrumentation'
import { runMLB } from '@/lib/pipeline/sport-pipelines/mlb'

export async function runOrchestrator(origin: string): Promise<any> {
  const instr = createInstrumentation()
  const results = instr.snapshot()

  for (const sport of PIPELINE_CONFIG.sports) {
    const started = Date.now()
    try {
      instr.stepStart(sport, 'collect')
      let details: any = {}
      if (sport === 'MLB') {
        // Run via internal pipeline
        details = await runMLB()
      } else {
        // Temporary: delegate to existing route until pipelines implemented
        const resp = await fetch(`${origin}/api/collect-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sport })
        })
        const data = await resp.json().catch(() => ({}))
        details = data?.details || data || {}
      }
      instr.stepEnd(sport, 'collect', details)
      ;(results as any)[`${sport}_elapsed_ms`] = Date.now() - started
    } catch (e: any) {
      ;(results as any)[`${sport}_elapsed_ms`] = Date.now() - started
      instr.appendError(sport, e?.message || String(e))
    }
  }

  return results
}
