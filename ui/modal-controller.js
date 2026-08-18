/**
 * [ui/modal-controller.js]
 * 설정/편집 모달 제어 (열기/닫기/탭 전환)
 * ─────────────────────────────────────────
 * [대체 대상] 기존 모달 열기/닫기 이벤트, 탭 전환
 */
import { $ , $$ } from '../utils/dom-helpers.js';

const modalOverlay = $('#modalOverlay');
const btnCloseModal = $('#btnCloseModal');
const editOverlay = $('#editOverlay');
const btnCloseEdit = $('#btnCloseEdit');
const panelBookmarks = $('#panelBookmarks');
const panelUsers = $('#panelUsers');
const tabUsers = $('#tabUsers');

let onModalOpen = null;
let onEditClose = null;

export function initModalController(options) {
  onModalOpen = options.onModalOpen || null;
  onEditClose = options.onEditClose || null;

  // 탭 전환

  $$('.modal-tab').forEach(tab => {
    tab.addEventListener('click', function () {

      $$('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const t = tab.dataset.tab;
      panelBookmarks.style.display = (t === 'bookmarks') ? '' : 'none';
      panelUsers.style.display = (t === 'users') ? '' : 'none';
    });
  });

  // 설정 모달 닫기
  btnCloseModal.addEventListener('click', closeSettingsModal);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeSettingsModal();
  });

  // 편집 모달 닫기
  btnCloseEdit.addEventListener('click', closeEditModal);
  editOverlay.addEventListener('click', function (e) {
    if (e.target === editOverlay) closeEditModal();
  });

  // ESC 키
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (editOverlay.classList.contains('show')) closeEditModal();
      else if (modalOverlay.classList.contains('show')) closeSettingsModal();
    }
  });
}

export function openSettingsModal(currentUser) {
  // 탭 초기화

  $$('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="bookmarks"]').classList.add('active');
  panelBookmarks.style.display = '';
  panelUsers.style.display = 'none';

  // 멤버 관리 탭: 관리자만
  tabUsers.style.display = (currentUser.role === 'admin') ? '' : 'none';

  if (onModalOpen) onModalOpen(currentUser);
  modalOverlay.classList.add('show');
}

export function closeSettingsModal() {
  modalOverlay.classList.remove('show');
}

export function openEditModalOverlay() {
  editOverlay.classList.add('show');
}

export function closeEditModal() {
  editOverlay.classList.remove('show');
  if (onEditClose) onEditClose();
}
