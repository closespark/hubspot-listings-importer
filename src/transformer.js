const logger = require('./logger');
const { US_STATE_CODES, VALID_STATE_CODES } = require('./properties');

/**
 * State name to code mapping for deriving stateCode
 */
const STATE_NAME_TO_CODE = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI',
  'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME',
  'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX',
  'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
};

/**
 * Transform JSON feed data to HubSpot Listings format
 * 
 * Aggregated Warnings:
 * Instead of logging a warning for every individual transformation issue,
 * this transformer aggregates warnings by type and reports a summary at the
 * end of the batch. This prevents log flooding when processing large feeds.
 */
class DataTransformer {
  constructor() {
    this.resetWarnings();
  }

  /**
   * Reset warning aggregation counters
   */
  resetWarnings() {
    this.warnings = {
      invalidStateCode: { count: 0, examples: [] },
      stateDerivationFailed: { count: 0, examples: [] },
      invalidDate: { count: 0, examples: [] },
      dateOutOfRange: { count: 0, examples: [] },
      unsupportedDateType: { count: 0, examples: [] },
      dateParseError: { count: 0, examples: [] },
    };
    // Maximum examples to collect per warning type
    this.maxExamples = 3;
  }

  /**
   * Track a warning for aggregated reporting
   * @param {string} type - Warning type key
   * @param {string} example - Example value that caused the warning
   */
  trackWarning(type, example) {
    if (this.warnings[type]) {
      this.warnings[type].count++;
      if (this.warnings[type].examples.length < this.maxExamples) {
        this.warnings[type].examples.push(example);
      }
    }
  }

  /**
   * Format examples for warning message
   * @param {Object} data - Warning data with count and examples
   * @returns {string} Formatted examples string
   */
  formatWarningExamples(data) {
    if (data.examples.length === 0) {
      return '';
    }
    const quotedExamples = data.examples.map(e => `"${e}"`).join(', ');
    const hasMore = data.count > data.examples.length;
    return ` (examples: ${quotedExamples}${hasMore ? ', ...' : ''})`;
  }

  /**
   * Log aggregated warnings summary
   * Called after processing a batch of listings
   */
  logWarningSummary() {
    const warningMessages = {
      invalidStateCode: 'Invalid stateCode values provided',
      stateDerivationFailed: 'Could not derive stateCode from state values',
      invalidDate: 'Invalid date values encountered',
      dateOutOfRange: 'Date values out of reasonable range (1900-2100)',
      unsupportedDateType: 'Unsupported date types encountered',
      dateParseError: 'Errors parsing date values',
    };

    let hasWarnings = false;
    const warningTypes = Object.keys(this.warnings);
    for (let i = 0; i < warningTypes.length; i++) {
      const type = warningTypes[i];
      const data = this.warnings[type];
      if (data.count > 0) {
        hasWarnings = true;
        const examples = this.formatWarningExamples(data);
        logger.warn(`${warningMessages[type]}: ${data.count} occurrence(s)${examples}`);
      }
    }

    if (hasWarnings) {
      logger.info('For details on individual warnings, set LOG_LEVEL=debug');
    }
  }

  /**
   * Get the first available field value from a list of possible field names
   */
  getFirstAvailableField(feedListing, ...fieldNames) {
    for (const fieldName of fieldNames) {
      if (feedListing[fieldName] !== undefined && feedListing[fieldName] !== null) {
        return feedListing[fieldName];
      }
    }
    return null;
  }

