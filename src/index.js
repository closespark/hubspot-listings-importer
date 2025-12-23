#!/usr/bin/env node

const Importer = require('./importer');
const logger = require('./logger');

/**
 * Main entry point for the HubSpot Listings Importer
 */
async function main() {
  try {
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
