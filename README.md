# HubSpot Listings Importer

A Node.js tool that imports JSON real estate feeds into HubSpot Listings objects. Designed to run on Render with support for secure secret management.

## Features

- ✅ Reads secrets from `/etc/secrets/.env` and Render environment variables
- ✅ Creates HubSpot Listings custom object if it doesn't exist
- ✅ Automatically creates all required custom properties
- ✅ Transforms JSON feed data to HubSpot format
- ✅ Upserts records (creates new or updates existing based on assetId)
- ✅ Retry logic with exponential backoff for API calls
- ✅ Comprehensive logging with configurable log levels
- ✅ Batch processing for large feeds

## Supported Properties

The importer creates and manages the following Listings properties:

### Property Details
- `assetId` - Unique identifier (required)
- `listPrice` - Listing price
- `listingStatus` - Current status
- `propertyType` - Type of property

### Property Specifications
- `squareFootage` - Square footage
- `bathrooms` - Number of bathrooms
- `bedrooms` - Number of bedrooms
- `lotSize` - Lot size value
- `lotSizeUnits` - Units for lot size

### Location Information
- `city` - City
- `state` - State
- `zip` - ZIP/Postal code
- `county` - County
- `address1` - Primary address line
- `address2` - Secondary address line

### Media and Auction
- `mediaUrl` - URL to property media/images
- `auctionStatus` - Auction status
- `auctionStartDate` - Auction start date
- `auctionEndDate` - Auction end date

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

### Local Execution

```bash
npm start
```

### On Render

The application will run automatically when deployed to Render. Configure it as:

- **Service Type**: Background Worker or Cron Job
- **Build Command**: `npm install`
- **Start Command**: `npm start`

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

| HubSpot Field | Accepted Feed Fields |
|--------------|---------------------|
| assetId | `assetId`, `asset_id`, `id` |
| listPrice | `listPrice`, `list_price`, `price` |
| listingStatus | `listingStatus`, `listing_status`, `status` |
| squareFootage | `squareFootage`, `square_footage`, `sqft` |
| bathrooms | `bathrooms`, `baths` |
| bedrooms | `bedrooms`, `beds` |
| zip | `zip`, `zipCode`, `zip_code`, `postal_code` |
| address1 | `address1`, `address`, `street` |
| mediaUrl | `mediaUrl`, `media_url`, `imageUrl`, `image_url` |

## How It Works

1. **Initialize**: Ensures the Listings custom object exists in HubSpot
2. **Create Properties**: Creates all required custom properties if they don't exist
3. **Fetch Feed**: Downloads the JSON feed from the configured URL
4. **Transform**: Converts feed data to HubSpot format with field mapping
5. **Upsert**: For each listing:
   - Searches for existing listing by `assetId`
   - Updates if found, creates if not found
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
