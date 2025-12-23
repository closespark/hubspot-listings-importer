const axios = require('axios');
const logger = require('./logger');
const config = require('./config');

/**
 * Fetch JSON feed data from a URL
 */
class FeedFetcher {
  constructor() {
    this.retryAttempts = config.get('retryAttempts');
    this.retryDelay = config.get('retryDelay');
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate URL to prevent SSRF attacks
   */
  validateUrl(url) {
    try {
      const parsedUrl = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
      }

      // Prevent requests to private IP ranges
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Block localhost and loopback
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        throw new Error('Requests to localhost are not allowed');
      }

      // Block private IP ranges (basic check)
      if (hostname.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/)) {
        throw new Error('Requests to private IP ranges are not allowed');
      }

      return true;
    } catch (error) {
      throw new Error(`Invalid feed URL: ${error.message}`);
    }
  }

  /**
   * Fetch feed data with retry logic
   */
  async fetchFeed(url) {
    // Validate URL to prevent SSRF
    this.validateUrl(url);
    
    logger.info(`Fetching feed from: ${url}`);
    
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 30000, // 30 second timeout
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        logger.info('Feed fetched successfully', {
          status: response.status,
          contentType: response.headers['content-type'],
        });

        return response.data;
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt}/${this.retryAttempts} failed to fetch feed`, {
          error: error.message,
          statusCode: error.response?.status,
        });

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * attempt;
          logger.info(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to fetch feed after ${this.retryAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Validate feed data structure
   */
  validateFeed(data) {
    if (!data) {
      throw new Error('Feed data is empty or null');
    }

    // Handle different feed structures
    if (Array.isArray(data)) {
      logger.info(`Feed contains ${data.length} listings`);
      return data;
    }

    // Check for common wrapper properties
    if (data.listings && Array.isArray(data.listings)) {
      logger.info(`Feed contains ${data.listings.length} listings (in 'listings' property)`);
      return data.listings;
    }

    if (data.results && Array.isArray(data.results)) {
      logger.info(`Feed contains ${data.results.length} listings (in 'results' property)`);
      return data.results;
    }

    if (data.data && Array.isArray(data.data)) {
      logger.info(`Feed contains ${data.data.length} listings (in 'data' property)`);
      return data.data;
    }

    // If it's a single object, treat it as a single listing
    if (typeof data === 'object') {
      logger.info('Feed contains a single listing object');
      return [data];
    }

    throw new Error('Unable to parse feed structure');
  }

  /**
   * Fetch and validate feed
   */
  async getFeed() {
    const url = config.get('feedUrl');
    const data = await this.fetchFeed(url);
    return this.validateFeed(data);
  }
}

module.exports = new FeedFetcher();
