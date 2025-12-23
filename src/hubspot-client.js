const { Client } = require('@hubspot/api-client');
const config = require('./config');
const logger = require('./logger');
const { LISTINGS_PROPERTIES } = require('./properties');

/**
 * HubSpot API client with retry logic and property management
 */
class HubSpotClient {
  constructor() {
    this.client = new Client({ accessToken: config.get('hubspotAccessToken') });
    this.objectType = 'listings';
    this.retryAttempts = config.get('retryAttempts');
    this.retryDelay = config.get('retryDelay');
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry wrapper for API calls
   */
  async retry(fn, context = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt}/${this.retryAttempts} failed for ${context}`, {
          error: error.message,
          statusCode: error.response?.status,
        });

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          logger.info(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Ensure the Listings custom object exists
   */
  async ensureListingsObject() {
    try {
      logger.info('Checking if Listings custom object exists...');
      const schema = await this.retry(
        () => this.client.crm.schemas.coreApi.getById(this.objectType),
        'get listings schema'
      );
      logger.info('Listings custom object exists', { objectTypeId: schema.objectTypeId });
      return schema;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.info('Listings custom object does not exist, creating...');
        return await this.createListingsObject();
      }
      throw error;
    }
  }

  /**
   * Create the Listings custom object
   */
  async createListingsObject() {
    const schema = {
      name: 'listings',
      labels: {
        singular: 'Listing',
        plural: 'Listings',
      },
      primaryDisplayProperty: 'assetId',
      secondaryDisplayProperties: ['address1', 'city', 'state'],
      searchableProperties: ['assetId', 'address1', 'city', 'state', 'zip'],
      requiredProperties: ['assetId'],
      properties: [],
      associatedObjects: ['CONTACT', 'COMPANY'],
    };

    try {
      const result = await this.retry(
        () => this.client.crm.schemas.coreApi.create(schema),
        'create listings object'
      );
      logger.info('Listings custom object created successfully', { objectTypeId: result.objectTypeId });
      return result;
    } catch (error) {
      logger.error('Failed to create Listings custom object', { error: error.message });
      throw error;
    }
  }

  /**
   * Get existing properties for Listings object
   */
  async getExistingProperties() {
    try {
      const properties = await this.retry(
        () => this.client.crm.properties.coreApi.getAll(this.objectType),
        'get existing properties'
      );
      return properties.results || [];
    } catch (error) {
      logger.error('Failed to get existing properties', { error: error.message });
      return [];
    }
  }

  /**
   * Create a property if it doesn't exist
   */
  async createPropertyIfNotExists(property, existingProperties) {
    const exists = existingProperties.some(p => p.name === property.name);
    
    if (exists) {
      logger.debug(`Property ${property.name} already exists`);
      return;
    }

    try {
      await this.retry(
        () => this.client.crm.properties.coreApi.create(this.objectType, property),
        `create property ${property.name}`
      );
      logger.info(`Created property: ${property.name}`);
    } catch (error) {
      logger.error(`Failed to create property ${property.name}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure all required properties exist
   */
  async ensureProperties() {
    logger.info('Ensuring all required properties exist...');
    
    const existingProperties = await this.getExistingProperties();
    logger.info(`Found ${existingProperties.length} existing properties`);

    for (const property of LISTINGS_PROPERTIES) {
      await this.createPropertyIfNotExists(property, existingProperties);
    }

    logger.info('All required properties are ensured');
  }

  /**
   * Search for existing listing by assetId
   */
  async searchByAssetId(assetId) {
    try {
      const filter = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'assetId',
                operator: 'EQ',
                value: assetId,
              },
            ],
          },
        ],
      };

      const result = await this.retry(
        () => this.client.crm.objects.searchApi.doSearch(this.objectType, filter),
        `search for assetId ${assetId}`
      );

      return result.results && result.results.length > 0 ? result.results[0] : null;
    } catch (error) {
      logger.error(`Failed to search for assetId ${assetId}`, { error: error.message });
      return null;
    }
  }

  /**
   * Create a new listing
   */
  async createListing(properties) {
    try {
      const result = await this.retry(
        () => this.client.crm.objects.basicApi.create(this.objectType, { properties }),
        `create listing ${properties.assetId}`
      );
      logger.info(`Created listing: ${properties.assetId}`, { id: result.id });
      return result;
    } catch (error) {
      logger.error(`Failed to create listing ${properties.assetId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing listing
   */
  async updateListing(listingId, properties) {
    try {
      const result = await this.retry(
        () => this.client.crm.objects.basicApi.update(this.objectType, listingId, { properties }),
        `update listing ${listingId}`
      );
      logger.info(`Updated listing: ${properties.assetId}`, { id: listingId });
      return result;
    } catch (error) {
      logger.error(`Failed to update listing ${listingId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Upsert a listing (create or update)
   */
  async upsertListing(properties) {
    if (!properties.assetId) {
      throw new Error('assetId is required for upserting');
    }

    const existing = await this.searchByAssetId(properties.assetId);
    
    if (existing) {
      return await this.updateListing(existing.id, properties);
    } else {
      return await this.createListing(properties);
    }
  }

  /**
   * Batch upsert listings
   */
  async batchUpsert(listings) {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (const listing of listings) {
      try {
        const existing = await this.searchByAssetId(listing.assetId);
        
        if (existing) {
          await this.updateListing(existing.id, listing);
          results.updated++;
        } else {
          await this.createListing(listing);
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          assetId: listing.assetId,
          error: error.message,
        });
        logger.error(`Failed to upsert listing ${listing.assetId}`, { error: error.message });
      }
    }

    return results;
  }
}

module.exports = HubSpotClient;
