/**
 * Normalize a property name to snake_case format required by HubSpot.
 * HubSpot requires property names to be lowercase + underscore only.
 * 
 * This utility is exported for use by consumers who need to dynamically
 * convert camelCase property names to HubSpot-compatible snake_case format.
 * 
 * @param {string} name - Property name (can be camelCase or snake_case)
 * @returns {string} Normalized snake_case property name
 * @example
 * normalizePropertyName('externalListingId') // => 'external_listing_id'
 * normalizePropertyName('listPrice') // => 'list_price'
 */
function normalizePropertyName(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase → snake_case
    .toLowerCase();
}

/**
 * US State codes for the state_code dropdown
 */
const US_STATE_CODES = [
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'District of Columbia', value: 'DC' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
];

/**
 * Define all required Listings properties for HubSpot
 */
const LISTINGS_PROPERTIES = [
  {
    name: 'external_listing_id',
    label: 'External Listing ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'listing_information',
    description: 'Unique external identifier for the listing',
  },
  {
    name: 'reference_id',
    label: 'Reference ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'listing_information',
    description: 'Secondary reference identifier for the listing',
  },
  {
    name: 'listing_start_date',
    label: 'Listing Start Date',
    type: 'date',
    fieldType: 'date',
    groupName: 'listing_information',
    description: 'Date when the listing became active',
  },
  {
    name: 'listing_end_date',
    label: 'Listing End Date',
    type: 'date',
    fieldType: 'date',
    groupName: 'listing_information',
    description: 'Date when the listing ended or expires',
  },
  {
    name: 'list_price',
    label: 'List Price',
    type: 'number',
    fieldType: 'number',
    groupName: 'listing_information',
    description: 'Listing price in dollars',
  },
  {
    name: 'listing_status',
    label: 'Listing Status',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'listing_information',
    description: 'Current status of the listing',
    options: [
      { label: 'For Sale', value: 'for_sale' },
      { label: 'Under Contract', value: 'under_contract' },
      { label: 'Sold', value: 'sold' },
      { label: 'Withdrawn', value: 'withdrawn' },
      { label: 'Expired', value: 'expired' },
    ],
  },
  // NOTE: hs_listing_type is HubSpot-owned — do NOT create or modify
  // Valid internal values: house, townhouse, multi_family, condos_co_ops, lots_land, apartments, manufactured
  //
  // NOTE: The following HubSpot-owned properties are NOT defined here because they already
  // exist with hs_ prefix (e.g., hs_square_footage, hs_bedrooms, hs_bathrooms, hs_lot_size,
  // hs_city, hs_state_province, hs_zip, hs_address_1, hs_address_2). We only define custom properties.
  {
    name: 'lot_size_units',
    label: 'Lot Size Units',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'listing_information',
    description: 'Units for lot size',
    options: [
      { label: 'Square Feet', value: 'sqft' },
      { label: 'Acres', value: 'acres' },
      { label: 'Square Meters', value: 'sqm' },
    ],
  },
  // NOTE: hs_city, hs_state_province, hs_zip are HubSpot-owned properties - not defined here
  {
    name: 'state_code',
    label: 'State Code',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'listing_information',
    description: 'US state code (e.g., CA, NY, TX)',
    options: US_STATE_CODES,
  },
  // NOTE: hs_zip is HubSpot-owned property - not defined here
  {
    name: 'county',
    label: 'County',
    type: 'string',
    fieldType: 'text',
    groupName: 'listing_information',
    description: 'County where property is located',
  },
  // NOTE: hs_address_1 and hs_address_2 are HubSpot-owned properties - not defined here
  {
    name: 'listing_url',
    label: 'Listing URL',
    type: 'string',
    fieldType: 'text',
    groupName: 'listing_information',
    description: 'URL to the property listing page',
  },
  {
    name: 'primary_image_url',
    label: 'Primary Image URL',
    type: 'string',
    fieldType: 'text',
    groupName: 'listing_information',
    description: 'URL to the main property image',
  },
  {
    name: 'is_new_listing',
    label: 'Is New Listing',
    type: 'bool',
    fieldType: 'booleancheckbox',
    groupName: 'listing_information',
    description: 'Whether this is a new listing',
  },
  {
    name: 'is_featured',
    label: 'Is Featured',
    type: 'bool',
    fieldType: 'booleancheckbox',
    groupName: 'listing_information',
    description: 'Whether this listing is featured',
  },
  {
    name: 'marketing_eligible',
    label: 'Marketing Eligible',
    type: 'bool',
    fieldType: 'booleancheckbox',
    groupName: 'listing_information',
    description: 'Whether this listing is eligible for marketing campaigns',
  },
  {
    name: 'auction_status',
    label: 'Auction Status',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'listing_information',
    description: 'Status of auction if applicable',
    options: [
      { label: 'Not on Auction', value: 'not_on_auction' },
      { label: 'Upcoming', value: 'upcoming' },
      { label: 'Active', value: 'active' },
      { label: 'Ended', value: 'ended' },
      { label: 'Sold', value: 'sold' },
    ],
  },
  {
    name: 'auction_start_date',
    label: 'Auction Start Date',
    type: 'date',
    fieldType: 'date',
    groupName: 'listing_information',
    description: 'Date when auction starts',
  },
  {
    name: 'auction_end_date',
    label: 'Auction End Date',
    type: 'date',
    fieldType: 'date',
    groupName: 'listing_information',
    description: 'Date when auction ends',
  },
];

/**
 * Valid state codes set for quick lookup
 */
const VALID_STATE_CODES = new Set(US_STATE_CODES.map(s => s.value));

module.exports = {
  LISTINGS_PROPERTIES,
  US_STATE_CODES,
  VALID_STATE_CODES,
  normalizePropertyName,
};
