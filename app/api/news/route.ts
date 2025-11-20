import { NextResponse } from 'next/server'
import axios from 'axios'

const RSS_FEEDS: Record<string, string> = {
  NFL: 'https://www.espn.com/espn/rss/nfl/news',
  NBA: 'https://www.espn.com/espn/rss/nba/news',
  MLB: 'https://www.espn.com/espn/rss/mlb/news',
  NCAAF: 'https://www.espn.com/espn/rss/ncf/news'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') || 'NFL'

  try {
    const feedUrl = RSS_FEEDS[sport]
    if (!feedUrl) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 })
    }

    const response = await axios.get(feedUrl)
    const xmlData = response.data

    // Parse RSS XML to extract articles
    const articles = parseRSS(xmlData)

    // Only return the three most recent articles
    return NextResponse.json({ articles: articles.slice(0, 3) })
  } catch (error) {
    console.error('Error fetching ESPN news:', error)
    return NextResponse.json({ articles: [] })
  }
}

function parseRSS(xml: string) {
  const articles: any[] = []
  
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const items = xml.match(itemRegex) || []

  for (const item of items) {
    // Extract title - remove CDATA wrapper if present
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/)
    let title = titleMatch?.[1] || ''
    title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim()

    // Extract link - remove CDATA wrapper if present
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/)
    let link = linkMatch?.[1] || ''
    link = link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim()

    // Extract description - remove CDATA wrapper if present
    const descMatch = item.match(/<description>([\s\S]*?)<\/description>/)
    let description = descMatch?.[1] || ''
    description = description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim()

    // Extract pubDate
    const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)
    const pubDate = pubDateMatch?.[1] || ''

    if (title && link) {
      articles.push({
        title,
        link,
        description,
        pubDate: pubDate.trim()
      })
    }
  }

  return articles
}