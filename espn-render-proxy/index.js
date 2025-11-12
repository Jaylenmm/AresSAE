const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ESPN proxy endpoint
app.get('/espn/*', async (req, res) => {
  try {
    const endpoint = req.params[0];
    const queryString = new URLSearchParams(req.query).toString();
    const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}${queryString ? '?' + queryString : ''}`;
    
    console.log(`Proxying ESPN: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('ESPN proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`ESPN Stats Proxy running on port ${PORT}`);
});
