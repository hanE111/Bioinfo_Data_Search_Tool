/**
 * Data Analyzer - Analyzes downloaded GEO dataset files
 */

import { dataDownloader } from './data-downloader.js';

export async function analyzeDownloadedData(datasetId) {
  try {
    // Check if data is downloaded
    const isDownloaded = await dataDownloader.isDownloaded(datasetId);

    if (!isDownloaded) {
      return {
        available: false,
        message: `Dataset ${datasetId} has not been downloaded yet. I can answer questions based on metadata from NCBI.`
      };
    }

    // Get data summary
    const summary = await dataDownloader.getDatasetSummary(datasetId);

    if (summary.status !== 'downloaded') {
      return {
        available: false,
        message: `Data files for ${datasetId} are not available. Status: ${summary.status}`
      };
    }

    // Build analysis response
    let response = `## Downloaded Data Analysis for ${datasetId}\n\n`;
    response += `**Location:** \`${summary.location}\`\n\n`;
    response += `**Total Size:** ${summary.totalSizeMB} MB\n\n`;
    response += `**Files Downloaded:**\n`;

    summary.files.forEach(file => {
      response += `- **${file.name}** (${file.sizeMB} MB)\n`;
    });

    if (summary.availableData && summary.availableData.length > 0) {
      response += `\n**Available Data Types:**\n`;
      summary.availableData.forEach(data => {
        response += `- **${data.type}:** ${data.description}\n`;
        response += `  File: \`${data.file}\` (${data.size})\n`;
      });
    }

    response += `\n### What you can do:\n`;
    response += `- Ask about file contents and structure\n`;
    response += `- Request statistics about samples\n`;
    response += `- Query specific data fields\n`;
    response += `- Get information about experimental conditions\n`;

    return {
      available: true,
      summary,
      response
    };

  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

export async function answerDataQuestion(datasetId, question) {
  const lowerQuestion = question.toLowerCase();

  // Check if data is available
  const analysis = await analyzeDownloadedData(datasetId);

  if (!analysis.available) {
    return analysis.message || `Data for ${datasetId} is not available locally.`;
  }

  // Answer based on downloaded data
  if (lowerQuestion.includes('file') || lowerQuestion.includes('download')) {
    let response = `**Downloaded Files for ${datasetId}:**\n\n`;
    analysis.summary.files.forEach(file => {
      response += `- **${file.name}**\n`;
      response += `  Size: ${file.sizeMB} MB (${file.sizeKB} KB)\n`;
      response += `  Modified: ${new Date(file.modified).toLocaleString()}\n\n`;
    });
    return response;
  }

  if (lowerQuestion.includes('size')) {
    return `The total size of downloaded files for ${datasetId} is **${analysis.summary.totalSizeMB} MB** across ${analysis.summary.files.length} file(s).`;
  }

  if (lowerQuestion.includes('location') || lowerQuestion.includes('where')) {
    return `The data files for ${datasetId} are stored at:\n\`${analysis.summary.location}\``;
  }

  if (lowerQuestion.includes('data type') || lowerQuestion.includes('what data')) {
    if (analysis.summary.availableData && analysis.summary.availableData.length > 0) {
      let response = `**Available Data Types:**\n\n`;
      analysis.summary.availableData.forEach(data => {
        response += `- **${data.type}:** ${data.description}\n`;
      });
      return response;
    }
  }

  // Default: show full analysis
  return analysis.response;
}
