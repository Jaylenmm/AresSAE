// Test TheSportsDB API to see what data we get

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3';

async function testAPI() {
  console.log('Testing TheSportsDB API...\n');
  
  try {
    // Test 1: Search for a player (LeBron James)
    console.log('1. Searching for LeBron James...');
    const searchUrl = `${BASE_URL}/searchplayers.php?p=lebron`;
    console.log('URL:', searchUrl);
    const searchRes = await fetch(searchUrl);
    const text = await searchRes.text();
    console.log('Response status:', searchRes.status);
    console.log('Response preview:', text.substring(0, 200));
    
    const searchData = JSON.parse(text);
    console.log('Player data:', JSON.stringify(searchData, null, 2));
  
  if (searchData.player && searchData.player[0]) {
    const playerId = searchData.player[0].idPlayer;
    console.log(`\nFound player ID: ${playerId}`);
    
    // Test 2: Get player details
    console.log('\n2. Getting player details...');
    const playerRes = await fetch(`${BASE_URL}/lookupplayer.php?id=${playerId}`);
    const playerData = await playerRes.json();
    console.log('Player details:', JSON.stringify(playerData, null, 2));
  }
  
  // Test 3: Get NBA league info
  console.log('\n3. Getting NBA league...');
  const leagueRes = await fetch(`${BASE_URL}/search_all_leagues.php?s=Basketball`);
  const leagueData = await leagueRes.json();
  console.log('Leagues:', JSON.stringify(leagueData, null, 2));
  
  // Test 4: Get recent NBA events
  console.log('\n4. Getting recent NBA events (league ID 4387)...');
  const eventsRes = await fetch(`${BASE_URL}/eventspastleague.php?id=4387`);
  const eventsData = await eventsRes.json();
  console.log('Recent events:', JSON.stringify(eventsData?.events?.slice(0, 2), null, 2));
  
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI().catch(console.error);
