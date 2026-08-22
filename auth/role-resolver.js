/**
 * Teams 그룹 기반 역할 판별
 */
import { roleConfig } from '../config/role.config.js';
import { graphGet } from '../api/graph-client.js';

let resolvedRole = null;
let currentUserEmail = null;

/**
 * 현재 사용자의 역할 판별
 * - Teams 팀 Owner → admin
 * - Teams 팀 Member → member
 * - Teams 팀 Guest → guest
 * - 미소속 → none
 */
export async function resolveUserRole() {
  const teamGroupId = roleConfig.teamGroupId;

  // 1. 현재 사용자 정보 조회
  const me = await graphGet('/me');
  currentUserEmail = me.mail || me.userPrincipalName;

  // 2. 팀 소유자 목록 확인
  const owners = await graphGet(`/groups/${teamGroupId}/owners?$select=id,mail,userPrincipalName`);
  const isOwner = owners.value.some(o =>
    (o.mail || o.userPrincipalName)?.toLowerCase() === currentUserEmail.toLowerCase()
  );

  if (isOwner) {
    resolvedRole = roleConfig.roles.admin;
    return { role: resolvedRole, email: currentUserEmail, displayName: me.displayName };
  }

  // 3. 팀 멤버 목록 확인
  const members = await graphGet(`/groups/${teamGroupId}/members?$select=id,mail,userPrincipalName,userType`);
  const myMembership = members.value.find(m =>
    (m.mail || m.userPrincipalName)?.toLowerCase() === currentUserEmail.toLowerCase()
  );

  if (!myMembership) {
    resolvedRole = roleConfig.roles.none;
    return { role: resolvedRole, email: currentUserEmail, displayName: me.displayName };
  }

  // 4. Guest 여부 확인
  if (myMembership.userType === 'Guest' || me.userType === 'Guest') {
    resolvedRole = roleConfig.roles.guest;
    return { role: resolvedRole, email: currentUserEmail, displayName: me.displayName };
  }

  // 5. 일반 멤버
  resolvedRole = roleConfig.roles.member;
  return { role: resolvedRole, email: currentUserEmail, displayName: me.displayName };
}

/**
 * 캐시된 역할 반환
 */
export function getCachedRole() {
  return resolvedRole;
}

/**
 * 현재 사용자 email 반환
 */
export function getCurrentUserEmail() {
  return currentUserEmail;
}

/**
 * 역할 캐시 초기화
 */
export function clearRoleCache() {
  resolvedRole = null;
  currentUserEmail = null;
}
