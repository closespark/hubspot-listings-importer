# Deployment Guide for Render

This guide explains how to deploy the HubSpot Listings Importer to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. A HubSpot account with a Private App configured
3. A JSON feed URL with real estate listings

## Step 1: Create a HubSpot Private App

1. Log in to your HubSpot account
2. Navigate to Settings → Integrations → Private Apps
3. Click "Create a private app"
4. Give it a name (e.g., "Listings Importer")
5. Enable the following scopes:
   - `crm.objects.custom.read`
   - `crm.objects.custom.write`
   - `crm.schemas.custom.read`
   - `crm.schemas.custom.write`
6. Create the app and copy the Access Token

## Step 2: Deploy to Render

### Option A: Background Worker (Continuous Running)

1. Log in to Render Dashboard
2. Click "New +" → "Background Worker"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `hubspot-listings-importer`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables (see below)
6. Click "Create Background Worker"

### Option B: Cron Job (Scheduled Running)

1. Log in to Render Dashboard
2. Click "New +" → "Cron Job"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `hubspot-listings-importer`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Schedule**: Set your desired schedule (e.g., `0 */6 * * *` for every 6 hours)
5. Add environment variables (see below)
6. Click "Create Cron Job"

## Step 3: Configure Environment Variables

Add the following environment variables in Render:

### Required Variables

| Variable | Value |
|----------|-------|
| `HUBSPOT_ACCESS_TOKEN` | Your HubSpot Private App Access Token |
| `FEED_URL` | URL to your JSON feed (e.g., `https://api.example.com/listings.json`) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level: `error`, `warn`, `info`, or `debug` |
| `RETRY_ATTEMPTS` | `3` | Number of retry attempts for failed API calls |
| `RETRY_DELAY` | `1000` | Initial retry delay in milliseconds |
| `BATCH_SIZE` | `100` | Number of listings to process in each batch |

## Step 4: Configure Secrets File (Optional)

If you prefer to use Render's secret files feature:

1. In Render Dashboard, go to your service
2. Navigate to "Environment" tab
3. Click "Secret Files"
4. Click "Add Secret File"
5. Set **Filename**: `/etc/secrets/.env`
6. Set **Contents**:
```
HUBSPOT_ACCESS_TOKEN=your_token_here
FEED_URL=https://your-feed-url.com/listings.json
LOG_LEVEL=info
```
7. Click "Save Changes"

## Step 5: Deploy and Monitor

1. Render will automatically deploy your service
2. Monitor the logs in the Render Dashboard:
   - Click on your service
   - Navigate to "Logs" tab
3. Look for success messages:
   ```
   [INFO] Starting HubSpot Listings Importer
   [INFO] Fetched X listings from feed
   [INFO] Import completed
   ```

## Troubleshooting

### Authentication Errors

If you see authentication errors:
- Verify `HUBSPOT_ACCESS_TOKEN` is correct
- Check that the token has all required scopes
- Ensure the Private App is active in HubSpot

### Feed Fetch Errors

If feed fetching fails:
- Verify `FEED_URL` is accessible from Render
- Check that the URL returns valid JSON
- Ensure the feed format matches the expected structure

### Memory Issues

If you encounter memory issues with large feeds:
- Reduce `BATCH_SIZE` to process fewer listings at once
- Consider upgrading to a higher Render plan

### Timeout Issues

If requests timeout:
- Increase `RETRY_DELAY` for more time between retries
- Check HubSpot API rate limits
- Consider splitting the import into multiple smaller runs

## Monitoring and Alerts

### Setting up Notifications

1. In Render Dashboard, go to your service
2. Navigate to "Notifications" tab
3. Add email or Slack notifications for:
   - Deploy failures
   - Service crashes
   - Health check failures

### Log Analysis

Key log messages to monitor:

- **Success**: `Import completed successfully`
- **Partial Success**: `Import completed with errors` (check error count)
- **Failure**: `Fatal error during import`

### Metrics to Track

- Number of listings created
- Number of listings updated
- Number of failures
- Import duration

## Updating the Service

To update the importer:

1. Push changes to your GitHub repository
2. Render will automatically detect and deploy changes
3. Or manually trigger a deploy from the Render Dashboard

## Scaling Considerations

For large feeds (10,000+ listings):

1. **Increase Resources**: Upgrade to a higher Render plan
2. **Adjust Batch Size**: Increase `BATCH_SIZE` for faster processing
3. **Use Cron Jobs**: Schedule imports during off-peak hours
4. **Monitor Rate Limits**: HubSpot has API rate limits - adjust timing accordingly

## Support

For issues or questions:

- Check the [README](README.md) for detailed documentation
- Review Render logs for error messages
- Verify HubSpot API status at https://status.hubspot.com
- Check your feed availability and format
