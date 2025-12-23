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
  if (!listing.assetId) {
    console.error(`ERROR: Listing ${index + 1} missing assetId`);
    allValid = false;
  }
});

if (allValid) {
  console.log('✓ All listings have required fields');
  process.exit(0);
} else {
  console.error('✗ Some listings are missing required fields');
  process.exit(1);
}
