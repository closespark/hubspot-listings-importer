# HubSpot Listings Importer

A Node.js tool that imports JSON real estate feeds into HubSpot Listings objects. Designed to run on Render with support for secure secret management.

## Features

- ✅ Reads secrets from `/etc/secrets/.env` and Render environment variables
- ✅ Creates HubSpot Listings custom object if it doesn't exist
- ✅ Automatically creates all required custom properties
- ✅ Transforms JSON feed data to HubSpot format
- ✅ Upserts records (creates new or updates existing based on hs_name)
- ✅ Retry logic with exponential backoff for API calls
- ✅ Comprehensive logging with configurable log levels
- ✅ Batch processing for large feeds

## Supported Properties

The importer uses both HubSpot-owned properties (prefixed with `hs_`) and custom properties:

### HubSpot-Owned Properties (hs_ prefix)
These properties are auto-created by HubSpot and are referenced using their correct internal names:
- `hs_name` - Listing name (auto-generated from address, unique identifier for upserts)
- `price` - Native HubSpot price field (authoritative, not prefixed with hs_)
- `hs_square_footage` - Square footage
- `hs_bathrooms` - Number of bathrooms
- `hs_bedrooms` - Number of bedrooms
- `hs_lot_size` - Lot size value
- `hs_city` - City
- `hs_state_province` - State/Province
- `hs_zip` - ZIP/Postal code
- `hs_address_1` - Primary address line
- `hs_address_2` - Secondary address line

### Custom Properties
These properties are created and managed by the importer:
- `external_listing_id` - External reference identifier (for tracking source system ID)
- `reference_id` - Secondary reference ID
- `listing_start_date` - When listing became active
- `listing_end_date` - When listing ended or expires
- `list_price` - **Legacy price field (read-only, cleared when price is updated)**
- `listing_status` - Current status (dropdown: For Sale, Under Contract, Sold, Withdrawn, Expired)
- `lot_size_units` - Units for lot size (dropdown: Square Feet, Acres, Square Meters)
- `state_code` - US state code dropdown (e.g., CA, NY, TX)
- `county` - County
- `listing_url` - URL to the property listing page
- `primary_image_url` - URL to the main property image
- `is_new_listing` - Whether this is a new listing
- `is_featured` - Whether this listing is featured
- `marketing_eligible` - Whether this listing is eligible for marketing campaigns
- `auction_status` - Auction status (internal values: not_on_auction, upcoming, active, ended, sold)
- `auction_start_date` - Auction start date
- `auction_end_date` - Auction end date

### HubSpot Native Listing Type (hs_listing_type)
The importer automatically infers and writes to the HubSpot-owned `hs_listing_type` field based on property characteristics.
Valid values (HubSpot internal enum):
- `house` - Standard single-family home (default)
- `townhouse` - Townhouse/row house
- `multi_family` - Multi-family property
- `condos_co_ops` - Condos or co-ops
- `lots_land` - Vacant lots or land
- `apartments` - Apartment buildings
- `manufactured` - Manufactured/mobile homes

## Prerequisites

- Node.js 14 or higher
- HubSpot account with API access
- HubSpot Private App Access Token with CRM scopes:
  - `crm.objects.custom.read`
  - `crm.objects.custom.write`
  - `crm.schemas.custom.read`
  - `crm.schemas.custom.write`

## Installation

1. Clone the repository:
```bash
git clone https://github.com/closespark/hubspot-listings-importer.git
cd hubspot-listings-importer
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (see Configuration section)

## Configuration

The application reads configuration from multiple sources in priority order:

1. **Render environment variables** (highest priority)
2. `/etc/secrets/.env` file (Render secrets)
3. `.env` file in project root (local development)

### Required Variables

```bash
HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_token
FEED_URL=https://your-feed-url.com/listings.json
```

### Optional Variables

```bash
LOG_LEVEL=info              # error, warn, info, debug (default: info)
RETRY_ATTEMPTS=3            # Number of retry attempts (default: 3)
RETRY_DELAY=1000           # Initial retry delay in ms (default: 1000)
BATCH_SIZE=100             # Number of listings per batch (default: 100)
```

### Local Development

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Render Deployment

On Render, configure environment variables in the dashboard or create a secret file at `/etc/secrets/.env`.

## Usage

### CLI Interface

The importer supports both file-based and URL-based feeds via command-line arguments:

**Import from local file:**
```bash
node src/cli.js --file ./path/to/feed.json
```

**Import from URL:**
```bash
node src/cli.js --url https://example.com/feed.json
```

**Dry-run mode (no changes to HubSpot):**
```bash
node src/cli.js --file ./feed.json --dry-run
```

**Show help:**
```bash
node src/cli.js --help
```

### Environment Variables (Legacy)

You can also use environment variables (for backward compatibility or Render deployments):

```bash
# For URL-based feeds
FEED_URL=https://example.com/feed.json npm start

