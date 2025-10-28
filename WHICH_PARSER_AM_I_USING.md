# Which Parser Am I Using?

## Quick Check:

### **In the UI:**
After analyzing a slip, look for the badge under the results header:

- **✨ GPT-4 Vision** (purple badge) = Using OpenAI GPT-4 Vision (most accurate)
- **🎯 PrizePicks Parser** (blue badge) = Using custom PrizePicks parser
- **🐶 Underdog Parser** (blue badge) = Using custom Underdog parser
- **📱 FanDuel Parser** (blue badge) = Using custom FanDuel parser
- **📊 generic-parser** (blue badge) = Using fallback generic parser

If you see a blue badge, you'll also see:
> (Add OPENAI_API_KEY for GPT-4 Vision)

### **In Vercel Logs:**
Go to: Vercel → Your Project → Deployments → Latest → Functions → analyze-slip

Look for this at the start:
```
🔍 Parsing Configuration:
  - OpenAI API Key: ✅ Available (will use GPT-4 Vision)
  - Google Vision API Key: ✅ Available (fallback)
```

Or:
```
🔍 Parsing Configuration:
  - OpenAI API Key: ❌ Not set
  - Google Vision API Key: ✅ Available (fallback)
```

Then you'll see one of:
```
🚀 Attempting GPT-4 Vision parsing...
✅ GPT-4 Vision found 4 bets
```

Or:
```
⚠️ Skipping GPT-4 Vision (no OpenAI API key)
📸 Using Google Vision OCR + custom parsers...
```

## Current Setup:

### **Without OPENAI_API_KEY:**
```
Image Upload
    ↓
Google Vision OCR (extracts text)
    ↓
Detect Sportsbook
    ↓
Use Specific Parser:
  - PrizePicks → prizepicks-parser
  - Underdog → underdog-parser
  - FanDuel → fanduel-parser
  - Other → generic-parser
    ↓
Match to Database
    ↓
Analyze Bets
```

**Accuracy:** 60-80% depending on image quality

### **With OPENAI_API_KEY:**
```
Image Upload
    ↓
GPT-4 Vision (directly parses image)
    ↓
Match to Database
    ↓
Analyze Bets
```

**Accuracy:** 90-95% across all sportsbooks

## How to Add GPT-4 Vision:

### **Step 1: Get OpenAI API Key**
1. Go to https://platform.openai.com/api-keys
2. Sign up/login
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### **Step 2: Add to Vercel**
1. Go to Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add new variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-...your_key`
   - **Environment:** All (Production, Preview, Development)
5. Click Save
6. Redeploy your app

### **Step 3: Verify**
1. Upload a slip
2. Check the badge - should say "✨ GPT-4 Vision"
3. Check Vercel logs - should say "✅ Available (will use GPT-4 Vision)"

## Cost Comparison:

### **Google Vision Only (Current):**
- **Free tier:** 1,000 images/month
- **After free:** $1.50 per 1,000 images
- **Accuracy:** 60-80%

### **GPT-4 Vision (Recommended):**
- **Cost:** ~$0.01 per image
- **Example:** 100 slips = $1.00
- **Accuracy:** 90-95%

### **Recommendation:**
Start with GPT-4 Vision. The improved accuracy is worth the small cost:
- **100 slips/month:** $1.00
- **500 slips/month:** $5.00
- **1000 slips/month:** $10.00

Much cheaper than manual analysis!

## Troubleshooting:

### **Badge shows blue (not purple):**
- OpenAI API key not set in Vercel
- Or key is invalid
- Check Vercel logs for confirmation

### **Logs say "❌ Not set":**
- Add OPENAI_API_KEY to Vercel environment variables
- Make sure to redeploy after adding

### **Logs say "❌ GPT-4 Vision failed":**
- Check OpenAI account has credits
- Check billing is set up
- Will automatically fall back to Google Vision

### **Want to force Google Vision (testing):**
- Remove OPENAI_API_KEY from Vercel
- Or temporarily rename it to `OPENAI_API_KEY_DISABLED`

## Summary:

**Right now (no OPENAI_API_KEY):**
- Using Google Vision OCR
- Using custom sportsbook parsers
- 60-80% accuracy
- Free (within limits)

**With OPENAI_API_KEY:**
- Using GPT-4 Vision
- No custom parsers needed
- 90-95% accuracy
- ~$0.01 per slip

**Check the badge in the UI or logs in Vercel to confirm which you're using!**
