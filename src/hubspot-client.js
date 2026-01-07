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
      primaryDisplayProperty: 'external_listing_id',
      secondaryDisplayProperties: ['hs_address_1', 'hs_city', 'hs_state_province', 'reference_id'],
      searchableProperties: ['external_listing_id', 'reference_id', 'hs_address_1', 'hs_city', 'hs_state_province', 'state_code', 'hs_zip'],
      requiredProperties: ['external_listing_id'],
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

    // Check for dry-run mode
    if (config.get('dryRun')) {
      logger.info(`[DRY-RUN] Would create property: ${property.name}`);
      return;
    }

    try {
      // Prepare property data
      const propertyData = {
        name: property.name,
        label: property.label,
        type: property.type,
        fieldType: property.fieldType,
        groupName: property.groupName,
        description: property.description,
      };

      // Add options for enumeration/select fields
      if (property.type === 'enumeration' && property.options) {
        propertyData.options = property.options;
      }

      await this.retry(
        () => this.client.crm.properties.coreApi.create(this.objectType, propertyData),
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
   * Search for existing listing by external_listing_id
   */
  async searchByExternalListingId(externalListingId) {
    try {
      const filter = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'external_listing_id',
                operator: 'EQ',
                value: externalListingId,
              },
            ],
          },
        ],
      };

      const result = await this.retry(
        () => this.client.crm.objects.searchApi.doSearch(this.objectType, filter),
        `search for external_listing_id ${externalListingId}`
      );

      return result.results && result.results.length > 0 ? result.results[0] : null;
    } catch (error) {
      logger.error(`Failed to search for external_listing_id ${externalListingId}`, { error: error.message });
      return null;
    }
  }

  /**
   * Create a new listing
   */
  async createListing(properties) {
    // Check for dry-run mode
    if (config.get('dryRun')) {
      logger.info(`[DRY-RUN] Would create listing: ${properties.external_listing_id}`);
      return { id: 'dry-run-' + properties.external_listing_id, properties };
    }

    try {
      const result = await this.retry(
        () => this.client.crm.objects.basicApi.create(this.objectType, { properties }),
        `create listing ${properties.external_listing_id}`
      );
      logger.info(`Created listing: ${properties.external_listing_id}`, { id: result.id });
      return result;
    } catch (error) {
      logger.error(`Failed to create listing ${properties.external_listing_id}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing listing
   */
  async updateListing(listingId, properties) {
    // Check for dry-run mode
    if (config.get('dryRun')) {
      logger.info(`[DRY-RUN] Would update listing: ${properties.external_listing_id} (ID: ${listingId})`);
      return { id: listingId, properties };
    }

    try {
      const result = await this.retry(
        () => this.client.crm.objects.basicApi.update(this.objectType, listingId, { properties }),
        `update listing ${listingId}`
      );
      logger.info(`Updated listing: ${properties.external_listing_id}`, { id: listingId });
      return result;
    } catch (error) {
      logger.error(`Failed to update listing ${listingId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Fields that can be updated on existing listings.
   * Other fields are preserved to avoid overwriting unrelated data.
   */
  static UPDATABLE_FIELDS = [
    'auction_status',
    'price',
    'auction_start_date',
    'auction_end_date',
  ];

  /**
   * Prepare properties for update - only include updatable fields.
   * If price is set, also clear legacy list_price field.
   * @param {Object} properties - Full listing properties
   * @returns {Object} Properties filtered to only updatable fields
   */
  prepareUpdateProperties(properties) {
    const updateProps = {};

    // Only include fields that should be updated
    for (const field of HubSpotClient.UPDATABLE_FIELDS) {
      if (properties[field] !== undefined) {
        updateProps[field] = properties[field];
      }
    }

    // Backfill + cleanup: if price is being set, clear legacy list_price
    if (updateProps.price !== undefined) {
      updateProps.list_price = null;
    }

    return updateProps;
  }

  /**
   * Prepare properties for create - exclude list_price (use price only).
   * @param {Object} properties - Full listing properties
   * @returns {Object} Properties without list_price
   */
  prepareCreateProperties(properties) {
    const createProps = { ...properties };
    // Do not include list_price on new listings - price is the single source of truth
    delete createProps.list_price;
    return createProps;
  }

  /**
   * Upsert a listing (create or update)
   */
  async upsertListing(properties) {
    if (!properties.external_listing_id) {
      throw new Error('external_listing_id is required for upserting');
    }

    const existing = await this.searchByExternalListingId(properties.external_listing_id);
    
    if (existing) {
      const updateProps = this.prepareUpdateProperties(properties);
      return await this.updateListing(existing.id, updateProps);
    } else {
      const createProps = this.prepareCreateProperties(properties);
      return await this.createListing(createProps);
    }
  }

  /**
   * Batch upsert listings
   * Note: Processes listings sequentially rather than using HubSpot's batch API
   * to provide better error isolation and detailed logging per listing.
   * For high-volume scenarios, consider implementing batch API endpoints.
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
        const existing = await this.searchByExternalListingId(listing.external_listing_id);
        
        if (existing) {
          const updateProps = this.prepareUpdateProperties(listing);
          await this.updateListing(existing.id, updateProps);
          results.updated++;
        } else {
          const createProps = this.prepareCreateProperties(listing);
          await this.createListing(createProps);
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          external_listing_id: listing.external_listing_id,
          error: error.message,
        });
        logger.error(`Failed to upsert listing ${listing.external_listing_id}`, { error: error.message });
      }
    }

    return results;
  }
}

module.exports = HubSpotClient;
