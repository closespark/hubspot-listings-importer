const logger = require('./logger');

/**
 * Transform JSON feed data to HubSpot Listings format
 */
class DataTransformer {
  /**
   * Transform a single listing from feed format to HubSpot format
   */
  transformListing(feedListing) {
    const transformed = {};

    // Required fields
    if (feedListing.assetId || feedListing.asset_id || feedListing.id) {
      transformed.assetId = String(feedListing.assetId || feedListing.asset_id || feedListing.id);
    }

    // Price fields
    if (feedListing.listPrice !== undefined || feedListing.list_price !== undefined || feedListing.price !== undefined) {
      const price = feedListing.listPrice || feedListing.list_price || feedListing.price;
      transformed.listPrice = this.parseNumber(price);
    }

    // Status fields
    if (feedListing.listingStatus || feedListing.listing_status || feedListing.status) {
      transformed.listingStatus = String(feedListing.listingStatus || feedListing.listing_status || feedListing.status);
    }

    // Property type
    if (feedListing.propertyType || feedListing.property_type || feedListing.type) {
      transformed.propertyType = String(feedListing.propertyType || feedListing.property_type || feedListing.type);
    }

    // Square footage
    if (feedListing.squareFootage !== undefined || feedListing.square_footage !== undefined || feedListing.sqft !== undefined) {
      const sqft = feedListing.squareFootage || feedListing.square_footage || feedListing.sqft;
      transformed.squareFootage = this.parseNumber(sqft);
    }

    // Bathrooms
    if (feedListing.bathrooms !== undefined || feedListing.baths !== undefined) {
      transformed.bathrooms = this.parseNumber(feedListing.bathrooms || feedListing.baths);
    }

    // Bedrooms
    if (feedListing.bedrooms !== undefined || feedListing.beds !== undefined) {
      transformed.bedrooms = this.parseNumber(feedListing.bedrooms || feedListing.beds);
    }

    // Lot size
    if (feedListing.lotSize !== undefined || feedListing.lot_size !== undefined) {
      transformed.lotSize = this.parseNumber(feedListing.lotSize || feedListing.lot_size);
    }

    // Lot size units
    if (feedListing.lotSizeUnits || feedListing.lot_size_units) {
      transformed.lotSizeUnits = String(feedListing.lotSizeUnits || feedListing.lot_size_units);
    }

    // Address fields
    if (feedListing.city) {
      transformed.city = String(feedListing.city);
    }

    if (feedListing.state) {
      transformed.state = String(feedListing.state);
    }

    if (feedListing.zip || feedListing.zipCode || feedListing.zip_code || feedListing.postal_code) {
      transformed.zip = String(feedListing.zip || feedListing.zipCode || feedListing.zip_code || feedListing.postal_code);
    }

    if (feedListing.county) {
      transformed.county = String(feedListing.county);
    }

    if (feedListing.address1 || feedListing.address || feedListing.street) {
      transformed.address1 = String(feedListing.address1 || feedListing.address || feedListing.street);
    }

    if (feedListing.address2 || feedListing.unit) {
      transformed.address2 = String(feedListing.address2 || feedListing.unit);
    }

    // Media URL
    if (feedListing.mediaUrl || feedListing.media_url || feedListing.imageUrl || feedListing.image_url) {
      transformed.mediaUrl = String(feedListing.mediaUrl || feedListing.media_url || feedListing.imageUrl || feedListing.image_url);
    }

    // Auction fields
    if (feedListing.auctionStatus || feedListing.auction_status) {
      transformed.auctionStatus = String(feedListing.auctionStatus || feedListing.auction_status);
    }

    if (feedListing.auctionStartDate || feedListing.auction_start_date) {
      transformed.auctionStartDate = this.parseDate(feedListing.auctionStartDate || feedListing.auction_start_date);
    }

    if (feedListing.auctionEndDate || feedListing.auction_end_date) {
      transformed.auctionEndDate = this.parseDate(feedListing.auctionEndDate || feedListing.auction_end_date);
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
