# Quick Start Guide

This guide will help you quickly test the HubSpot Listings Importer locally.

## Prerequisites

- Node.js 14+ installed
- HubSpot account with Private App Access Token
- A JSON feed URL or local file

## Steps

### 1. Clone and Install

```bash
git clone https://github.com/closespark/hubspot-listings-importer.git
cd hubspot-listings-importer
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```
HUBSPOT_ACCESS_TOKEN=your_hubspot_token_here
FEED_URL=https://your-feed-url.com/listings.json
LOG_LEVEL=debug
```

### 3. Test with Sample Data (Optional)

First, test the transformer with the included sample data:

```bash
node test-transformer.js
```

You should see:
```
Testing Data Transformer...
Loaded 3 listings from sample feed
Transformed 3 listings
✓ All listings have required fields
```

### 4. Run the Importer

```bash
npm start
```

You should see output like:

```
[INFO] Starting HubSpot Listings Importer
[INFO] Initializing HubSpot environment...
[INFO] Checking if Listings custom object exists...
[INFO] Ensuring all required properties exist...
[INFO] Fetching feed data...
[INFO] Fetched X listings from feed
[INFO] Transforming feed data to HubSpot format...
[INFO] Processing X listings...
[INFO] Created listing: ASSET-001
[INFO] Updated listing: ASSET-002
[INFO] Import completed
```

## Testing with Local JSON File

If you want to test with a local file instead of a URL:

1. Create a local web server to serve your JSON file:

```bash
# Install a simple HTTP server
npm install -g http-server

# Serve the current directory
http-server -p 8000
```

2. Update your `.env`:

```
FEED_URL=http://localhost:8000/sample-feed.json
```

3. Run the importer:

```bash
npm start
```

## Troubleshooting

### "HUBSPOT_ACCESS_TOKEN is required"

Make sure your `.env` file exists and contains the token:

```bash
cat .env | grep HUBSPOT_ACCESS_TOKEN
```

### "FEED_URL is required"

Make sure your `.env` file contains the feed URL:

```bash
cat .env | grep FEED_URL
```

### "Failed to fetch feed"

- Check that the URL is accessible
- Verify the URL returns valid JSON
- Try accessing the URL in your browser

### HubSpot API Errors

- Verify your Access Token is valid
- Check token has required scopes (see README)
- Ensure token hasn't expired

## Next Steps

- See [README.md](README.md) for full documentation
- See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for deployment instructions
- Customize field mappings in `src/transformer.js`
- Add new properties in `src/properties.js`
