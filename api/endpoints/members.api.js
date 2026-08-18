/**
 * [api/endpoints/members.api.js]
 * Teams/그룹 멤버 관리 API
 * ─────────────────────────────────────────
 * [대체 대상] 기존 사용자 관리 (portal_us_v7)
 * [역할 구분]
 *   - 관리자: 그룹 Owner
 *   - 사용자: 그룹 Member 중 userType='Member'
 *   - Guest: 그룹 Member 중 userType='Guest'
 */
import { graphFetch } from '../graph-client.js';
import { sharepointConfig } from '../../config/sharepoint.config.js';

const GROUP_URL = `${sharepointConfig.graphUrl}/groups/${sharepointConfig.adminGroupId}`;

/** 그룹 소유자(관리자) 목록 조회 */
export async function fetchGroupOwners() {
  const url = `${GROUP_URL}/owners?$select=id,displayName,mail,userPrincipalName,userType`;
  const response = await graphFetch(url);
  return (response.value || []).map(normalizeUser);
}

/** 그룹 멤버 전체 목록 조회 (소유자 제외) */
export async function fetchGroupMembers() {
  const url = `${GROUP_URL}/members?$select=id,displayName,mail,userPrincipalName,userType`;
  const response = await graphFetch(url);
  return (response.value || []).map(normalizeUser);
}

/** 사용자 검색 (디렉토리에서) */
export async function searchUsers(query) {
  const encoded = encodeURIComponent(query);
  const url = `${sharepointConfig.graphUrl}/users?$filter=startswith(displayName,'${encoded}') or startswith(mail,'${encoded}')&$select=id,displayName,mail,userPrincipalName,userType&$top=10`;
  try {
    const response = await graphFetch(url);
    return (response.value || []).map(normalizeUser);
  } catch (e) {
    // $filter 실패 시 $search 시도
    const searchUrl = `${sharepointConfig.graphUrl}/users?$search="displayName:${encoded}" OR "mail:${encoded}"&$select=id,displayName,mail,userPrincipalName,userType&$top=10&$count=true`;
    const response = await graphFetch(searchUrl, {
      headers: { 'ConsistencyLevel': 'eventual' }
    });
    return (response.value || []).map(normalizeUser);
  }
}

/** 그룹에 멤버 추가 */
export async function addMemberToGroup(userId) {
  const url = `${GROUP_URL}/members/$ref`;
  const body = {
    "@odata.id": `${sharepointConfig.graphUrl}/directoryObjects/${userId}`
  };
  await graphFetch(url, { method: 'POST', body });
}

/** 그룹에서 멤버 제거 */
export async function removeMemberFromGroup(userId) {
  const url = `${GROUP_URL}/members/${userId}/$ref`;
  await graphFetch(url, { method: 'DELETE' });
}

/** 소유자(관리자)로 승격 */
export async function addOwnerToGroup(userId) {
  const url = `${GROUP_URL}/owners/$ref`;
  const body = {
    "@odata.id": `${sharepointConfig.graphUrl}/directoryObjects/${userId}`
  };
  await graphFetch(url, { method: 'POST', body });
}

/** 소유자(관리자)에서 해제 */
export async function removeOwnerFromGroup(userId) {
  const url = `${GROUP_URL}/owners/${userId}/$ref`;
  await graphFetch(url, { method: 'DELETE' });
}

// ─── 유틸 ─── //

function normalizeUser(u) {
  return {
    id: u.id,
    displayName: u.displayName || '',
    email: u.mail || u.userPrincipalName || '',
    userType: u.userType || 'Member' // 'Member' | 'Guest'
  };
}
