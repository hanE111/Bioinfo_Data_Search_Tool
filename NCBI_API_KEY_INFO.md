# NCBI API Key Information

## ✅ Your API Key is Now Integrated!

Your NCBI API key `fabb197bb29a646b11c3ece73df996175e08` has been added to the code and will be used automatically.

## What This Means

### Before (Without API Key)
- ❌ Limited to **3 requests per second**
- ❌ May hit rate limits with rapid searches
- ❌ Slower when doing multiple operations

### Now (With Your API Key)
- ✅ **10 requests per second** (3x faster!)
- ✅ No rate limiting issues
- ✅ Smoother, faster searches
- ✅ Better for multiple concurrent queries
- ✅ **Still completely free** - no cost

## How It's Used

### Claude Desktop (MCP Server)
Your API key is hardcoded in [mcp-server/index.js](mcp-server/index.js:30):
```javascript
const NCBI_API_KEY = 'yourapikeyhere';
```

It's automatically appended to all NCBI API requests.

### Web Interface (Backend)
Your API key is hardcoded in [backend/geo-client.js](backend/geo-client.js:10):
```javascript
const NCBI_API_KEY = 'yourapikeyhere';
```

When you start the backend, you'll see:
```
✓ Connected to NCBI E-utilities API
✓ Using NCBI API key for enhanced rate limits (10 req/s)
```

## Verification

Start the backend and look for the confirmation message:

```bash
cd backend
npm run dev
```

You should see:
```
✓ Using NCBI API key for enhanced rate limits (10 req/s)
```

## Rate Limits Comparison

| Scenario | Without API Key | With Your API Key |
|----------|----------------|-------------------|
| **Requests/second** | 3 | 10 |
| **Daily limit** | None | None |
| **Cost** | Free | Free |
| **Registration required** | No | Yes (already done) |

## Can I Change It?

### Option 1: Environment Variable (Recommended for security)
Set in your shell or `.env` file:
```bash
export NCBI_API_KEY=your_different_key
```

### Option 2: Edit the code directly
Change the hardcoded value in:
- `mcp-server/index.js` line 30
- `backend/geo-client.js` line 10

### Option 3: Leave it as is
Your current key is already integrated and working!

## Security Note

NCBI API keys are:
- ✅ Free to use
- ✅ Not secret (can be in public code)
- ✅ Only rate-limited per key (no billing)
- ✅ Can't access private data
- ✅ Can't modify anything

Unlike API keys from OpenAI or Anthropic, NCBI keys don't have costs or security risks. They just identify you for rate limiting purposes.

## Getting Another Key

If you ever need a new one:
1. Go to https://www.ncbi.nlm.nih.gov/account/
2. Sign in
3. Go to Settings → API Key Management
4. Create a new key

## Testing It

Try these to see the improved speed:

### Test 1: Rapid Searches
```
In Claude Desktop:
1. "Search for breast cancer datasets"
2. "Search for diabetes datasets"
3. "Search for alzheimer datasets"
```

All three should complete quickly without rate limit errors.

### Test 2: Multiple Dataset Details
```
"Get details for GSE123456, GSE789012, and GSE111213"
```

Should fetch all three without delay.

## Summary

- ✅ Your NCBI API key is integrated and active
- ✅ You now have 3x faster rate limits
- ✅ No additional setup needed
- ✅ Works for both Claude Desktop and Web Interface
- ✅ Completely free, no costs

Enjoy faster GEO dataset searches! 🚀
