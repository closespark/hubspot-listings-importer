#!/usr/bin/env node

/**
 * Test script for inferPropertyType function
 */

// Mock config and logger to avoid requiring environment variables
process.env.HUBSPOT_ACCESS_TOKEN = 'test-token';
process.env.FEED_URL = 'http://test.com/feed.json';

const transformer = require('./src/transformer');
const inferPropertyType = transformer.inferPropertyType;

console.log('Testing inferPropertyType function...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, input, expected) {
  const result = inferPropertyType(input);
  if (result === expected) {
    console.log(`✓ ${name}: ${JSON.stringify(input)} => "${result}"`);
    testsPassed++;
  } else {
    console.error(`✗ ${name}: ${JSON.stringify(input)} => "${result}" (expected "${expected}")`);
    testsFailed++;
  }
}

// Test Land detection
test(
  'Land - vacant lot with large lot size',
  { squareFootage: 0, bedrooms: 0, bathrooms: 0, lotSize: 10000 },
  'Land'
);

test(
  'Land - tiny structure on large lot',
  { squareFootage: 200, bedrooms: 0, bathrooms: 0, lotSize: 50000 },
  'Land'
);

// Test Manufactured detection
test(
  'Manufactured - typical manufactured home',
  { squareFootage: 1400, bedrooms: 3, bathrooms: 2, lotSize: 10000 },
  'Manufactured'
);

test(
  'Manufactured - small manufactured home',
  { squareFootage: 400, bedrooms: 1, bathrooms: 1, lotSize: 3000 },
  'Manufactured'
);

// Test Multi-Family detection
test(
  'Multi-Family - many bedrooms',
  { squareFootage: 3000, bedrooms: 5, bathrooms: 3, lotSize: 8000 },
  'Multi-Family'
);

test(
  'Multi-Family - many bathrooms',
  { squareFootage: 2000, bedrooms: 3, bathrooms: 4, lotSize: 6000 },
  'Multi-Family'
);

test(
  'Multi-Family - large with 4 bedrooms',
  { squareFootage: 2500, bedrooms: 4, bathrooms: 2, lotSize: 6000 },
  'Multi-Family'
);

// Test Condo detection
test(
  'Condo - small unit with no lot',
  { squareFootage: 800, bedrooms: 1, bathrooms: 1, lotSize: 0 },
  'Condo'
);

test(
  'Condo - small unit with tiny lot',
  { squareFootage: 1000, bedrooms: 2, bathrooms: 1, lotSize: 1500 },
  'Condo'
);

// Test Townhome detection
test(
  'Townhome - typical townhome',
  { squareFootage: 1500, bedrooms: 3, bathrooms: 2, lotSize: 2000 },
  'Townhome'
);

test(
  'Townhome - larger townhome',
  { squareFootage: 2200, bedrooms: 4, bathrooms: 2.5, lotSize: 4000 },
  'Townhome'
);

// Test Single Family detection
test(
  'Single Family - standard home',
  { squareFootage: 2000, bedrooms: 3, bathrooms: 2, lotSize: 8000 },
  'Single Family'
);

test(
  'Single Family - larger home (not multi-family due to fewer beds)',
  { squareFootage: 3500, bedrooms: 3, bathrooms: 2.5, lotSize: 12000 },
  'Single Family'
);

// Test Other fallback
test(
  'Other - unusual combination',
  { squareFootage: 500, bedrooms: 1, bathrooms: 1, lotSize: 2500 },
  'Other'
);

// Test edge cases with string inputs
test(
  'Handles string inputs - Land',
  { squareFootage: '0', bedrooms: '0', bathrooms: '0', lotSize: '15000' },
  'Land'
);

// Per the function logic, when all values are 0/null/undefined,
// the Condo check passes (sf<=1200 && beds<=2 && lot===0)
test(
  'Handles null/undefined inputs - Condo (no lot, small/no structure)',
  { squareFootage: null, bedrooms: undefined, bathrooms: null, lotSize: null },
  'Condo'
);

test(
  'Handles missing inputs - Condo (no lot, small/no structure)',
  {},
  'Condo'
);

// Test transformer integration - listing without property_type should get inferred type
console.log('\nTesting transformer integration...\n');

const testListing = {
  external_listing_id: 'TEST-001',
  square_footage: 0,
  bedrooms: 0,
  bathrooms: 0,
  lot_size: 20000,
};

const transformed = transformer.transformListing(testListing);
if (transformed.property_type === 'Land') {
  console.log('✓ Transformer correctly infers property_type as "Land" when not provided');
  testsPassed++;
} else {
  console.error(`✗ Transformer inference failed: expected "Land", got "${transformed.property_type}"`);
  testsFailed++;
}

// Test that provided property_type is not overwritten
const testListingWithType = {
  external_listing_id: 'TEST-002',
  property_type: 'custom_type',
  square_footage: 0,
  bedrooms: 0,
  bathrooms: 0,
  lot_size: 20000,
};

const transformedWithType = transformer.transformListing(testListingWithType);
if (transformedWithType.property_type === 'custom_type') {
  console.log('✓ Transformer correctly preserves provided property_type');
  testsPassed++;
} else {
  console.error(`✗ Transformer should preserve provided type: expected "custom_type", got "${transformedWithType.property_type}"`);
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
