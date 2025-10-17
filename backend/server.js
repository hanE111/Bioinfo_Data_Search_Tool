import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { geoClient } from './geo-client.js';
import { processUserMessage } from './chat-processor.js';
import { threadManager } from './thread-manager.js';
import { dataDownloader } from './data-downloader.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}));
app.use(express.json());

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  ws.on('error', console.error);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  // Send welcome message
  ws.send(JSON.stringify({ type: 'connected', message: 'Connected to GEO server' }));
});

// Broadcast function for WebSocket
function broadcastProgress(datasetId, progress) {
  const message = JSON.stringify({
    type: 'download-progress',
    datasetId,
    progress
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Initialize GEO client on startup
geoClient.connect().catch(console.error);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'GEO Dataset Chatbot API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      chat: 'POST /api/chat',
      search: 'POST /api/search',
      dataset: 'GET /api/dataset/:id',
      analyze: 'POST /api/analyze/:id'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mcpConnected: geoClient.isConnected });
});

// Get all threads
app.get('/api/threads', (req, res) => {
  try {
    const threads = threadManager.getAllThreads();
    res.json({ threads });
  } catch (error) {
    console.error('Error getting threads:', error);
    res.status(500).json({
      error: 'Failed to get threads',
      details: error.message,
    });
  }
});

// Get specific thread
app.get('/api/threads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const thread = threadManager.getThread(id);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json({ thread });
  } catch (error) {
    console.error('Error getting thread:', error);
    res.status(500).json({
      error: 'Failed to get thread',
      details: error.message,
    });
  }
});

// Create new dataset thread
app.post('/api/threads', async (req, res) => {
  try {
    const { datasetId } = req.body;

    if (!datasetId) {
      return res.status(400).json({ error: 'Dataset ID is required' });
    }

    // Fetch dataset details
    const details = await geoClient.getDatasetDetails(datasetId);

    // Create thread with "downloading" status
    const thread = threadManager.createThread(datasetId, details.details, { downloading: true });

    // Send initial response
    res.json({ thread });

    // Start download in background
    (async () => {
      try {
        console.log(`Starting download for ${datasetId}...`);

        // Register progress callback
        dataDownloader.onProgress(datasetId, (progress) => {
          broadcastProgress(datasetId, progress);
        });

        const downloadResult = await dataDownloader.downloadDataset(datasetId);

        // Update thread with download status
        const threadId = `dataset-${datasetId}`;
        threadManager.updateThreadDownloadStatus(threadId, downloadResult);

        // Remove progress callback
        dataDownloader.removeProgressCallback(datasetId);

        console.log(`Download complete for ${datasetId}`);
      } catch (error) {
        console.error(`Download error for ${datasetId}:`, error);
        const threadId = `dataset-${datasetId}`;
        threadManager.updateThreadDownloadStatus(threadId, {
          success: false,
          error: error.message
        });
        dataDownloader.removeProgressCallback(datasetId);
      }
    })();

  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({
      error: 'Failed to create thread',
      details: error.message,
    });
  }
});

// Delete thread
app.delete('/api/threads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = threadManager.deleteThread(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({
      error: 'Failed to delete thread',
      details: error.message,
    });
  }
});

// Chat endpoint - main interface for the chatbot
app.post('/api/chat', async (req, res) => {
  try {
    const { message, threadId = 'general' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get thread
    let thread = threadManager.getThread(threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Add user message to thread
    threadManager.addMessage(threadId, {
      role: 'user',
      content: message
    });

    // Get conversation history from thread
    const conversationHistory = thread.messages;

    // Process the user's message with thread context
    const response = await processUserMessage(
      message,
      conversationHistory,
      thread.datasetId
    );

    // Add assistant response to thread
    threadManager.addMessage(threadId, {
      role: 'assistant',
      content: response.message,
      metadata: response
    });

    // Get updated thread
    thread = threadManager.getThread(threadId);

    res.json({
      ...response,
      thread: thread
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: 'Failed to process message',
      details: error.message,
    });
  }
});

// Search datasets endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await geoClient.searchDatasets(query);
    res.json(results);
  } catch (error) {
    console.error('Error searching datasets:', error);
    res.status(500).json({
      error: 'Failed to search datasets',
      details: error.message,
    });
  }
});

// Get dataset details
app.get('/api/dataset/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const details = await geoClient.getDatasetDetails(id);
    res.json(details);
  } catch (error) {
    console.error('Error fetching dataset details:', error);
    res.status(500).json({
      error: 'Failed to fetch dataset details',
      details: error.message,
    });
  }
});

// Analyze dataset (download and analyze)
app.post('/api/analyze/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = await geoClient.analyzeDataset(id);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing dataset:', error);
    res.status(500).json({
      error: 'Failed to analyze dataset',
      details: error.message,
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing GEO client...');
  await geoClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing GEO client...');
  await geoClient.disconnect();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`\n🚀 GEO Dataset Chatbot Backend running on port ${PORT}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`   WebSocket server ready for real-time updates\n`);
});
