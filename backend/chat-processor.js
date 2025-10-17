import { dataDownloader } from './data-downloader.js';
import { geoClient } from './geo-client.js';
import { advancedAnalyzer } from './advanced-analyzer.js';

/**
 * Process user messages and determine intent
 * This simulates an LLM by using keyword matching and pattern recognition
 */
export async function processUserMessage(message, conversationHistory = [], datasetId = null) {
  const lowerMessage = message.toLowerCase();

  // If we have a dataset context, handle dataset-specific queries
  if (datasetId) {
    return await handleDatasetContextMessage(message, datasetId, conversationHistory);
  }

  // Determine intent
  const intent = determineIntent(lowerMessage, conversationHistory);

  switch (intent.type) {
    case 'search':
      return await handleSearchIntent(message, intent);

    case 'analyze':
      return await handleAnalyzeIntent(message, intent);

    case 'details':
      return await handleDetailsIntent(message, intent);

    case 'greeting':
      return handleGreeting();

    case 'help':
      return handleHelp();

    default:
      return await handleGeneralQuery(message);
  }
}

// Handle messages in dataset-specific context
async function handleDatasetContextMessage(message, datasetId, history) {
  const lowerMessage = message.toLowerCase();

  // Check for analysis/download requests
  if (lowerMessage.match(/\b(analyze|analysis|download|data files|raw data)\b/i)) {
    try {
      const analysis = await geoClient.analyzeDataset(datasetId);
      const details = parseDatasetDetails(analysis);

      let response = `## Analysis of ${datasetId}\n\n`;
      response += formatAnalysisResponse(details, datasetId);

      return {
        type: 'analysis',
        message: response,
        datasetId: datasetId,
        details: details
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Error analyzing ${datasetId}: ${error.message}`
      };
    }
  }

  // Check for specific info requests
  if (lowerMessage.match(/\b(sample|organism|platform|drug|treatment|type)\b/i)) {
    try {
      const result = await geoClient.getDatasetDetails(datasetId);
      const details = parseDatasetDetails(result);

      let response = '';

      if (lowerMessage.includes('sample')) {
        response = `${datasetId} contains **${details.sampleCount || 'unknown number of'} samples**.`;
      } else if (lowerMessage.includes('organism')) {
        response = `${datasetId} studies **${details.organism || 'unknown organism'}**.`;
      } else if (lowerMessage.includes('platform')) {
        response = `${datasetId} uses the **${details.platform || 'unknown'} platform**.`;
      } else if (lowerMessage.match(/drug|treatment/i)) {
        response = `${datasetId} drug/treatment: **${details.drugTreatment || 'Not specified'}**.`;
      } else if (lowerMessage.match(/type|data type/i)) {
        response = `${datasetId} is a **${details.dataType || 'unknown'} dataset**.`;
      } else {
        response = formatDetailsResponse(details, datasetId);
      }

      return {
        type: 'details',
        message: response,
        datasetId: datasetId,
        details: details
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Error getting details for ${datasetId}: ${error.message}`
      };
    }
  }

  // Default: provide context-aware response
  try {
    const result = await geoClient.getDatasetDetails(datasetId);
    const details = parseDatasetDetails(result);

    const response = `I'm here to help with **${datasetId}**. You can ask me about:

- Sample information
- Organism details
- Platform and technology
- Drug/treatment information
- Data download and analysis

What would you like to know?`;

    return {
      type: 'info',
      message: response,
      datasetId: datasetId,
      details: details
    };
  } catch (error) {
    return {
      type: 'error',
      message: `Error: ${error.message}`
    };
  }
}

function determineIntent(message, history) {
  // Extract GEO IDs if present
  const geoIdMatch = message.match(/(?:GSE|GDS|GPL|GSM)(\d+)/i);
  const geoId = geoIdMatch ? geoIdMatch[0] : null;

  // Check for analysis requests
  if (message.match(/\b(analyz|download|detail|more about|tell me more|information about)\b/i)) {
    if (geoId) {
      return { type: 'analyze', geoId };
    }
    // Check if previous message mentioned a dataset
    const lastDataset = findLastMentionedDataset(history);
    if (lastDataset) {
      return { type: 'analyze', geoId: lastDataset };
    }
  }

  // Check for detail requests
  if (message.match(/\b(what is|explain|describe|summary|tell me about|about)\b/i) && geoId) {
    return { type: 'details', geoId };
  }

  // Check for greetings
  if (message.match(/\b(hello|hi|hey|greetings)\b/i)) {
    return { type: 'greeting' };
  }

  // Check for help requests
  if (message.match(/\b(help|how|what can you)\b/i)) {
    return { type: 'help' };
  }

  // Default to search
  return { type: 'search', query: message };
}

