# Quick Start - Claude Desktop Integration

## 🚀 Setup in 3 Steps

### Step 1: Open Claude Desktop Config

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Or:** Claude Desktop → Settings → Developer → Edit Config

### Step 2: Add This Configuration

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

**Important:** Update the path if your project is in a different location!

### Step 3: Restart Claude Desktop

Quit and reopen Claude Desktop. Look for the 🔌 icon in the bottom right.

## ✅ Test It Immediately

Copy and paste this into Claude Desktop:

```
Search for breast cancer RNA-seq datasets using the GEO tools
```

Claude will use the MCP server to search NCBI GEO and show you results!

## 🎯 What You Can Ask

### Search for Datasets
```
Search for diabetes RNA-seq datasets
Search for paclitaxel breast cancer
Find datasets about BRCA1
```

### Download & Analyze
```
Download GSE276326 and analyze it
Get details about GSE123456
Download GSE276326 then tell me about the samples
```

### Ask Questions About Data
```
How many drugs are in GSE276326?
What is BRCA1 expression in GSE276326?
Show me sample characteristics for GSE276326
How many samples are there?
What treatments were used?
```

### Complex Analysis
```
Download GSE276326, analyze it, then tell me:
1. How many unique drugs are there?
2. How many drug-sample pairs?
3. What is the expression of TP53 across all samples?
4. Summarize the experimental design
```

## 🎬 Complete Example Workflow

**You:** "Search for breast cancer paclitaxel datasets"

**Claude:** *Uses search tool, shows results*

**You:** "Download GSE276326"

**Claude:** *Downloads and decompresses files*

**You:** "How many drugs are there?"

**Claude:** *Analyzes the dataset and tells you the drug count*

**You:** "What is BRCA1 expression?"

**Claude:** *Queries gene expression and shows values*

## 🔧 Available Tools

Claude has access to these tools:

- `search_geo_datasets` - Search NCBI GEO
- `get_dataset_details` - Get dataset info
- `download_dataset` - Download files
- `analyze_dataset` - Parse and analyze
- `query_gene_expression` - Get gene values
- `get_sample_characteristics` - Get metadata

**You don't need to call them directly** - just ask Claude in natural language!

## 💡 Pro Tips

1. **Download once, query many times** - Downloaded data persists
2. **Be specific** - Use dataset IDs like "GSE123456"
3. **Ask follow-ups** - Claude remembers the context
4. **Natural language** - No need to memorize commands

## ❌ Troubleshooting

### No 🔌 icon?
- Check the config file path is correct
- Make sure it's an absolute path (starts with `/`)
- Restart Claude Desktop

### "Tool not available" error?
- Verify `node` is installed: `node --version`
- Check the path in config file
- Look at logs: Settings → Developer → View Logs

### Can't download datasets?
- Check internet connection
- Try a different dataset ID
- Some datasets might be very large

## 📊 File Storage

Data downloads to:
```
backend/data/GSE123456/
  ├── series_matrix.txt
  └── family.soft
```

Files persist, so you won't re-download!

## 🆚 Claude Desktop vs Web Interface

### Use Claude Desktop for:
- ✅ Complex questions and reasoning
- ✅ Natural language queries
- ✅ No API key needed
- ✅ Persistent conversation context

### Use Web Interface for:
- ✅ Visual progress bars
- ✅ Browsing multiple datasets
- ✅ Thread management
- ✅ Real-time download tracking

**Both share the same data directory!**

## 🎉 You're Ready!

Open Claude Desktop and try:
```
Search for your favorite gene or disease in GEO datasets
```

Have fun exploring genomic data! 🧬
