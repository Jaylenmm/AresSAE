// ===== FIXED: lib/cache-managerTEST.ts =====

import { supabase } from './supabase'

export interface CacheEntry {
  cache_key: string
  data: any
  expires_at: string
  created_at: string
}

/**
 * Cache historical data in Supabase
 */
export async function cacheHistoricalData(
  key: string,
  data: any,
  expiresInDays: number = 7
): Promise<void> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    
    const { error } = await supabase.from('historical_cache').upsert({
      cache_key: key,
      data: JSON.stringify(data),
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    }, {
      onConflict: 'cache_key'
    })
    
    if (error) {
      console.error('Error caching data:', error.message)
    } else {
      console.log(`Cached: ${key}`)
    }
  } catch (error: any) {
    console.error('Cache write failed:', error.message)
  }
}

/**
 * Retrieve data from cache
 */
export async function getFromCache(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('historical_cache')
      .select('data, expires_at, created_at')
      .eq('cache_key', key)
      .maybeSingle()
    
    if (error) {
      console.error('Cache read error:', error.message)
      return null
    }
    
    if (!data) {
      console.log(`Cache miss: ${key}`)
      return null
    }
    
    if (new Date(data.expires_at) < new Date()) {
      console.log(`Cache expired: ${key}`)
      await supabase.from('historical_cache').delete().eq('cache_key', key)
      return null
    }
    
    console.log(`Cache hit: ${key}`)
    return JSON.parse(data.data)
  } catch (error: any) {
    console.error('Cache read failed:', error.message)
    return null
  }
}

/**
 * Delete specific cache entry
 */
export async function deleteFromCache(key: string): Promise<void> {
  try {
    await supabase.from('historical_cache').delete().eq('cache_key', key)
    console.log(`Deleted cache: ${key}`)
  } catch (error: any) {
    console.error('Cache delete failed:', error.message)
  }
}

/**
 * Clear all expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('historical_cache')
      .delete()
      .lt('expires_at', now)
      .select()
    
    if (error) {
      console.error('Error clearing expired cache:', error.message)
      return 0
    }
    
    const count = data?.length || 0
    console.log(`Cleared ${count} expired cache entries`)
    return count
  } catch (error: any) {
    console.error('Cache cleanup failed:', error.message)
    return 0
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number
  expiredEntries: number
  validEntries: number
}> {
  try {
    const { data: all, error } = await supabase
      .from('historical_cache')
      .select('expires_at')
    
    if (error) {
      console.error('Error getting cache stats:', error.message)
      return { totalEntries: 0, expiredEntries: 0, validEntries: 0 }
    }
    
    if (!all) {
      return { totalEntries: 0, expiredEntries: 0, validEntries: 0 }
    }
    
    const now = new Date()
    const expired = all.filter(entry => new Date(entry.expires_at) < now).length
    
    return {
      totalEntries: all.length,
      expiredEntries: expired,
      validEntries: all.length - expired
    }
  } catch (error: any) {
    console.error('Error getting cache stats:', error.message)
    return { totalEntries: 0, expiredEntries: 0, validEntries: 0 }
  }
}

/**
 * Generate cache key for player props
 */
export function generatePlayerPropCacheKey(
  playerName: string,
  propType: string,
  season: number,
  timeframe: 'season' | 'recent' = 'season'
): string {
  const sanitizedName = playerName.toLowerCase().replace(/\s+/g, '_')
  return `hist_${sanitizedName}_${propType}_${season}_${timeframe}`
}

/**
 * Generate cache key for historical odds
 */
export function generateHistoricalOddsCacheKey(
  sport: string,
  dateRange: string,
  market: string
): string {
  return `hist_odds_${sport}_${dateRange}_${market}`
}

/**
 * Batch cache multiple entries
 */
export async function batchCacheData(
  entries: Array<{ key: string; data: any; expiresInDays?: number }>
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  
  for (const entry of entries) {
    try {
      await cacheHistoricalData(entry.key, entry.data, entry.expiresInDays || 7)
      success++
    } catch (error) {
      console.error(`Failed to cache ${entry.key}:`, error)
      failed++
    }
  }
  
  console.log(`Batch cache complete: ${success} succeeded, ${failed} failed`)
  return { success, failed }
}