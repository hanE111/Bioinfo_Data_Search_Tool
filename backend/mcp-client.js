import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class GeoMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      // Create transport - it will handle spawning the process
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@obar1/mcp-geo'],
      });

      // Create client
      this.client = new Client({
        name: 'geo-chatbot-client',
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {},
        },
      });

      // Connect
      await this.client.connect(this.transport);
      this.isConnected = true;

      console.log('✓ Connected to GEO MCP server');

      // List available tools
      const tools = await this.client.listTools();
      console.log('Available tools:', tools.tools.map(t => t.name));
    } catch (error) {
      console.error('Failed to connect to GEO MCP server:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async searchDatasets(query) {
    await this.connect();

    try {
      // Use the GEO MCP search tool
      const result = await this.client.callTool({
        name: 'geo_search',
        arguments: {
          term: query,
          retmax: 20, // Get up to 20 results
        },
      });

      return result;
    } catch (error) {
      console.error('Error searching datasets:', error);
      throw error;
    }
  }

  async getDatasetDetails(geoId) {
    await this.connect();

    try {
      // Use the GEO MCP fetch tool to get detailed information
      const result = await this.client.callTool({
        name: 'geo_fetch',
        arguments: {
          id: geoId,
        },
      });

      return result;
    } catch (error) {
      console.error('Error fetching dataset details:', error);
      throw error;
    }
  }

  async downloadDataset(geoId, outputPath) {
    await this.connect();

    try {
      // Use the GEO MCP download tool
      const result = await this.client.callTool({
        name: 'geo_download',
        arguments: {
          id: geoId,
          destdir: outputPath,
        },
      });

      return result;
    } catch (error) {
      console.error('Error downloading dataset:', error);
      throw error;
    }
  }

  async analyzeDataset(geoId) {
    await this.connect();

    try {
      // First download the dataset
      const downloadPath = `./data/${geoId}`;
      await this.downloadDataset(geoId, downloadPath);

      // Then get detailed information
      const details = await this.getDatasetDetails(geoId);

      // Combine the information
      return {
        details,
        downloadPath,
        analyzed: true,
      };
    } catch (error) {
      console.error('Error analyzing dataset:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('✓ Disconnected from GEO MCP server');
    }
  }
}

// Export singleton instance
export const geoMCPClient = new GeoMCPClient();
