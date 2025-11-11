# NBA Stats Production Solution

## Problem
NBA.com blocks requests from Vercel/cloud hosting IPs, causing 504 timeouts in production.

## Solutions (Pick One)

### Option 1: Use Railway.app (Recommended - Free Tier Available)
Railway allows you to deploy a separate microservice that fetches NBA stats.
- Deploy a simple Express server on Railway
- Railway IPs are not blocked by NBA.com
- Your Vercel app calls Railway endpoint instead of NBA.com directly
- Free tier: 500 hours/month

**Steps:**
1. Create a new repo with a simple Express server that proxies NBA.com
2. Deploy to Railway.app
3. Update `NBA_STATS_BASE` in your app to point to Railway URL

### Option 2: Use Cloudflare Workers (Free)
Cloudflare Workers use different IPs and are less likely to be blocked.
- Deploy NBA stats proxy as a Cloudflare Worker
- Free tier: 100k requests/day
- Very fast (edge network)

### Option 3: Use Render.com (Free Tier)
Similar to Railway, deploy a proxy service on Render.
- Free tier available
- Different IP ranges than Vercel

### Option 4: Self-Host on VPS (Most Reliable)
Deploy your entire app on a VPS (DigitalOcean, Linode, etc.)
- $5-10/month
- Full control
- Residential-like IP that NBA.com won't block
- Can use Docker for easy deployment

### Option 5: Use ScraperAPI or Similar Service ($$$)
Paid proxy service designed for web scraping
- Handles IP rotation
- ~$50/month for basic plan
- Most reliable but costs money

## Recommended: Railway + Vercel Hybrid

Keep your main app on Vercel, deploy NBA stats proxy on Railway:

```
User → Vercel (your app) → Railway (NBA proxy) → NBA.com
```

This way:
- Your app stays on Vercel (fast, free)
- NBA stats work (Railway IPs not blocked)
- Total cost: $0 (both free tiers)
