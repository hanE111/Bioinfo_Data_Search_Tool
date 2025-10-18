# MCP Architecture Explained

## What is MCP?

**MCP (Model Context Protocol)** is a protocol that allows AI assistants like Claude to use external tools.

## Your Current Setup

### Architecture Flow

```
┌──────────────────────────┐
│   Claude Desktop App     │  ← You ask questions here
│   (the AI assistant)     │
└────────────┬─────────────┘
             │
             │ Uses MCP Protocol to communicate
             │
┌────────────▼─────────────┐
│   MCP Server        │  ← mcp-server/index.js
│   (geo-dataset-server)   │     This is what you built!
│                          │
│   Provides 6 tools:      │
│   - search_geo_datasets  │
│   - get_dataset_details  │
│   - download_dataset     │
│   - analyze_dataset      │
│   - query_gene_expression│
│   - get_sample_char...   │
└────────────┬─────────────┘
             │
             │ Makes HTTP requests
             │
┌────────────▼─────────────┐
│   NCBI GEO API          │  ← Public genomics database
│   (eutils.ncbi.nlm...)  │
└──────────────────────────┘
```

## Key Point: YOU Built the MCP Server

Your `mcp-server/index.js` **IS** the MCP server. It:

1. **Registers itself with Claude Desktop** via the config file
2. **Provides tools** that Claude can use
3. **Talks to NCBI** directly (not another MCP server)

## Where Claude Connects

In your Claude Desktop config file:
```json
{
  "mcpServers": {
    "geo-datasets": {
      "command": "node",
      "args": [
        "/path/to/mcp-server/index.js"
      ]
    }
  }
}
```

This tells Claude Desktop:
- Run `node /path/to/mcp-server/index.js`
- This starts YOUR MCP server
- Claude can now use the tools it provides

## How It Works

### Step 1: Claude Desktop starts your server
```bash
node /path/to/mcp-server/index.js
```

### Step 2: Your server registers its tools
```javascript
// In mcp-server/index.js
this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_geo_datasets',
      description: 'Search for GEO datasets...',
      // ...
    },
    // ... other tools
  ]
}));
```

### Step 3: Claude can use these tools
When you ask Claude: "Search for breast cancer datasets"

Claude sees it has a tool called `search_geo_datasets` and uses it:
```javascript
// Claude calls this:
search_geo_datasets({ query: "breast cancer" })
```

### Step 4: Your server does the work
```javascript
async searchDatasets(query, maxResults) {
  // Makes API call to NCBI
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/...`;
  const response = await fetch(searchUrl);
  // Returns results to Claude
}
```

### Step 5: Claude shows you the results
Claude formats the data nicely and shows you the datasets.



## How to Add Different MCPs

If you want to add OTHER MCP servers (weather, calculator, etc.):

### Option 1: Add More Servers to Config

Edit Claude Desktop config:
```json
{
  "mcpServers": {
    "geo-datasets": {
      "command": "node",
      "args": ["/path/to/your/mcp-server/index.js"]
    },
    "weather": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-weather"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  }
}
```

Now Claude has access to:
- Your GEO tools
- Weather tools
- Filesystem tools

### Option 2: Modify Your Server to Connect to Other APIs

Edit `mcp-server/index.js` to add more tools:

```javascript
// Add a new tool
{
  name: 'search_pubmed',
  description: 'Search PubMed for scientific papers',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    }
  }
}

// Add the implementation
async searchPubmed(query) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}`;
  const response = await fetch(url);
  // ... return results
}
```

## What Connects to What

### Your Custom MCP Server Code

**File:** `mcp-server/index.js`

**What it imports:**
```javascript
// MCP SDK - Protocol implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// HTTP client - To call NCBI
import fetch from 'node-fetch';
```

**What it connects to:**
- Claude Desktop (via stdio/MCP protocol)
- NCBI E-utilities API (via HTTPS)

**What it does NOT connect to:**
- No other MCP servers
- No intermediary services
- Just Claude ↔ Your Server ↔ NCBI

## The MCP Protocol

MCP is just a communication standard. Think of it like:

```
Claude Desktop speaks MCP
     ↕️
Your server speaks MCP (using SDK)
     ↕️
NCBI API speaks HTTP/JSON
```

Your server is a **translator**:
- Takes MCP requests from Claude
- Makes HTTP requests to NCBI
- Returns MCP responses to Claude

## Key Files

### 1. MCP Server ([mcp-server/index.js](mcp-server/index.js))
- Lines 8-13: Import MCP SDK
- Lines 34-44: Create MCP Server instance
- Lines 51-138: Define tools (what Claude can use)
- Lines 189-700+: Implement tools (what they actually do)

### 2. Claude Desktop Config
**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**What it does:** Tells Claude Desktop to run your server

### 3. Package Dependencies ([mcp-server/package.json](mcp-server/package.json))
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",  // MCP protocol
    "node-fetch": "^3.3.2"                  // HTTP client
  }
}
```

## How to Change Data Sources

### Currently: NCBI GEO
```javascript
const ftpBase = `https://ftp.ncbi.nlm.nih.gov/geo/series/...`;
```

### Want to add PubMed?
```javascript
// Add to your existing server
async searchPubmed(query) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}`;
  // ... implement
}
```

### Want to add UniProt?
```javascript
async searchProteins(query) {
  const url = `https://rest.uniprot.org/uniprotkb/search?query=${query}`;
  // ... implement
}
```

### Want a completely different MCP server?

**Option A:** Use someone else's pre-built server
```json
{
  "mcpServers": {
    "your-geo": {
      "command": "node",
      "args": ["/path/to/mcp-server/index.js"]
    },
    "someone-elses-weather": {
      "command": "npx",
      "args": ["-y", "@some-org/weather-mcp"]
    }
  }
}
```

**Option B:** Build your own (like you did for GEO)
- Copy `mcp-server/` folder
- Modify the tools
- Change the API endpoints
- Add to Claude config

## Available MCP Servers

You can find pre-built MCP servers at:
- https://github.com/modelcontextprotocol/servers
- https://www.npmjs.com/search?q=%40modelcontextprotocol

Examples:
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-google-maps` - Maps/location
- `@modelcontextprotocol/server-github` - GitHub operations

## Summary

**Your setup:**
```
You → Claude Desktop → YOUR MCP Server → NCBI GEO API
```

**Not:**
```
You → Claude Desktop → "GEO MCP" → Something else
```

**Key insight:** You built the entire MCP server yourself. It's custom code that:
1. Speaks MCP protocol (via SDK)
2. Calls NCBI APIs
3. Provides tools to Claude

**To use a different MCP:** Either add more to your Claude config, or modify your server code to add more tools/APIs.

---

**Want to see how to add another MCP server?** Let me know which one and I can show you how to configure it!
