/**
 * Advanced dataset context message handler
 * Replaces handleDatasetContextMessage with full data analysis capabilities
 */

import { advancedAnalyzer } from './advanced-analyzer.js';
import { answerDataQuestion } from './data-analyzer.js';
import { claudeAnalyzer } from './claude-analyzer.js';

export async function handleDatasetContextMessage(message, datasetId, history) {
  const lowerMessage = message.toLowerCase();

  // Check if this is a complex question that needs Claude
  if (claudeAnalyzer.isAvailable() && claudeAnalyzer.needsLLMAnalysis(message)) {
    console.log('🤖 Using Claude LLM for complex analysis...');
    try {
      const result = await claudeAnalyzer.processQuestion(message, datasetId);

      if (result.success) {
        return {
          type: 'claude-analysis',
          message: result.analysis,
          datasetId,
        };
      } else {
        console.warn('Claude analysis failed, falling back to standard analysis');
      }
    } catch (error) {
      console.error('Error in Claude analysis:', error);
      // Fall through to standard analysis
    }
  }

  // Gene-specific queries
  if (lowerMessage.match(/\b(gene|expression|level|BRCA|TP53|EGFR)\b/i)) {
    const geneMatch = message.match(/\b([A-Z][A-Z0-9]{2,10})\b/);
    if (geneMatch) {
      const geneName = geneMatch[1];
      try {
        const result = await advancedAnalyzer.queryGene(datasetId, geneName);

        if (result.error) {
          return {
            type: 'info',
            message: `I need to parse the data first. ${result.error}\n\nTry asking for a full analysis first!`
          };
        }

        if (result.found) {
          let response = `## Gene Expression: ${result.geneId}\n\n`;
          response += `Found gene **${result.geneId}** in ${datasetId}!\n\n`;
          response += `**Expression Values Across Samples:**\n\n`;

          // Show first 10 samples
          const samples = result.samples.slice(0, 10);
          const values = result.values.slice(0, 10);

          samples.forEach((sample, idx) => {
            response += `- **${sample}**: ${values[idx]?.toFixed(2) || 'N/A'}\n`;
          });

          if (result.samples.length > 10) {
            response += `\n_...and ${result.samples.length - 10} more samples_\n`;
          }

          // Calculate basic stats
          const validValues = result.values.filter(v => !isNaN(v) && isFinite(v));
          if (validValues.length > 0) {
            const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
            const max = Math.max(...validValues);
            const min = Math.min(...validValues);

            response += `\n**Statistics:**\n`;
            response += `- Mean expression: ${mean.toFixed(2)}\n`;
            response += `- Range: ${min.toFixed(2)} - ${max.toFixed(2)}\n`;
          }

          return {
            type: 'gene_query',
            message: response,
            datasetId,
            geneData: result
          };
        } else {
          return {
            type: 'info',
            message: `I couldn't find gene **${geneName}** in the available data for ${datasetId}.\n\nNote: I'm searching through the first 1000 genes. The gene might be in the full dataset but not in the preview data.`
          };
        }
      } catch (error) {
        return {
          type: 'error',
          message: `Error querying gene: ${error.message}`
        };
      }
    }
  }

  // Statistics queries
  if (lowerMessage.match(/\b(statistics|stats|mean|median|distribution|summary)\b/i)) {
    try {
      const stats = await advancedAnalyzer.getStatistics(datasetId);

      if (stats.error) {
        return {
          type: 'info',
          message: `To get statistics, I need to parse the data first. This happens automatically when you create a thread.\n\nError: ${stats.error}`
        };
      }

      let response = `## Sample Statistics for ${datasetId}\n\n`;
      response += `**Total Samples:** ${stats.sampleCount}\n`;
      response += `**Genes Analyzed:** ${stats.geneCount} (preview)\n\n`;

      if (stats.samples && stats.samples.length > 0) {
        response += `**Per-Sample Statistics:**\n\n`;

        stats.samples.slice(0, 10).forEach(sample => {
          response += `### ${sample.name}\n`;
          response += `- Values: ${sample.valueCount}\n`;
          response += `- Mean: ${sample.mean}\n`;
          response += `- Median: ${sample.median}\n`;
          response += `- Range: ${sample.min} - ${sample.max}\n\n`;
        });

        if (stats.samples.length > 10) {
          response += `_...and ${stats.samples.length - 10} more samples_\n\n`;
        }
      }

      return {
        type: 'statistics',
        message: response,
        datasetId,
        stats
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Error getting statistics: ${error.message}`
      };
    }
  }

  // Sample details
  if (lowerMessage.match(/\b(samples|sample details|sample info)\b/i)) {
    try {
      const sampleDetails = await advancedAnalyzer.getSampleDetails(datasetId);

      if (sampleDetails.error) {
        return {
          type: 'info',
          message: `Sample information requires parsed data. ${sampleDetails.error}`
        };
      }

      let response = `## Sample Information for ${datasetId}\n\n`;
      response += `**Total Samples:** ${sampleDetails.sampleCount || sampleDetails.samples.length}\n\n`;

      if (sampleDetails.samples && sampleDetails.samples.length > 0) {
        response += `**Sample Details:**\n\n`;

        sampleDetails.samples.slice(0, 5).forEach((sample, idx) => {
          response += `### ${idx + 1}. ${sample.id}\n`;
          if (sample.title) response += `**Title:** ${sample.title}\n`;
          if (sample.source) response += `**Source:** ${sample.source}\n`;
          if (sample.organism) response += `**Organism:** ${sample.organism}\n`;

          if (sample.characteristics && Object.keys(sample.characteristics).length > 0) {
            response += `**Characteristics:**\n`;
            Object.entries(sample.characteristics).forEach(([key, value]) => {
              response += `- ${key}: ${value}\n`;
            });
          }

          response += `\n`;
        });

        if (sampleDetails.samples.length > 5) {
          response += `_...and ${sampleDetails.samples.length - 5} more samples_\n`;
        }
      }

      return {
        type: 'sample_details',
        message: response,
        datasetId,
        sampleDetails
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Error getting sample details: ${error.message}`
      };
    }
  }

  // Full analysis
  if (lowerMessage.match(/\b(full analysis|complete analysis|analyze everything|full details)\b/i)) {
    try {
      const analysis = await advancedAnalyzer.getFullAnalysis(datasetId);

      if (analysis.error) {
        return {
          type: 'error',
          message: `Error performing full analysis: ${analysis.error}`
        };
      }

      let response = `# Complete Analysis: ${datasetId}\n\n`;

      // Overview
      response += `## Overview\n\n`;
      if (analysis.overview.title) {
        response += `**Title:** ${analysis.overview.title}\n\n`;
      }
      response += `- **Total Samples:** ${analysis.overview.totalSamples || 'Unknown'}\n`;
      response += `- **Total Genes:** ${analysis.overview.totalGenes || 'Unknown'}${analysis.overview.hasMoreData ? ' (preview)' : ''}\n`;
      if (analysis.overview.platform) {
        response += `- **Platform:** ${analysis.overview.platform}\n`;
      }
      response += `\n`;

      // Data Quality
      response += `## Data Quality\n\n`;
      response += `- Expression Matrix: ${analysis.dataQuality.matrixAvailable ? '✅ Available' : '❌ Not available'}\n`;
      response += `- Sample Metadata: ${analysis.dataQuality.metadataAvailable ? '✅ Available' : '❌ Not available'}\n`;
      response += `- Sample Info Complete: ${analysis.dataQuality.sampleInfoComplete ? '✅ Yes' : '⚠️ Limited'}\n`;
      response += `- Expression Data Parsed: ${analysis.dataQuality.expressionDataParsed ? '✅ Yes' : '❌ No'}\n\n`;

      // Samples
      if (analysis.samples && analysis.samples.count > 0) {
        response += `## Samples (${analysis.samples.count})\n\n`;
        response += `Showing first ${Math.min(5, analysis.samples.details?.length || 0)} samples:\n\n`;

        analysis.samples.details?.slice(0, 5).forEach((sample, idx) => {
          response += `${idx + 1}. **${sample.id}**\n`;
          if (sample.characteristics && Object.keys(sample.characteristics).length > 0) {
            Object.entries(sample.characteristics).slice(0, 3).forEach(([key, value]) => {
              response += `   - ${key}: ${value}\n`;
            });
          }
        });
        response += `\n`;
      }

      // Statistics
      if (analysis.statistics && analysis.statistics.samples) {
        response += `## Expression Statistics\n\n`;
        response += `Calculated across ${analysis.statistics.sampleCount} samples and ${analysis.statistics.geneCount} genes.\n\n`;

        const avgMeans = analysis.statistics.samples
          .map(s => parseFloat(s.mean))
          .filter(v => !isNaN(v));

        if (avgMeans.length > 0) {
          const overallMean = (avgMeans.reduce((a, b) => a + b, 0) / avgMeans.length).toFixed(2);
          response += `**Overall average expression:** ${overallMean}\n\n`;
        }
      }

      response += `## What You Can Ask\n\n`;
      response += `- Query specific genes (e.g., "What is BRCA1 expression?")\n`;
      response += `- Get sample-specific stats\n`;
      response += `- Search within the dataset\n`;
      response += `- Compare samples\n`;

      return {
        type: 'full_analysis',
        message: response,
        datasetId,
        analysis
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Error: ${error.message}`
      };
    }
  }

  // Search within dataset
  if (lowerMessage.match(/\b(search|find|look for)\b/i) && !lowerMessage.match(/\b(dataset|datasets)\b/i)) {
    const searchQuery = message.replace(/\b(search|find|look for|in|within)\b/gi, '').trim();

    if (searchQuery.length > 2) {
      try {
        const results = await advancedAnalyzer.searchInDataset(datasetId, searchQuery);

        let response = `## Search Results in ${datasetId}\n\n`;
        response += `Searching for: **"${searchQuery}"**\n\n`;

        if (results.genes && results.genes.length > 0) {
          response += `### Matching Genes (${results.genes.length})\n\n`;
          results.genes.slice(0, 10).forEach(gene => {
            response += `- **${gene.geneId}**\n`;
          });
          if (results.genes.length > 10) {
            response += `\n_...and ${results.genes.length - 10} more genes_\n`;
          }
          response += `\n`;
        }

        if (results.samples && results.samples.length > 0) {
          response += `### Matching Samples (${results.samples.length})\n\n`;
          results.samples.slice(0, 5).forEach(sample => {
            response += `- **${sample.id}**\n`;
            if (sample.matched && sample.matched.length > 0) {
              response += `  Matched in: ${sample.matched.join(', ')}\n`;
            }
          });
          if (results.samples.length > 5) {
            response += `\n_...and ${results.samples.length - 5} more samples_\n`;
          }
        }

        if (results.genes.length === 0 && results.samples.length === 0) {
          response += `No matches found for "${searchQuery}".\n\n`;
          response += `Try:\n- Different keywords\n- Gene symbols (e.g., BRCA1)\n- Sample characteristics\n`;
        }

        return {
          type: 'search_results',
          message: response,
          datasetId,
          results
        };
      } catch (error) {
        return {
          type: 'error',
          message: `Search error: ${error.message}`
        };
      }
    }
  }

  // File/data queries
  if (lowerMessage.match(/\b(file|files|data|downloaded|local)\b/i)) {
    return await answerDataQuestion(datasetId, message);
  }

  // Default: helpful response
  return {
    type: 'info',
    message: `I'm here to help analyze **${datasetId}**! You can ask me:

**Gene Queries:**
- "What is BRCA1 expression?"
- "Show me TP53 levels"

**Statistics:**
- "Show statistics"
- "Give me sample stats"

**Sample Information:**
- "Tell me about the samples"
- "Show sample details"

**Analysis:**
- "Do a full analysis"
- "Analyze everything"

**Search:**
- "Search for breast"
- "Find genes containing EGFR"

**Files:**
- "What files were downloaded?"
- "Show me the data"

What would you like to know?`
  };
}