function findLastMentionedDataset(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const match = msg.content?.match(/(?:GSE|GDS|GPL|GSM)(\d+)/i);
    if (match) {
      return match[0];
    }
  }
  return null;
}

async function handleSearchIntent(message, intent) {
  try {
    const results = await geoClient.searchDatasets(intent.query || message);

    // Parse the response
    const datasets = parseSearchResults(results);

    // Create a conversational response
    const response = formatSearchResponse(datasets, message);

    return {
      type: 'search',
      message: response,
      datasets: datasets,
    };
  } catch (error) {
    return {
      type: 'error',
      message: `I encountered an error while searching for datasets: ${error.message}. Please try rephrasing your query.`,
    };
  }
}

async function handleAnalyzeIntent(message, intent) {
  if (!intent.geoId) {
    return {
      type: 'error',
      message: 'Please specify a GEO dataset ID (e.g., GSE12345) to analyze.',
    };
  }

  try {
    const analysis = await geoClient.analyzeDataset(intent.geoId);
    const details = parseDatasetDetails(analysis.details);

    const response = formatAnalysisResponse(details, intent.geoId);

    return {
      type: 'analysis',
      message: response,
      datasetId: intent.geoId,
      details: details,
      downloadPath: analysis.downloadPath,
    };
  } catch (error) {
    return {
      type: 'error',
      message: `I couldn't analyze dataset ${intent.geoId}. Error: ${error.message}`,
    };
  }
}

async function handleDetailsIntent(message, intent) {
  if (!intent.geoId) {
    return {
      type: 'error',
      message: 'Please specify a GEO dataset ID to get details.',
    };
  }

  try {
    const result = await geoClient.getDatasetDetails(intent.geoId);
    const details = parseDatasetDetails(result);

    const response = formatDetailsResponse(details, intent.geoId);

    return {
      type: 'details',
      message: response,
      datasetId: intent.geoId,
      details: details,
    };
  } catch (error) {
    return {
      type: 'error',
      message: `I couldn't fetch details for ${intent.geoId}. Error: ${error.message}`,
    };
  }
}

function handleGreeting() {
  return {
    type: 'greeting',
    message: `Hello! I'm your GEO dataset search assistant. I can help you find and analyze genomic datasets from the Gene Expression Omnibus (GEO) database.

You can:
- Describe the type of data you're looking for (e.g., "breast cancer RNA-seq data")
- Ask about specific datasets (e.g., "tell me about GSE12345")
- Request detailed analysis of datasets

What would you like to search for today?`,
  };
}

function handleHelp() {
  return {
    type: 'help',
    message: `I can help you search and analyze GEO datasets. Here's what you can do:

**Search for datasets:**
- "Find RNA-seq data for breast cancer"
- "Show me microarray studies about diabetes"
- "I need ChIP-seq data for p53"

**Get dataset details:**
- "Tell me about GSE12345"
- "What is GSE67890?"

**Analyze datasets:**
- "Analyze GSE12345"
- "Download and analyze the dataset"

Just describe what you're looking for in natural language, and I'll help you find the most suitable datasets!`,
  };
}

async function handleGeneralQuery(message) {
  // Try to extract meaningful search terms
  return await handleSearchIntent(message, { query: message });
}

// Helper functions to parse API responses

function parseSearchResults(apiResponse) {
  try {
    // API response contains datasets array directly
    if (apiResponse.datasets && Array.isArray(apiResponse.datasets)) {
      return apiResponse.datasets.map(ds => ({
        id: ds.id,
        title: ds.title,
        description: `${ds.title} - ${ds.organism} (${ds.samples} samples)`,
        organism: ds.organism,
        samples: ds.samples,
        type: ds.type
      }));
    }

    return [];
  } catch (error) {
    console.error('Error parsing search results:', error);
    return [];
  }
}

function parseDatasetDetails(apiResponse) {
  try {
    // API response contains details directly
    if (apiResponse.details) {
      return apiResponse.details;
    }

    const content = apiResponse.content || [];
    const textContent = content.find(c => c.type === 'text');

    if (!textContent) {
      return { raw: 'No details available' };
    }

    const text = textContent.text;

    // Extract key information
    const details = {
      raw: text,
      title: extractField(text, 'title'),
      summary: extractField(text, 'summary') || extractField(text, 'description'),
      organism: extractField(text, 'organism'),
      platform: extractField(text, 'platform'),
      sampleCount: extractSampleCount(text),
      drugTreatment: extractDrugs(text),
      dataType: extractDataType(text),
      publicationDate: extractField(text, 'date') || extractField(text, 'submission'),
    };

    return details;
  } catch (error) {
    console.error('Error parsing dataset details:', error);
    return { raw: mcpResponse.toString() };
  }
}

