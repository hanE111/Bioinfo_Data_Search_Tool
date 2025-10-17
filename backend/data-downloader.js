/**
 * GEO Data Downloader and Analyzer
 * Downloads and processes actual GEO dataset files
 */

import { promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import path from 'path';

class DataDownloader {
  constructor() {
    this.dataDir = './data';
    this.progressCallbacks = new Map(); // datasetId -> callback function
    this.ensureDataDir();
  }

  /**
   * Register a progress callback for a dataset download
   */
  onProgress(datasetId, callback) {
    this.progressCallbacks.set(datasetId, callback);
  }

  /**
   * Remove progress callback
   */
  removeProgressCallback(datasetId) {
    this.progressCallbacks.delete(datasetId);
  }

  /**
   * Emit progress update
   */
  emitProgress(datasetId, progress) {
    const callback = this.progressCallbacks.get(datasetId);
    if (callback) {
      callback(progress);
    }
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  /**
   * Download GEO dataset files
   */
  async downloadDataset(geoId) {
    const datasetDir = path.join(this.dataDir, geoId);

    try {
      // Create dataset directory
      await fs.mkdir(datasetDir, { recursive: true });

      // GEO FTP URLs
      const seriesPath = geoId.slice(0, -3) + 'nnn';
      const ftpBase = `https://ftp.ncbi.nlm.nih.gov/geo/series/${seriesPath}/${geoId}`;

      // Files to download
      const filesToDownload = [
        {
          name: 'series_matrix.txt.gz',
          url: `${ftpBase}/matrix/${geoId}_series_matrix.txt.gz`,
          type: 'metadata'
        },
        {
          name: 'family.soft.gz',
          url: `${ftpBase}/soft/${geoId}_family.soft.gz`,
          type: 'metadata'
        }
      ];

      const downloadedFiles = [];
      const errors = [];
      const totalFiles = filesToDownload.length;

      // Download each file
      for (let i = 0; i < filesToDownload.length; i++) {
        const file = filesToDownload[i];
        try {
          console.log(`Downloading ${file.name} for ${geoId}...`);
          const filePath = path.join(datasetDir, file.name);

          // Emit download start
          this.emitProgress(geoId, {
            stage: 'downloading',
            fileName: file.name,
            fileIndex: i + 1,
            totalFiles,
            percent: 0
          });

          const response = await fetch(file.url);

          if (response.ok) {
            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);

            // Stream download with progress tracking
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              chunks.push(value);
              receivedLength += value.length;

              // Emit progress
              if (total) {
                const percent = Math.round((receivedLength / total) * 100);
                this.emitProgress(geoId, {
                  stage: 'downloading',
                  fileName: file.name,
                  fileIndex: i + 1,
                  totalFiles,
                  percent,
                  receivedBytes: receivedLength,
                  totalBytes: total
                });
              }
            }

            const arrayBuffer = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
              arrayBuffer.set(chunk, position);
              position += chunk.length;
            }

            await fs.writeFile(filePath, arrayBuffer);

            const fileInfo = {
              name: file.name,
              path: filePath,
              size: arrayBuffer.byteLength,
              sizeKB: (arrayBuffer.byteLength / 1024).toFixed(2),
              type: file.type
            };

            console.log(`✓ Downloaded ${file.name} (${fileInfo.sizeKB} KB)`);

            // Immediately decompress .gz files
            if (file.name.endsWith('.gz')) {
              try {
                console.log(`Decompressing ${file.name}...`);
                this.emitProgress(geoId, {
                  stage: 'decompressing',
                  fileName: file.name,
                  fileIndex: i + 1,
                  totalFiles
                });

                const decompressedPath = await this.decompressFile(filePath);
                const decompressedStats = await fs.stat(decompressedPath);
                fileInfo.decompressed = decompressedPath;
                fileInfo.decompressedSize = decompressedStats.size;
                fileInfo.decompressedSizeKB = (decompressedStats.size / 1024).toFixed(2);
                console.log(`✓ Decompressed to ${path.basename(decompressedPath)} (${fileInfo.decompressedSizeKB} KB)`);
              } catch (decompressError) {
                console.error(`Warning: Could not decompress ${file.name}:`, decompressError.message);
                fileInfo.decompressError = decompressError.message;
              }
            }

            downloadedFiles.push(fileInfo);
          } else {
            errors.push(`${file.name}: HTTP ${response.status}`);
          }
        } catch (error) {
          errors.push(`${file.name}: ${error.message}`);
        }
      }

      // Emit completion
      this.emitProgress(geoId, {
        stage: 'complete',
        totalFiles,
        downloadedFiles: downloadedFiles.length,
        errors: errors.length
      });

      return {
        success: downloadedFiles.length > 0,
        datasetDir,
        files: downloadedFiles,
        errors: errors.length > 0 ? errors : null
      };
    } catch (error) {
      console.error(`Error downloading ${geoId}:`, error);
      throw error;
    }
  }

  /**
   * Parse SOFT file format
   */
  async parseSOFTFile(filePath) {
    try {
      // For .gz files, we'd need to decompress first
      // For now, return metadata structure
      const stats = await fs.stat(filePath);

      return {
        type: 'SOFT',
        path: filePath,
        size: stats.size,
        parsed: false,
        note: 'SOFT file parsing requires decompression'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse series matrix file
   */
  async parseSeriesMatrix(filePath) {
    try {
      const stats = await fs.stat(filePath);

      return {
        type: 'Series Matrix',
        path: filePath,
        size: stats.size,
        parsed: false,
        note: 'Matrix file parsing requires decompression'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Analyze downloaded dataset
   */
  async analyzeDataset(geoId) {
    const datasetDir = path.join(this.dataDir, geoId);

    try {
      // Check if data exists
      const exists = await fs.access(datasetDir).then(() => true).catch(() => false);

      if (!exists) {
        return {
          status: 'not_downloaded',
          message: 'Dataset not downloaded yet'
        };
      }

      // List downloaded files
      const files = await fs.readdir(datasetDir);
      const fileStats = [];

      for (const file of files) {
        const filePath = path.join(datasetDir, file);
        const stats = await fs.stat(filePath);

        fileStats.push({
          name: file,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(2),
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          modified: stats.mtime
        });
      }

      return {
        status: 'downloaded',
        datasetDir,
        files: fileStats,
        totalSize: fileStats.reduce((sum, f) => sum + f.size, 0),
        fileCount: files.length
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get dataset summary from downloaded files
   */
  async getDatasetSummary(geoId) {
    const analysis = await this.analyzeDataset(geoId);

    if (analysis.status !== 'downloaded') {
      return analysis;
    }

    // Build summary
    const summary = {
      datasetId: geoId,
      location: analysis.datasetDir,
      files: analysis.files,
      totalSizeMB: (analysis.totalSize / (1024 * 1024)).toFixed(2),
      availableData: []
    };

    // Identify what data is available
    for (const file of analysis.files) {
      if (file.name.includes('matrix')) {
        summary.availableData.push({
          type: 'Expression Matrix',
          description: 'Sample expression data',
          file: file.name,
          size: file.sizeMB + ' MB'
        });
      } else if (file.name.includes('soft')) {
        summary.availableData.push({
          type: 'Metadata',
          description: 'Sample and platform information',
          file: file.name,
          size: file.sizeMB + ' MB'
        });
      }
    }

    return summary;
  }

  /**
   * Check if dataset is already downloaded
   */
  async isDownloaded(geoId) {
    const datasetDir = path.join(this.dataDir, geoId);
    try {
      await fs.access(datasetDir);
      const files = await fs.readdir(datasetDir);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete downloaded dataset
   */
  async deleteDataset(geoId) {
    const datasetDir = path.join(this.dataDir, geoId);
    try {
      await fs.rm(datasetDir, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

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

      // Decompress using pipeline
      await pipeline(
        createReadStream(gzFilePath),
        createGunzip(),
        createWriteStream(outputPath)
      );

      return outputPath;
    } catch (error) {
      console.error(`Error decompressing ${gzFilePath}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const dataDownloader = new DataDownloader();
