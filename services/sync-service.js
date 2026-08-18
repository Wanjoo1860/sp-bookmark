/**
 * [services/sync-service.js]
 * 오프라인 큐 및 동기화
 * ─────────────────────────────────────────
 */
import { STORAGE_KEYS } from '../config/app.config.js';

const QUEUE_KEY = STORAGE_KEYS.OFFLINE_QUEUE;

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch { return []; }
}

export function addToQueue(action) {
  const queue = getQueue();
  queue.push({ ...action, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

/** 온라인 복귀 시 큐 처리 (향후 확장) */
export async function processQueue(handler) {
  const queue = getQueue();
  if (queue.length === 0) return;

  for (const action of queue) {
    try {
      await handler(action);
    } catch (e) {
      console.warn('큐 처리 실패:', action, e);
    }
  }
  clearQueue();
}
