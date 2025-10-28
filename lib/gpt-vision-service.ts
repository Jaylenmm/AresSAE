// lib/gpt-vision-service.ts
// GPT-4 Vision for intelligent bet slip parsing

export interface GPTVisionResult {
  bets: Array<{
    player?: string
    team1?: string
    team2?: string
    propType?: string
    line?: number
    selection: string // 'over', 'under', 'home', 'away', 'more', 'less'
    odds?: number
    betType: 'player_prop' | 'spread' | 'moneyline' | 'total'
    sportsbook?: string
    confidence: number
  }>
  sportsbook?: string
  totalBets: number
}

/**
 * Use GPT-4 Vision to intelligently parse bet slip
 */
export async function parseWithGPTVision(imageBase64: string): Promise<GPTVisionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY to .env.local')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // GPT-4 with vision (cheaper than gpt-4-vision-preview)
        messages: [
          {
            role: 'system',
            content: `You are an expert at reading sports betting slips. Extract ALL bets from the image and return them in a structured JSON format.

For each bet, identify:
- Player name (for props) or team names (for game bets)
- Bet type (player_prop, spread, moneyline, total)
- Prop type (player_points, player_pass_yds, player_rush_yds, player_reception_yds, player_assists, player_rebounds, player_threes)
- Line value (the number)
- Selection (over/under for totals/props, more/less for DFS, home/away for spreads/ML)
- Odds (if visible, otherwise use -110)
- Sportsbook name

Return ONLY valid JSON in this exact format:
{
  "sportsbook": "string",
  "totalBets": number,
  "bets": [
    {
      "betType": "player_prop" | "spread" | "moneyline" | "total",
      "player": "string (if prop)",
      "team1": "string (if game bet)",
      "team2": "string (if game bet)",
      "propType": "string (if prop)",
      "line": number,
      "selection": "over" | "under" | "more" | "less" | "home" | "away",
      "odds": number,
      "sportsbook": "string",
      "confidence": 0.0-1.0
    }
  ]
}

IMPORTANT:
- For PrizePicks/Underdog/DFS: "More" = over, "Less" = under
- If odds not visible, use -110
- Include ALL bets visible in the image
- Set confidence based on text clarity (0.0-1.0)`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all bets from this betting slip image. Return ONLY the JSON, no other text.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1 // Low temperature for consistent parsing
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('GPT Vision API error:', error)
      throw new Error(`GPT Vision API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in GPT response')
    }

    // Parse JSON from response
    // GPT might wrap it in markdown code blocks, so clean it
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '')
    }

    const result = JSON.parse(jsonStr)
    
    console.log('GPT Vision parsed:', result)
    
    return result

  } catch (error: any) {
    console.error('GPT Vision parsing error:', error)
    throw new Error(`Failed to parse with GPT Vision: ${error.message}`)
  }
}

/**
 * Hybrid approach: Use Google Vision for OCR, then GPT-4 to parse
 */
export async function parseWithGPTFromText(ocrText: string): Promise<GPTVisionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheaper model for text-only
        messages: [
          {
            role: 'system',
            content: `You are an expert at parsing sports betting slip text. Extract ALL bets and return structured JSON.

Return ONLY valid JSON in this exact format:
{
  "sportsbook": "string",
  "totalBets": number,
  "bets": [
    {
      "betType": "player_prop" | "spread" | "moneyline" | "total",
      "player": "string (if prop)",
      "team1": "string (if game bet)",
      "team2": "string (if game bet)",
      "propType": "string (if prop)",
      "line": number,
      "selection": "over" | "under" | "more" | "less" | "home" | "away",
      "odds": number,
      "sportsbook": "string",
      "confidence": 0.0-1.0
    }
  ]
}

For PrizePicks/DFS: "More" = over, "Less" = under. If no odds, use -110.`
          },
          {
            role: 'user',
            content: `Parse this betting slip text:\n\n${ocrText}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`GPT API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in GPT response')
    }

    let jsonStr = content.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '')
    }

    return JSON.parse(jsonStr)

  } catch (error: any) {
    console.error('GPT text parsing error:', error)
    throw new Error(`Failed to parse with GPT: ${error.message}`)
  }
}
