# UI Simplification

## Before (Too Much Info):
```
Bet #1
Type: player_prop
Player: Bam Adebayo
Teams: Miami Heat vs Charlotte Hornets
Line: 10
Odds: -110
Match Confidence: 85%
```

## After (Clean & Clear):
```
Miami Heat vs Charlotte Hornets

Bam Adebayo

REBOUNDS    Under 10    (-110)

Match confidence: 85%
```

---

## Layout Structure:

### 1. **Game/Team Info** (small, gray)
```
Miami Heat vs Charlotte Hornets
```

### 2. **Player Name** (large, bold, white)
```
Bam Adebayo
```

### 3. **Prop, Line, Selection, Odds** (medium, one line)
```
REBOUNDS    Under 10    (-110)
```

### 4. **Match Confidence** (tiny, gray)
```
Match confidence: 85%
```

### 5. **Analysis** (existing, unchanged)
```
[STRONG BET]    95% Confidence
Edge: +12.5%
✓ Reasons...
⚠ Warnings...
```

---

## Visual Hierarchy:

```
┌─────────────────────────────────────────┐
│ Miami Heat vs Charlotte Hornets         │ ← Small gray
│                                          │
│ Bam Adebayo                             │ ← Big bold white
│                                          │
│ REBOUNDS  Under 10  (-110)              │ ← Medium, colored
│                                          │
│ Match confidence: 85%                    │ ← Tiny gray
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ [STRONG BET]      95% Confidence    │ │
│ │ Edge: +12.5%                        │ │
│ │ ✓ Player averaging 12.3 rebounds   │ │
│ │ ⚠ Recent injury concern             │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Example with All 4 Bets:

```
┌─────────────────────────────────────────┐
│ 4 of 4 bets matched                     │
│ 🌐 universal-prizepicks                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Miami Heat vs Charlotte Hornets         │
│                                          │
│ Bam Adebayo                             │
│ REBOUNDS  Under 10  (-110)              │
│ Match confidence: 85%                    │
│                                          │
│ [STRONG BET] 95% Confidence             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Miami Heat vs Charlotte Hornets         │
│                                          │
│ LaMelo Ball                             │
│ POINTS  Under 25.5  (-110)              │
│ Match confidence: 92%                    │
│                                          │
│ [BET] 88% Confidence                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Milwaukee Bucks vs New York Knicks      │
│                                          │
│ Giannis Antetokounmpo                   │
│ REBOUNDS  Over 13.5  (-110)             │
│ Match confidence: 98%                    │
│                                          │
│ [STRONG BET] 96% Confidence             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Oklahoma City Thunder vs Sacramento     │
│                                          │
│ Chet Holmgren                           │
│ POINTS  Under 18.5  (-110)              │
│ Match confidence: 88%                    │
│                                          │
│ [CONSIDER] 72% Confidence               │
└─────────────────────────────────────────┘
```

---

## Key Improvements:

1. **Removed clutter** - no "Type:", "Player:", etc. labels
2. **Visual hierarchy** - important info is bigger
3. **One-line bet summary** - easy to scan
4. **Match confidence de-emphasized** - still there but smaller
5. **Clean spacing** - easier to read

---

## What Each Line Shows:

### Line 1: Game Context
- Shows which game the bet is for
- Helps group bets by game
- Small and subtle

### Line 2: Player Name
- Most important identifier
- Large and bold
- Easy to scan

### Line 3: The Actual Bet
- Prop type (REBOUNDS, POINTS, ASSISTS)
- Selection (Over/Under)
- Line value (10, 25.5, etc.)
- Odds (-110, +150, etc.)
- All on one line for quick reading

### Line 4: Match Confidence
- Technical detail for verification
- Small text so it doesn't distract
- Still accessible if needed

---

## Mobile-Friendly:

The layout stacks nicely on mobile:
```
Miami Heat vs Charlotte Hornets

Bam Adebayo

REBOUNDS
Under 10
(-110)

Match confidence: 85%
```

---

## Accessibility:

- Clear visual hierarchy
- Good contrast (white on dark)
- Color-coded recommendations (green/blue/yellow/red)
- Readable font sizes
- Proper spacing

---

This is much cleaner and easier to understand at a glance!
