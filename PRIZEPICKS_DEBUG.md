# PrizePicks Debugging Guide

## What I Just Fixed:

### 1. **Enhanced PrizePicks Parser**
- Now looks for "More" and "Less" as standalone lines
- Searches backwards 5 lines for player name and stats
- Better logging to see what's being detected
- Handles arrow symbols (↑ More, ↓ Less)

### 2. **Better Sportsbook Detection**
- Detects "Power Play" as PrizePicks indicator
- Detects combination of "More", "Less", and "Pick"
- More aggressive PrizePicks detection

### 3. **Error Messages Show OCR Text**
- When parsing fails, error now shows extracted text
- Helps debug what OCR actually saw

## How to Debug Your PrizePicks Slip:

### Step 1: Upload the slip
- You should now see the extracted text in the error message

### Step 2: Check Vercel Logs
Go to Vercel → Your Project → Deployments → Latest → Functions → analyze-slip

Look for these console logs:
```
Parsing PrizePicks format, total lines: X
First 20 lines: [...]
Found over/under at line X: ...
Found stat at line X: ... → 21.5 points
Found player at line X: Zach LaVine
✅ Creating bet: { playerName, lineValue, selection, propType }
```

### Step 3: What the Parser Expects

From your image, the structure should be:
```
Zach LaVine          ← Player name (capitalized)
SAC • G • #8         ← Team/position (ignored)
21.5 Points          ← Line + Stat type
↓ Less  ↑ More       ← Selection buttons
```

The parser looks for:
1. "More" or "Less" (with or without arrows)
2. Goes backwards to find "21.5 Points"
3. Goes backwards to find "Zach LaVine"

### Step 4: Common Issues

**Issue: Player name not detected**
- OCR might see it as multiple lines
- Name might have special characters
- Try: Check if "Zach" and "LaVine" are on separate lines

**Issue: Stat not detected**
- OCR might see "21.5" and "Points" separately
- Might be "Pts" instead of "Points"
- Might be "PT Ast" (PT Assists) format

**Issue: More/Less not detected**
- Might include arrow symbols
- Might be in different language/encoding
- Check actual OCR text

## What to Send Me:

When you upload the slip and get an error, send me:

1. **The error message** (now includes OCR text)
2. **Vercel console logs** (from Functions tab)
3. **Screenshot** (you already sent this)

With these 3 things, I can see exactly what's going wrong and fix the parser!

## Expected OCR Output for Your Image:

Based on your screenshot, OCR should extract something like:
```
PRIZEPICKS
4-pick Power Play
NBA OKC vs SAC
Zach LaVine
SAC • G • #8
21.5 Points
↓ Less
↑ More
NBA MIL vs NYK
Bobby Portis
MIL • F • #9
6.2 PT Ast
↓ Less
↑ More
Giannis Antetokounmpo
MIL • F • #34
24.5 Points
↑ More
Jalen Brunson
NYK • G • #11
27.5 Points
↓ Less
↑ More
```

If the OCR text looks very different from this, that's the problem!

## Quick Test:

After pushing these changes:
1. Upload your PrizePicks slip
2. Copy the error message (includes OCR text)
3. Send it to me
4. I'll adjust the parser based on actual OCR output

The improved logging will show exactly where the parser is failing!
