/**
 * Claude LLM Analyzer
 * Uses Claude API to answer complex analytical questions about datasets
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { advancedAnalyzer } from './advanced-analyzer.js';

dotenv.config();

class ClaudeAnalyzer {
  constructor() {
    this.anthropic = null;
    this.initializeClient();
  }

  initializeClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set. Claude analysis will not be available.');
      console.warn('   Set it in your .env file or environment variables.');
      return;
    }

    try {
      this.anthropic = new Anthropic({
        apiKey: apiKey,
      });
      console.log('✓ Claude API client initialized');
    } catch (error) {
      console.error('Failed to initialize Claude API:', error);
    }
  }

  isAvailable() {
    return this.anthropic !== null;
  }

  /**
   * Detect if a question requires Claude LLM analysis
   */
  needsLLMAnalysis(question) {
    const complexPatterns = [
      /how many.*drug/i,
      /count.*drug/i,
      /number of.*drug/i,
      /how many.*sample/i,
      /count.*sample/i,
      /drug.*sample.*pair/i,
      /combination of/i,
      /compare.*between/i,
      /correlation/i,
      /trend/i,
      /pattern/i,
      /relationship between/i,
      /summary of/i,
      /summarize/i,
      /explain.*difference/i,
      /what.*mean/i,
      /interpret/i,
    ];

    return complexPatterns.some(pattern => pattern.test(question));
  }

  /**
   * Analyze a complex question using Claude
   */
  async analyzeWithClaude(question, datasetId, parsedData) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Claude API not available. Please set ANTHROPIC_API_KEY environment variable.',
      };
    }

    try {
      // Prepare dataset context
      const context = this.prepareDatasetContext(datasetId, parsedData);

      // Build the prompt
      const prompt = this.buildAnalysisPrompt(question, context);

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const analysis = response.content[0].text;

      return {
        success: true,
        analysis,
        datasetId,
        question,
      };
    } catch (error) {
      console.error('Error calling Claude API:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Prepare dataset context for Claude
   */
  prepareDatasetContext(datasetId, parsedData) {
    const context = {
      datasetId,
    };

    // Add metadata
    if (parsedData.metadata) {
      context.metadata = {
        title: parsedData.metadata.title,
        summary: parsedData.metadata.summary,
        sampleCount: parsedData.metadata.sampleCount,
        platformId: parsedData.metadata.platformId,
      };
    }

    // Add sample information
    if (parsedData.samples && parsedData.samples.length > 0) {
      context.sampleCount = parsedData.samples.length;

      // Extract sample characteristics
      const characteristics = new Set();
      const drugs = new Set();

      parsedData.samples.forEach(sample => {
        if (sample.characteristics) {
          Object.keys(sample.characteristics).forEach(key => {
            characteristics.add(key);

            // Detect drug-related characteristics
            if (key.toLowerCase().includes('drug') ||
                key.toLowerCase().includes('treatment') ||
                key.toLowerCase().includes('compound')) {
              const value = sample.characteristics[key];
              if (value && value !== 'none' && value !== 'control') {
                drugs.add(value);
              }
            }
          });
        }
      });

      context.characteristicTypes = Array.from(characteristics);
      context.uniqueDrugs = Array.from(drugs);
      context.drugCount = drugs.size;

      // Sample examples (first 3)
      context.sampleExamples = parsedData.samples.slice(0, 3).map(s => ({
        id: s.id,
        title: s.title,
        characteristics: s.characteristics,
      }));
    }

    // Add expression data info
    if (parsedData.expressionMatrix) {
      context.expressionData = {
        geneCount: parsedData.expressionMatrix.genes?.length || 0,
        hasMissingValues: parsedData.expressionMatrix.hasMissingValues,
        valueRange: parsedData.expressionMatrix.valueRange,
      };
    }

    // Add statistics if available
    if (parsedData.statistics) {
      context.statistics = parsedData.statistics;
    }

    return context;
  }

  /**
   * Build analysis prompt for Claude
   */
  buildAnalysisPrompt(question, context) {
    return `You are a bioinformatics data analyst helping researchers understand genomic datasets from the Gene Expression Omnibus (GEO).

**Dataset:** ${context.datasetId}
${context.metadata?.title ? `**Title:** ${context.metadata.title}` : ''}
${context.metadata?.summary ? `**Summary:** ${context.metadata.summary}` : ''}

**Data Available:**
- Sample Count: ${context.sampleCount || 'Unknown'}
${context.expressionData ? `- Gene Expression Data: ${context.expressionData.geneCount} genes` : ''}
${context.uniqueDrugs && context.uniqueDrugs.length > 0 ? `- Drugs/Treatments: ${context.uniqueDrugs.join(', ')}` : ''}
${context.characteristicTypes && context.characteristicTypes.length > 0 ? `- Sample Characteristics: ${context.characteristicTypes.join(', ')}` : ''}

${context.sampleExamples && context.sampleExamples.length > 0 ? `
**Sample Examples:**
${context.sampleExamples.map((s, i) => `
${i + 1}. ${s.id} - ${s.title}
   ${Object.entries(s.characteristics || {}).map(([k, v]) => `${k}: ${v}`).join('\n   ')}
`).join('\n')}
` : ''}

${context.statistics ? `
**Dataset Statistics:**
${JSON.stringify(context.statistics, null, 2)}
` : ''}

**User Question:** ${question}

Please analyze the available data and provide a clear, accurate answer to the user's question. Include:
1. Direct answer to the question with specific numbers/details
2. Brief explanation of how you determined this from the data
3. Any relevant insights or caveats

Keep your response concise and focused on answering the question.`;
  }

  /**
   * Process a question using Claude with dataset context
   */
  async processQuestion(question, datasetId) {
    try {
      // First, get the parsed dataset
      const parsedData = await advancedAnalyzer.getFullAnalysis(datasetId);

      if (!parsedData.success) {
        return {
          success: false,
          error: 'Could not load dataset for analysis',
        };
      }

      // Analyze with Claude
      const result = await this.analyzeWithClaude(question, datasetId, parsedData);

      return result;
    } catch (error) {
      console.error('Error processing question with Claude:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton
export const claudeAnalyzer = new ClaudeAnalyzer();
