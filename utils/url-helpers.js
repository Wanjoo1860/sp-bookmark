/**
 * [utils/url-helpers.js]
 * URL/파비콘 관련 유틸리티
 * ─────────────────────────────────────────
 * [대체 대상] 기존 getHostname(), faviconUrl(), fallbackIcon(), handleImgError(), isBlocked()
 */
import { KNOWN_BLOCKED, STORAGE_KEYS } from '../config/app.config.js';

let dynamicBlocked = [];

export function initDynamicBlocked() {
  try {
    dynamicBlocked = JSON.parse(localStorage.getItem(STORAGE_KEYS.BLOCKED)) || [];
  } catch { dynamicBlocked = []; }
}

export function getDynamicBlocked() {
  return dynamicBlocked;
}

export function addToDynamicBlocked(url) {
  const h = getHostname(url);
  if (h && !dynamicBlocked.includes(h)) {
    dynamicBlocked.push(h);
    localStorage.setItem(STORAGE_KEYS.BLOCKED, JSON.stringify(dynamicBlocked));
  }
}

export function getHostname(url) {
  try {
    return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase();
  } catch { return ''; }
}

export function isBlocked(url) {
  const h = getHostname(url);
  if (!h) return false;
  for (const d of KNOWN_BLOCKED) {
    if (h === d || h.endsWith('.' + d)) return true;
  }
  for (const d of dynamicBlocked) {
    if (h === d || h.endsWith('.' + d)) return true;
  }
  return false;
}

export function faviconUrl(url, sz) {
  const h = getHostname(url);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=${sz || 64}` : '';
}

export function fallbackIcon(name) {
  const ch = (name || '?').charAt(0).toUpperCase();
  const hue = (ch.charCodeAt(0) * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="hsl(${hue},55%,45%)"/><text x="32" y="44" font-size="32" font-weight="bold" font-family="Arial,sans-serif" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

export function handleImgError(img, url, name) {
  const h = getHostname(url);
  if (!img.dataset.retry) {
    img.dataset.retry = '1';
    img.src = `https://icons.duckduckgo.com/ip3/${h}.ico`;
    return;
  }
  if (img.dataset.retry === '1') {
    img.dataset.retry = '2';
    img.src = fallbackIcon(name || h);
    return;
  }
  img.style.display = 'none';
}
