/**
 * Guest 관리 API
 */
import { graphGet, graphPost, graphDelete } from '../graph-client.js';
import { roleConfig } from '../../config/role.config.js';
import { logger } from '../../utils/logger.js';

const teamGroupId = roleConfig.teamGroupId;

/**
 * Guest 초대 (Azure AD 초대 + 팀 Guest로 추가)
 */
export async function inviteGuest(email, displayName = '') {
  logger.info('GuestsAPI', `Inviting guest: ${email}`);

  const invitationBody = {
    invitedUserEmailAddress: email,
    invitedUserDisplayName: displayName || email.split('@')[0],
    inviteRedirectUrl: window.location.origin,
    sendInvitationMessage: true,
    invitedUserMessageInfo: {                    // ✅ 선택: 커스텀 메시지 추가
      customizedMessageBody: '즐겨찾기 포털에 Guest로 초대되었습니다. 아래 링크를 클릭하여 수락해 주세요.'
    }
  };

  const invitation = await graphPost('/invitations', invitationBody);
  const guestUserId = invitation.invitedUser.id;

  // 2. 팀 멤버로 추가
  try {
    const memberBody = {
      '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${guestUserId}`
    };
    await graphPost(`/groups/${teamGroupId}/members/$ref`, memberBody);
  } catch (error) {
    if (error.status !== 400) throw error;
    logger.warn('GuestsAPI', 'User already a member of the group');
  }

  return {
    id: guestUserId,
    email: email,
    displayName: invitation.invitedUser.displayName || displayName,
    status: invitation.status,                   // ✅ 추가: 초대 상태 반환
    inviteRedeemUrl: invitation.inviteRedeemUrl   // ✅ 추가: 직접 수락 URL
  };
}


/**
 * Guest 삭제 (팀에서 제거)
 */
export async function removeGuestFromTeam(userId) {
  logger.info('GuestsAPI', `Removing guest from team: ${userId}`);

  const endpoint = `/groups/${teamGroupId}/members/${userId}/$ref`;
  await graphDelete(endpoint);
}

/**
 * Guest Azure AD에서 완전 삭제 (선택적)
 * 주의: User.ReadWrite.All 권한 필요 (현재 Scope에 미포함)
 */
export async function deleteGuestFromAD(userId) {
  logger.info('GuestsAPI', `Deleting guest from AD: ${userId}`);

  // 현재 권한으로는 지원하지 않음 — 팀에서 제거만 수행
  // 필요 시 User.ReadWrite.All 추가 후 활성화
  // await graphDelete(`/users/${userId}`);

  throw new Error('AD 완전 삭제는 추가 권한(User.ReadWrite.All)이 필요합니다. 팀에서 제거만 수행됩니다.');
}

/**
 * Guest 초대 유효성 검증
 */
export function validateGuestEmail(email) {
  // 기본 이메일 형식 체크
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: '유효한 이메일 형식이 아닙니다.' };
  }

  // 내부 도메인 체크 (조직 사용자는 Guest로 초대 불가)
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain === 'myworkweb.onmicrosoft.com') {
    return { valid: false, message: '조직 내부 사용자는 Guest로 초대할 수 없습니다. 멤버로 추가해 주세요.' };
  }

  return { valid: true, message: '' };
}
