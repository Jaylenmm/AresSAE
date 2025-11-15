/**
 * Test Highlightly API integration
 * Run: npx tsx test-highlightly.ts
 */
import dotenv from 'dotenv';

// Explicitly load variables from .env.local for local testing
dotenv.config({ path: '.env.local' });

import { getPlayerStats } from './lib/highlightly-service';

async function testHighlightly() {
  console.log('🧪 Testing Highlightly API Integration\n');
  console.log('Environment check:');
  console.log('HIGHLIGHTLY_API_KEY present:', !!process.env.HIGHLIGHTLY_API_KEY);
  console.log('HIGHLIGHTLY_API_KEY length:', process.env.HIGHLIGHTLY_API_KEY?.length || 0);
  console.log('='.repeat(60));
  
  const testPlayers = [
    { name: 'LeBron James', sport: 'nba' as const },
    { name: 'Patrick Mahomes', sport: 'nfl' as const },
    { name: 'Shohei Ohtani', sport: 'mlb' as const },
    { name: 'Connor McDavid', sport: 'nhl' as const }
  ];
  
  for (const player of testPlayers) {
    console.log(`\n📊 Testing ${player.sport.toUpperCase()}: ${player.name}`);
    console.log('-'.repeat(60));
    
    const stats = await getPlayerStats(player.name, player.sport);
    
    if (stats) {
      console.log(`✅ SUCCESS - Got data from Highlightly`);
      console.log(`   Player: ${stats.playerName}`);
      console.log(`   Team: ${stats.team}`);
      console.log(`   Sport: ${stats.sport}`);
      console.log(`   Source: ${stats.source}`);
      console.log(`   Recent Games: ${stats.recentGames.length}`);
      
      if (stats.recentGames.length > 0) {
        const lastGame = stats.recentGames[0];
        console.log(`\n   Last Game:`);
        console.log(`   - Date: ${lastGame.gameDate}`);
        console.log(`   - Opponent: ${lastGame.opponent}`);
        console.log(`   - Stats:`, Object.keys(lastGame.stats).slice(0, 5).join(', '));
      }
    } else {
      console.log(`❌ FAILED - No data returned`);
      console.log(`   This could mean:`);
      console.log(`   - API key not configured (set HIGHLIGHTLY_API_KEY in .env.local)`);
      console.log(`   - Rate limit exceeded (100 requests/day)`);
      console.log(`   - Player not found`);
    }
    
    // Wait 2 seconds between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Complete\n');
}

testHighlightly().catch(console.error);
