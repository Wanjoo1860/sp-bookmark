/**
 * 토스트 알림 UI
 */
import { appConfig } from '../config/app.config.js';

const toastEl = document.getElementById('toastMsg');

/**
 * 토스트 메시지 표시
 * @param {string} msg - 메시지
 * @param {'info'|'error'|'success'} type - 유형
 */
export function showToast(msg, type = 'info') {
  toastEl.textContent = msg;
  toastEl.className = 'toast-msg';

  if (type === 'error') {
    toastEl.style.borderColor = 'var(--danger)';
  } else if (type === 'success') {
    toastEl.style.borderColor = 'var(--success)';
  } else {
    toastEl.style.borderColor = 'var(--border)';
  }

  toastEl.classList.add('show');

  setTimeout(() => {
    toastEl.classList.remove('show');
    toastEl.style.borderColor = '';
  }, appConfig.toastDuration);
}
