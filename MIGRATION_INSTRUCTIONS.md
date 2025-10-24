# Database Migration Instructions

## Add Player ESPN IDs Table

To enable ESPN stats integration, you need to create the `player_espn_ids` table in your Supabase database.

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `lib/migrations/add_player_espn_ids.sql`
5. Click **Run** to execute the migration

### Option 2: Command Line

If you have the Supabase CLI installed:

```bash
supabase db push
```

### Verify Migration

After running the migration, verify the table was created:

```sql
SELECT * FROM player_espn_ids LIMIT 1;
```

You should see an empty table with columns: `id`, `player_name`, `espn_id`, `sport`, `created_at`, `updated_at`.

## What This Does

This migration creates a caching table that stores ESPN player IDs mapped to player names. This prevents repeated API lookups and improves performance when fetching player statistics.

The table will automatically populate as users view player props on the Build page.
