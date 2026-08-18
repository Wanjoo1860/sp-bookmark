/**
 * [auth/role-resolver.js]
 * 사용자 역할(admin/user/guest) 결정
 * ─────────────────────────────────────────
 * [대체 대상] 기존 user.role 하드코딩 판별
 * [로직]
 *   - 그룹 Owner → admin
 *   - 그룹 Member이면서 userType !== 'Guest' → user
 *   - userType === 'Guest' → guest
 *   - 그룹에 없어도 테넌트 사용자면 → user (모든 직원 접근 가능)
 *   - Guest는 그룹 멤버여야 접근 가능
 */
import { sharepointConfig } from '../config/sharepoint.config.js';
import { graphFetch } from '../api/graph-client.js';

export async function resolveUserRole(account) {
  const userId = account.localAccountId;

  try {
    // 1. 현재 사용자의 userType 확인
    const meResponse = await graphFetch(`${sharepointConfig.graphUrl}/me?$select=id,displayName,mail,userPrincipalName,userType`);
    const userType = meResponse.userType; // 'Member' 또는 'Guest'

    // 2. 그룹 소유자 확인 → admin
    const ownersResponse = await graphFetch(
      `${sharepointConfig.graphUrl}/groups/${sharepointConfig.adminGroupId}/owners?$select=id`
    );
    const owners = ownersResponse.value || [];
    const isOwner = owners.some(o => o.id === userId);

    if (isOwner) {
      return { role: 'admin', userType: userType, profile: meResponse };
    }

    // 3. Guest 여부 확인
    if (userType === 'Guest') {
      // Guest는 그룹 멤버 여부 확인 → 멤버여야 접근 가능
      const membersResponse = await graphFetch(
        `${sharepointConfig.graphUrl}/groups/${sharepointConfig.adminGroupId}/members?$select=id`
      );
      const members = membersResponse.value || [];
      const isMember = members.some(m => m.id === userId);

      if (isMember) {
        return { role: 'guest', userType: 'Guest', profile: meResponse };
      } else {
        // Guest인데 그룹 멤버 아님 → 접근 불가
        return { role: 'unauthorized', userType: 'Guest', profile: meResponse };
      }
    }

    // 4. 일반 테넌트 멤버 → user (모든 직원 접근 가능)
    return { role: 'user', userType: userType, profile: meResponse };

  } catch (error) {
    console.warn('역할 결정 실패, 기본 user 적용:', error);
    return { role: 'user', userType: 'Member', profile: null };
  }
}
