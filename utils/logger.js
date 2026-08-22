/**
 * 로거 유틸리티
 */
const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CURRENT_LEVEL = LOG_LEVEL.INFO;

export const logger = {
  debug(module, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVEL.DEBUG) {
      console.log(`[DEBUG][${module}]`, ...args);
    }
  },

  info(module, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVEL.INFO) {
      console.info(`[INFO][${module}]`, ...args);
    }
  },

  warn(module, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVEL.WARN) {
      console.warn(`[WARN][${module}]`, ...args);
    }
  },

  error(module, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVEL.ERROR) {
      console.error(`[ERROR][${module}]`, ...args);
    }
  }
};
