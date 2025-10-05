import { NextResponse } from 'next/server'
import axios from 'axios'

const RSS_FEEDS: Record<string, string> = {
  NFL: 'https://www.espn.com/espn/rss/nfl/news',
  NBA: 'https://www.espn.com/espn/rss/nba/news',
  MLB: 'https://www.espn.com/espn/rss/mlb/news',
  CFB: 'https://www.espn.com/espn/rss/ncf/news'
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

    return NextResponse.json({ articles: articles.slice(0, 5) })
  } catch (error) {
    console.error('Error fetching ESPN news:', error)
    return NextResponse.json({ articles: [] })
  }
}

function parseRSS(xml: string) {
  const articles: any[] = []
  
  // Simple regex parsing (production should use proper XML parser)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/
  const linkRegex = /<link>(.*?)<\/link>/
  const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>/
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/

  const items = xml.match(itemRegex) || []

  for (const item of items) {
    const title = item.match(titleRegex)?.[1] || ''
    const link = item.match(linkRegex)?.[1] || ''
    const description = item.match(descRegex)?.[1] || ''
    const pubDate = item.match(pubDateRegex)?.[1] || ''

    if (title && link) {
      articles.push({
        title: title.trim(),
        link: link.trim(),
        description: description.trim(),
        pubDate: pubDate.trim()
      })
    }
  }

  return articles
}