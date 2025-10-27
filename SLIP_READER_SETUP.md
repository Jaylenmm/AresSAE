# Slip Reader Feature - Setup Guide

## Overview
The Slip Reader feature allows users to upload screenshots of their bet slips and receive instant analysis. It uses OCR to extract bet details, matches them against your database, and runs your existing analysis engine.

## What Was Built

### 1. Files Created
- `/app/slip-reader/page.tsx` - Main page with password protection and upload UI
- `/app/api/analyze-slip/route.ts` - API endpoint for processing slips
- `/lib/ocr-service.ts` - Google Vision API integration
- `/lib/bet-parser.ts` - Parse OCR text into structured bets
- `/lib/bet-matcher.ts` - Match parsed bets to database using fuzzy matching

### 2. Files Modified
- `/components/BottomNav.tsx` - Added "Slip" nav item with Camera icon

### 3. Dependencies Added
- `fastest-levenshtein` - For fuzzy string matching

## Environment Variables Needed

Add to your `.env.local`:

```env
# Slip Reader password (already set)
NEXT_PUBLIC_SLIP_READER_PASSWORD=ares2024

# Google Cloud Vision API (REQUIRED)
GOOGLE_VISION_API_KEY=your_api_key_here
```

## Google Vision API Setup

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable "Cloud Vision API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key to `.env.local`

**Cost:** ~$1.50 per 1000 images (first 1000/month free)

## How It Works

### User Flow:
1. User navigates to "Slip" in bottom nav
2. Enters admin password (ares2024)
3. Takes photo or uploads image of bet slip
4. Clicks "Analyze Slip"
5. System:
   - Extracts text using Google Vision OCR
   - Parses bet details (teams, players, lines, odds)
   - Matches to database using fuzzy matching
   - Runs analysis on each bet
   - Detects if parlay (multiple bets) or straight bet
6. Shows results with analysis for each bet

### Technical Flow:
```
Image → OCR → Parse → Match → Analyze → Display
```

## Features

✅ **Password Protected** - Admin only until ready for production
✅ **Mobile Camera Support** - Direct camera capture on mobile
✅ **File Upload** - Upload from gallery/files
✅ **OCR Extraction** - Google Vision API
✅ **Bet Parsing** - Extracts teams, players, lines, odds, bet types
✅ **Fuzzy Matching** - Matches to database even with typos
✅ **Analysis Integration** - Uses your existing analysis engine
✅ **Parlay Detection** - Automatically detects single vs multiple bets
✅ **Confidence Scoring** - Shows match confidence for each bet
✅ **Mobile Responsive** - Works on all screen sizes

## Supported Bet Types

- ✅ Spreads
- ✅ Moneylines
- ✅ Totals (Over/Under)
- ✅ Player Props
- ✅ Parlays (multiple bets)

## Supported Sportsbooks (Auto-detected)

- FanDuel
- DraftKings
- BetMGM
- Caesars
- ESPN BET
- Pinnacle
- BetOnline
- Bovada
- MyBookie
- Bet365

## Testing Checklist

### Desktop Testing:
- [ ] Navigate to /slip-reader
- [ ] Enter password
- [ ] Upload bet slip image
- [ ] Verify OCR extraction
- [ ] Check bet matching
- [ ] Verify analysis results

### Mobile Testing:
- [ ] Open on mobile device
- [ ] Test camera capture
- [ ] Test file upload
- [ ] Verify responsive layout
- [ ] Check results display

### Edge Cases:
- [ ] Blurry image
- [ ] Multiple bets (parlay)
- [ ] Unknown sportsbook
- [ ] Player/team not in database
- [ ] Invalid image format

## Known Limitations

1. **OCR Accuracy** - Depends on image quality
2. **Sportsbook Formats** - Different layouts may parse differently
3. **Match Confidence** - Low confidence (<50%) won't analyze
4. **API Costs** - Google Vision charges per image
5. **Parlay Analysis** - Currently analyzes each leg separately (not combined odds)

## Future Enhancements

- [ ] Tesseract.js fallback (free OCR)
- [ ] Sportsbook logo detection
- [ ] Save analyzed slips to user history
- [ ] Batch processing (multiple slips)
- [ ] Combined parlay odds calculation
- [ ] Manual bet correction UI
- [ ] Training data for better parsing

## Troubleshooting

### "No text found in image"
- Image quality too low
- Try better lighting or clearer screenshot

### "No bets found in image"
- Bet slip format not recognized
- Try different sportsbook or clearer image

### "Low confidence match"
- Team/player name not matching database
- Check for typos or abbreviations

### "Failed to analyze bet"
- No odds data in database for this game
- Game may be too old or not yet added

## Production Deployment

Before removing password protection:

1. ✅ Test thoroughly on mobile
2. ✅ Verify Google Vision API is working
3. ✅ Check cost estimates for expected usage
4. ✅ Test with various sportsbook formats
5. ✅ Ensure error handling is robust
6. Remove password check in `/app/slip-reader/page.tsx`

## Support

For issues or questions:
- Check console logs for detailed errors
- Verify Google Vision API key is set
- Ensure database has recent odds data
- Test with clear, well-lit images
