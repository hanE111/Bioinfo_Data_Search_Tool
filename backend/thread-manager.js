/**
 * Thread Management System
 * Each thread represents a conversation about a specific dataset or general search
 */

class ThreadManager {
  constructor() {
    this.threads = new Map();
    this.createDefaultThread();
  }

  createDefaultThread() {
    const defaultThread = {
      id: 'general',
      title: 'General Search',
      type: 'general',
      datasetId: null,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.threads.set('general', defaultThread);
  }

  createThread(datasetId, datasetInfo, downloadStatus = null) {
    const threadId = `dataset-${datasetId}`;

    // Check if thread already exists
    if (this.threads.has(threadId)) {
      return this.threads.get(threadId);
    }

    let initialMessage = `I've created a dedicated thread for **${datasetId}**. `;

    if (downloadStatus?.downloading) {
      initialMessage += `\n\n📥 **Downloading dataset files...**\n\nThis may take a moment. I'll let you know when the data is ready for analysis.`;
    } else if (downloadStatus?.success) {
      initialMessage += `\n\n✅ **Dataset downloaded successfully!**\n\n`;
      initialMessage += `**Dataset Information:**\n`;
      initialMessage += `${datasetInfo.title ? `- **Title:** ${datasetInfo.title}\n` : ''}`;
      initialMessage += `${datasetInfo.organism ? `- **Organism:** ${datasetInfo.organism}\n` : ''}`;
      initialMessage += `${datasetInfo.sampleCount ? `- **Samples:** ${datasetInfo.sampleCount}\n` : ''}`;
      initialMessage += `${datasetInfo.dataType ? `- **Data Type:** ${datasetInfo.dataType}\n` : ''}`;

      if (downloadStatus.files && downloadStatus.files.length > 0) {
        initialMessage += `\n**Downloaded & Decompressed Files:**\n`;
        downloadStatus.files.forEach(file => {
          initialMessage += `- **${file.name}** (${file.sizeKB} KB)\n`;
          if (file.decompressed) {
            const decompressedName = file.decompressed.split('/').pop();
            initialMessage += `  ✓ Decompressed: ${decompressedName} (${file.decompressedSizeKB} KB)\n`;
          }
        });
      }

      initialMessage += `\n💡 You can now ask questions about the data, request analysis, or explore specific aspects of this dataset!`;
    } else {
      initialMessage += `\n\n**Dataset Information:**\n`;
      initialMessage += `${datasetInfo.title ? `- **Title:** ${datasetInfo.title}\n` : ''}`;
      initialMessage += `${datasetInfo.organism ? `- **Organism:** ${datasetInfo.organism}\n` : ''}`;
      initialMessage += `${datasetInfo.sampleCount ? `- **Samples:** ${datasetInfo.sampleCount}\n` : ''}`;
      initialMessage += `${datasetInfo.dataType ? `- **Data Type:** ${datasetInfo.dataType}\n` : ''}`;
      initialMessage += `\nWhat would you like to know about this dataset?`;
    }

    const thread = {
      id: threadId,
      title: datasetInfo.title || datasetId,
      type: 'dataset',
      datasetId: datasetId,
      datasetInfo: datasetInfo,
      downloadStatus: downloadStatus,
      messages: [
        {
          id: Date.now(),
          role: 'assistant',
          content: initialMessage,
          timestamp: new Date()
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.threads.set(threadId, thread);
    return thread;
  }

  updateThreadDownloadStatus(threadId, downloadStatus) {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.downloadStatus = downloadStatus;
      thread.updatedAt = new Date();

      // Add a message about download completion
      if (downloadStatus.success) {
        thread.messages.push({
          id: Date.now(),
          role: 'assistant',
          content: `✅ **Download complete!**\n\nI've successfully downloaded ${downloadStatus.files?.length || 0} file(s) for ${thread.datasetId}.\n\nYou can now ask me to analyze the data, show statistics, or answer specific questions about the dataset!`,
          timestamp: new Date()
        });
      } else if (downloadStatus.error) {
        thread.messages.push({
          id: Date.now(),
          role: 'assistant',
          content: `⚠️ **Download encountered issues:**\n\n${downloadStatus.errors?.join('\n') || downloadStatus.error}\n\nI can still answer questions based on the metadata, but detailed data analysis may be limited.`,
          timestamp: new Date()
        });
      }
    }
    return thread;
  }

  getThread(threadId) {
    return this.threads.get(threadId);
  }

  getAllThreads() {
    return Array.from(this.threads.values()).sort((a, b) =>
      b.updatedAt - a.updatedAt
    );
  }

  addMessage(threadId, message) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    thread.messages.push({
      ...message,
      id: Date.now(),
      timestamp: new Date()
    });
    thread.updatedAt = new Date();

    return thread;
  }

  deleteThread(threadId) {
    if (threadId === 'general') {
      throw new Error('Cannot delete the general thread');
    }
    return this.threads.delete(threadId);
  }

  clearThread(threadId) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    if (threadId === 'general') {
      thread.messages = [];
    } else {
      // Keep the initial dataset info message
      thread.messages = thread.messages.slice(0, 1);
    }

    thread.updatedAt = new Date();
    return thread;
  }
}

// Export singleton instance
export const threadManager = new ThreadManager();
