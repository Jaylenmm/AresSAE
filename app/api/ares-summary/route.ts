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

    console.log('[ARES SUMMARY API] Request received')

    const analysis = body.analysis as AnalysisResult
    const context = body.context as { description: string; sport?: string }

    const hasKey = !!process.env.ANTHROPIC_API_KEY
    const summary = await generateAresSummary(analysis, context)

    if (!summary) {
      console.warn('[ARES SUMMARY API] No summary generated (missing key or Anthropic error)')
    } else {
      console.log('[ARES SUMMARY API] Summary generated')
    }

    return NextResponse.json({ summary, hasKey }, { status: 200 })
  } catch (err: any) {
    console.error('Error in /api/ares-summary:', err)
    return NextResponse.json({ error: 'Internal error generating summary' }, { status: 500 })
  }
}
