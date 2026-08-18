/**
 * [utils/dom-helpers.js]
 * DOM 유틸리티 함수
 * ─────────────────────────────────────────
 */
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

export function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export function createElement(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}
