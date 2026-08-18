/**
 * [services/cache-service.js]
 * 로컬 캐시 관리 (오프라인 대응)
 * ─────────────────────────────────────────
 */
import { STORAGE_KEYS } from '../config/app.config.js';

const PREFIX = STORAGE_KEYS.CACHE_BOOKMARKS;

export function saveToCache(key, data) {
  try {
    localStorage.setItem(`${PREFIX}_${key}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('캐시 저장 실패:', e);
  }
}

export function loadFromCache(key) {
  try {
    const raw = localStorage.getItem(`${PREFIX}_${key}`);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch (e) {
    return null;
  }
}

export function clearCache(key) {
  localStorage.removeItem(`${PREFIX}_${key}`);
}
