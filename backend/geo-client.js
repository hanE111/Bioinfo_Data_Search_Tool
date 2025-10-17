/**
 * GEO Dataset Client using NCBI E-utilities API
 * This replaces the MCP client with direct API calls to NCBI
 */

const NCBI_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// NCBI API Key (optional but recommended for better rate limits: 10 req/s vs 3 req/s)
// Set via environment variable or hardcode your key here
const NCBI_API_KEY = process.env.NCBI_API_KEY || 'yourapikeyhere';

class GeoClient {
  constructor() {
    this.isConnected = true; // Always connected via HTTP
    this.apiKey = NCBI_API_KEY;
  }

  // Build API URL with optional API key
  buildUrl(baseUrl) {
    return this.apiKey ? `${baseUrl}&api_key=${this.apiKey}` : baseUrl;
  }

  async connect() {
    // Test connection with a simple request
    try {
      const testUrl = this.buildUrl(`${NCBI_BASE_URL}/einfo.fcgi?db=gds&retmode=json`);
      const response = await fetch(testUrl);
      if (response.ok) {
        console.log('✓ Connected to NCBI E-utilities API');
        if (this.apiKey) {
          console.log('✓ Using NCBI API key for enhanced rate limits (10 req/s)');
        } else {
          console.log('⚠️  No NCBI API key - using default rate limits (3 req/s)');
        }
        this.isConnected = true;
      }
    } catch (error) {
      console.error('Failed to connect to NCBI:', error);
      this.isConnected = false;
    }
  }

  async searchDatasets(query, maxResults = 20) {
    try {
      // Step 1: Search for datasets
      const searchUrl = this.buildUrl(`${NCBI_BASE_URL}/esearch.fcgi?db=gds&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`);
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      const idList = searchData.esearchresult?.idlist || [];

      if (idList.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No datasets found for query: ${query}`
          }]
        };
      }

      // Step 2: Fetch summaries for the datasets
      const summaryUrl = this.buildUrl(`${NCBI_BASE_URL}/esummary.fcgi?db=gds&id=${idList.join(',')}&retmode=json`);
      const summaryResponse = await fetch(summaryUrl);
      const summaryData = await summaryResponse.json();

      // Format results
      const datasets = idList.map(id => {
        const doc = summaryData.result?.[id];
        if (!doc) return null;

        return {
          id: doc.accession || id,
          title: doc.title || 'No title',
          summary: doc.summary || 'No summary available',
          organism: doc.taxon || 'Unknown',
          platform: doc.gpl || 'Unknown',
          samples: doc.n_samples || 0,
          type: doc.gdstype || 'Unknown',
          pubdate: doc.pdat || 'Unknown'
        };
      }).filter(Boolean);

      // Create formatted text response
      let text = `Found ${datasets.length} datasets:\n\n`;
      datasets.forEach((ds, idx) => {
        text += `${idx + 1}. **${ds.id}** - ${ds.title}\n`;
        text += `   Organism: ${ds.organism} | Samples: ${ds.samples} | Type: ${ds.type}\n\n`;
      });

      return {
        content: [{
          type: 'text',
          text: text
        }],
        datasets: datasets
      };
    } catch (error) {
      console.error('Error searching datasets:', error);
      throw error;
    }
  }

  async getDatasetDetails(geoId) {
    try {
      // Search for the specific ID
      const searchUrl = this.buildUrl(`${NCBI_BASE_URL}/esearch.fcgi?db=gds&term=${geoId}&retmode=json`);
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      const idList = searchData.esearchresult?.idlist || [];

      if (idList.length === 0) {
        throw new Error(`Dataset ${geoId} not found`);
      }

      const id = idList[0];

      // Get detailed summary
      const summaryUrl = this.buildUrl(`${NCBI_BASE_URL}/esummary.fcgi?db=gds&id=${id}&retmode=json`);
      const summaryResponse = await fetch(summaryUrl);
      const summaryData = await summaryResponse.json();

      const doc = summaryData.result?.[id];

      if (!doc) {
        throw new Error(`No details found for ${geoId}`);
      }

      // Format detailed response
      let text = `# ${doc.accession || geoId}\n\n`;
      text += `**Title:** ${doc.title || 'No title'}\n\n`;
      text += `**Summary:** ${doc.summary || 'No summary available'}\n\n`;
      text += `**Organism:** ${doc.organism || doc.taxon || 'Unknown'}\n`;
      text += `**Platform:** ${doc.gpl || 'Unknown'}\n`;
      text += `**Sample Count:** ${doc.n_samples || 0}\n`;
      text += `**Dataset Type:** ${doc.gdstype || 'Unknown'}\n`;
      text += `**Publication Date:** ${doc.pdat || 'Unknown'}\n`;

      if (doc.pubmed_ids && doc.pubmed_ids.length > 0) {
        text += `**PubMed IDs:** ${doc.pubmed_ids.join(', ')}\n`;
      }

      return {
        content: [{
          type: 'text',
          text: text
        }],
        details: {
          id: doc.accession || geoId,
          title: doc.title,
          summary: doc.summary,
          organism: doc.organism || doc.taxon,
          platform: doc.gpl,
          sampleCount: doc.n_samples,
          dataType: doc.gdstype,
          publicationDate: doc.pdat,
          pubmedIds: doc.pubmed_ids
        }
      };
    } catch (error) {
      console.error('Error fetching dataset details:', error);
      throw error;
    }
  }

  async analyzeDataset(geoId) {
    try {
      // Get detailed information
      const details = await this.getDatasetDetails(geoId);

      // Add analysis info
      const doc = details.details;

      let text = details.content[0].text;
      text += `\n\n## Analysis\n\n`;
      text += `This dataset contains ${doc.sampleCount} samples from ${doc.organism}.\n`;
      text += `Data type: ${doc.dataType}\n`;
      text += `Platform: ${doc.platform}\n\n`;

      text += `### Download Information\n`;
      text += `You can download this dataset from:\n`;
      text += `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${geoId}\n\n`;

      text += `### FTP Access\n`;
      text += `Raw data files: https://ftp.ncbi.nlm.nih.gov/geo/series/${geoId.slice(0, -3)}nnn/${geoId}/\n`;

      return {
        content: [{
          type: 'text',
          text: text
        }],
        details: doc,
        analyzed: true,
        downloadUrl: `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${geoId}`,
        ftpUrl: `https://ftp.ncbi.nlm.nih.gov/geo/series/${geoId.slice(0, -3)}nnn/${geoId}/`
      };
    } catch (error) {
      console.error('Error analyzing dataset:', error);
      throw error;
    }
  }

  async downloadDataset(geoId, outputPath) {
    // This would require actual file download logic
    // For now, return download URLs
    return {
      content: [{
        type: 'text',
        text: `Dataset ${geoId} download links:\n\nWeb: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${geoId}\nFTP: https://ftp.ncbi.nlm.nih.gov/geo/series/${geoId.slice(0, -3)}nnn/${geoId}/`
      }],
      downloadUrl: `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${geoId}`,
      ftpUrl: `https://ftp.ncbi.nlm.nih.gov/geo/series/${geoId.slice(0, -3)}nnn/${geoId}/`,
      outputPath: outputPath
    };
  }

  async disconnect() {
    // Nothing to disconnect for HTTP client
    console.log('✓ GEO client closed');
  }
}

// Export singleton instance
export const geoClient = new GeoClient();
