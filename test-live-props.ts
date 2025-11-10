/**
 * Test NBA Prop Analyzer with LIVE data from The Odds API
 */

import { fetchPlayerProps } from './lib/odds-api';
import { analyzeNBAProp } from './lib/nba-prop-analyzer';
import type { ParsedBet } from './lib/bet-parser';

async function testLiveProps() {
  console.log('🏀 Fetching LIVE NBA props from The Odds API...\n');
  
  try {
    const propsData = await fetchPlayerProps('basketball_nba');
    
    if (!propsData || propsData.length === 0) {
      console.log('❌ No NBA games found today');
      return;
    }
    
    console.log(`✅ Found ${propsData.length} games with props\n`);
    
    // Find Cade Cunningham and CJ McCollum props
    const targetPlayers = ['Cade Cunningham', 'CJ McCollum'];
    const foundProps: ParsedBet[] = [];
    
    for (const game of propsData) {
      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          // Only look at player_points market
          if (market.key !== 'player_points') continue;
          
          for (const outcome of market.outcomes) {
            const playerName = outcome.description;
            
            if (targetPlayers.some(target => playerName.includes(target))) {
              // Found a target player
              const line = outcome.point;
              const odds = outcome.price;
              
              // Create Over bet
              foundProps.push({
                type: 'player_prop',
                player: playerName,
                propType: 'player_points',
                line: line,
                selection: 'over',
                odds: odds,
                sportsbook: bookmaker.key,
                sport: 'NBA',
                rawText: `${playerName} Over ${line} Points @ ${odds}`,
                confidence: 0.9
              });
              
              // Find Under odds (opposing outcome)
              const underOutcome = market.outcomes.find((o: any) => 
                o.description === playerName && o.name === 'Under'
              );
              
              if (underOutcome) {
                foundProps.push({
                  type: 'player_prop',
                  player: playerName,
                  propType: 'player_points',
                  line: line,
                  selection: 'under',
                  odds: underOutcome.price,
                  sportsbook: bookmaker.key,
                  sport: 'NBA',
                  rawText: `${playerName} Under ${line} Points @ ${underOutcome.price}`,
                  confidence: 0.9
                });
              }
            }
          }
        }
      }
    }
    
    if (foundProps.length === 0) {
      console.log('❌ No props found for Cade Cunningham or CJ McCollum');
      console.log('Available players in data:');
      
      // Show what players ARE available
      const availablePlayers = new Set<string>();
      for (const game of propsData) {
        for (const bookmaker of game.bookmakers) {
          for (const market of bookmaker.markets) {
            if (market.key === 'player_points') {
              for (const outcome of market.outcomes) {
                availablePlayers.add(outcome.description);
              }
            }
          }
        }
      }
      
      console.log(Array.from(availablePlayers).slice(0, 20).join(', '));
      return;
    }
    
    console.log(`\n✅ Found ${foundProps.length} props for target players\n`);
    
    // Analyze each prop
    for (const prop of foundProps) {
      console.log('='.repeat(60));
      console.log(`📊 ${prop.player} - ${prop.selection?.toUpperCase()} ${prop.line} points`);
      console.log(`   Sportsbook: ${prop.sportsbook}, Odds: ${prop.odds}`);
      console.log('='.repeat(60));
      
      const analysis = await analyzeNBAProp(prop);
      
      if (analysis) {
        console.log(`\n🎯 Recommendation: ${analysis.recommendation.toUpperCase()}`);
        console.log(`📈 Confidence: ${analysis.confidence.toFixed(1)}%`);
        console.log(`💰 Edge: ${analysis.edge.toFixed(2)}%`);
        
        console.log(`\n📊 Stats:`);
        console.log(`  Season Median: ${analysis.stats.seasonMedian.toFixed(1)}`);
        console.log(`  Last 5 Median: ${analysis.stats.last5Median.toFixed(1)}`);
        console.log(`  Hit Rate: ${analysis.stats.hitRate.toFixed(0)}%`);
        console.log(`  Skewness: ${analysis.stats.skewness.toFixed(2)}`);
        
        if (analysis.simulation) {
          console.log(`\n🎲 Monte Carlo Simulation:`);
          console.log(`  Simulation Median: ${analysis.simulation.median.toFixed(1)}`);
          console.log(`  Hit Probability: ${(analysis.simulation.hitProbability * 100).toFixed(1)}%`);
          console.log(`  Fair Odds: Over ${analysis.simulation.fairOdds.over}, Under ${analysis.simulation.fairOdds.under}`);
        }
        
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
      
      console.log('\n');
    }
    
    console.log('='.repeat(60));
    console.log('✅ Live props analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLiveProps().catch(console.error);
