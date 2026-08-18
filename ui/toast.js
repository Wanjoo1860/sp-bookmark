/**
 * [ui/toast.js]
 * 토스트 알림 표시
 * ─────────────────────────────────────────
 * [대체 대상] 기존 toast() 함수
 */
import { $ } from '../utils/dom-helpers.js';
import { TIMERS } from '../config/app.config.js';

const toastEl = $('#toastMsg');

export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), TIMERS.TOAST_DURATION);
}
