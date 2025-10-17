/**
 * Data Parser - Decompresses and parses GEO data files
 */

import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import { createInterface } from 'readline';

class DataParser {
  /**
   * Decompress a .gz file
   */
  async decompressFile(gzFilePath) {
    const outputPath = gzFilePath.replace('.gz', '');

    try {
      // Check if already decompressed
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      if (exists) {
        console.log(`File already decompressed: ${outputPath}`);
        return outputPath;
      }

      // Decompress
      await pipeline(
        createReadStream(gzFilePath),
        createGunzip(),
        createWriteStream(outputPath)
      );

      console.log(`Decompressed: ${path.basename(outputPath)}`);
      return outputPath;
    } catch (error) {
      console.error(`Error decompressing ${gzFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Parse SOFT file format
   */
  async parseSOFTFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const data = {
        platform: {},
        samples: [],
        series: {},
        raw: []
      };

      let currentSection = null;
      let currentSample = null;

      for (const line of lines) {
        if (line.startsWith('^PLATFORM')) {
          currentSection = 'platform';
          data.platform.id = line.split('=')[1]?.trim();
        } else if (line.startsWith('^SAMPLE')) {
          currentSection = 'sample';
          currentSample = { id: line.split('=')[1]?.trim(), characteristics: {} };
          data.samples.push(currentSample);
        } else if (line.startsWith('^SERIES')) {
          currentSection = 'series';
          data.series.id = line.split('=')[1]?.trim();
        } else if (line.startsWith('!')) {
          const [key, ...valueParts] = line.substring(1).split('=');
          const value = valueParts.join('=').trim();

          if (currentSection === 'platform') {
            data.platform[key.trim()] = value;
          } else if (currentSection === 'sample' && currentSample) {
            if (key.includes('characteristics')) {
              const charMatch = value.match(/(.+?):\s*(.+)/);
              if (charMatch) {
                currentSample.characteristics[charMatch[1]] = charMatch[2];
              }
            } else {
              currentSample[key.trim()] = value;
            }
          } else if (currentSection === 'series') {
            data.series[key.trim()] = value;
          }
        }

        // Keep first 100 lines as raw sample
        if (data.raw.length < 100) {
          data.raw.push(line);
        }
      }

      return data;
    } catch (error) {
      console.error(`Error parsing SOFT file:`, error);
      return null;
    }
  }

  /**
   * Parse series matrix file
   */
  async parseSeriesMatrix(filePath) {
    try {
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const metadata = {};
      const samples = [];
      let expressionData = [];
      let headerLine = null;
      let inDataSection = false;

      for await (const line of rl) {
        if (line.startsWith('!')) {
          // Metadata line
          const match = line.match(/^!([^_]+)_(.+?)\t(.+)$/);
          if (match) {
            const [, category, key, value] = match;
            if (!metadata[category]) metadata[category] = {};
            metadata[category][key] = value.split('\t');
          }
        } else if (line.startsWith('"ID_REF"')) {
          // Header line
          headerLine = line.split('\t').map(s => s.replace(/"/g, ''));
          inDataSection = true;
        } else if (inDataSection && line.trim()) {
          // Expression data
          const values = line.split('\t').map(s => s.replace(/"/g, ''));

          // Only store first 1000 rows to save memory
          if (expressionData.length < 1000) {
            expressionData.push(values);
          }
        }
      }

      // Extract sample names
      if (headerLine) {
        for (let i = 1; i < headerLine.length; i++) {
          samples.push(headerLine[i]);
        }
      }

      return {
        metadata,
        samples,
        sampleCount: samples.length,
        geneCount: expressionData.length,
        expressionData: expressionData.slice(0, 100), // First 100 genes for preview
        hasMoreData: expressionData.length === 1000
      };
    } catch (error) {
      console.error(`Error parsing series matrix:`, error);
      return null;
    }
  }

  /**
   * Get sample statistics
   */
  async getSampleStatistics(expressionData, samples) {
    if (!expressionData || expressionData.length === 0) {
      return null;
    }

    const stats = {
      sampleCount: samples.length,
      geneCount: expressionData.length,
      samples: []
    };

    // Calculate statistics for each sample
    for (let i = 1; i < samples.length + 1 && i < expressionData[0].length; i++) {
      const values = expressionData
        .map(row => parseFloat(row[i]))
        .filter(v => !isNaN(v) && isFinite(v));

      if (values.length > 0) {
        const sorted = values.slice().sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...values);
        const max = Math.max(...values);

        stats.samples.push({
          name: samples[i - 1],
          valueCount: values.length,
          mean: mean.toFixed(2),
          median: median.toFixed(2),
          min: min.toFixed(2),
          max: max.toFixed(2),
          range: (max - min).toFixed(2)
        });
      }
    }

    return stats;
  }

  /**
   * Query gene expression
   */
  async queryGeneExpression(expressionData, geneName) {
    if (!expressionData || expressionData.length === 0) {
      return null;
    }

    const geneNameUpper = geneName.toUpperCase();

    // Find gene in data
    for (const row of expressionData) {
      const geneId = row[0].toUpperCase();
      if (geneId.includes(geneNameUpper) || geneNameUpper.includes(geneId)) {
        return {
          found: true,
          geneId: row[0],
          values: row.slice(1).map(v => parseFloat(v)),
          rawData: row
        };
      }
    }

    return {
      found: false,
      searched: geneName
    };
  }

  /**
   * Get data summary
   */
  async getDataSummary(parsedMatrix) {
    if (!parsedMatrix) return null;

    const summary = {
      totalSamples: parsedMatrix.sampleCount,
      totalGenes: parsedMatrix.geneCount,
      hasMoreData: parsedMatrix.hasMoreData
    };

    // Extract key metadata
    if (parsedMatrix.metadata) {
      summary.title = parsedMatrix.metadata.Series?.title?.[0];
      summary.organism = parsedMatrix.metadata.Sample?.organism_ch1?.[0];
      summary.platform = parsedMatrix.metadata.Series?.platform_id?.[0];
    }

    return summary;
  }
}

export const dataParser = new DataParser();
