const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

/**
 * Configuration module that reads secrets from /etc/secrets/.env and Render environment variables
 */
class Config {
  constructor() {
    this.config = null;
    this.loaded = false;
  }

  /**
   * Load configuration from multiple sources in priority order:
   * 1. Render environment variables (highest priority)
   * 2. /etc/secrets/.env file
   * 3. Local .env file (for development)
   */
  loadConfig() {
    if (this.loaded) {
      return; // Already loaded
    }

    // Try to load from local .env first (for development)
    const localEnvPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(localEnvPath)) {
      console.log('Loading local .env file...');
      dotenv.config({ path: localEnvPath });
    }

    // Try to load from /etc/secrets/.env (Render secrets)
    const renderSecretsPath = '/etc/secrets/.env';
    if (fs.existsSync(renderSecretsPath)) {
      console.log('Loading /etc/secrets/.env file...');
      dotenv.config({ path: renderSecretsPath });
    }

    // Environment variables take precedence (Render env vars or system env vars)
    this.config = {
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_TOKEN,
      feedUrl: process.env.FEED_URL,
      feedSource: process.env.FEED_SOURCE || 'url', // 'url' or 'file'
      feedFilePath: process.env.FEED_FILE_PATH,
      dryRun: process.env.DRY_RUN === 'true',
      logLevel: process.env.LOG_LEVEL || 'info',
      retryAttempts: this.parseIntSafe(process.env.RETRY_ATTEMPTS, 3),
      retryDelay: this.parseIntSafe(process.env.RETRY_DELAY, 1000),
      batchSize: this.parseIntSafe(process.env.BATCH_SIZE, 100),
    };

    this.loaded = true;
    this.validate();
  }

  /**
   * Safely parse integer with fallback to default
   */
  parseIntSafe(value, defaultValue) {
    if (!value) {
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.warn(`Invalid numeric value "${value}", using default ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Validate required configuration
   */
  validate() {
    // Skip validation if showing help or no token is needed yet
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      return;
    }

    if (!this.config.hubspotAccessToken) {
      throw new Error('HUBSPOT_ACCESS_TOKEN or HUBSPOT_API_TOKEN is required');
    }
    
    // Only validate feed source if CLI args haven't been processed yet
    const hasFeedSource = this.config.feedUrl || this.config.feedFilePath;
    
    if (!this.config.dryRun && !hasFeedSource) {
      // Allow validation to pass if we're just showing help or haven't set feed source yet
      // This will be re-validated when the importer runs
      return;
    }
    
    if (this.config.feedSource === 'url' && !this.config.feedUrl) {
      throw new Error('FEED_URL is required when using URL source');
    }
    if (this.config.feedSource === 'file' && !this.config.feedFilePath) {
      throw new Error('FEED_FILE_PATH is required when using file source');
    }
  }

  /**
   * Get configuration value
   */
  get(key) {
    if (!this.loaded) {
      this.loadConfig();
    }
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll() {
    if (!this.loaded) {
      this.loadConfig();
    }
    return { ...this.config };
  }
}

module.exports = new Config();
