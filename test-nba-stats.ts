/**
 * Test NBA Stats Service
 * Run with: npx tsx test-nba-stats.ts
 */

import { getPlayerStats } from './lib/nba-stats-service';

async function testNBAStats() {
  console.log('🏀 Testing NBA Stats API...\n');
  
  const players = ['Kevin Durant', 'Stephen Curry'];
  
  for (const playerName of players) {
    const stats = await getPlayerStats(playerName, 5);
    
    if (stats) {
      console.log(`\n📋 ${stats.player.name} Stats:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Team: ${stats.player.team}`);
      console.log(`Season: ${stats.seasonStats.season}`);
      console.log(`Games Played: ${stats.seasonStats.gamesPlayed}`);
      
      console.log('\nSeason Averages:');
      console.log(`  Points: ${stats.seasonStats.averages.points} PPG`);
      console.log(`  Rebounds: ${stats.seasonStats.averages.rebounds} RPG`);
      console.log(`  Assists: ${stats.seasonStats.averages.assists} APG`);
      console.log(`  Steals: ${stats.seasonStats.averages.steals} SPG`);
      console.log(`  Blocks: ${stats.seasonStats.averages.blocks} BPG`);
      console.log(`  Turnovers: ${stats.seasonStats.averages.turnovers} TPG`);
      console.log(`  FG%: ${(stats.seasonStats.averages.fieldGoalPct * 100).toFixed(1)}%`);
      console.log(`  3PT%: ${(stats.seasonStats.averages.threePointPct * 100).toFixed(1)}%`);
      console.log(`  FT%: ${(stats.seasonStats.averages.freeThrowPct * 100).toFixed(1)}%`);
      console.log(`  Minutes: ${stats.seasonStats.averages.minutesPerGame} MPG`);
      
      console.log(`\nLast ${stats.recentGames.length} Games:`);
      if (stats.recentGames.length === 0) {
        console.log('  ⚠️ No recent games found (season may not have started yet)');
      } else {
        stats.recentGames.forEach((game, i) => {
          const fgPct = game.fieldGoalsAttempted > 0 ? ((game.fieldGoalsMade / game.fieldGoalsAttempted) * 100).toFixed(1) : '0.0';
          const threePct = game.threePointsAttempted > 0 ? ((game.threePointsMade / game.threePointsAttempted) * 100).toFixed(1) : '0.0';
          console.log(`  ${i + 1}. ${game.gameDate} vs ${game.opponent}:`);
          console.log(`     ${game.points} PTS, ${game.rebounds} REB, ${game.assists} AST, ${game.steals} STL, ${game.blocks} BLK`);
          console.log(`     FG: ${game.fieldGoalsMade}/${game.fieldGoalsAttempted} (${fgPct}%), 3PT: ${game.threePointsMade}/${game.threePointsAttempted} (${threePct}%)`);
        });
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
  
  console.log('✅ NBA Stats API test complete!');
}

testNBAStats().catch(console.error);
