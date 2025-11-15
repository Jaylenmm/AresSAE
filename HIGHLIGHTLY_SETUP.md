# Highlightly API Setup

## Overview
Highlightly provides player stats and live scores for NFL, NBA, MLB, NHL, NCAAF, and NCAAB.

**Free Tier:** 100 requests/day

## Setup

1. **Get API Key**
   - Go to https://rapidapi.com/highlightly-api-highlightly-api-default/api/sport-highlights-api
   - Sign up for free tier
   - Copy your RapidAPI key

2. **Add to Environment**
   ```bash
   # Add to .env.local
   HIGHLIGHTLY_API_KEY=your_rapidapi_key_here
   ```

3. **Test Locally**
   ```bash
   npx tsx test-highlightly.ts
   ```

## How It Works

- **Primary:** Tries Highlightly API first (100 req/day free)
- **Fallback:** Falls back to NBA.com if Highlightly unavailable or rate limited
- **Logging:** All requests clearly marked with `[HIGHLIGHTLY]` prefix

## Supported Sports

- ✅ NFL (American Football)
- ✅ NBA (Basketball)
- ✅ MLB (Baseball)
- ✅ NHL (Hockey)
- ✅ NCAAF (College Football)
- ✅ NCAAB (College Basketball)

## Rate Limiting

Free tier = 100 requests/day. When limit is hit:
- Returns `null`
- Logs: `⚠️ [HIGHLIGHTLY] Rate limit exceeded - falling back`
- Automatically uses NBA.com for NBA stats
- Other sports will show "stats unavailable"

## Production Deployment

Add `HIGHLIGHTLY_API_KEY` to Vercel environment variables:
```bash
vercel env add HIGHLIGHTLY_API_KEY
```

## Monitoring

Watch for these log messages:
- `✅ [HIGHLIGHTLY] Got X games for PlayerName` - Success
- `⚠️ [HIGHLIGHTLY] Rate limit exceeded` - Hit daily limit
- `❌ [HIGHLIGHTLY] Player not found` - Player doesn't exist
- `⚠️ Highlightly unavailable, falling back to NBA.com` - Using fallback