# For file-based feeds
FEED_SOURCE=file FEED_FILE_PATH=./feed.json npm start
```

### On Render

The application will run automatically when deployed to Render. Configure it as:

- **Service Type**: Background Worker or Cron Job
- **Build Command**: `npm install`
- **Start Command**: `npm start` or `node src/cli.js --url $FEED_URL`

## One-Time Local Listings Import

For a one-time import of listings from a local JSON file:

1. Place your listings JSON file at `data/properties_combined.json`

2. Create a `.env` file in the project root:
   ```bash
   HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_token
   ```

3. Run the importer:
   ```bash
   node src/index.js ./data/properties_combined.json
   ```

**Notes:**
- The importer uses `hs_name` as the unique identifier and performs upserts (creates new or updates existing records)
- `hs_name` is auto-generated from address components (street, city, state, zip)
- Listings are uniquely identified and upserted by `hs_name`
- Re-running the import will update existing listings, not create duplicates
- Data files in `data/` are gitignored to prevent accidental commits
- This is intended for one-time use; the JSON file is not synced or scheduled
- For more CLI options (--dry-run, --url), use `node src/cli.js` instead

## Feed Data Format

The importer supports flexible JSON feed formats. The feed can be:

1. An array of listing objects:
```json
[
  {
    "assetId": "12345",
    "listPrice": 500000,
    "city": "San Francisco",
    ...
  }
]
```

2. An object with a listings array:
```json
{
  "listings": [
    { "assetId": "12345", ... }
  ]
}
```

3. Common wrapper properties supported: `listings`, `results`, `data`

### Field Mapping

The transformer supports multiple field name variations:

| HubSpot Property | Accepted Feed Fields |
|-----------------|---------------------|
| hs_name | Auto-generated from address (hs_address_1, hs_city, hs_state_province, hs_zip) |
| external_listing_id | `externalListingId`, `external_listing_id`, `assetId`, `asset_id`, `id` |
| reference_id | `referenceId`, `reference_id`, `assetReferenceId`, `asset_reference_id` |
| listing_start_date | `listingStartDate`, `listing_start_date`, `startDate`, `start_date` |
| listing_end_date | `listingEndDate`, `listing_end_date`, `endDate`, `end_date` |
| price | `listPrice`, `list_price`, `price` |
| listing_status | `listingStatus`, `listing_status`, `status` |
| hs_square_footage | `squareFootage`, `square_footage`, `sqft` |
| hs_bathrooms | `bathrooms`, `baths` |
| hs_bedrooms | `bedrooms`, `beds` |
| hs_lot_size | `lotSize`, `lot_size` |
| lot_size_units | `lotSizeUnits`, `lot_size_units` |
| hs_city | `city` |
| hs_state_province | `state` |
| state_code | `stateCode`, `state_code` (auto-derived from state) |
| hs_zip | `zip`, `zipCode`, `zip_code`, `postal_code` |
| county | `county` |
| hs_address_1 | `addressLine1`, `address_line_1`, `address1`, `address`, `street` |
| hs_address_2 | `addressLine2`, `address_line_2`, `address2`, `unit` |
| listing_url | `listingUrl`, `listing_url`, `propertyUrl`, `property_url`, `url` |
| primary_image_url | `primaryImageUrl`, `primary_image_url`, `imageUrl`, `image_url`, `mediaUrl`, `media_url` |
| is_new_listing | `isNewListing`, `is_new_listing`, `isNew`, `is_new` |
| is_featured | `isFeatured`, `is_featured`, `featured` |
| marketing_eligible | `marketingEligible`, `marketing_eligible` |
| auction_status | `auctionStatus`, `auction_status` |
| auction_start_date | `auctionStartDate`, `auction_start_date` |
| auction_end_date | `auctionEndDate`, `auction_end_date` |

## Data Behavior & Defaults

This section documents how the importer handles data transformation, automatic field derivation, and default values.

### Default Values

The following fields have automatic default behaviors when not explicitly provided in the feed:

| Field | Default | Description |
|-------|---------|-------------|
| `marketingEligible` | `true` | Listings are marketing-eligible by default, making them available for email campaigns, workflows, and automation. Set explicitly to `false` in your feed to opt out. |

### State Code Derivation

The `stateCode` field is automatically derived from the `state` field:

- If `stateCode` is already provided and is a valid 2-letter code, it's used directly
- If `state` is a valid 2-letter code (e.g., "CA", "NY"), it's used directly
- If `state` is a full name (e.g., "California"), it's converted to the code
- If derivation fails, `stateCode` remains unset (warnings are aggregated in the summary)

### Date Parsing

Dates are parsed with the following rules:

- **Numeric timestamps**: Interpreted as Unix timestamps (seconds or milliseconds)
- **String dates**: Parsed using JavaScript's `Date` constructor
- **Valid range**: Dates must be between years 1900 and 2100
- **Invalid dates**: Logged as warnings and the field remains unset
- **Auction dates**: `auction_start_date` and `auction_end_date` are normalized to midnight UTC. Any timestamp with a time component is stripped before sending to HubSpot to avoid `INVALID_DATE` errors.

### Auction Status Values

The `auction_status` field uses HubSpot's internal enum values. Human-readable values from feed data are automatically normalized:

**Valid internal values:**
- `not_on_auction` - Not currently on auction
- `upcoming` - Auction scheduled but not started
- `active` - Auction currently in progress
- `ended` - Auction has ended
- `sold` - Sold at auction

**Human-readable mappings:**
- "For Sale" → `active`
- "Bidding Started" → `active`
- "Upcoming" → `upcoming`
- "Ended" → `ended`
- "Sold" → `sold`

**Invalid values** are dropped and not sent to HubSpot to avoid `INVALID_OPTION` errors.

## Operational Notes

This section covers logging behavior and operational considerations for running the importer at scale.

### Aggregated Warnings

To prevent log flooding when processing large feeds, the importer aggregates transformation warnings by type and reports a summary at the end of each batch. This includes:

- **State code derivation failures**: When `stateCode` cannot be derived from the `state` field
- **Invalid state codes**: When provided `stateCode` values don't match valid US state codes
- **Date parsing issues**: Invalid dates, dates out of range, or unsupported date formats

Example summary output:
```
[WARN] Could not derive stateCode from state values: 15 occurrence(s) (examples: "Unknown State", "XX", "Atlantis", ...)
[WARN] Invalid date values encountered: 3 occurrence(s) (examples: "not-a-date", "2025-99-99", ...)
[INFO] For details on individual warnings, set LOG_LEVEL=debug
```

### Debug Mode

Set `LOG_LEVEL=debug` to see individual warnings for each record, including:

- Each failed state code derivation with the specific value
- Each invalid date with the problematic value
- API request and response details

This is useful for debugging feed data quality issues but may produce verbose output for large feeds.

### Scaling Considerations

When processing large feeds (10,000+ listings):

- **Batch size**: Adjust `BATCH_SIZE` to balance memory usage and API efficiency
- **Logging verbosity**: Keep `LOG_LEVEL=info` or `LOG_LEVEL=warn` to avoid excessive log volume
- **Error isolation**: Individual listing failures don't stop the batch; errors are collected and reported in the summary

## How It Works

1. **Initialize**: Ensures the Listings custom object exists in HubSpot
2. **Create Properties**: Creates all required custom properties if they don't exist
3. **Fetch Feed**: Downloads the JSON feed from the configured URL
4. **Transform**: Converts feed data to HubSpot format with field mapping
5. **Upsert**: For each listing:
   - Searches for existing listing by `hs_name` (uniquely identifies listings)
   - Updates if found (limited fields only), creates if not found
   - Never creates duplicates
6. **Retry**: Failed API calls are retried with exponential backoff
7. **Log**: All operations are logged with configurable verbosity

## Error Handling

- API calls have automatic retry with exponential backoff
- Invalid listings are logged and skipped
- Failed upserts are tracked and reported in the summary
- All errors include detailed context for debugging

## Logging

Logs are written to stdout with timestamps and severity levels:

```
[2024-01-15T10:30:45.123Z] [INFO] Starting HubSpot Listings Importer
[2024-01-15T10:30:46.456Z] [INFO] Fetched 150 listings from feed
[2024-01-15T10:30:47.789Z] [INFO] Created listing: 12345
```

Set `LOG_LEVEL=debug` for verbose output including API request details.

## Troubleshooting

### Authentication Errors

- Verify your `HUBSPOT_ACCESS_TOKEN` is valid
- Ensure the token has required CRM scopes
- Check token hasn't expired

### Feed Fetch Errors

- Verify `FEED_URL` is accessible
- Check feed returns valid JSON
- Ensure feed format matches expected structure

### Property Creation Errors

- Verify token has `crm.schemas.custom.write` scope
- Check HubSpot account limits for custom objects

## Development

### Project Structure

```
.
├── src/
│   ├── index.js           # Entry point
│   ├── config.js          # Configuration management
│   ├── logger.js          # Logging utility
│   ├── properties.js      # Property definitions
│   ├── hubspot-client.js  # HubSpot API client
│   ├── transformer.js     # Data transformation
│   ├── feed-fetcher.js    # Feed fetching
│   └── importer.js        # Main import logic
├── package.json
└── README.md
```

### Adding New Properties

To add new properties, update `src/properties.js`:

```javascript
{
  name: 'myNewField',
  label: 'My New Field',
  type: 'string',
  fieldType: 'text',
  groupName: 'listingsinformation',
  description: 'Description of the field',
}
```

Then update `src/transformer.js` to map the field from your feed format.

## License

MIT
