/**
 * Test NBA Prop Analyzer
 * Run with: npx tsx test-nba-analyzer.ts
 */

import { analyzeNBAProp } from './lib/nba-prop-analyzer';
import type { ParsedBet } from './lib/bet-parser';

async function testAnalyzer() {
  console.log('🏀 Testing NBA Prop Analyzer...\n');
  
  // Test bets
  const testBets: ParsedBet[] = [
    {
      type: 'player_prop',
      player: 'Cade Cunningham',
      propType: 'player_points',
      line: 24.5,
      selection: 'over',
      odds: -110,
      sportsbook: 'prizepicks',
      sport: 'NBA',
      rawText: 'Cade Cunningham Over 24.5 Points',
      confidence: 0.9
    },
    {
      type: 'player_prop',
      player: 'Cade Cunningham',
      propType: 'player_assists',
      line: 8.5,
      selection: 'over',
      odds: -110,
      sportsbook: 'prizepicks',
      sport: 'NBA',
      rawText: 'Cade Cunningham Over 8.5 Assists',
      confidence: 0.9
    },
    {
      type: 'player_prop',
      player: 'CJ McCollum',
      propType: 'player_points',
      line: 21.5,
      selection: 'over',
      odds: -110,
      sportsbook: 'prizepicks',
      sport: 'NBA',
      rawText: 'CJ McCollum Over 21.5 Points',
      confidence: 0.9
    },
    {
      type: 'player_prop',
      player: 'CJ McCollum',
      propType: 'player_rebounds',
      line: 4.5,
      selection: 'under',
      odds: -110,
      sportsbook: 'prizepicks',
      sport: 'NBA',
      rawText: 'CJ McCollum Under 4.5 Rebounds',
      confidence: 0.9
    }
  ];
  
  for (const bet of testBets) {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Testing: ${bet.player} - ${bet.propType} ${bet.selection} ${bet.line}`);
    console.log('='.repeat(60));
    
    const analysis = await analyzeNBAProp(bet);
    
    if (analysis) {
      console.log(`\n🎯 Recommendation: ${analysis.recommendation.toUpperCase()}`);
      console.log(`📈 Confidence: ${analysis.confidence}%`);
      console.log(`💰 Edge: ${analysis.edge.toFixed(2)}%`);
      
      console.log(`\n📊 Stats:`);
      console.log(`  Season Average: ${analysis.stats.seasonAverage.toFixed(1)}`);
      console.log(`  Last 5 Average: ${analysis.stats.last5Average.toFixed(1)}`);
      console.log(`  Hit Rate: ${analysis.stats.hitRate.toFixed(0)}%`);
      console.log(`  Trend: ${analysis.stats.trend.toUpperCase()}`);
      
      if (analysis.reasoning.length > 0) {
        console.log(`\n✅ Reasoning:`);
        analysis.reasoning.forEach(r => console.log(`  • ${r}`));
      }
      
      if (analysis.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        analysis.warnings.forEach(w => console.log(`  • ${w}`));
      }
    } else {
      console.log('❌ Analysis failed');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ NBA Prop Analyzer test complete!');
}

testAnalyzer().catch(console.error);
