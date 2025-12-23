#!/usr/bin/env node

/**
 * Integration test to verify all modules can be loaded and initialized
 */

console.log('Running integration checks...\n');

let hasErrors = false;

// Test 1: Load all modules
console.log('1. Testing module loading...');
try {
  // Set minimal env vars to pass validation
  process.env.HUBSPOT_ACCESS_TOKEN = 'test-token-for-loading';
  process.env.FEED_URL = 'http://test.com/feed.json';

  const config = require('./src/config');
  const logger = require('./src/logger');
  const properties = require('./src/properties');
  const HubSpotClient = require('./src/hubspot-client');
  const transformer = require('./src/transformer');
  const feedFetcher = require('./src/feed-fetcher');
  const Importer = require('./src/importer');

  console.log('   ✓ All modules loaded successfully\n');
} catch (error) {
  console.error('   ✗ Module loading failed:', error.message);
  hasErrors = true;
}

// Test 2: Check properties definition
console.log('2. Testing properties definition...');
try {
  const { LISTINGS_PROPERTIES } = require('./src/properties');
  
  const expectedProps = [
    'assetId', 'listPrice', 'listingStatus', 'propertyType',
    'squareFootage', 'bathrooms', 'bedrooms', 'lotSize', 'lotSizeUnits',
    'city', 'state', 'zip', 'county', 'address1', 'address2',
    'mediaUrl', 'auctionStatus', 'auctionStartDate', 'auctionEndDate'
  ];

  const definedProps = LISTINGS_PROPERTIES.map(p => p.name);
  const missing = expectedProps.filter(p => !definedProps.includes(p));

  if (missing.length > 0) {
    console.error('   ✗ Missing properties:', missing.join(', '));
    hasErrors = true;
  } else {
    console.log(`   ✓ All ${expectedProps.length} required properties defined\n`);
  }
} catch (error) {
  console.error('   ✗ Properties check failed:', error.message);
  hasErrors = true;
}

// Test 3: Test transformer
console.log('3. Testing data transformer...');
try {
  const transformer = require('./src/transformer');
  const testData = {
    assetId: 'TEST-001',
    listPrice: 500000,
    city: 'Test City',
    state: 'CA',
    beds: 3,
    baths: 2,
  };

  const transformed = transformer.transformListing(testData);

  if (transformed.assetId !== 'TEST-001') {
    throw new Error('assetId not transformed correctly');
  }
  if (transformed.bedrooms !== 3) {
    throw new Error('bedrooms mapping failed');
  }
  if (transformed.bathrooms !== 2) {
    throw new Error('bathrooms mapping failed');
  }

  console.log('   ✓ Transformer working correctly\n');
} catch (error) {
  console.error('   ✗ Transformer test failed:', error.message);
  hasErrors = true;
}

// Test 4: Test configuration
console.log('4. Testing configuration...');
try {
  const config = require('./src/config');
  
  if (!config.get('hubspotAccessToken')) {
    throw new Error('Failed to get hubspotAccessToken');
  }
  if (!config.get('feedUrl')) {
    throw new Error('Failed to get feedUrl');
  }

  console.log('   ✓ Configuration working correctly\n');
} catch (error) {
  console.error('   ✗ Configuration test failed:', error.message);
  hasErrors = true;
}

// Test 5: Verify package.json scripts
console.log('5. Testing package.json configuration...');
try {
  const pkg = require('./package.json');
  
  if (!pkg.scripts.start) {
    throw new Error('Missing start script');
  }
  if (!pkg.dependencies['@hubspot/api-client']) {
    throw new Error('Missing @hubspot/api-client dependency');
  }
  if (!pkg.dependencies.axios) {
    throw new Error('Missing axios dependency');
  }
  if (!pkg.dependencies.dotenv) {
    throw new Error('Missing dotenv dependency');
  }

  console.log('   ✓ Package configuration correct\n');
} catch (error) {
  console.error('   ✗ Package configuration test failed:', error.message);
  hasErrors = true;
}

// Summary
console.log('='.repeat(60));
if (hasErrors) {
  console.log('❌ Integration checks FAILED');
  console.log('='.repeat(60));
  process.exit(1);
} else {
  console.log('✅ All integration checks PASSED');
  console.log('='.repeat(60));
  console.log('\nThe HubSpot Listings Importer is ready to use!');
  console.log('\nNext steps:');
  console.log('  1. Configure your .env file with HUBSPOT_ACCESS_TOKEN and FEED_URL');
  console.log('  2. Run: npm start');
  console.log('  3. See QUICK_START.md for detailed instructions');
  console.log('  4. See RENDER_DEPLOYMENT.md for deployment to Render');
  process.exit(0);
}
