/**
 * Test NFL.com API endpoints
 */

async function testNFLAPI() {
  const playerName = 'Drake Maye';
  
  // Try NFL's Shield API (what their site uses)
  console.log('Testing NFL Shield API...\n');
  
  // Endpoint 1: Player search
  const searchUrl = `https://api.nfl.com/v3/shield/?query=query{playerSearch(name:"${playerName}"){players{id,displayName,person{id}}}}`;
  console.log('Search URL:', searchUrl);
  
  try {
    const searchResponse = await fetch(searchUrl);
    console.log('Search status:', searchResponse.status);
    const searchData = await searchResponse.text();
    console.log('Search response:', searchData.substring(0, 500));
  } catch (e: any) {
    console.log('Search error:', e.message);
  }
  
  // Endpoint 2: Try their stats API directly
  console.log('\n\nTrying stats.nfl.com...');
  const statsUrl = `https://stats.nfl.com/api/v1/player/stats?name=${encodeURIComponent(playerName)}`;
  console.log('Stats URL:', statsUrl);
  
  try {
    const statsResponse = await fetch(statsUrl);
    console.log('Stats status:', statsResponse.status);
    const statsData = await statsResponse.text();
    console.log('Stats response:', statsData.substring(0, 500));
  } catch (e: any) {
    console.log('Stats error:', e.message);
  }
  
  // Endpoint 3: Try v1 API
  console.log('\n\nTrying v1 API...');
  const v1Url = `https://api.nfl.com/v1/reroute?s=search&q=${encodeURIComponent(playerName)}`;
  console.log('V1 URL:', v1Url);
  
  try {
    const v1Response = await fetch(v1Url);
    console.log('V1 status:', v1Response.status);
    const v1Data = await v1Response.text();
    console.log('V1 response:', v1Data.substring(0, 500));
  } catch (e: any) {
    console.log('V1 error:', e.message);
  }
}

testNFLAPI().catch(console.error);
