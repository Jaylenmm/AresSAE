import { NextResponse } from 'next/server'
import { generateFeaturedPicks } from '@/lib/generateFeaturedPicks'

export async function POST() {
  try {
    console.log('🎯 Manual featured picks generation triggered...')
    
    const result = await generateFeaturedPicks()
    
    return NextResponse.json({
      success: result.success,
      picksGenerated: result.picksGenerated,
      error: result.error,
      message: result.success 
        ? `Successfully generated ${result.picksGenerated} featured picks!`
        : `Failed to generate picks: ${result.error}`
    })
    
  } catch (error) {
    console.error('Error in generate-featured-picks API:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}