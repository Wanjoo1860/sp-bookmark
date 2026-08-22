/**
 * 에러 핸들링 유틸리티
 */
import { showToast } from '../ui/toast.js';

/**
 * API 에러 처리
 */
export async function handleApiError(response, method, endpoint) {
  let errorBody = {};
  try {
    errorBody = await response.json();
  } catch (e) {
    // JSON 파싱 실패
  }

  const errorCode = errorBody?.error?.code || 'UnknownError';
  const errorMessage = errorBody?.error?.message || response.statusText;

  console.error(`[API Error] ${method} ${endpoint}`, {
    status: response.status,
    code: errorCode,
    message: errorMessage
  });

  // 사용자 친화적 메시지
  const userMessage = getErrorMessage(response.status, errorCode);
  showToast(userMessage, 'error');

  throw new ApiError(response.status, errorCode, errorMessage, endpoint);
}

/**
 * 사용자 친화적 에러 메시지 반환
 */
function getErrorMessage(status, code) {
  const messages = {
    401: '인증이 만료되었습니다. 다시 로그인해 주세요.',
    403: '권한이 없습니다. 관리자에게 문의하세요.',
    404: '요청한 리소스를 찾을 수 없습니다.',
    409: '데이터 충돌이 발생했습니다. 새로고침 후 다시 시도해 주세요.',
    429: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    503: '서비스를 일시적으로 사용할 수 없습니다.'
  };

  return messages[status] || `오류가 발생했습니다 (${code})`;
}

/**
 * 커스텀 API 에러 클래스
 */
export class ApiError extends Error {
  constructor(status, code, message, endpoint) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
  }
}
