#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const Importer = require('./importer');
const logger = require('./logger');

/**
 * CLI entry point for the HubSpot Listings Importer
 */

program
  .name('hubspot-listings-importer')
  .description('Import JSON real estate feeds into HubSpot Listings')
  .version('1.0.0')
  .option('-f, --file <path>', 'Path to JSON feed file')
  .option('-u, --url <url>', 'URL to JSON feed')
  .option('--dry-run', 'Run without making changes to HubSpot', false)
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    // Validate input
    if (!options.file && !options.url) {
      logger.error('Error: Either --file or --url must be provided\n');
      program.help();
      return; // Let help display before exit
    }

    if (options.file && options.url) {
      logger.error('Error: Cannot specify both --file and --url\n');
      program.help();
      return; // Let help display before exit
    }

    // Set configuration based on CLI options
    if (options.file) {
      const filePath = path.resolve(options.file);
      process.env.FEED_SOURCE = 'file';
      process.env.FEED_FILE_PATH = filePath;
    } else if (options.url) {
      process.env.FEED_SOURCE = 'url';
      process.env.FEED_URL = options.url;
    }

    if (options.dryRun) {
      process.env.DRY_RUN = 'true';
      logger.info('Running in DRY-RUN mode - no changes will be made to HubSpot');
    }

    const importer = new Importer();
    const results = await importer.run();

    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Records created:  ${results.created}`);
    console.log(`Records updated:  ${results.updated}`);
    console.log(`Errors:           ${results.failed}`);
    console.log(`Duration:         ${(results.duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(80) + '\n');

    if (results.errors && results.errors.length > 0) {
      console.log('ERRORS:');
      results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. Asset ID: ${err.assetId} - ${err.error}`);
      });
      console.log('\n');
    }

    if (results.success) {
      logger.info('Import completed successfully');
      process.exit(0);
    } else {
      logger.error('Import completed with errors');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Fatal error during import', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Run the importer
main();
