/**
 * 캐시 서비스 — 메모리 캐시 (TTL 기반)
 */
import { appConfig } from '../config/app.config.js';

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = appConfig.cacheTTL;
  }

  /**
   * 캐시 조회
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 캐시 저장
   */
  set(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * 특정 키 무효화
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * 전체 캐시 초기화
   */
  clear() {
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
