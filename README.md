# GEO Dataset Search & Analysis Tool

Search and analyze Gene Expression Omnibus (GEO) datasets using **Claude Desktop** or a **web interface**.

## 🚀 Quick Start

### Option 1: Claude Desktop (Recommended - No API Key Needed!)

**1. Configure Claude Desktop**

Edit config file:
```bash
# macOS
open ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Windows
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**2. Add this configuration:**
```json
{
  "mcpServers": {
    "geo-datasets": {
      "command": "node",
      "args": [
        "/Users/haeunyoo/BHI/Bioinfo_Data_Search_Tool/mcp-server/index.js"
      ]
    }
  }
}
```

**Update the path to your actual installation location!**

**3. Restart Claude Desktop**

Look for 🔌 icon in bottom right.

**4. Try it:**
```
Search for breast cancer RNA-seq datasets
Download GSE276326 and analyze it
How many drugs are in this dataset?
What is BRCA1 expression?
```

**[📖 Detailed Setup →](QUICK_START_CLAUDE_DESKTOP.md)**

---

### Option 2: Web Interface

**1. Install dependencies:**
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mcp-server && npm install
```

**2. Start servers:**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

**3. Open browser:**
```
http://localhost:5173
```

## ✨ Features

- 🔍 **Natural Language Search** - "Find breast cancer RNA-seq datasets"
- 📊 **Real-time Progress** - Visual download progress bars
- 📦 **Auto-Decompression** - Files ready immediately
- 🧬 **Gene Queries** - "What is BRCA1 expression?"
- 🧪 **Sample Analysis** - Extract treatments and drugs
- 💬 **Multi-threaded** - Separate conversation per dataset
- ⚡ **Fast** - NCBI API key included (10 req/s vs 3)

**[📖 Full Feature List →](FEATURES.md)**

## 📊 What You Can Ask

### Search
```
"Search for diabetes datasets"
"Find paclitaxel treatment studies"
```

### Download & Analyze
```
"Download GSE276326"
"Analyze this dataset"
"How many samples?"
```

### Complex Questions
```
"How many drugs are there?"
"What is BRCA1 expression?"
"Show sample characteristics"
"Compare treatments"
```

## 🏗️ Architecture

```
┌──────────────────┐
│  Claude Desktop  │  ← Ask questions in natural language
└────────┬─────────┘
         │ MCP Protocol
┌────────▼─────────┐
│   MCP Server     │  ← Handles GEO operations
│  (this tool)     │
└────────┬─────────┘
         │ HTTPS
┌────────▼─────────┐
│   NCBI GEO API   │  ← Public genomics data
└──────────────────┘
```

## 📁 Project Structure

```
Bioinfo_Data_Search_Tool/
├── mcp-server/              # Claude Desktop integration
│   ├── index.js
│   └── package.json
├── backend/                 # Web backend
│   ├── server.js           # Express + WebSocket
│   ├── geo-client.js       # NCBI API client
│   ├── data-downloader.js  # Downloads with progress
│   ├── data-parser.js      # Parse GEO files
│   └── data/               # Downloaded datasets
├── frontend/                # Web UI
│   └── src/
│       ├── App.jsx
│       └── components/
└── docs/
    ├── README.md (this file)
    ├── QUICK_START_CLAUDE_DESKTOP.md
    ├── FEATURES.md
    ├── TESTING_GUIDE.md
    └── NCBI_API_KEY_INFO.md
```

## 🆚 Claude Desktop vs Web Interface

| Feature | Claude Desktop | Web Interface |
|---------|---------------|---------------|
| **Setup Time** | 2 minutes | 5 minutes |
| **API Key** | Not needed | Optional |
| **Progress Bars** | No | Yes |
| **AI Analysis** | Full Claude reasoning | Basic (or needs API key) |
| **Best For** | Quick analysis | Visual tracking |

**Recommendation:** Start with Claude Desktop, add Web Interface if you want visual progress bars.

## ⚡ Performance

Your NCBI API key is integrated, giving you:
- ✅ **10 requests/second** (vs 3 without)
- ✅ No rate limiting
- ✅ Completely free

**[📖 API Key Details →](NCBI_API_KEY_INFO.md)**

## 📚 Documentation

- **[QUICK_START_CLAUDE_DESKTOP.md](QUICK_START_CLAUDE_DESKTOP.md)** - Claude Desktop setup guide
- **[FEATURES.md](FEATURES.md)** - Complete feature list with examples
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - How to test everything
- **[NCBI_API_KEY_INFO.md](NCBI_API_KEY_INFO.md)** - API key information

## 💡 Example Workflow

```
You: Search for diabetes RNA-seq datasets

Claude: [Shows 10 datasets with descriptions]

You: Download GSE123456

Claude: Downloaded and decompressed:
        - series_matrix.txt (245 KB)
        - family.soft (890 KB)

You: How many drugs are there?

Claude: Based on sample characteristics:
        - 2 unique drugs (Metformin, Placebo)
        - 48 drug-sample pairs

You: What is INS expression?

Claude: INS gene expression:
        - Mean: 12.3
        - Metformin samples: 13.2 (higher)
        - Placebo samples: 11.4 (lower)
```

## 🐛 Troubleshooting

### Claude Desktop not connecting?
- Check config file path is absolute (starts with `/`)
- Verify `node` is installed: `node --version`
- Restart Claude Desktop completely
- Look for 🔌 icon

### Web interface not working?
- Ensure both servers are running
- Check ports 3001 and 5173 are free
- Look for errors in terminal

### Downloads failing?
- Check internet connection
- Try a different dataset
- Some datasets are very large (>1GB)

## 📊 Data Storage

Both interfaces share the same storage:

```
backend/data/
  └── GSE123456/
      ├── series_matrix.txt.gz    (original)
      ├── series_matrix.txt        (decompressed)
      ├── family.soft.gz
      └── family.soft
```

Downloads persist between sessions!

## 🎓 Requirements

- Node.js 18+ and npm
- Internet connection
- Claude Desktop app (for Option 1)

## 🔐 Privacy

- All processing happens locally
- Downloads from NCBI (public data)
- Claude Desktop/API only if used
- No credentials needed for GEO access

## 📄 License

MIT License - Use freely for research

---

**Ready to start?**

👉 **[Claude Desktop Setup (2 minutes)](QUICK_START_CLAUDE_DESKTOP.md)**

👉 **Web Interface:** Follow [Option 2](#option-2-web-interface) above

Happy researching! 🧬