  /**
   * Transform a single listing from feed format to HubSpot format
   */
  transformListing(feedListing) {
    const transformed = {};

    // Required fields - external_listing_id is the primary key
    const externalListingId = this.getFirstAvailableField(feedListing, 'externalListingId', 'external_listing_id', 'assetId', 'asset_id', 'id');
    if (externalListingId) {
      transformed.external_listing_id = String(externalListingId);
    }

    // Reference ID
    const referenceId = this.getFirstAvailableField(feedListing, 'referenceId', 'reference_id', 'assetReferenceId', 'asset_reference_id');
    if (referenceId) {
      transformed.reference_id = String(referenceId);
    }

    // Listing Start Date
    const startDate = this.getFirstAvailableField(feedListing, 'listingStartDate', 'listing_start_date', 'startDate', 'start_date');
    if (startDate) {
      transformed.listing_start_date = this.parseDate(startDate);
    }

    // Listing End Date
    const endDate = this.getFirstAvailableField(feedListing, 'listingEndDate', 'listing_end_date', 'endDate', 'end_date');
    if (endDate) {
      transformed.listing_end_date = this.parseDate(endDate);
    }

    // Price fields
    const price = this.getFirstAvailableField(feedListing, 'listPrice', 'list_price', 'price');
    if (price !== null) {
      transformed.list_price = this.parseNumber(price);
    }

    // Status fields
    const status = this.getFirstAvailableField(feedListing, 'listingStatus', 'listing_status', 'status');
    if (status) {
      transformed.listing_status = String(status);
    }

    // Property type
    const propType = this.getFirstAvailableField(feedListing, 'propertyType', 'property_type', 'type');
    if (propType) {
      transformed.property_type = String(propType);
    }

    // Square footage
    const sqft = this.getFirstAvailableField(feedListing, 'squareFootage', 'square_footage', 'sqft');
    if (sqft !== null) {
      transformed.hs_square_footage = this.parseNumber(sqft);
    }

    // Bathrooms
    const baths = this.getFirstAvailableField(feedListing, 'bathrooms', 'baths');
    if (baths !== null) {
      transformed.hs_bathrooms = this.parseNumber(baths);
    }

    // Bedrooms
    const beds = this.getFirstAvailableField(feedListing, 'bedrooms', 'beds');
    if (beds !== null) {
      transformed.hs_bedrooms = this.parseNumber(beds);
    }

    // Lot size
    const lotSize = this.getFirstAvailableField(feedListing, 'lotSize', 'lot_size');
    if (lotSize !== null) {
      transformed.hs_lot_size = this.parseNumber(lotSize);
    }

    // Lot size units
    const lotSizeUnits = this.getFirstAvailableField(feedListing, 'lotSizeUnits', 'lot_size_units');
    if (lotSizeUnits) {
      transformed.lot_size_units = String(lotSizeUnits);
    }

    // Address fields
    if (feedListing.city) {
      transformed.hs_city = String(feedListing.city);
    }

    if (feedListing.state) {
      transformed.hs_state_province = String(feedListing.state);
    }

    // Derive state_code from state or use provided stateCode
    const stateCode = this.deriveStateCode(feedListing);
    if (stateCode) {
      transformed.state_code = stateCode;
    }

    const zip = this.getFirstAvailableField(feedListing, 'zip', 'zipCode', 'zip_code', 'postal_code');
    if (zip) {
      transformed.hs_zip = String(zip);
    }

    if (feedListing.county) {
      transformed.county = String(feedListing.county);
    }

    const address1 = this.getFirstAvailableField(feedListing, 'addressLine1', 'address_line_1', 'address1', 'address', 'street');
    if (address1) {
      transformed.hs_address_1 = String(address1);
    }

    const address2 = this.getFirstAvailableField(feedListing, 'addressLine2', 'address_line_2', 'address2', 'unit');
    if (address2) {
      transformed.hs_address_2 = String(address2);
    }

    // URL fields
    const listingUrl = this.getFirstAvailableField(feedListing, 'listingUrl', 'listing_url', 'propertyUrl', 'property_url', 'url');
    if (listingUrl) {
      transformed.listing_url = String(listingUrl);
    }

    const primaryImageUrl = this.getFirstAvailableField(feedListing, 'primaryImageUrl', 'primary_image_url', 'imageUrl', 'image_url', 'mediaUrl', 'media_url');
    if (primaryImageUrl) {
      transformed.primary_image_url = String(primaryImageUrl);
    }

    // Marketing flags
    const isNewListing = this.getFirstAvailableField(feedListing, 'isNewListing', 'is_new_listing', 'isNew', 'is_new');
    if (isNewListing !== null) {
      transformed.is_new_listing = this.parseBoolean(isNewListing);
    }

    const isFeatured = this.getFirstAvailableField(feedListing, 'isFeatured', 'is_featured', 'featured');
    if (isFeatured !== null) {
      transformed.is_featured = this.parseBoolean(isFeatured);
    }

    // marketing_eligible defaults to true if not provided.
    // This ensures new listings are automatically eligible for marketing campaigns (emails, workflows).
    // Override by explicitly setting marketingEligible: false in the feed data.
    const marketingEligible = this.getFirstAvailableField(feedListing, 'marketingEligible', 'marketing_eligible');
    if (marketingEligible !== null) {
      transformed.marketing_eligible = this.parseBoolean(marketingEligible);
    } else {
      transformed.marketing_eligible = true;
    }

    // Auction fields
    const auctionStatus = this.getFirstAvailableField(feedListing, 'auctionStatus', 'auction_status');
    if (auctionStatus) {
      transformed.auction_status = String(auctionStatus);
    }

    const auctionStart = this.getFirstAvailableField(feedListing, 'auctionStartDate', 'auction_start_date');
    if (auctionStart) {
      transformed.auction_start_date = this.parseDate(auctionStart);
    }

    const auctionEnd = this.getFirstAvailableField(feedListing, 'auctionEndDate', 'auction_end_date');
    if (auctionEnd) {
      transformed.auction_end_date = this.parseDate(auctionEnd);
    }

    // REQUIRED by HubSpot: hs_name
    // Generate hs_name from address components if not already provided in the feed
    if (!transformed.hs_name) {
      const parts = [];

      // Street address
      if (transformed.hs_address_1) {
        let street = transformed.hs_address_1;

        if (transformed.hs_address_2) {
          street += ` ${transformed.hs_address_2}`;
        }

        parts.push(street);
      }

      // City
      if (transformed.hs_city) {
        parts.push(transformed.hs_city);
      }

      // State + ZIP
      const stateZip = [];
      if (transformed.hs_state_province) {
        stateZip.push(transformed.hs_state_province);
      }
      if (transformed.hs_zip) {
        stateZip.push(transformed.hs_zip);
      }
      if (stateZip.length) {
        parts.push(stateZip.join(' '));
      }

      // Final fallback (HubSpot requires hs_name)
      transformed.hs_name =
        parts.length > 0
          ? parts.join(', ')
          : transformed.external_listing_id
            ? `Listing ${transformed.external_listing_id}`
            : 'Listing';
    }

    return transformed;
  }

