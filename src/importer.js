const HubSpotClient = require('./hubspot-client');
const feedFetcher = require('./feed-fetcher');
const transformer = require('./transformer');
const logger = require('./logger');
const config = require('./config');

/**
 * Main importer class that orchestrates the import process
 */
class Importer {
  constructor() {
    this.hubspotClient = new HubSpotClient();
    this.batchSize = config.get('batchSize');
  }

  /**
   * Initialize HubSpot environment (ensure object and properties exist)
   */
  async initialize() {
    logger.info('Initializing HubSpot environment...');
    
    try {
      await this.hubspotClient.ensureListingsObject();
      await this.hubspotClient.ensureProperties();
      logger.info('HubSpot environment initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize HubSpot environment', { error: error.message });
      throw error;
    }
  }

  /**
   * Process listings in batches
   */
  async processListings(listings) {
    logger.info(`Processing ${listings.length} listings...`);
    
    const batches = [];
    for (let i = 0; i < listings.length; i += this.batchSize) {
      batches.push(listings.slice(i, i + this.batchSize));
    }

    logger.info(`Split into ${batches.length} batches of max ${this.batchSize} listings`);

    const totalResults = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < batches.length; i++) {
      logger.info(`Processing batch ${i + 1}/${batches.length}...`);
      
      try {
        const results = await this.hubspotClient.batchUpsert(batches[i]);
        
        totalResults.created += results.created;
        totalResults.updated += results.updated;
        totalResults.failed += results.failed;
        totalResults.errors.push(...results.errors);

        logger.info(`Batch ${i + 1} completed`, {
          created: results.created,
          updated: results.updated,
          failed: results.failed,
        });
      } catch (error) {
        logger.error(`Batch ${i + 1} failed`, { error: error.message });
        totalResults.failed += batches[i].length;
      }
    }

    return totalResults;
  }

  /**
   * Run the complete import process
   */
  async run() {
    const startTime = Date.now();
    logger.info('='.repeat(80));
    logger.info('Starting HubSpot Listings Importer');
    logger.info('='.repeat(80));

    try {
      // Step 1: Initialize HubSpot environment
      await this.initialize();

      // Step 2: Fetch feed data
      logger.info('Fetching feed data...');
      const feedData = await feedFetcher.getFeed();
      logger.info(`Fetched ${feedData.length} listings from feed`);

      // Step 3: Transform data
      logger.info('Transforming feed data to HubSpot format...');
      const transformedListings = transformer.transformListings(feedData);
      logger.info(`Transformed ${transformedListings.length} listings`);

      if (transformedListings.length === 0) {
        logger.warn('No valid listings to import after transformation');
        return {
          success: true,
          created: 0,
          updated: 0,
          failed: 0,
          duration: Date.now() - startTime,
        };
      }

      // Step 4: Process and upsert listings
      const results = await this.processListings(transformedListings);

      // Step 5: Log summary
      const duration = Date.now() - startTime;
      logger.info('='.repeat(80));
      logger.info('Import completed', {
        duration: `${(duration / 1000).toFixed(2)}s`,
        total: transformedListings.length,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
      });
      logger.info('='.repeat(80));

      if (results.errors.length > 0) {
        logger.error('Errors occurred during import:', results.errors);
      }

      return {
        success: results.failed === 0,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
        errors: results.errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Import failed', {
        error: error.message,
        stack: error.stack,
        duration: `${(duration / 1000).toFixed(2)}s`,
      });

      throw error;
    }
  }
}

module.exports = Importer;
