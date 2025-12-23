const logger = require('./logger');

/**
 * Transform JSON feed data to HubSpot Listings format
 */
class DataTransformer {
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

    // Required fields
    const assetId = this.getFirstAvailableField(feedListing, 'assetId', 'asset_id', 'id');
    if (assetId) {
      transformed.assetId = String(assetId);
    }

    // Asset Reference ID
    const assetRefId = this.getFirstAvailableField(feedListing, 'assetReferenceId', 'asset_reference_id', 'referenceId', 'reference_id');
    if (assetRefId) {
      transformed.assetReferenceId = String(assetRefId);
    }

    // Listing Start Date
    const startDate = this.getFirstAvailableField(feedListing, 'listingStartDate', 'listing_start_date', 'startDate', 'start_date');
    if (startDate) {
      transformed.listingStartDate = this.parseDate(startDate);
    }

    // Price fields
    const price = this.getFirstAvailableField(feedListing, 'listPrice', 'list_price', 'price');
    if (price !== null) {
      transformed.listPrice = this.parseNumber(price);
    }

    // Status fields
    const status = this.getFirstAvailableField(feedListing, 'listingStatus', 'listing_status', 'status');
    if (status) {
      transformed.listingStatus = String(status);
    }

    // Property type
    const propType = this.getFirstAvailableField(feedListing, 'propertyType', 'property_type', 'type');
    if (propType) {
      transformed.propertyType = String(propType);
    }

    // Square footage
    const sqft = this.getFirstAvailableField(feedListing, 'squareFootage', 'square_footage', 'sqft');
    if (sqft !== null) {
      transformed.squareFootage = this.parseNumber(sqft);
    }

    // Bathrooms
    const baths = this.getFirstAvailableField(feedListing, 'bathrooms', 'baths');
    if (baths !== null) {
      transformed.bathrooms = this.parseNumber(baths);
    }

    // Bedrooms
    const beds = this.getFirstAvailableField(feedListing, 'bedrooms', 'beds');
    if (beds !== null) {
      transformed.bedrooms = this.parseNumber(beds);
    }

    // Lot size
    const lotSize = this.getFirstAvailableField(feedListing, 'lotSize', 'lot_size');
    if (lotSize !== null) {
      transformed.lotSize = this.parseNumber(lotSize);
    }

    // Lot size units
    const lotSizeUnits = this.getFirstAvailableField(feedListing, 'lotSizeUnits', 'lot_size_units');
    if (lotSizeUnits) {
      transformed.lotSizeUnits = String(lotSizeUnits);
    }

    // Address fields
    if (feedListing.city) {
      transformed.city = String(feedListing.city);
    }

    if (feedListing.state) {
      transformed.state = String(feedListing.state);
    }

    const zip = this.getFirstAvailableField(feedListing, 'zip', 'zipCode', 'zip_code', 'postal_code');
    if (zip) {
      transformed.zip = String(zip);
    }

    if (feedListing.county) {
      transformed.county = String(feedListing.county);
    }

    const address1 = this.getFirstAvailableField(feedListing, 'addressLine1', 'address_line_1', 'address1', 'address', 'street');
    if (address1) {
      transformed.addressLine1 = String(address1);
    }

    const address2 = this.getFirstAvailableField(feedListing, 'addressLine2', 'address_line_2', 'address2', 'unit');
    if (address2) {
      transformed.addressLine2 = String(address2);
    }

    // Media URL
    const mediaUrl = this.getFirstAvailableField(feedListing, 'mediaUrl', 'media_url', 'imageUrl', 'image_url');
    if (mediaUrl) {
      transformed.mediaUrl = String(mediaUrl);
    }

    // Auction fields
    const auctionStatus = this.getFirstAvailableField(feedListing, 'auctionStatus', 'auction_status');
    if (auctionStatus) {
      transformed.auctionStatus = String(auctionStatus);
    }

    const auctionStart = this.getFirstAvailableField(feedListing, 'auctionStartDate', 'auction_start_date');
    if (auctionStart) {
      transformed.auctionStartDate = this.parseDate(auctionStart);
    }

    const auctionEnd = this.getFirstAvailableField(feedListing, 'auctionEndDate', 'auction_end_date');
    if (auctionEnd) {
      transformed.auctionEndDate = this.parseDate(auctionEnd);
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
          logger.warn(`Invalid date value: ${value}`);
          return null;
        }

        const year = date.getFullYear();
        if (year < 1900 || year > 2100) {
          logger.warn(`Date out of reasonable range: ${value}`);
          return null;
        }

        return date.getTime();
      }

      logger.warn(`Unsupported date type: ${typeof value}`);
      return null;
    } catch (error) {
      logger.warn(`Error parsing date: ${value}`, { error: error.message });
      return null;
    }
  }

  /**
   * Transform an array of listings
   */
  transformListings(feedListings) {
    if (!Array.isArray(feedListings)) {
      logger.warn('Feed data is not an array, attempting to wrap it');
      feedListings = [feedListings];
    }

    return feedListings
      .map((listing, index) => {
        try {
          return this.transformListing(listing);
        } catch (error) {
          logger.error(`Error transforming listing at index ${index}`, { error: error.message });
          return null;
        }
      })
      .filter(listing => listing !== null && listing.assetId); // Filter out invalid listings
  }
}

module.exports = new DataTransformer();
