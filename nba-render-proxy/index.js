const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const NBA_STATS_BASE = 'https://stats.nba.com/stats';
const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Connection': 'keep-alive',
};

// Proxy endpoint
app.get('/nba/*', async (req, res) => {
  try {
    const endpoint = req.params[0];
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${NBA_STATS_BASE}/${endpoint}${queryString ? '?' + queryString : ''}`;
    
    console.log(`Proxying: ${url}`);
    
    const response = await fetch(url, { headers: NBA_HEADERS });
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`NBA Proxy running on port ${PORT}`);
});
