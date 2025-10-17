import { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import Header from './components/Header';
import ThreadSidebar from './components/ThreadSidebar';
import DownloadProgress from './components/DownloadProgress';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

function App() {
  const [threads, setThreads] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState('general');
  const [currentThread, setCurrentThread] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState({});
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentThread?.messages]);

  // Setup WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'download-progress') {
            setDownloadProgress(prev => ({
              ...prev,
              [data.datasetId]: data.progress
            }));

            // Clear progress when complete
            if (data.progress.stage === 'complete') {
              setTimeout(() => {
                setDownloadProgress(prev => {
                  const updated = { ...prev };
                  delete updated[data.datasetId];
                  return updated;
                });
                // Reload thread to show updated status
                loadThread(currentThreadId);
              }, 3000);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Load threads on mount
  useEffect(() => {
    loadThreads();
    checkServerHealth();
  }, []);

  // Load current thread when ID changes
  useEffect(() => {
    if (currentThreadId) {
      loadThread(currentThreadId);
    }
  }, [currentThreadId]);

  const checkServerHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      const data = await res.json();
      setServerStatus(data.mcpConnected ? 'connected' : 'disconnected');
    } catch {
      setServerStatus('error');
    }
  };

  const loadThreads = async () => {
    try {
      const response = await fetch(`${API_URL}/api/threads`);
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error('Error loading threads:', error);
    }
  };

  const loadThread = async (threadId) => {
    try {
      const response = await fetch(`${API_URL}/api/threads/${threadId}`);
      const data = await response.json();
      setCurrentThread(data.thread);
    } catch (error) {
      console.error('Error loading thread:', error);
    }
  };

  const createDatasetThread = async (datasetId) => {
    try {
      const response = await fetch(`${API_URL}/api/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId }),
      });

      const data = await response.json();
      const newThread = data.thread;

      // Add to threads list
      setThreads(prev => [newThread, ...prev.filter(t => t.id !== newThread.id)]);

      // Switch to new thread
      setCurrentThreadId(newThread.id);

      return newThread;
    } catch (error) {
      console.error('Error creating thread:', error);
      throw error;
    }
  };

  const deleteThread = async (threadId) => {
    try {
      await fetch(`${API_URL}/api/threads/${threadId}`, {
        method: 'DELETE',
      });

      // Remove from list
      setThreads(prev => prev.filter(t => t.id !== threadId));

      // Switch to general if current thread was deleted
      if (currentThreadId === threadId) {
        setCurrentThreadId('general');
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  const handleSendMessage = async (content) => {
    if (!content.trim()) return;

    setIsLoading(true);

    try {
      // Send to backend with thread context
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          threadId: currentThreadId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Update current thread with new messages
      setCurrentThread(data.thread);

      // Check if a dataset was mentioned and offer to create thread
      if (data.datasetId && currentThreadId === 'general' && data.type !== 'error') {
        // Extract dataset ID from response
        const match = data.message.match(/\b(GSE|GDS)\d+\b/);
        if (match) {
          const foundDatasetId = match[0];

          // Show option to create thread (we'll update UI for this later)
          // For now, automatically create thread if analyzing
          if (data.type === 'analysis' || data.type === 'details') {
            setTimeout(() => {
              if (window.confirm(`Create a dedicated thread for ${foundDatasetId}?`)) {
                createDatasetThread(foundDatasetId);
              }
            }, 500);
          }
        }
      }

      // Reload threads list
      await loadThreads();
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message to current thread
      const errorThread = { ...currentThread };
      errorThread.messages = [
        ...errorThread.messages,
        {
          id: Date.now(),
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please make sure the backend server is running and try again.',
          timestamp: new Date(),
          isError: true,
        },
      ];
      setCurrentThread(errorThread);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatasetClick = async (datasetId) => {
    // Check if thread already exists
    const existingThread = threads.find(t => t.datasetId === datasetId);

    if (existingThread) {
      setCurrentThreadId(existingThread.id);
    } else {
      await createDatasetThread(datasetId);
    }
  };

  return (
    <div className="app">
      <Header serverStatus={serverStatus} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="app-body">
        <ThreadSidebar
          threads={threads}
          currentThreadId={currentThreadId}
          onSelectThread={setCurrentThreadId}
          onDeleteThread={deleteThread}
          isOpen={sidebarOpen}
        />

        <div className="chat-container">
          <div className="messages">
            {currentThread?.messages.map(message => (
              <ChatMessage
                key={message.id}
                message={message}
                onDatasetClick={handleDatasetClick}
              />
            ))}

            {/* Show download progress for current thread's dataset */}
            {currentThread?.datasetId && downloadProgress[currentThread.datasetId] && (
              <DownloadProgress progress={downloadProgress[currentThread.datasetId]} />
            )}

            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}

export default App;
