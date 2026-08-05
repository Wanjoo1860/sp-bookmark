/**
 * admin.js — 관리자 그룹 관리
 * 의존성: config.js, graph.js
 */
var Admin = (function() {
  'use strict';

  /**
   * 관리자 멤버 목록 로드
   */
  async function loadMembers() {
    var endpoint = '/groups/' + CONFIG.adminGroupId + '/members';
    var result = await Graph.get(endpoint);
    var members = result.value || [];

    return members.map(function(m) {
      return {
        id: m.id,
        displayName: m.displayName || m.userPrincipalName || '(이름 없음)',
        email: (m.mail || m.userPrincipalName || '').toLowerCase()
      };
    });
  }

  /**
   * 관리자 추가 (구성원 + 소유자)
   */
  async function addMember(email) {
    // 1. 사용자 조회
    var user;
    try {
      user = await Graph.get('/users/' + encodeURIComponent(email));
    } catch (e) {
      if (e.status === 404) throw new Error('사용자를 찾을 수 없습니다: ' + email);
      throw new Error('사용자 조회 실패: ' + e.message);
    }

    var userId = user.id;
    var refBody = {
      '@odata.id': CONFIG.graphUrl + '/directoryObjects/' + userId
    };

    var results = { member: '', owner: '' };

    // 2. 구성원 추가
    try {
      await Graph.post('/groups/' + CONFIG.adminGroupId + '/members/$ref', refBody);
      results.member = 'added';
    } catch (e) {
      if (e.status === 400 && e.body && e.body.error &&
          e.body.error.message && e.body.error.message.indexOf('already exist') !== -1) {
        results.member = 'exists';
      } else {
        results.member = 'error: ' + e.message;
      }
    }

    // 3. 소유자 추가
    try {
      await Graph.post('/groups/' + CONFIG.adminGroupId + '/owners/$ref', refBody);
      results.owner = 'added';
    } catch (e) {
      if (e.status === 400 && e.body && e.body.error &&
          e.body.error.message && e.body.error.message.indexOf('already exist') !== -1) {
        results.owner = 'exists';
      } else {
        results.owner = 'error: ' + e.message;
      }
    }

    return results;
  }

  /**
   * 관리자 제거 (구성원 + 소유자)
   */
  async function removeMember(userId) {
    var results = { member: '', owner: '' };

    // 구성원 제거
    try {
      await Graph.del('/groups/' + CONFIG.adminGroupId + '/members/' + userId + '/$ref');
      results.member = 'removed';
    } catch (e) {
      if (e.status === 404) results.member = 'not_found';
      else results.member = 'error: ' + e.message;
    }

    // 소유자 제거
    try {
      await Graph.del('/groups/' + CONFIG.adminGroupId + '/owners/' + userId + '/$ref');
      results.owner = 'removed';
    } catch (e) {
      if (e.status === 404) results.owner = 'not_found';
      else results.owner = 'error: ' + e.message;
    }

    return results;
  }

  return {
    loadMembers: loadMembers,
    addMember: addMember,
    removeMember: removeMember
  };
})();
