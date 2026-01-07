#!/usr/bin/env node

/**
 * Test script for HubSpot Listings upsert behavior changes:
 * 1. Uses price instead of list_price
 * 2. Auction status normalization
 * 3. Auction date normalization to midnight UTC
 * 4. Upsert field filtering
 * 5. Fail soft on invalid auction data
 */

// Mock config and logger to avoid requiring environment variables
process.env.HUBSPOT_ACCESS_TOKEN = 'test-token';
process.env.FEED_URL = 'http://test.com/feed.json';

const transformer = require('./src/transformer');
const HubSpotClient = require('./src/hubspot-client');

console.log('Testing HubSpot Listings Upsert Behavior...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, actual, expected) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`✓ ${name}`);
    testsPassed++;
  } else {
    console.error(`✗ ${name}: got ${actualStr}, expected ${expectedStr}`);
    testsFailed++;
  }
}

function isAtMidnightUTC(epochMs) {
  if (epochMs === null || epochMs === undefined) return true;
  const d = new Date(epochMs);
  return d.getUTCHours() === 0 &&
         d.getUTCMinutes() === 0 &&
         d.getUTCSeconds() === 0 &&
         d.getUTCMilliseconds() === 0;
}

// =============================================================================
// Test 1: Uses HubSpot's native price field instead of list_price
// =============================================================================
console.log('Test 1: Uses price instead of list_price');

const listing1 = {
  external_listing_id: 'TEST-001',
  list_price: 500000,
};
const transformed1 = transformer.transformListing(listing1);
test('Output uses price field', transformed1.price, 500000);
test('Output does not include list_price', transformed1.list_price, undefined);

// Test with price input field
const listing1b = {
  external_listing_id: 'TEST-001b',
  price: 600000,
};
const transformed1b = transformer.transformListing(listing1b);
test('Price input maps to price output', transformed1b.price, 600000);
test('Price input - no list_price', transformed1b.list_price, undefined);

// =============================================================================
// Test 2: Auction status normalization
// =============================================================================
console.log('\nTest 2: Auction status normalization');

// Valid internal values pass through
const listingAuction1 = {
  external_listing_id: 'AUCTION-001',
  auction_status: 'active',
};
const transformedAuction1 = transformer.transformListing(listingAuction1);
test('Valid "active" passes through', transformedAuction1.auction_status, 'active');

const listingAuction2 = {
  external_listing_id: 'AUCTION-002',
  auction_status: 'not_on_auction',
};
const transformedAuction2 = transformer.transformListing(listingAuction2);
test('Valid "not_on_auction" passes through', transformedAuction2.auction_status, 'not_on_auction');

// Human-readable strings map to internal values
const listingAuction3 = {
  external_listing_id: 'AUCTION-003',
  auction_status: 'For Sale',
};
const transformedAuction3 = transformer.transformListing(listingAuction3);
test('"For Sale" maps to "active"', transformedAuction3.auction_status, 'active');

const listingAuction4 = {
  external_listing_id: 'AUCTION-004',
  auction_status: 'Bidding Started',
};
const transformedAuction4 = transformer.transformListing(listingAuction4);
test('"Bidding Started" maps to "active"', transformedAuction4.auction_status, 'active');

const listingAuction5 = {
  external_listing_id: 'AUCTION-005',
  auction_status: 'Upcoming',
};
const transformedAuction5 = transformer.transformListing(listingAuction5);
test('"Upcoming" maps to "upcoming"', transformedAuction5.auction_status, 'upcoming');

const listingAuction6 = {
  external_listing_id: 'AUCTION-006',
  auction_status: 'Ended',
};
const transformedAuction6 = transformer.transformListing(listingAuction6);
test('"Ended" maps to "ended"', transformedAuction6.auction_status, 'ended');

const listingAuction7 = {
  external_listing_id: 'AUCTION-007',
  auction_status: 'Sold',
};
const transformedAuction7 = transformer.transformListing(listingAuction7);
test('"Sold" maps to "sold"', transformedAuction7.auction_status, 'sold');

// Invalid/unknown values are omitted
const listingAuction8 = {
  external_listing_id: 'AUCTION-008',
  auction_status: 'Invalid Status Value',
};
const transformedAuction8 = transformer.transformListing(listingAuction8);
test('Invalid status is omitted', transformedAuction8.auction_status, undefined);

const listingAuction9 = {
  external_listing_id: 'AUCTION-009',
  auction_status: 'Pending Review',
};
const transformedAuction9 = transformer.transformListing(listingAuction9);
test('Unknown status is omitted', transformedAuction9.auction_status, undefined);

// =============================================================================
// Test 3: Auction date normalization to midnight UTC
// =============================================================================
console.log('\nTest 3: Auction date normalization to midnight UTC');

const listingDate1 = {
  external_listing_id: 'DATE-001',
  auction_start_date: '2024-02-01T14:30:00Z',
  auction_end_date: '2024-02-15T23:59:59Z',
};
const transformedDate1 = transformer.transformListing(listingDate1);
test('auction_start_date normalized to midnight', isAtMidnightUTC(transformedDate1.auction_start_date), true);
test('auction_end_date normalized to midnight', isAtMidnightUTC(transformedDate1.auction_end_date), true);
// Feb 1 2024 00:00:00 UTC = 1706745600000
test('auction_start_date = 2024-02-01 midnight', transformedDate1.auction_start_date, 1706745600000);
// Feb 15 2024 00:00:00 UTC = 1707955200000
test('auction_end_date = 2024-02-15 midnight', transformedDate1.auction_end_date, 1707955200000);

