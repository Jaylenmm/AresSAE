/**
 * Test NBA.com API from different methods to see what actually works
 */

const NBA_STATS_BASE = 'https://stats.nba.com/stats';
const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
};

async function testDirect() {
  console.log('\n1. Testing DIRECT NBA.com call...');
  try {
    const response = await fetch(
      `${NBA_STATS_BASE}/commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0`,
      { headers: NBA_HEADERS }
    );
    console.log(`✅ Direct call: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Found ${data.resultSets[0].rowSet.length} players`);
    }
  } catch (error: any) {
    console.log(`❌ Direct call failed: ${error.message}`);
  }
}

async function testAllOrigins() {
  console.log('\n2. Testing AllOrigins proxy...');
  try {
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      `${NBA_STATS_BASE}/commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0`
    )}`;
    const response = await fetch(url);
    console.log(`✅ AllOrigins: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Found ${data.resultSets[0].rowSet.length} players`);
    }
  } catch (error: any) {
    console.log(`❌ AllOrigins failed: ${error.message}`);
  }
}

async function testCorsAnywhere() {
  console.log('\n3. Testing CORS Anywhere...');
  try {
    const url = `https://cors-anywhere.herokuapp.com/${NBA_STATS_BASE}/commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0`;
    const response = await fetch(url, { headers: NBA_HEADERS });
    console.log(`✅ CORS Anywhere: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Found ${data.resultSets[0].rowSet.length} players`);
    }
  } catch (error: any) {
    console.log(`❌ CORS Anywhere failed: ${error.message}`);
  }
}

async function testThingProxy() {
  console.log('\n4. Testing ThingProxy...');
  try {
    const url = `https://thingproxy.freeboard.io/fetch/${NBA_STATS_BASE}/commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0`;
    const response = await fetch(url);
    console.log(`✅ ThingProxy: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Found ${data.resultSets[0].rowSet.length} players`);
    }
  } catch (error: any) {
    console.log(`❌ ThingProxy failed: ${error.message}`);
  }
}

async function main() {
  console.log('Testing NBA.com API access from Node.js environment...\n');
  console.log('This simulates what happens in production (Vercel).\n');
  
  await testDirect();
  await testAllOrigins();
  await testCorsAnywhere();
  await testThingProxy();
  
  console.log('\n✅ = Working | ❌ = Failed\n');
}

main();
