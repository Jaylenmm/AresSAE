// lib/ares-summary.ts
// Generate natural-language summaries for Ares analysis using Claude (Anthropic).

import type { AnalysisResult } from './analysis-engine'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL_NAME = 'claude-3-5-sonnet-20240620'

interface SummaryContext {
  description: string
  sport?: string
}

export async function generateAresSummary(
  analysis: AnalysisResult,
  context: SummaryContext
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not configured; skipping Ares summary generation.')
    return null
  }

  try {
    const { edge, expectedValue, confidence, recommendation, trueProbability } = analysis

    const prompt = `You are Ares, a sharp sports betting assistant. Write a concise 1-3 sentence summary explaining this bet evaluation in plain language.

Bet description: ${context.description}
Sport (if known): ${context.sport || 'Unknown'}
Edge: ${edge}%
Expected value per $1: ${expectedValue / 100}
Model win probability: ${trueProbability !== null ? (trueProbability * 100).toFixed(1) + '%' : 'unknown'}
Confidence score: ${confidence}%
Recommendation: ${recommendation}

Guidelines:
- Speak as Ares ("we" / "Ares") but DO NOT mention AI or language models.
- If there is strong edge, emphasize why it looks like a good price.
- If edge is small or negative, explain that it may not be worth betting or suggest a better angle/market if appropriate.
- Be direct and practical for a bettor; no fluff.
- Output just the summary text, no bullets, no labels.`

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        max_tokens: 180,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('Anthropic API error:', response.status, errorText)
      return null
    }

    const data: any = await response.json()
    const content = data?.content?.[0]?.text ?? ''
    const summary = typeof content === 'string' ? content.trim() : ''
    return summary || null
  } catch (err) {
    console.error('Error generating Ares summary via Anthropic:', err)
    return null
  }
}