// Test with epoch timestamps
const listingDate2 = {
  external_listing_id: 'DATE-002',
  auction_start_date: 1706792400000, // 2024-02-01T13:00:00Z
};
const transformedDate2 = transformer.transformListing(listingDate2);
test('Epoch with time normalized to midnight', isAtMidnightUTC(transformedDate2.auction_start_date), true);
test('Epoch normalized correctly', transformedDate2.auction_start_date, 1706745600000);

// Invalid dates are omitted (fail soft)
const listingDate3 = {
  external_listing_id: 'DATE-003',
  auction_start_date: 'invalid-date',
  auction_end_date: null,
};
const transformedDate3 = transformer.transformListing(listingDate3);
test('Invalid auction_start_date is omitted', transformedDate3.auction_start_date, undefined);
test('Null auction_end_date is omitted', transformedDate3.auction_end_date, undefined);

// =============================================================================
// Test 4: HubSpotClient update properties filtering
// =============================================================================
console.log('\nTest 4: HubSpotClient update properties filtering');

const client = new HubSpotClient();

// Test prepareUpdateProperties
const fullProperties = {
  external_listing_id: 'TEST-100',
  hs_name: 'Test Listing',
  price: 500000,
  auction_status: 'active',
  auction_start_date: 1706745600000,
  auction_end_date: 1707955200000,
  hs_city: 'San Francisco', // Should not be included in update
  hs_bedrooms: 3, // Should not be included in update
};

const updateProps = client.prepareUpdateProperties(fullProperties);
test('Update includes price', updateProps.price, 500000);
test('Update includes auction_status', updateProps.auction_status, 'active');
test('Update includes auction_start_date', updateProps.auction_start_date, 1706745600000);
test('Update includes auction_end_date', updateProps.auction_end_date, 1707955200000);
test('Update sets list_price to null (backfill cleanup)', updateProps.list_price, null);
test('Update does not include hs_city', updateProps.hs_city, undefined);
test('Update does not include hs_bedrooms', updateProps.hs_bedrooms, undefined);
test('Update does not include hs_name', updateProps.hs_name, undefined);
test('Update does not include external_listing_id', updateProps.external_listing_id, undefined);

// Test that list_price is NOT cleared if price is not set
const updatePropsNoPrice = client.prepareUpdateProperties({
  external_listing_id: 'TEST-101',
  auction_status: 'ended',
});
test('No list_price when price not set', updatePropsNoPrice.list_price, undefined);
test('auction_status included without price', updatePropsNoPrice.auction_status, 'ended');

// =============================================================================
// Test 5: HubSpotClient create properties filtering
// =============================================================================
console.log('\nTest 5: HubSpotClient create properties filtering');

const createInputProps = {
  external_listing_id: 'TEST-200',
  hs_name: 'New Listing',
  price: 750000,
  list_price: 750000, // Should be removed
  hs_city: 'Oakland',
  hs_bedrooms: 4,
  auction_status: 'upcoming',
};

const createProps = client.prepareCreateProperties(createInputProps);
test('Create includes external_listing_id', createProps.external_listing_id, 'TEST-200');
test('Create includes hs_name', createProps.hs_name, 'New Listing');
test('Create includes price', createProps.price, 750000);
test('Create does not include list_price', createProps.list_price, undefined);
test('Create includes hs_city', createProps.hs_city, 'Oakland');
test('Create includes hs_bedrooms', createProps.hs_bedrooms, 4);
test('Create includes auction_status', createProps.auction_status, 'upcoming');

// =============================================================================
// Test 6: Fail soft on auction data (auction fields don't block listing)
// =============================================================================
console.log('\nTest 6: Fail soft on auction data');

const listingBadAuction = {
  external_listing_id: 'FAIL-SOFT-001',
  price: 400000,
  auction_status: 'BadEnumValue', // Invalid - should be omitted
  auction_start_date: 'not-a-date', // Invalid - should be omitted
  auction_end_date: '2024-02-15T00:00:00Z', // Valid
  city: 'Test City',  // Use 'city' as that's what transformer expects
};
const transformedBadAuction = transformer.transformListing(listingBadAuction);

test('Listing still has external_listing_id', transformedBadAuction.external_listing_id, 'FAIL-SOFT-001');
test('Listing still has price', transformedBadAuction.price, 400000);
test('Listing still has hs_city', transformedBadAuction.hs_city, 'Test City');
test('Invalid auction_status omitted (not blocking)', transformedBadAuction.auction_status, undefined);
test('Invalid auction_start_date omitted (not blocking)', transformedBadAuction.auction_start_date, undefined);
test('Valid auction_end_date still included', transformedBadAuction.auction_end_date, 1707955200000);

// =============================================================================
// Summary
// =============================================================================
console.log(`\n${'-'.repeat(60)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✓ All upsert behavior tests passed!');
  process.exit(0);
}
