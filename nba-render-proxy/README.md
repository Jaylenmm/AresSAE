# NBA Stats Render Proxy

## Deploy to Render

1. Push this folder to a GitHub repo
2. Go to https://render.com
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Settings:
   - **Name**: nba-stats-proxy
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
6. Click "Create Web Service"

You'll get a URL like: `https://nba-stats-proxy.onrender.com`

## Update Your App

Add to `.env.local`:
```
NBA_PROXY_URL=https://nba-stats-proxy.onrender.com
```

Then update `lib/nba-stats-service.ts` to use the proxy.