  /**
   * Parse a value as a number
   */
  parseNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse a value as a boolean
   */
  parseBoolean(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return Boolean(value);
  }

  /**
   * Derive state code from state value or provided stateCode
   */
  deriveStateCode(feedListing) {
    // First check if stateCode is already provided
    const providedCode = this.getFirstAvailableField(feedListing, 'stateCode', 'state_code');
    if (providedCode) {
      const code = String(providedCode).toUpperCase();
      if (VALID_STATE_CODES.has(code)) {
        return code;
      }
      // Track invalid stateCode for aggregated warning
      this.trackWarning('invalidStateCode', String(providedCode));
      logger.debug(`Invalid stateCode provided: ${providedCode}`);
    }

    // Try to derive from state field using getFirstAvailableField for flexibility
    const state = this.getFirstAvailableField(feedListing, 'state', 'state_name');
    if (!state) {
      return null;
    }

    const stateStr = String(state).trim();
    
    // Check if it's already a valid 2-letter code
    if (stateStr.length === 2 && VALID_STATE_CODES.has(stateStr.toUpperCase())) {
      return stateStr.toUpperCase();
    }

    // Try to look up state name
    const normalizedName = stateStr.toLowerCase();
    if (STATE_NAME_TO_CODE[normalizedName]) {
      return STATE_NAME_TO_CODE[normalizedName];
    }

    // Track state derivation failure for aggregated warning
    this.trackWarning('stateDerivationFailed', state);
    logger.debug(`Could not derive stateCode from state value: "${state}"`);
    return null;
  }

  /**
   * Parse a date value to Unix timestamp in milliseconds
   */
  parseDate(value) {
    if (!value) {
      return null;
    }

    try {
      // Handle numeric timestamps (already in milliseconds or seconds)
      if (typeof value === 'number') {
        // If it looks like seconds (less than year 3000 in milliseconds)
        const timestamp = value < 10000000000 ? value * 1000 : value;
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
      }

      // Handle string dates
      if (typeof value === 'string') {
        // Reject obviously invalid patterns
        if (value.trim() === '' || value === 'null' || value === 'undefined') {
          return null;
        }

        const date = new Date(value);
        
        // Check if the date is valid and not in the distant past (before 1900) or far future (after 2100)
        if (isNaN(date.getTime())) {
          this.trackWarning('invalidDate', value);
          logger.debug(`Invalid date value: ${value}`);
          return null;
        }

        const year = date.getFullYear();
        if (year < 1900 || year > 2100) {
          this.trackWarning('dateOutOfRange', value);
          logger.debug(`Date out of reasonable range: ${value}`);
          return null;
        }

        return date.getTime();
      }

      this.trackWarning('unsupportedDateType', typeof value);
      logger.debug(`Unsupported date type: ${typeof value}`);
      return null;
    } catch (error) {
      this.trackWarning('dateParseError', String(value));
      logger.debug(`Error parsing date: ${value}`, { error: error.message });
      return null;
    }
  }

  /**
   * Transform an array of listings
   */
  transformListings(feedListings) {
    // Reset warnings for this batch
    this.resetWarnings();

    if (!Array.isArray(feedListings)) {
      logger.warn('Feed data is not an array, attempting to wrap it');
      feedListings = [feedListings];
    }

    const results = feedListings
      .map((listing, index) => {
        try {
          return this.transformListing(listing);
        } catch (error) {
          logger.error(`Error transforming listing at index ${index}`, { error: error.message });
          return null;
        }
      })
      .filter(listing => listing !== null && listing.external_listing_id); // Filter out invalid listings

    // Log aggregated warnings summary
    this.logWarningSummary();

    return results;
  }
}

module.exports = new DataTransformer();
