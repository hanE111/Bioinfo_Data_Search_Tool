#!/usr/bin/env node

/**
 * MCP Server for GEO Dataset Analysis
 * Allows Claude Desktop to search and analyze GEO datasets
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory for downloads
const DATA_DIR = path.join(__dirname, '..', 'backend', 'data');

// NCBI API Key (optional but recommended for better rate limits)
// Get yours at: https://www.ncbi.nlm.nih.gov/account/settings/
const NCBI_API_KEY = process.env.NCBI_API_KEY || 'yourapikeyhere';

class GeoMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'geo-dataset-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_geo_datasets',
          description: 'Search for GEO datasets by keyword. Returns dataset IDs, titles, and descriptions.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., "breast cancer paclitaxel", "RNA-seq diabetes")',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_dataset_details',
          description: 'Get detailed information about a specific GEO dataset including metadata, samples, and platform info.',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'GEO dataset ID (e.g., "GSE123456")',
              },
            },
            required: ['dataset_id'],
          },
        },
        {
          name: 'download_dataset',
          description: 'Download and decompress GEO dataset files (series matrix and SOFT files) for analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'GEO dataset ID to download (e.g., "GSE123456")',
              },
            },
            required: ['dataset_id'],
          },
        },
        {
          name: 'analyze_dataset',
          description: 'Parse and analyze downloaded dataset. Returns sample info, characteristics, expression data summary, and statistics.',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'GEO dataset ID that has been downloaded',
              },
            },
            required: ['dataset_id'],
          },
        },
        {
          name: 'query_gene_expression',
          description: 'Get expression values for a specific gene across all samples in a dataset.',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'GEO dataset ID',
              },
              gene_symbol: {
                type: 'string',
                description: 'Gene symbol (e.g., "BRCA1", "TP53", "EGFR")',
              },
            },
            required: ['dataset_id', 'gene_symbol'],
          },
        },
        {
          name: 'get_sample_characteristics',
          description: 'Get detailed characteristics for all samples (treatments, drugs, conditions, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              dataset_id: {
                type: 'string',
                description: 'GEO dataset ID',
              },
            },
            required: ['dataset_id'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_geo_datasets':
            return await this.searchDatasets(args.query, args.max_results || 10);

          case 'get_dataset_details':
            return await this.getDatasetDetails(args.dataset_id);

          case 'download_dataset':
            return await this.downloadDataset(args.dataset_id);

          case 'analyze_dataset':
            return await this.analyzeDataset(args.dataset_id);

          case 'query_gene_expression':
            return await this.queryGeneExpression(args.dataset_id, args.gene_symbol);

          case 'get_sample_characteristics':
            return await this.getSampleCharacteristics(args.dataset_id);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async searchDatasets(query, maxResults) {
    const apiKeyParam = NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : '';
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gds&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json${apiKeyParam}`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    const ids = searchData.esearchresult.idlist || [];

    if (ids.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No datasets found for query: "${query}"`,
          },
        ],
      };
    }

    // Get details for each ID
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gds&id=${ids.join(',')}&retmode=json${apiKeyParam}`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    const datasets = ids.map((id) => {
      const record = summaryData.result[id];
      return {
        id: record.accession,
        title: record.title,
        summary: record.summary,
        organism: record.taxon,
        samples: record.n_samples,
        platform: record.gpl,
        type: record.entrytype,
      };
    });

    const resultText = `Found ${datasets.length} datasets:\n\n${datasets
      .map(
        (d, i) =>
          `${i + 1}. **${d.id}** - ${d.title}\n   Organism: ${d.organism}, Samples: ${d.samples}\n   ${d.summary.substring(0, 200)}...`
      )
      .join('\n\n')}`;

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  }

  async getDatasetDetails(datasetId) {
    const apiKeyParam = NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : '';

    // Search for the dataset
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gds&term=${datasetId}&retmode=json${apiKeyParam}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    const ids = searchData.esearchresult.idlist || [];
    if (ids.length === 0) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    // Get summary
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gds&id=${ids[0]}&retmode=json${apiKeyParam}`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    const record = summaryData.result[ids[0]];

    const details = {
      id: record.accession,
      title: record.title,
      summary: record.summary,
      organism: record.taxon,
      samples: record.n_samples,
      platform: record.gpl,
      platformTitle: record.gpl_title,
      type: record.entrytype,
      pubmedIds: record.pubmed_ids || [],
      submissionDate: record.pdat,
    };

    const resultText = `**${details.id}**\n\n**Title:** ${details.title}\n\n**Summary:** ${details.summary}\n\n**Details:**\n- Organism: ${details.organism}\n- Sample Count: ${details.samples}\n- Platform: ${details.platform} (${details.platformTitle})\n- Type: ${details.type}\n- Submission Date: ${details.submissionDate}\n${details.pubmedIds.length > 0 ? `- PubMed IDs: ${details.pubmedIds.join(', ')}` : ''}`;

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  }

  async downloadDataset(datasetId) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const datasetDir = path.join(DATA_DIR, datasetId);
    await fs.mkdir(datasetDir, { recursive: true });

    const seriesPath = datasetId.slice(0, -3) + 'nnn';
    const ftpBase = `https://ftp.ncbi.nlm.nih.gov/geo/series/${seriesPath}/${datasetId}`;

    const filesToDownload = [
      {
        name: 'series_matrix.txt.gz',
        url: `${ftpBase}/matrix/${datasetId}_series_matrix.txt.gz`,
      },
      {
        name: 'family.soft.gz',
        url: `${ftpBase}/soft/${datasetId}_family.soft.gz`,
      },
    ];

    const downloaded = [];
    const errors = [];

    for (const file of filesToDownload) {
      try {
        const filePath = path.join(datasetDir, file.name);
        const response = await fetch(file.url);

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          await fs.writeFile(filePath, Buffer.from(arrayBuffer));

          const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(2);
          downloaded.push(`${file.name} (${sizeKB} KB)`);

          // Decompress
          if (file.name.endsWith('.gz')) {
            const outputPath = filePath.replace('.gz', '');
            await pipeline(createReadStream(filePath), createGunzip(), createWriteStream(outputPath));

            const stats = await fs.stat(outputPath);
            const decompressedKB = (stats.size / 1024).toFixed(2);
            downloaded.push(`  ✓ Decompressed: ${path.basename(outputPath)} (${decompressedKB} KB)`);
          }
        } else {
          errors.push(`${file.name}: HTTP ${response.status}`);
        }
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    let resultText = `**Download Complete for ${datasetId}**\n\n`;
    if (downloaded.length > 0) {
      resultText += `Downloaded and decompressed:\n${downloaded.map((f) => `- ${f}`).join('\n')}`;
    }
    if (errors.length > 0) {
      resultText += `\n\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`;
    }
    resultText += `\n\nFiles stored in: ${datasetDir}`;

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  }

  async analyzeDataset(datasetId) {
    const datasetDir = path.join(DATA_DIR, datasetId);

    // Check if downloaded
    try {
      await fs.access(datasetDir);
    } catch {
      throw new Error(`Dataset ${datasetId} not downloaded. Use download_dataset first.`);
    }

    // Parse series matrix
    const matrixPath = path.join(datasetDir, 'series_matrix.txt');
    let matrixData = null;

    try {
      const content = await fs.readFile(matrixPath, 'utf-8');
      matrixData = this.parseSeriesMatrix(content);
    } catch (error) {
      throw new Error(`Could not parse series matrix: ${error.message}`);
    }

    // Build analysis
    let resultText = `**Analysis of ${datasetId}**\n\n`;

    if (matrixData.metadata) {
      resultText += `**Metadata:**\n`;
      resultText += `- Title: ${matrixData.metadata.title || 'N/A'}\n`;
      resultText += `- Platform: ${matrixData.metadata.platform || 'N/A'}\n`;
      resultText += `- Sample Count: ${matrixData.metadata.sampleCount || 0}\n\n`;
    }

    if (matrixData.samples && matrixData.samples.length > 0) {
      resultText += `**Samples (${matrixData.samples.length} total):**\n\n`;

      // Get unique characteristic types
      const charTypes = new Set();
      const drugs = new Set();

      matrixData.samples.forEach((sample) => {
        if (sample.characteristics) {
          Object.keys(sample.characteristics).forEach((key) => {
            charTypes.add(key);

            // Detect drugs
            if (key.toLowerCase().includes('drug') || key.toLowerCase().includes('treatment')) {
              const value = sample.characteristics[key];
              if (value && value !== 'none' && value !== 'control') {
                drugs.add(value);
              }
            }
          });
        }
      });

      resultText += `**Characteristic Types:** ${Array.from(charTypes).join(', ')}\n\n`;

      if (drugs.size > 0) {
        resultText += `**Drugs/Treatments Found:** ${Array.from(drugs).join(', ')}\n`;
        resultText += `**Drug Count:** ${drugs.size}\n\n`;
      }

      // Show first 3 samples as examples
      resultText += `**Sample Examples:**\n`;
      matrixData.samples.slice(0, 3).forEach((sample, i) => {
        resultText += `\n${i + 1}. ${sample.id}\n`;
        if (sample.characteristics) {
          Object.entries(sample.characteristics).forEach(([key, value]) => {
            resultText += `   - ${key}: ${value}\n`;
          });
        }
      });

      if (matrixData.samples.length > 3) {
        resultText += `\n...and ${matrixData.samples.length - 3} more samples\n`;
      }
    }

    if (matrixData.expressionMatrix) {
      resultText += `\n**Expression Data:**\n`;
      resultText += `- Genes: ${matrixData.expressionMatrix.geneCount || 0}\n`;
      resultText += `- Data Points: ${(matrixData.expressionMatrix.geneCount || 0) * (matrixData.metadata?.sampleCount || 0)}\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  }

  async queryGeneExpression(datasetId, geneSymbol) {
    const datasetDir = path.join(DATA_DIR, datasetId);
    const matrixPath = path.join(datasetDir, 'series_matrix.txt');

    try {
      const content = await fs.readFile(matrixPath, 'utf-8');
      const matrixData = this.parseSeriesMatrix(content);

      if (!matrixData.expressionMatrix || !matrixData.expressionMatrix.data) {
        throw new Error('No expression data available');
      }

      // Find gene (case-insensitive)
      const geneUpper = geneSymbol.toUpperCase();
      const geneIndex = matrixData.expressionMatrix.genes.findIndex((g) => g.toUpperCase().includes(geneUpper));

      if (geneIndex === -1) {
        return {
          content: [
            {
              type: 'text',
              text: `Gene ${geneSymbol} not found in dataset. Try a different gene symbol.`,
            },
          ],
        };
      }

      const geneId = matrixData.expressionMatrix.genes[geneIndex];
      const values = matrixData.expressionMatrix.data[geneIndex];
      const samples = matrixData.samples.map((s) => s.id);

      // Calculate statistics
      const validValues = values.filter((v) => !isNaN(v) && isFinite(v));
      const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      const max = Math.max(...validValues);
      const min = Math.min(...validValues);

      let resultText = `**Gene Expression: ${geneId}**\n\n`;
      resultText += `**Statistics:**\n`;
      resultText += `- Mean: ${mean.toFixed(3)}\n`;
      resultText += `- Min: ${min.toFixed(3)}\n`;
      resultText += `- Max: ${max.toFixed(3)}\n`;
      resultText += `- Samples: ${values.length}\n\n`;

      resultText += `**Expression Values (first 10 samples):**\n`;
      samples.slice(0, 10).forEach((sample, i) => {
        resultText += `- ${sample}: ${values[i]?.toFixed(3) || 'N/A'}\n`;
      });

      if (samples.length > 10) {
        resultText += `\n...and ${samples.length - 10} more samples`;
      }

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Error querying gene expression: ${error.message}`);
    }
  }

  async getSampleCharacteristics(datasetId) {
    const datasetDir = path.join(DATA_DIR, datasetId);
    const matrixPath = path.join(datasetDir, 'series_matrix.txt');

    try {
      const content = await fs.readFile(matrixPath, 'utf-8');
      const matrixData = this.parseSeriesMatrix(content);

      if (!matrixData.samples || matrixData.samples.length === 0) {
        throw new Error('No sample data available');
      }

      // Collect all characteristics
      const charTypes = new Map();
      const drugs = new Set();
      let drugSamplePairs = 0;

      matrixData.samples.forEach((sample) => {
        if (sample.characteristics) {
          Object.entries(sample.characteristics).forEach(([key, value]) => {
            if (!charTypes.has(key)) {
              charTypes.set(key, new Set());
            }
            charTypes.get(key).add(value);

            // Count drugs
            if (key.toLowerCase().includes('drug') || key.toLowerCase().includes('treatment')) {
              if (value && value !== 'none' && value !== 'control') {
                drugs.add(value);
                drugSamplePairs++;
              }
            }
          });
        }
      });

      let resultText = `**Sample Characteristics for ${datasetId}**\n\n`;
      resultText += `**Total Samples:** ${matrixData.samples.length}\n\n`;

      if (drugs.size > 0) {
        resultText += `**Drugs/Treatments:**\n`;
        resultText += `- Unique drugs: ${drugs.size}\n`;
        resultText += `- Drug names: ${Array.from(drugs).join(', ')}\n`;
        resultText += `- Drug-sample pairs: ${drugSamplePairs}\n\n`;
      }

      resultText += `**All Characteristic Types:**\n`;
      charTypes.forEach((values, key) => {
        resultText += `\n**${key}:**\n`;
        const uniqueValues = Array.from(values);
        if (uniqueValues.length <= 10) {
          uniqueValues.forEach((v) => {
            resultText += `  - ${v}\n`;
          });
        } else {
          uniqueValues.slice(0, 10).forEach((v) => {
            resultText += `  - ${v}\n`;
          });
          resultText += `  ... and ${uniqueValues.length - 10} more values\n`;
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Error getting sample characteristics: ${error.message}`);
    }
  }

  parseSeriesMatrix(content) {
    const lines = content.split('\n');
    const result = {
      metadata: {},
      samples: [],
      expressionMatrix: null,
    };

    let inDataSection = false;
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith('!Series_title')) {
        result.metadata.title = line.split('\t')[1]?.replace(/"/g, '');
      } else if (line.startsWith('!Series_platform_id')) {
        result.metadata.platform = line.split('\t')[1]?.replace(/"/g, '');
      } else if (line.startsWith('!Sample_title')) {
        const titles = line.split('\t').slice(1);
        titles.forEach((title, i) => {
          if (!result.samples[i]) result.samples[i] = {};
          result.samples[i].title = title.replace(/"/g, '');
        });
      } else if (line.startsWith('!Sample_geo_accession')) {
        const ids = line.split('\t').slice(1);
        ids.forEach((id, i) => {
          if (!result.samples[i]) result.samples[i] = {};
          result.samples[i].id = id.replace(/"/g, '');
        });
      } else if (line.startsWith('!Sample_characteristics_ch1')) {
        const chars = line.split('\t').slice(1);
        chars.forEach((char, i) => {
          if (!result.samples[i]) result.samples[i] = {};
          if (!result.samples[i].characteristics) result.samples[i].characteristics = {};

          const match = char.match(/(.+?):\s*(.+)/);
          if (match) {
            const key = match[1].replace(/"/g, '').trim();
            const value = match[2].replace(/"/g, '').trim();
            result.samples[i].characteristics[key] = value;
          }
        });
      } else if (line.startsWith('!series_matrix_table_begin')) {
        inDataSection = true;
      } else if (line.startsWith('!series_matrix_table_end')) {
        inDataSection = false;
      } else if (inDataSection && line.startsWith('"')) {
        dataLines.push(line);
      }
    }

    result.metadata.sampleCount = result.samples.length;

    // Parse expression data
    if (dataLines.length > 0) {
      const genes = [];
      const data = [];

      dataLines.forEach((line) => {
        const parts = line.split('\t');
        const geneId = parts[0]?.replace(/"/g, '');
        const values = parts.slice(1).map((v) => parseFloat(v));

        genes.push(geneId);
        data.push(values);
      });

      result.expressionMatrix = {
        genes,
        data,
        geneCount: genes.length,
      };
    }

    return result;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GEO Dataset MCP Server running on stdio');
  }
}

const server = new GeoMcpServer();
server.run().catch(console.error);
