# Underdog Format Fix

## What Was Wrong:

Your Underdog slip showed:
```
Tyrese Maxey
Higher 28.5 Points

VJ Edgecombe
Lower 19.5 Points
```

The parser was looking for "Higher" and "Lower" as **standalone lines**, but Underdog puts them on the **same line** as the stat:
- `Higher 28.5 Points` (all one line)
- `Lower 19.5 Points` (all one line)

## What I Fixed:

### 1. **Combined Pattern Detection**
Added logging to see when combined patterns are found:
```typescript
// Now detects: "Higher 28.5 Points"
const pattern1 = lowerLine.match(/(higher|lower|more|less|over|under)\s+(\d+\.?\d*)\s*(points?|pts)/i)
```

### 2. **Improved Player Name Matching**
- Now searches 5 lines back (was 3)
- Handles apostrophes in names (e.g., "D'Angelo")
- More flexible pattern matching

### 3. **Matchup Extraction for "@" Format**
Underdog uses `@` instead of `vs`:
```
76ers @ Wizards  → { team1: "PHI", team2: "WAS" }
Bucks vs Knicks  → { team1: "MIL", team2: "NYK" }
```

Now handles both formats!

### 4. **Team Name Mapping**
Added function to map partial team names to abbreviations:
```
"76ers" → "PHI"
"Wizards" → "WAS"
"Bucks" → "MIL"
"Knicks" → "NYK"
```

## Expected Output for Your Slip:

### Bet 1: Tyrese Maxey
```javascript
{
  player: "Tyrese Maxey",
  team1: "Philadelphia 76ers",
  team2: "Washington Wizards",
  line: 28.5,
  propType: "player_points",
  selection: "over",  // Higher → over
  sportsbook: "underdog"
}
```

### Bet 2: VJ Edgecombe
```javascript
{
  player: "VJ Edgecombe",
  line: 19.5,
  propType: "player_points",
  selection: "under",  // Lower → under
  sportsbook: "underdog"
}
```

### Bet 3: Giannis Antetokounmpo
```javascript
{
  player: "Giannis Antetokounmpo",
  team1: "Milwaukee Bucks",
  team2: "New York Knicks",
  line: 31.5,
  propType: "player_points",
  selection: "over",  // Higher → over
  sportsbook: "underdog"
}
```

### Bet 4: Jalen Brunson
```javascript
{
  player: "Jalen Brunson",
  team1: "Milwaukee Bucks",
  team2: "New York Knicks",
  line: 27.5,
  propType: "player_points",
  selection: "under",  // Lower → under
  sportsbook: "underdog"
}
```

## Console Logs You'll See:

```
Parsing PrizePicks format, total lines: 30
First 20 lines: [...]
Found combined pattern at line 5: Higher 28.5 Points → pattern1: true
Found matchup at line 3: { team1: 'PHI', team2: 'WAS' }
Found player at line 4: Tyrese Maxey
✅ Found bet (combined pattern): {
  playerName: 'Tyrese Maxey',
  lineValue: 28.5,
  selection: 'over',
  propType: 'player_points',
  team: 'Philadelphia 76ers',
  matchup: { team1: 'PHI', team2: 'WAS' }
}
```

## Why It Should Work Now:

### ✅ Combined Pattern Matching
- Detects "Higher 28.5 Points" as one line
- Extracts: selection="Higher", line=28.5, stat="Points"

### ✅ Player Name Extraction
- Looks backwards from the stat line
- Finds "Tyrese Maxey" on previous line

### ✅ Team/Matchup Extraction
- Finds "76ers @ Wizards" format
- Maps to PHI vs WAS

### ✅ Normalization
- "Higher" → "over"
- "Lower" → "under"

## Testing:

After pushing:
1. **Upload your Underdog slip**
2. **Check console logs** - should see "Found combined pattern"
3. **Should find 4 bets** (Maxey, Edgecombe, Giannis, Brunson)
4. **Check error message** if still fails - will show OCR text

## If Still Not Working:

Send me:
1. **Error message** (includes OCR text)
2. **Console logs** from Vercel
3. Look for:
   - "Found combined pattern at line X"
   - "Found player at line X"
   - "Found matchup at line X"

The detailed logging will show exactly where it's failing!
