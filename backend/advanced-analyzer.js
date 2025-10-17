/**
 * Advanced Data Analyzer - Full dataset analysis with parsing
 */

import { dataDownloader } from './data-downloader.js';
import { dataParser } from './data-parser.js';
import path from 'path';

class AdvancedAnalyzer {
  constructor() {
    this.cache = new Map(); // Cache parsed data
  }

  /**
   * Get or parse dataset
   */
  async getDataset(datasetId) {
    // Check cache first
    if (this.cache.has(datasetId)) {
      return this.cache.get(datasetId);
    }

    try {
      // Check if downloaded
      const isDownloaded = await dataDownloader.isDownloaded(datasetId);
      if (!isDownloaded) {
        return { error: 'Dataset not downloaded' };
      }

      const summary = await dataDownloader.getDatasetSummary(datasetId);
      const datasetDir = summary.location;

      // Find and decompress series matrix
      const matrixFile = summary.files.find(f => f.name.includes('series_matrix'));
      const softFile = summary.files.find(f => f.name.includes('soft'));

      let parsedMatrix = null;
      let parsedSOFT = null;

      if (matrixFile) {
        const matrixPath = path.join(datasetDir, matrixFile.name);
        console.log(`Decompressing and parsing matrix for ${datasetId}...`);

        try {
          const decompressed = await dataParser.decompressFile(matrixPath);
          parsedMatrix = await dataParser.parseSeriesMatrix(decompressed);
        } catch (error) {
          console.error(`Error parsing matrix:`, error);
        }
      }

      if (softFile) {
        const softPath = path.join(datasetDir, softFile.name);
        console.log(`Decompressing and parsing SOFT for ${datasetId}...`);

        try {
          const decompressed = await dataParser.decompressFile(softPath);
          parsedSOFT = await dataParser.parseSOFTFile(decompressed);
        } catch (error) {
          console.error(`Error parsing SOFT:`, error);
        }
      }

      const dataset = {
        id: datasetId,
        summary,
        matrix: parsedMatrix,
        soft: parsedSOFT,
        parsed: true
      };

      // Cache result
      this.cache.set(datasetId, dataset);

      return dataset;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get comprehensive statistics
   */
  async getStatistics(datasetId) {
    const dataset = await this.getDataset(datasetId);

    if (dataset.error) {
      return { error: dataset.error };
    }

    if (!dataset.matrix) {
      return { error: 'No expression matrix available' };
    }

    const stats = await dataParser.getSampleStatistics(
      dataset.matrix.expressionData,
      dataset.matrix.samples
    );

    return {
      datasetId,
      ...stats,
      metadata: dataset.matrix.metadata
    };
  }

  /**
   * Query specific gene
   */
  async queryGene(datasetId, geneName) {
    const dataset = await this.getDataset(datasetId);

    if (dataset.error) {
      return { error: dataset.error };
    }

    if (!dataset.matrix || !dataset.matrix.expressionData) {
      return { error: 'No expression data available' };
    }

    const result = await dataParser.queryGeneExpression(
      dataset.matrix.expressionData,
      geneName
    );

    if (result.found) {
      // Add sample names
      result.samples = dataset.matrix.samples;
      result.expressionByDSample = {};

      dataset.matrix.samples.forEach((sample, idx) => {
        result.expressionBySample[sample] = result.values[idx];
      });
    }

    return result;
  }

  /**
   * Get sample details
   */
  async getSampleDetails(datasetId) {
    const dataset = await this.getDataset(datasetId);

    if (dataset.error) {
      return { error: dataset.error };
    }

    const details = {
      datasetId,
      samples: []
    };

    // From matrix
    if (dataset.matrix) {
      details.sampleCount = dataset.matrix.sampleCount;
      details.sampleNames = dataset.matrix.samples;
    }

    // From SOFT (more detailed)
    if (dataset.soft && dataset.soft.samples) {
      details.samples = dataset.soft.samples.map(s => ({
        id: s.id,
        title: s['Sample_title'],
        source: s['Sample_source_name_ch1'],
        organism: s['Sample_organism_ch1'],
        characteristics: s.characteristics,
        treatment: s['Sample_treatment_protocol_ch1']
      }));
    }

    return details;
  }

  /**
   * Get comprehensive analysis
   */
  async getFullAnalysis(datasetId) {
    const dataset = await this.getDataset(datasetId);

    if (dataset.error) {
      return { error: dataset.error };
    }

    const analysis = {
      datasetId,
      overview: {},
      samples: {},
      statistics: {},
      dataQuality: {}
    };

    // Overview
    if (dataset.matrix) {
      analysis.overview = {
        totalSamples: dataset.matrix.sampleCount,
        totalGenes: dataset.matrix.geneCount,
        hasMoreData: dataset.matrix.hasMoreData
      };

      if (dataset.matrix.metadata?.Series) {
        analysis.overview.title = dataset.matrix.metadata.Series.title?.[0];
        analysis.overview.platform = dataset.matrix.metadata.Series.platform_id?.[0];
      }
    }

    // Sample information
    if (dataset.soft?.samples) {
      analysis.samples = {
        count: dataset.soft.samples.length,
        details: dataset.soft.samples.slice(0, 10).map(s => ({
          id: s.id,
          characteristics: s.characteristics
        }))
      };
    }

    // Statistics
    if (dataset.matrix?.expressionData) {
      const stats = await dataParser.getSampleStatistics(
        dataset.matrix.expressionData,
        dataset.matrix.samples
      );
      analysis.statistics = stats;
    }

    // Data quality indicators
    analysis.dataQuality = {
      matrixAvailable: !!dataset.matrix,
      metadataAvailable: !!dataset.soft,
      sampleInfoComplete: !!(dataset.soft?.samples && dataset.soft.samples.length > 0),
      expressionDataParsed: !!(dataset.matrix?.expressionData && dataset.matrix.expressionData.length > 0)
    };

    return analysis;
  }

  /**
   * Search within dataset
   */
  async searchInDataset(datasetId, query) {
    const dataset = await this.getDataset(datasetId);

    if (dataset.error) {
      return { error: dataset.error };
    }

    const results = {
      genes: [],
      samples: [],
      metadata: []
    };

    const queryLower = query.toLowerCase();

    // Search genes
    if (dataset.matrix?.expressionData) {
      for (const row of dataset.matrix.expressionData.slice(0, 100)) {
        if (row[0].toLowerCase().includes(queryLower)) {
          results.genes.push({
            geneId: row[0],
            preview: row.slice(0, 4).join(', ')
          });
        }
      }
    }

    // Search samples
    if (dataset.soft?.samples) {
      for (const sample of dataset.soft.samples) {
        const sampleText = JSON.stringify(sample).toLowerCase();
        if (sampleText.includes(queryLower)) {
          results.samples.push({
            id: sample.id,
            matched: Object.keys(sample.characteristics).filter(k =>
              k.toLowerCase().includes(queryLower) ||
              sample.characteristics[k]?.toLowerCase().includes(queryLower)
            )
          });
        }
      }
    }

    return results;
  }

  /**
   * Clear cache for a dataset
   */
  clearCache(datasetId) {
    this.cache.delete(datasetId);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear();
  }
}

export const advancedAnalyzer = new AdvancedAnalyzer();
