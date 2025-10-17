# Testing Guide - New Features

## Setup for Testing

### 1. Set up Claude API (Optional but Recommended)

Create or update `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your Anthropic API key:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...your_key_here...
```

Get your API key from: https://console.anthropic.com/

**Note:** The app works without Claude, but complex questions will fall back to basic analysis.

### 2. Start Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm install  # if not already done
npm run dev
```

Look for:
```
✓ Claude API client initialized
🚀 GEO Dataset Chatbot Backend running on port 3001
   WebSocket server ready for real-time updates
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install  # if not already done
npm run dev
```

## Test 1: Download Progress Bar

### Steps:
1. Open the app in your browser (http://localhost:5173)
2. In the general thread, search: "Find breast cancer RNA-seq datasets"
3. Click on one of the dataset cards (e.g., "GSE276326")
4. Watch for the progress bar to appear

### Expected Results:
- ✅ Purple/gradient progress bar appears
- ✅ Shows "⬇️ Downloading" with file name
- ✅ Progress percentage increases (0% → 100%)
- ✅ Shows bytes downloaded (e.g., "45.2 KB / 150.3 KB")
- ✅ Switches to "📦 Decompressing" stage
- ✅ Shows "✅ Complete" when done
- ✅ Progress bar disappears after 3 seconds
- ✅ Thread message updates with file info

### Check Backend Console:
```
Starting download for GSE276326...
Downloading series_matrix.txt.gz for GSE276326...
✓ Downloaded series_matrix.txt.gz (2.8 KB)
Decompressing series_matrix.txt.gz...
✓ Decompressed to series_matrix.txt (15 KB)
```

## Test 2: Automatic Decompression

### Steps:
1. Create a new dataset thread (if not already from Test 1)
2. Wait for download to complete
3. Check the thread message for decompressed files

### Expected Results:
- ✅ Thread shows "Downloaded & Decompressed Files:"
- ✅ Lists both .gz files with original size
- ✅ Shows "✓ Decompressed:" with larger size
- ✅ Both compressed and decompressed files exist

### Verify Files:
```bash
ls -lh backend/data/GSE276326/
```

Should show:
```
series_matrix.txt.gz      2.8K
series_matrix.txt         15K
family.soft.gz            45K
family.soft               180K
```

## Test 3: Claude LLM Analysis

### Prerequisites:
- Claude API key configured in `.env`
- Dataset downloaded and decompressed

### Test 3a: Count Questions

**Question:** "How many drugs are there?"

### Expected Results:
- ✅ Backend logs: "🤖 Using Claude LLM for complex analysis..."
- ✅ Response includes specific drug count
- ✅ Lists the drug names
- ✅ Explains how it determined this from the data

### Test 3b: Drug-Sample Pairs

**Question:** "How many drug, sample pairs are there?"

### Expected Results:
- ✅ Claude analyzes the data
- ✅ Provides exact count of combinations
- ✅ May include a breakdown by drug
- ✅ Cites sample characteristics from the data

### Test 3c: Summary Question

**Question:** "Summarize what this dataset is about"

### Expected Results:
- ✅ Concise overview of the study
- ✅ Mentions key experimental factors
- ✅ Notes sample count and data type
- ✅ Highlights main research focus

### Test 3d: Complex Analysis

**Question:** "What patterns do you see in the treatments?"

### Expected Results:
- ✅ Claude identifies treatment groups
- ✅ Notes control vs experimental samples
- ✅ May mention dosage or timing patterns
- ✅ Provides biological context

## Test 4: Fallback Without Claude

### Steps:
1. Stop the backend
2. Remove or comment out `ANTHROPIC_API_KEY` in `.env`
3. Restart backend
4. Ask a complex question

### Expected Results:
- ✅ Backend logs: "⚠️  ANTHROPIC_API_KEY not set"
- ✅ Questions still get answered
- ✅ Falls back to standard analysis
- ✅ May be less detailed but still functional

## Test 5: Multiple Concurrent Downloads

### Steps:
1. Search for datasets
2. Quickly click 3 different dataset cards
3. Switch between the threads

### Expected Results:
- ✅ Each thread shows its own progress bar
- ✅ Downloads happen in parallel
- ✅ Progress updates independently
- ✅ No interference between threads

## Test 6: WebSocket Reconnection

### Steps:
1. Start a download
2. Stop the backend (Ctrl+C)
3. Wait a few seconds
4. Restart the backend
5. Start another download

### Expected Results:
- ✅ Browser console shows "WebSocket disconnected, reconnecting..."
- ✅ WebSocket reconnects automatically
- ✅ New downloads show progress normally
- ✅ No manual refresh needed

## Test 7: Standard Analysis Still Works

### Test Gene Query:
**Question:** "What is BRCA1 expression?"

### Expected Results:
- ✅ Shows expression values across samples
- ✅ Includes statistics (mean, min, max)
- ✅ Works without Claude

### Test Statistics:
**Question:** "Show statistics"

### Expected Results:
- ✅ Sample count
- ✅ Gene count
- ✅ Characteristic types
- ✅ Works without Claude

## Test 8: Complete Workflow

### End-to-End Test:

1. **Search:** "Find paclitaxel breast cancer datasets"
2. **Click:** Any dataset card
3. **Wait:** For download progress to complete
4. **Ask:** "How many samples are there?"
5. **Ask:** "What is TP53 expression?"
6. **Ask:** "How many drugs are there?" (if Claude enabled)
7. **Ask:** "Do a full analysis"

### Expected Flow:
- ✅ Search returns results
- ✅ Thread created automatically
- ✅ Progress bar shows download
- ✅ Decompression happens automatically
- ✅ All questions answered correctly
- ✅ Claude used for complex questions
- ✅ Full analysis comprehensive

## Troubleshooting Tests

### Progress Bar Not Showing?
- Check browser console for WebSocket errors
- Verify backend logs show "WebSocket client connected"
- Ensure no firewall blocking WebSocket

### Claude Not Working?
- Check `.env` has correct API key
- Verify key format: `sk-ant-api03-...`
- Look for backend log: "✓ Claude API client initialized"
- Check Anthropic console for API usage

### Files Not Decompressing?
- Check backend logs for decompression errors
- Verify disk space available
- Try smaller dataset first

### Downloads Timing Out?
- Check internet connection
- Try different dataset
- Some datasets are very large (>1GB)

## Performance Benchmarks

### Small Dataset (< 5 MB):
- Download: 2-5 seconds
- Decompression: < 1 second
- Claude analysis: 2-4 seconds
- Total: < 10 seconds

### Medium Dataset (5-50 MB):
- Download: 10-30 seconds
- Decompression: 1-3 seconds
- Claude analysis: 3-6 seconds
- Total: 15-40 seconds

### Large Dataset (> 50 MB):
- Download: 1-5 minutes
- Decompression: 5-15 seconds
- Claude analysis: 4-8 seconds
- Total: Variable by size

## Success Criteria

All tests passing means:
- ✅ Progress bars working in real-time
- ✅ Files decompressed automatically
- ✅ Claude answering complex questions
- ✅ Standard analysis still functional
- ✅ WebSocket reliable and reconnecting
- ✅ Multiple downloads working
- ✅ No errors in console
- ✅ Files stored correctly

## Quick Verification Commands

### Check running processes:
```bash
lsof -i :3001  # Backend
lsof -i :5173  # Frontend
```

### Check downloaded data:
```bash
ls -lh backend/data/*/
```

### Check backend logs:
Look for:
- ✓ Claude API client initialized
- WebSocket client connected
- 🤖 Using Claude LLM for complex analysis...
- ✓ Downloaded... ✓ Decompressed...

### Check frontend console:
Look for:
- WebSocket connected
- No CORS errors
- No 404 errors

## Example Test Session

```
1. Start backend ✓
2. Start frontend ✓
3. Search "breast cancer" ✓
4. Click GSE276326 ✓
5. See progress bar ✓
6. Ask "How many samples?" ✓
7. Ask "How many drugs?" ✓ (Claude)
8. Check files exist ✓
9. All tests passed ✓
```

## Reporting Issues

If tests fail, collect:
1. Browser console output
2. Backend terminal output
3. `ls -lh backend/data/*/` output
4. `.env` configuration (redact API key)
5. Node version (`node --version`)
6. Steps to reproduce

## Next Steps After Testing

Once all tests pass:
- Start using with real datasets
- Explore different question types
- Try complex Claude questions
- Share feedback on what works well
- Report any bugs or unexpected behavior

Happy testing! 🧪
