/**
 * Teams 팀 멤버 관리 API
 */
import { graphGet, graphPost, graphDelete } from '../graph-client.js';
import { roleConfig } from '../../config/role.config.js';
import { logger } from '../../utils/logger.js';

const teamGroupId = roleConfig.teamGroupId;

/**
 * 팀 소유자(Admin) 목록 조회
 */
export async function fetchTeamOwners() {
  logger.info('MembersAPI', 'Fetching team owners');

  const response = await graphGet(
    `/groups/${teamGroupId}/owners?$select=id,displayName,mail,userPrincipalName,userType`
  );

  return response.value.map(mapToMember);
}

/**
 * 팀 멤버(Member) 목록 조회 (Owner, Guest 제외)
 */
export async function fetchTeamMembers() {
  logger.info('MembersAPI', 'Fetching team members');

  const [membersRes, ownersRes] = await Promise.all([
    graphGet(`/groups/${teamGroupId}/members?$select=id,displayName,mail,userPrincipalName,userType`),
    graphGet(`/groups/${teamGroupId}/owners?$select=id`)
  ]);

  const ownerIds = new Set(ownersRes.value.map(o => o.id));

  return membersRes.value
    .filter(m => !ownerIds.has(m.id) && m.userType !== 'Guest')
    .map(mapToMember);
}

/**
 * 팀 게스트(Guest) 목록 조회
 */
export async function fetchTeamGuests() {
  logger.info('MembersAPI', 'Fetching team guests');

  const response = await graphGet(
    `/groups/${teamGroupId}/members?$select=id,displayName,mail,userPrincipalName,userType`
  );

  return response.value
    .filter(m => m.userType === 'Guest')
    .map(mapToMember);
}

/**
 * 조직 내 사용자 검색 (직원)
 */
export async function searchOrganizationUsers(query) {
  logger.info('MembersAPI', `Searching users: ${query}`);

  if (!query || query.length < 2) return [];

  const endpoint = `/users?$filter=startswith(displayName,'${query}') or startswith(mail,'${query}')&$select=id,displayName,mail,userPrincipalName,userType,jobTitle,department&$top=10`;

  try {
    const response = await graphGet(endpoint);
    return response.value
      .filter(u => u.userType !== 'Guest') // 외부 Guest 제외
      .map(u => ({
        id: u.id,
        displayName: u.displayName,
        email: u.mail || u.userPrincipalName,
        jobTitle: u.jobTitle || '',
        department: u.department || ''
      }));
  } catch (error) {
    // $filter 미지원 시 $search로 폴백
    logger.warn('MembersAPI', 'Filter failed, trying $search');
    const searchEndpoint = `/users?$search="displayName:${query}" OR "mail:${query}"&$select=id,displayName,mail,userPrincipalName,userType,jobTitle,department&$top=10`;
    const response = await graphGet(searchEndpoint);
    return response.value
      .filter(u => u.userType !== 'Guest')
      .map(u => ({
        id: u.id,
        displayName: u.displayName,
        email: u.mail || u.userPrincipalName,
        jobTitle: u.jobTitle || '',
        department: u.department || ''
      }));
  }
}

/**
 * 사용자를 팀 멤버로 추가
 */
export async function addTeamMember(userId) {
  logger.info('MembersAPI', `Adding member: ${userId}`);

  const endpoint = `/groups/${teamGroupId}/members/$ref`;
  const body = {
    '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`
  };

  await graphPost(endpoint, body);
}

/**
 * 사용자를 팀 소유자로 추가
 */
export async function addTeamOwner(userId) {
  logger.info('MembersAPI', `Adding owner: ${userId}`);

  const endpoint = `/groups/${teamGroupId}/owners/$ref`;
  const body = {
    '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`
  };

  await graphPost(endpoint, body);
}

/**
 * 관리자로 승격 (멤버 → 소유자)
 * - 팀 미소속이면 멤버로 먼저 추가 후 소유자 부여
 * - 이미 멤버이면 소유자 권한만 부여
 */
export async function promoteToAdmin(userId) {
  logger.info('MembersAPI', `Promoting to admin: ${userId}`);

  // 이미 멤버인지 확인
  const members = await graphGet(`/groups/${teamGroupId}/members?$select=id`);
  const isMember = members.value.some(m => m.id === userId);

  // 멤버가 아니면 먼저 추가
  if (!isMember) {
    await addTeamMember(userId);
  }

  // 소유자로 추가
  await addTeamOwner(userId);
}

/**
 * 관리자에서 강등 (소유자 → 멤버)
 */
export async function demoteFromAdmin(userId) {
  logger.info('MembersAPI', `Demoting from admin: ${userId}`);

  const endpoint = `/groups/${teamGroupId}/owners/${userId}/$ref`;
  await graphDelete(endpoint);
}

/**
 * 팀에서 멤버 제거
 */
export async function removeTeamMember(userId) {
  logger.info('MembersAPI', `Removing member: ${userId}`);

  // 그룹 멤버에서 제거
  const endpoint = `/groups/${teamGroupId}/members/${userId}/$ref`;
  await graphDelete(endpoint);
}

/**
 * 멤버 매핑 유틸
 */
function mapToMember(user) {
  return {
    id: user.id,
    displayName: user.displayName || '',
    email: user.mail || user.userPrincipalName || '',
    userType: user.userType || 'Member'
  };
}

