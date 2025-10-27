// lib/ocr-service.ts
// OCR service using Google Cloud Vision API

export interface OCRResult {
  text: string
  confidence: number
  blocks: TextBlock[]
}

export interface TextBlock {
  text: string
  boundingBox: { x: number; y: number; width: number; height: number }
  confidence: number
}

/**
 * Extract text from image using Google Cloud Vision API
 */
export async function extractTextFromImage(imageBase64: string, apiKey?: string): Promise<OCRResult> {
  const key = apiKey || process.env.GOOGLE_VISION_API_KEY
  
  if (!key) {
    console.error('Available env vars:', Object.keys(process.env))
    throw new Error('Google Vision API key not configured. Add GOOGLE_VISION_API_KEY to .env.local')
  }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [
                { type: 'TEXT_DETECTION', maxResults: 1 },
                { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
              ]
            }
          ]
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`)
    }

    const data = await response.json()
    const textAnnotations = data.responses[0]?.textAnnotations || []
    const fullTextAnnotation = data.responses[0]?.fullTextAnnotation

    if (textAnnotations.length === 0) {
      return { text: '', confidence: 0, blocks: [] }
    }

    // First annotation is the full text
    const fullText = textAnnotations[0]?.description || ''
    
    // Extract text blocks with bounding boxes
    const blocks: TextBlock[] = fullTextAnnotation?.pages?.[0]?.blocks?.map((block: any) => {
      const vertices = block.boundingBox?.vertices || []
      const text = block.paragraphs
        ?.map((p: any) => p.words?.map((w: any) => 
          w.symbols?.map((s: any) => s.text).join('')
        ).join(' '))
        .join('\n') || ''
      
      return {
        text,
        boundingBox: {
          x: vertices[0]?.x || 0,
          y: vertices[0]?.y || 0,
          width: (vertices[1]?.x || 0) - (vertices[0]?.x || 0),
          height: (vertices[2]?.y || 0) - (vertices[0]?.y || 0)
        },
        confidence: block.confidence || 0
      }
    }) || []

    return {
      text: fullText,
      confidence: textAnnotations[0]?.confidence || 0,
      blocks
    }
  } catch (error) {
    console.error('OCR extraction error:', error)
    throw error
  }
}

/**
 * Fallback: Simple preprocessing for better OCR results
 */
export function preprocessImage(imageBase64: string): string {
  // In a real implementation, you might want to:
  // - Increase contrast
  // - Remove noise
  // - Deskew the image
  // For now, just return as-is
  return imageBase64
}
