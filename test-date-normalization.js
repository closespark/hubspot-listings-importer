#!/usr/bin/env node

/**
 * Test script for HubSpot date-only field normalization
 * Verifies that listing_start_date and listing_end_date are normalized to midnight UTC
 */

// Mock config and logger to avoid requiring environment variables
process.env.HUBSPOT_ACCESS_TOKEN = 'test-token';
process.env.FEED_URL = 'http://test.com/feed.json';

const transformer = require('./src/transformer');

console.log('Testing HubSpot Date-Only Field Normalization...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, actual, expected) {
  if (actual === expected) {
    console.log(`✓ ${name}`);
    testsPassed++;
  } else {
    console.error(`✗ ${name}: got ${actual}, expected ${expected}`);
    testsFailed++;
  }
}

function isAtMidnightUTC(epochMs) {
  if (epochMs === null) return true; // null is valid
  const d = new Date(epochMs);
  return d.getUTCHours() === 0 &&
         d.getUTCMinutes() === 0 &&
         d.getUTCSeconds() === 0 &&
         d.getUTCMilliseconds() === 0;
}

// Test 1: Date already at midnight UTC should remain unchanged
console.log('Test 1: Date already at midnight UTC');
const listing1 = {
  external_listing_id: 'TEST-001',
  listing_start_date: '2024-01-15T00:00:00Z',
};
const transformed1 = transformer.transformListing(listing1);
// 2024-01-15T00:00:00Z = 1705276800000
test('listing_start_date is at midnight UTC', isAtMidnightUTC(transformed1.listing_start_date), true);
test('listing_start_date value correct (1705276800000)', transformed1.listing_start_date, 1705276800000);

// Test 2: Date with time component should be normalized to midnight
console.log('\nTest 2: Date with time component');
const listing2 = {
  external_listing_id: 'TEST-002',
  listing_start_date: '2024-01-15T14:30:45Z',
  listing_end_date: '2024-02-15T23:59:59Z',
};
const transformed2 = transformer.transformListing(listing2);
test('listing_start_date normalized to midnight UTC', isAtMidnightUTC(transformed2.listing_start_date), true);
test('listing_end_date normalized to midnight UTC', isAtMidnightUTC(transformed2.listing_end_date), true);
// Both should be at midnight of their respective dates
test('listing_start_date = 2024-01-15 midnight (1705276800000)', transformed2.listing_start_date, 1705276800000);
test('listing_end_date = 2024-02-15 midnight (1707955200000)', transformed2.listing_end_date, 1707955200000);

// Test 3: Epoch milliseconds input with time should be normalized
console.log('\nTest 3: Epoch milliseconds with time component');
// 1705320645000 = 2024-01-15T12:10:45Z
const listing3 = {
  external_listing_id: 'TEST-003',
  listing_start_date: 1705320645000,
};
const transformed3 = transformer.transformListing(listing3);
test('Epoch with time normalized to midnight UTC', isAtMidnightUTC(transformed3.listing_start_date), true);
test('Epoch normalized correctly (1705276800000)', transformed3.listing_start_date, 1705276800000);

// Test 4: Epoch seconds input should be normalized
console.log('\nTest 4: Epoch seconds with time component');
// 1705320645 seconds = 2024-01-15T12:10:45Z
const listing4 = {
  external_listing_id: 'TEST-004',
  listing_start_date: 1705320645,
};
const transformed4 = transformer.transformListing(listing4);
test('Epoch seconds normalized to midnight UTC', isAtMidnightUTC(transformed4.listing_start_date), true);
test('Epoch seconds normalized correctly (1705276800000)', transformed4.listing_start_date, 1705276800000);

// Test 5: Null values should not be added
console.log('\nTest 5: Null values');
const listing5 = {
  external_listing_id: 'TEST-005',
  listing_start_date: null,
  listing_end_date: null,
};
const transformed5 = transformer.transformListing(listing5);
// Null values don't add the property - undefined in transformed object
test('null listing_start_date not added (undefined)', transformed5.listing_start_date, undefined);
test('null listing_end_date not added (undefined)', transformed5.listing_end_date, undefined);

// Test 6: Missing date fields should not be added
console.log('\nTest 6: Missing date fields');
const listing6 = {
  external_listing_id: 'TEST-006',
};
const transformed6 = transformer.transformListing(listing6);
test('Missing listing_start_date not added', transformed6.listing_start_date, undefined);
test('Missing listing_end_date not added', transformed6.listing_end_date, undefined);

// Test 7: Date string without time (ISO date only)
console.log('\nTest 7: ISO date string (no time)');
const listing7 = {
  external_listing_id: 'TEST-007',
  listing_start_date: '2024-01-15',
};
const transformed7 = transformer.transformListing(listing7);
test('ISO date string normalized to midnight UTC', isAtMidnightUTC(transformed7.listing_start_date), true);

// Test 8: Different timezone offset should be normalized to midnight UTC
console.log('\nTest 8: Different timezone offset');
// 2024-01-15T20:00:00-05:00 = 2024-01-16T01:00:00Z (next day in UTC)
const listing8 = {
  external_listing_id: 'TEST-008',
  listing_start_date: '2024-01-15T20:00:00-05:00',
};
const transformed8 = transformer.transformListing(listing8);
test('Timezone offset normalized to midnight UTC', isAtMidnightUTC(transformed8.listing_start_date), true);
// This should be midnight of January 16th UTC since the original time converts to 01:00 UTC on Jan 16
test('Timezone offset gives correct date (1705363200000 = 2024-01-16 midnight)', transformed8.listing_start_date, 1705363200000);

// Summary
console.log(`\n${'-'.repeat(50)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✓ All date normalization tests passed!');
  process.exit(0);
}
