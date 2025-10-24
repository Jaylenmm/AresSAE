// Quick diagnostic: check what The Odds API returns for sharp books on NFL props
const API_KEY = process.env.THE_ODDS_API_KEY

async function testSharpProps() {
  console.log('Fetching NFL events...')
  const eventsResp = await fetch(`https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events?apiKey=${API_KEY}`)
  const events = await eventsResp.json()
  
  if (!events || events.length === 0) {
    console.log('No NFL events found')
    return
  }
  
  const testEvent = events[0]
  console.log(`\nTesting event: ${testEvent.away_team} @ ${testEvent.home_team}`)
  console.log(`Event ID: ${testEvent.id}`)
  
  // Test with all regions
  const regions = 'us,us2,eu,uk,au'
  const markets = 'player_pass_yds,player_pass_tds,player_rush_yds,player_receptions'
  
  console.log(`\nFetching props with regions: ${regions}`)
  const propsUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${testEvent.id}/odds?apiKey=${API_KEY}&regions=${regions}&markets=${markets}&oddsFormat=american`
  
  const propsResp = await fetch(propsUrl)
  const propsData = await propsResp.json()
  
  console.log(`\nTotal bookmakers returned: ${propsData.bookmakers?.length || 0}`)
  
  if (propsData.bookmakers && propsData.bookmakers.length > 0) {
    console.log('\nBookmakers found:')
    propsData.bookmakers.forEach(book => {
      const marketCount = book.markets?.length || 0
      console.log(`  - ${book.key} (${book.title}): ${marketCount} markets`)
    })
    
    const sharpBooks = propsData.bookmakers.filter(b => ['pinnacle', 'circa', 'circasports'].includes(b.key))
    console.log(`\nSharp books found: ${sharpBooks.length}`)
    sharpBooks.forEach(book => {
      console.log(`  - ${book.key}: ${book.markets?.length || 0} markets`)
      if (book.markets && book.markets.length > 0) {
        console.log(`    Markets: ${book.markets.map(m => m.key).join(', ')}`)
      }
    })
  } else {
    console.log('\nNo bookmakers returned at all')
  }
  
  console.log(`\nAPI requests remaining: ${propsResp.headers.get('x-requests-remaining')}`)
}

testSharpProps().catch(console.error)
