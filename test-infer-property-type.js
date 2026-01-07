#!/usr/bin/env node

/**
 * Test script for inferHsListingType function
 * Tests HubSpot native hs_listing_type enum values
 */

// Mock config and logger to avoid requiring environment variables
process.env.HUBSPOT_ACCESS_TOKEN = 'test-token';
process.env.FEED_URL = 'http://test.com/feed.json';

const transformer = require('./src/transformer');
const inferHsListingType = transformer.inferHsListingType;

console.log('Testing inferHsListingType function...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, input, expected) {
  const result = inferHsListingType(input);
  if (result === expected) {
    console.log(`✓ ${name}: ${JSON.stringify(input)} => "${result}"`);
    testsPassed++;
  } else {
    console.error(`✗ ${name}: ${JSON.stringify(input)} => "${result}" (expected "${expected}")`);
    testsFailed++;
  }
}

// Test lots_land detection
test(
  'lots_land - vacant lot with large lot size',
  { squareFootage: 0, bedrooms: 0, bathrooms: 0, lotSize: 10000 },
  'lots_land'
);

test(
  'lots_land - no structure on large lot',
  { squareFootage: 0, bedrooms: 0, bathrooms: 0, lotSize: 5000 },
  'lots_land'
);

// Test manufactured detection
test(
  'manufactured - typical manufactured home',
  { squareFootage: 1400, bedrooms: 3, bathrooms: 2, lotSize: 10000 },
  'manufactured'
);

test(
  'manufactured - small manufactured home',
  { squareFootage: 400, bedrooms: 1, bathrooms: 1, lotSize: 3000 },
  'manufactured'
);

// Test apartments detection (larger-scale multi-unit)
test(
  'apartments - many bedrooms (10+)',
  { squareFootage: 6000, bedrooms: 10, bathrooms: 6, lotSize: 15000 },
  'apartments'
);

test(
  'apartments - many bathrooms (8+)',
  { squareFootage: 7500, bedrooms: 8, bathrooms: 8, lotSize: 20000 },
  'apartments'
);

test(
  'apartments - large with 8+ beds',
  { squareFootage: 8000, bedrooms: 8, bathrooms: 6, lotSize: 25000 },
  'apartments'
);

// Test multi_family detection
test(
  'multi_family - many bedrooms',
  { squareFootage: 3000, bedrooms: 5, bathrooms: 3, lotSize: 8000 },
  'multi_family'
);

test(
  'multi_family - many bathrooms',
  { squareFootage: 2000, bedrooms: 3, bathrooms: 4, lotSize: 6000 },
  'multi_family'
);

test(
  'multi_family - large with 4 bedrooms',
  { squareFootage: 2500, bedrooms: 4, bathrooms: 2, lotSize: 6000 },
  'multi_family'
);

// Test condos_co_ops detection
test(
  'condos_co_ops - small unit with no lot',
  { squareFootage: 800, bedrooms: 1, bathrooms: 1, lotSize: 0 },
  'condos_co_ops'
);

test(
  'condos_co_ops - small unit with tiny lot',
  { squareFootage: 1000, bedrooms: 2, bathrooms: 1, lotSize: 500 },
  'condos_co_ops'
);

// Test townhouse detection
test(
  'townhouse - typical townhouse',
  { squareFootage: 1500, bedrooms: 3, bathrooms: 2, lotSize: 2000 },
  'townhouse'
);

test(
  'townhouse - larger townhouse',
  { squareFootage: 2200, bedrooms: 3, bathrooms: 2.5, lotSize: 4000 },
  'townhouse'
);

// Test house detection
test(
  'house - standard home',
  { squareFootage: 2000, bedrooms: 3, bathrooms: 2, lotSize: 8000 },
  'house'
);

test(
  'house - larger home (not multi-family due to fewer beds)',
  { squareFootage: 3500, bedrooms: 3, bathrooms: 2.5, lotSize: 12000 },
  'house'
);

// Test house fallback
test(
  'house - default fallback for large lot outside townhouse range',
  { squareFootage: 1500, bedrooms: 2, bathrooms: 1, lotSize: 25000 },
  'house'
);

// Test edge cases with string inputs
test(
  'Handles string inputs - lots_land',
  { squareFootage: '0', bedrooms: '0', bathrooms: '0', lotSize: '15000' },
  'lots_land'
);

// When all values are 0/null/undefined, fallback is house
test(
  'Handles null/undefined inputs - house fallback',
  { squareFootage: null, bedrooms: undefined, bathrooms: null, lotSize: null },
  'house'
);

test(
  'Handles missing inputs - house fallback',
  {},
  'house'
);

// Test transformer integration - listing should get inferred hs_listing_type
console.log('\nTesting transformer integration...\n');

const testListing = {
  external_listing_id: 'TEST-001',
  square_footage: 0,
  bedrooms: 0,
  bathrooms: 0,
  lot_size: 20000,
};

const transformed = transformer.transformListing(testListing);
if (transformed.hs_listing_type === 'lots_land') {
  console.log('✓ Transformer correctly infers hs_listing_type as "lots_land"');
  testsPassed++;
} else {
  console.error(`✗ Transformer inference failed: expected "lots_land", got "${transformed.hs_listing_type}"`);
  testsFailed++;
}

// Verify property_type is not set
if (transformed.property_type === undefined) {
  console.log('✓ Transformer does not set property_type (migrated to hs_listing_type)');
  testsPassed++;
} else {
  console.error(`✗ Transformer should not set property_type, but got "${transformed.property_type}"`);
  testsFailed++;
}

// Test that hs_listing_type is always inferred (not preserved from input)
const testListingWithType = {
  external_listing_id: 'TEST-002',
  property_type: 'custom_type', // This should be ignored
  square_footage: 2000,
  bedrooms: 3,
  bathrooms: 2,
  lot_size: 8000,
};

const transformedWithType = transformer.transformListing(testListingWithType);
if (transformedWithType.hs_listing_type === 'house') {
  console.log('✓ Transformer infers hs_listing_type based on property characteristics');
  testsPassed++;
} else {
  console.error(`✗ Transformer should infer hs_listing_type as "house", got "${transformedWithType.hs_listing_type}"`);
  testsFailed++;
}

// Verify property_type is not copied from input
if (transformedWithType.property_type === undefined) {
  console.log('✓ Transformer does not copy property_type from input');
  testsPassed++;
} else {
  console.error(`✗ Transformer should not copy property_type from input, got "${transformedWithType.property_type}"`);
  testsFailed++;
}

// Summary
console.log(`\n${'-'.repeat(50)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!');
  process.exit(0);
}
