#!/usr/bin/env node

/**
 * Simple test script to verify the transformer works correctly
 */

// Mock config and logger to avoid requiring environment variables
process.env.HUBSPOT_ACCESS_TOKEN = 'test-token';
process.env.FEED_URL = 'http://test.com/feed.json';

const transformer = require('./src/transformer');
const fs = require('fs');
const path = require('path');

console.log('Testing Data Transformer...\n');

// Load sample feed
const feedPath = path.join(__dirname, 'sample-feed.json');
const feedData = JSON.parse(fs.readFileSync(feedPath, 'utf8'));

console.log(`Loaded ${feedData.length} listings from sample feed\n`);

// Transform the data
const transformed = transformer.transformListings(feedData);

console.log(`Transformed ${transformed.length} listings\n`);

// Display results
transformed.forEach((listing, index) => {
  console.log(`Listing ${index + 1}:`);
  console.log(JSON.stringify(listing, null, 2));
  console.log('---\n');
});

// Verify required fields
let allValid = true;
transformed.forEach((listing, index) => {
  if (!listing.external_listing_id) {
    console.error(`ERROR: Listing ${index + 1} missing external_listing_id`);
    allValid = false;
  }
  if (!listing.hs_name) {
    console.error(`ERROR: Listing ${index + 1} missing hs_name`);
    allValid = false;
  }
  // Verify hs_listing_type is present and uses valid HubSpot internal values
  const validHsListingTypes = ['house', 'townhouse', 'multi_family', 'condos_co_ops', 'lots_land', 'apartments', 'manufactured'];
  if (!listing.hs_listing_type) {
    console.error(`ERROR: Listing ${index + 1} missing hs_listing_type`);
    allValid = false;
  } else if (!validHsListingTypes.includes(listing.hs_listing_type)) {
    console.error(`ERROR: Listing ${index + 1} has invalid hs_listing_type: "${listing.hs_listing_type}"`);
    allValid = false;
  }
  // Ensure property_type is NOT present (we've migrated to hs_listing_type)
  if (listing.property_type !== undefined) {
    console.error(`ERROR: Listing ${index + 1} should not have property_type (use hs_listing_type instead)`);
    allValid = false;
  }
});

if (allValid) {
  console.log('✓ All listings have required fields (external_listing_id, hs_name, hs_listing_type)');
  console.log('✓ No listings have property_type (correctly migrated to hs_listing_type)');
  process.exit(0);
} else {
  console.error('✗ Some listings are missing required fields or have invalid values');
  process.exit(1);
}
