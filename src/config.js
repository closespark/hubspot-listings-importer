const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

/**
 * Configuration module that reads secrets from /etc/secrets/.env and Render environment variables
 */
class Config {
  constructor() {
    this.config = {};
    this.loadConfig();
  }

  /**
   * Load configuration from multiple sources in priority order:
   * 1. Render environment variables (highest priority)
   * 2. /etc/secrets/.env file
   * 3. Local .env file (for development)
   */
  loadConfig() {
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
      hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      feedUrl: process.env.FEED_URL,
      logLevel: process.env.LOG_LEVEL || 'info',
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
      batchSize: parseInt(process.env.BATCH_SIZE || '100'),
    };

    this.validate();
  }

  /**
   * Validate required configuration
   */
  validate() {
    if (!this.config.hubspotAccessToken) {
      throw new Error('HUBSPOT_ACCESS_TOKEN is required');
    }
    if (!this.config.feedUrl) {
      throw new Error('FEED_URL is required');
    }
  }

  /**
   * Get configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }
}

module.exports = new Config();
