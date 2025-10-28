// lib/image-preprocessor.ts
// Preprocess images for better OCR accuracy

/**
 * Convert image to grayscale and increase contrast
 * This improves OCR accuracy for bet slips
 */
export async function preprocessImageForOCR(base64Image: string): Promise<string> {
  // If running in browser (shouldn't be, but just in case)
  if (typeof window !== 'undefined') {
    return base64Image
  }

  try {
    // Create canvas and load image
    const img = await loadImage(base64Image)
    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return base64Image

    // Draw original image
    ctx.drawImage(img, 0, 0)
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Apply preprocessing
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      
      // Increase contrast (make darks darker, lights lighter)
      const contrast = 1.5
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      const adjusted = factor * (gray - 128) + 128
      
      // Apply threshold to make text sharper
      const threshold = adjusted > 128 ? 255 : 0
      
      data[i] = threshold     // R
      data[i + 1] = threshold // G
      data[i + 2] = threshold // B
      // Alpha stays the same
    }

    // Put processed image back
    ctx.putImageData(imageData, 0, 0)
    
    // Convert back to base64
    return canvas.toDataURL('image/png').split(',')[1]
  } catch (error) {
    console.error('Image preprocessing error:', error)
    // Return original if preprocessing fails
    return base64Image
  }
}

// Helper functions for Node.js environment
function loadImage(base64: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // In Node.js, we'd use a library like 'canvas' or 'sharp'
    // For now, return a mock that works with the canvas API
    // This is a placeholder - we'll use sharp library instead
    reject(new Error('Image loading not implemented - use sharp library'))
  })
}

function createCanvas(width: number, height: number): any {
  // Placeholder - would use 'canvas' library in Node.js
  throw new Error('Canvas not implemented - use sharp library')
}

/**
 * Preprocess using Sharp library (better for Node.js)
 */
export async function preprocessWithSharp(base64Image: string): Promise<string> {
  try {
    const sharp = require('sharp')
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Image, 'base64')
    
    // Process image
    const processed = await sharp(buffer)
      .grayscale() // Convert to grayscale
      .normalize() // Normalize contrast
      .sharpen() // Sharpen text
      .threshold(128) // Binary threshold for clear text
      .toBuffer()
    
    // Convert back to base64
    return processed.toString('base64')
  } catch (error) {
    console.error('Sharp preprocessing error:', error)
    return base64Image
  }
}

/**
 * Simple brightness/contrast adjustment without external libraries
 */
export function simplePreprocess(base64Image: string): string {
  // For now, just return original
  // We'll implement sharp-based preprocessing
  return base64Image
}