function extractField(text, fieldName) {
  const regex = new RegExp(`${fieldName}[:\\s]+([^\\n]+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractSampleCount(text) {
  const match = text.match(/(\d+)\s+samples?/i);
  return match ? parseInt(match[1]) : null;
}

function extractDrugs(text) {
  const drugKeywords = ['drug', 'treatment', 'compound', 'inhibitor', 'therapy'];
  const drugs = [];

  for (const keyword of drugKeywords) {
    const regex = new RegExp(`${keyword}[:\\s]+([^\\n\\.]+)`, 'i');
    const match = text.match(regex);
    if (match) {
      drugs.push(match[1].trim());
    }
  }

  return drugs.length > 0 ? drugs.join('; ') : 'No drug treatment mentioned';
}

function extractDataType(text) {
  const types = ['RNA-seq', 'microarray', 'ChIP-seq', 'ATAC-seq', 'scRNA-seq', 'methylation'];

  for (const type of types) {
    if (text.toLowerCase().includes(type.toLowerCase())) {
      return type;
    }
  }

  return 'Unknown';
}

// Response formatters

function formatSearchResponse(datasets, query) {
  if (datasets.length === 0) {
    return `I couldn't find any datasets matching "${query}". Try rephrasing your search or using different keywords.`;
  }

  let response = `I found ${datasets.length} dataset${datasets.length > 1 ? 's' : ''} matching your query:\n\n`;

  datasets.forEach((dataset, index) => {
    response += `**${index + 1}. ${dataset.id}**\n${dataset.description}\n\n`;
  });

  response += `\nWould you like detailed information about any of these datasets? Just ask me about a specific ID (e.g., "tell me more about ${datasets[0].id}").`;

  return response;
}

function formatDetailsResponse(details, geoId) {
  let response = `## ${geoId}\n\n`;

  if (details.title) {
    response += `**Title:** ${details.title}\n\n`;
  }

  if (details.summary) {
    response += `**Summary:** ${details.summary}\n\n`;
  }

  response += `**Key Characteristics:**\n`;

  if (details.organism) {
    response += `- **Organism:** ${details.organism}\n`;
  }

  if (details.dataType) {
    response += `- **Data Type:** ${details.dataType}\n`;
  }

  if (details.platform) {
    response += `- **Platform:** ${details.platform}\n`;
  }

  if (details.sampleCount) {
    response += `- **Sample Count:** ${details.sampleCount}\n`;
  }

  if (details.drugTreatment) {
    response += `- **Drug/Treatment:** ${details.drugTreatment}\n`;
  }

  if (details.publicationDate) {
    response += `- **Publication Date:** ${details.publicationDate}\n`;
  }

  response += `\nWould you like me to download and analyze this dataset in detail? Just say "analyze ${geoId}".`;

  return response;
}

function formatAnalysisResponse(details, geoId) {
  let response = `I've downloaded and analyzed dataset ${geoId}. Here's a detailed breakdown:\n\n`;

  response += `## ${details.title || geoId}\n\n`;

  response += `### Dataset Overview\n`;
  if (details.summary) {
    response += `${details.summary}\n\n`;
  }

  response += `### Detailed Characteristics\n\n`;

  if (details.organism) {
    response += `**Organism:** ${details.organism}\n\n`;
  }

  if (details.dataType) {
    response += `**Data Type:** ${details.dataType}\n`;
    response += `This determines the kind of analysis you can perform on this dataset.\n\n`;
  }

  if (details.platform) {
    response += `**Platform/Technology:** ${details.platform}\n\n`;
  }

  if (details.sampleCount) {
    response += `**Sample Size:** ${details.sampleCount} samples\n`;
    response += `A ${details.sampleCount > 10 ? 'robust' : 'small'} sample size ${details.sampleCount > 10 ? 'suitable for statistical analysis' : 'that may require careful interpretation'}.\n\n`;
  }

  if (details.drugTreatment) {
    response += `**Drug/Treatment Information:** ${details.drugTreatment}\n\n`;
  }

  response += `### Data Files\n`;
  response += `The dataset has been downloaded and is ready for analysis. The data includes expression matrices, sample metadata, and platform annotations.\n\n`;

  response += `Would you like me to explain any specific aspect of this dataset?`;

  return response;
}

// Import advanced handler
import { handleDatasetContextMessage as handleDatasetContextMessageAdvanced } from './chat-processor-advanced.js';

// Override the basic handler with advanced version
// This provides full gene queries, statistics, and data analysis
export { handleDatasetContextMessageAdvanced as handleDatasetContextMessage };
