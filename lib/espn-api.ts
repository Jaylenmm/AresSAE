import axios from 'axios'

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2'

export async function getTop25CFBTeams() {
  try {
    const response = await axios.get(
      `${ESPN_BASE_URL}/sports/football/college-football/rankings`
    )
    
    const apPoll = response.data.rankings.find(
      (r: any) => r.name === 'AP Top 25' || r.shortName === 'AP'
    )
    
    if (!apPoll || !apPoll.ranks) {
      console.error('AP Poll not found in rankings')
      return []
    }

    // Extract team names from top 25
    const top25Teams = apPoll.ranks.map((rank: any) => {
      return rank.team?.displayName || rank.team?.name || ''
    }).filter(Boolean)

    console.log('📊 Top 25 CFB Teams:', top25Teams)
    return top25Teams
  } catch (error) {
    console.error('Error fetching CFB rankings:', error)
    return []
  }
}

export function isTop25Team(teamName: string, top25List: string[]): boolean {
  // Normalize team names for comparison
  const normalizedTeam = teamName.toLowerCase().trim()
  
  return top25List.some(ranked => {
    const normalizedRanked = ranked.toLowerCase().trim()
    // Check for exact match or if one contains the other
    return normalizedRanked.includes(normalizedTeam) || normalizedTeam.includes(normalizedRanked)
  })
}