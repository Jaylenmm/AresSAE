# Structured Parser - Following Actual Slip Format

## The Problem with Universal Parser:

The universal parser was finding numbers everywhere and trying to guess what they meant. This led to:
- ❌ Timestamps being parsed as bets (7:00 PM)
- ❌ Jersey numbers being parsed as bets (#8, #9)
- ❌ Payout multipliers being parsed as bets (6x, 10x)
- ❌ "Flex Play" and "Power Play" being parsed as player names

## The Solution: Follow the Slip Structure

Instead of guessing, **follow the exact format of the slip**:

### PrizePicks Format:
```
4-pick Power Play           ← Find number of picks

NBA MIA vs CHA              ← Game header
Bam Adebayo                 ← Player name
MIA • C-F • #13             ← Player info (skip)
10 Rebounds                 ← Prop line + type
↓ Less ↑ More               ← Selection (look for highlighted)

LaMelo Ball                 ← Player name
CHA • G • #1                ← Player info (skip)
25.5 Points                 ← Prop line + type
↓ Less ↑ More               ← Selection

NBA MIL vs NYK              ← New game header
Giannis Antetokounmpo       ← Player name
...
```

### Underdog Format:
```
4 Picks                     ← Find number of picks

76ers @ Wizards - 6:00 PM   ← Game header
Tyrese Maxey                ← Player name
Higher 28.5 Points          ← Selection + prop (combined)

VJ Edgecombe                ← Player name
Lower 19.5 Points           ← Selection + prop (combined)

Bucks vs Knicks - 7:00 PM   ← New game header
...
```

## How the Structured Parser Works:

### Step 1: Find Expected Number of Bets
```typescript
"4-pick Power Play" → expectedBets = 4
"4 Picks"          → expectedBets = 4
```

### Step 2: Find Game Headers
```typescript
"NBA MIA vs CHA"           → game: MIA vs CHA (NBA)
"76ers @ Wizards - 6:00"   → game: PHI vs WAS (NBA)
"MIL vs NYK"               → game: MIL vs NYK (NBA)
```

### Step 3: For Each Game, Find Players
```typescript
// Look for 2-3 capitalized words
"Bam Adebayo"              → player ✓
"LaMelo Ball"              → player ✓
"Giannis Antetokounmpo"    → player ✓

// Filter out non-players
"Flex Play"                → skip ❌
"Power Play"               → skip ❌
"Minimum Guarantee"        → skip ❌
```

### Step 4: For Each Player, Find Prop Info
Look ahead 5 lines for:
- **Prop line + type**: "21.5 Points", "10 Rebounds"
- **Selection**: "Higher", "Lower", "More", "Less"
- **Combined format**: "Higher 28.5 Points"

### Step 5: Create Bet
```typescript
{
  player: "Bam Adebayo",
  propType: "player_rebounds",
  line: 10,
  selection: "under",  // from "Less"
  team1: "Miami Heat",
  team2: "Charlotte Hornets",
  sport: "NBA"
}
```

## Example: Your 4-Pick Slip

### OCR Text:
```
4 Picks

76ers @ Wizards - 6:00 PM
Tyrese Maxey
Higher 28.5 Points

VJ Edgecombe
Lower 19.5 Points

Bucks vs Knicks - 7:00 PM
Giannis Antetokounmpo
Higher 31.5 Points

Jalen Brunson
Lower 27.5 Points
```

### Parser Output:
```
🎯 Found 4 picks expected

🏀 Found game: PHI vs WAS (NBA)
  👤 Found player: Tyrese Maxey
    ✓ Selection: over (from "Higher 28.5 Points")
    ✓ Prop: points 28.5 (over)
    ✅ Created bet #1

  👤 Found player: VJ Edgecombe
    ✓ Selection: under (from "Lower 19.5 Points")
    ✓ Prop: points 19.5 (under)
    ✅ Created bet #2

🏀 Found game: MIL vs NYK (NBA)
  👤 Found player: Giannis Antetokounmpo
    ✓ Selection: over (from "Higher 31.5 Points")
    ✓ Prop: points 31.5 (over)
    ✅ Created bet #3

  👤 Found player: Jalen Brunson
    ✓ Selection: under (from "Lower 27.5 Points")
    ✓ Prop: points 27.5 (under)
    ✅ Created bet #4

📊 Found 4 bets (expected 4) ✅
```

## Key Improvements:

### 1. **Sequential Processing**
- Reads slip top-to-bottom like a human
- Follows the natural structure
- Doesn't jump around looking for patterns

### 2. **Game Grouping**
- Finds game headers first
- Groups all players under that game
- Maintains context

### 3. **No Garbage**
- Only looks for players after game headers
- Filters out "Flex Play", "Power Play", etc.
- Ignores timestamps, jersey numbers, multipliers

### 4. **Validation**
- Knows how many bets to expect
- Warns if fewer bets found
- Only creates bets with minimum required data

### 5. **Database Filtering**
- After parsing, filters to only show bets with match confidence > 50%
- This removes any remaining garbage that didn't match to real players

## Expected Results:

### Before (Universal Parser):
```
Found 18 bets:
- Bobby Portis 21.5 Points ✓
- Bobby Portis 7 Points ❌ (timestamp)
- Bobby Portis 9 Points ❌ (jersey #)
- Flex Play 34 Points ❌ (not a player)
- Flex Play 24.5 Points ❌
- Power Play 1 Points ❌
- Minimum Guarantee 6 Receptions ❌
... (11 more garbage bets)
```

### After (Structured Parser + Filtering):
```
Found 4 bets:
- Tyrese Maxey Over 28.5 Points ✓
- VJ Edgecombe Under 19.5 Points ✓
- Giannis Antetokounmpo Over 31.5 Points ✓
- Jalen Brunson Under 27.5 Points ✓

All matched to database with >80% confidence ✓
```

## Why This Works:

1. **Follows the actual format** - doesn't try to guess
2. **Uses context** - knows what game each player belongs to
3. **Validates** - checks expected number of bets
4. **Filters** - removes bets that don't match to database
5. **Clean output** - only shows real player props

## Testing:

### Your Underdog Slip:
```
Expected: 4 bets
Should find:
✓ Tyrese Maxey - Over 28.5 Points
✓ VJ Edgecombe - Under 19.5 Points
✓ Giannis Antetokounmpo - Over 31.5 Points
✓ Jalen Brunson - Under 27.5 Points
```

### Your PrizePicks Slip:
```
Expected: 4 bets
Should find:
✓ Bam Adebayo - Under 10 Rebounds
✓ LaMelo Ball - Under 25.5 Points
✓ Giannis Antetokounmpo - Over 13.5 Rebounds
✓ Chet Holmgren - Under 18.5 Points
```

---

**This should finally give you reliable, clean results!** 🎯
