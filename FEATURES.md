# Complete Feature List

## 🔍 Search & Discovery

### Dataset Search
```
"Search for breast cancer RNA-seq datasets"
"Find diabetes treatment studies"
"Show me paclitaxel datasets"
```

**What you get:**
- Dataset ID (e.g., GSE123456)
- Title and description
- Organism (e.g., Homo sapiens)
- Number of samples
- Platform information

## 📥 Download & Processing

### Automatic Download
```
"Download GSE276326"
```

**Features:**
- Downloads from NCBI FTP
- Real-time progress bars (web only)
- Automatic .gz decompression
- Files stored locally
- Typical size: 100KB - 50MB

### Downloaded Files
- `series_matrix.txt` → Expression data
- `family.soft` → Sample metadata

## 📊 Data Analysis

### Full Analysis
```
"Analyze GSE276326"
```

**Provides:**
- Dataset summary
- Sample count
- Platform info
- Sample characteristics
- Treatment/drug info
- Gene count

### Sample Characteristics
```
"Show sample characteristics"
"What treatments were used?"
```

**Extracts:**
- Treatment types
- Drug names
- Cell types
- Tissue sources
- Disease states

### Drug Detection
```
"How many drugs are there?"
```

**Identifies:**
- Unique drugs used
- Treatment vs control
- Drug-sample pairs

## 🧬 Gene Expression

### Query Genes
```
"What is BRCA1 expression?"
"Show me TP53 levels"
```

**Returns:**
- Expression across samples
- Mean, min, max stats
- Per-sample values

## 💬 Interfaces

### Claude Desktop
- Natural language queries
- Context memory
- Biological insights
- No API key needed

### Web Interface
- Visual progress bars
- Thread management
- Click-based navigation
- Real-time updates

## ⚡ Performance

- **10 req/s** with NCBI API key (vs 3)
- Cached data for instant re-queries
- Streaming downloads
- Concurrent operations

## 📊 Supported Data

- Microarray data
- RNA-seq (normalized)
- Log2 transformed
- Sample metadata
- Series matrix format
- SOFT format

## 💡 Usage Tips

**Best practices:**
1. Download first, then analyze
2. Use uppercase gene names (BRCA1)
3. Be specific with dataset IDs
4. Ask follow-up questions

**Search tips:**
- Start broad, then filter
- Use NCBI search syntax
- Check publication dates
- Read descriptions

## 🆚 Comparison

| Feature | Claude Desktop | Web Interface |
|---------|----------------|---------------|
| Setup | 2 min | 5 min |
| API Key | Not needed | Optional |
| Progress | No visual | Progress bars |
| AI | Full Claude | Needs API key |
| Threading | Context | Sidebar |

---

**[Set up Claude Desktop →](QUICK_START_CLAUDE_DESKTOP.md)**

**[Start Web Interface →](README.md#option-2-web-interface)**
