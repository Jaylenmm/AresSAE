type AnyRecord = Record<string, any>

export type Instrumentation = {
  stepStart: (sport: string, step: string) => void
  stepEnd: (sport: string, step: string, data?: AnyRecord) => void
  appendError: (sport: string, message: string) => void
  snapshot: () => AnyRecord
}

export function createInstrumentation(): Instrumentation {
  const results: AnyRecord = { errors: [] as string[] }
  const stepTimes: Record<string, Record<string, number>> = {}
  return {
    stepStart(sport, step) {
      stepTimes[sport] = stepTimes[sport] || {}
      stepTimes[sport][step] = Date.now()
    },
    stepEnd(sport, step, data) {
      const start = stepTimes[sport]?.[step]
      const elapsed = start ? Date.now() - start : undefined
      results[sport] = results[sport] || {}
      if (elapsed !== undefined) results[`${sport}_${step}_ms`] = elapsed
      if (data) Object.assign(results[sport], data)
    },
    appendError(sport, message) {
      results.errors.push(`${sport}: ${message}`)
      results[sport] = results[sport] || {}
      results[sport].error = message
    },
    snapshot() {
      return results
    }
  }
}
