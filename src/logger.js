const config = require('./config');

/**
 * Simple logger with configurable log levels
 */
class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    this.currentLevel = null; // Lazy loaded
  }

  getCurrentLevel() {
    if (this.currentLevel === null) {
      const logLevel = config.get('logLevel') || 'info';
      this.currentLevel = this.levels[logLevel] || this.levels.info;
    }
    return this.currentLevel;
  }

  log(level, message, data = null) {
    if (this.levels[level] <= this.getCurrentLevel()) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (data) {
        console.log(logMessage, JSON.stringify(data, null, 2));
      } else {
        console.log(logMessage);
      }
    }
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }
}

module.exports = new Logger();
