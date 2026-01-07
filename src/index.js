#!/usr/bin/env node

const path = require('path');

// Check for file path argument BEFORE loading any modules that use config
const fileArg = process.argv[2];
const isFileImport = fileArg && !fileArg.startsWith('-');
if (isFileImport) {
  const filePath = path.resolve(fileArg);
  process.env.FEED_SOURCE = 'file';
  process.env.FEED_FILE_PATH = filePath;
}

// Now load modules that depend on config
const Importer = require('./importer');
const logger = require('./logger');

/**
 * Main entry point for the HubSpot Listings Importer
 * 
 * Usage:
 *   node src/index.js ./data/properties_combined.json
 *   node src/index.js (uses FEED_URL environment variable)
 */
async function main() {
  try {
    if (isFileImport) {
      logger.info(`Importing from file: ${path.resolve(fileArg)}`);
    }

    const importer = new Importer();
    const results = await importer.run();

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
