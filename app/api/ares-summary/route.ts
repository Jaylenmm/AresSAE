import { NextResponse } from 'next/server'
import { generateAresSummary } from '@/lib/ares-summary'
import type { AnalysisResult } from '@/lib/analysis-engine'

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || !body.analysis || !body.context) {
      return NextResponse.json({ error: 'Missing analysis or context' }, { status: 400 })
    }

    const analysis = body.analysis as AnalysisResult
    const context = body.context as { description: string; sport?: string }

    const summary = await generateAresSummary(analysis, context)

    return NextResponse.json({ summary }, { status: 200 })
  } catch (err: any) {
    console.error('Error in /api/ares-summary:', err)
    return NextResponse.json({ error: 'Internal error generating summary' }, { status: 500 })
  }
}
