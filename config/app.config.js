/**
 * [config/app.config.js]
 * 앱 전역 상수 및 설정
 * ─────────────────────────────────────────
 * [AI 수정 가이드] 차단 도메인 추가 시 KNOWN_BLOCKED 배열에 추가
 */
export const KNOWN_BLOCKED = [
  'google.com','youtube.com','github.com','naver.com','daum.net','kakao.com',
  'mail.google.com','chat.openai.com','claude.ai','facebook.com','instagram.com',
  'twitter.com','x.com','linkedin.com','reddit.com','netflix.com','amazon.com',
  'apple.com','microsoft.com','notion.so','figma.com','slack.com','discord.com',
  'dropbox.com','drive.google.com','stackoverflow.com','openai.com','tistory.com',
  'velog.io','medium.com','twitch.tv','spotify.com','pinterest.com','zoom.us',
  'teams.microsoft.com','outlook.com','office.com','outlook.cloud.microsoft',
  'vercel.com','netlify.com','linear.app','developer.mozilla.org','yahoo.com'
];

export const STORAGE_KEYS = {
  BLOCKED: 'portal_blocked_v7',
  CACHE_BOOKMARKS: 'portal_cache_bm',
  OFFLINE_QUEUE: 'portal_offline_queue'
};

export const TIMERS = {
  TOAST_DURATION: 2500,
  HOVER_DELAY: 400,
  IFRAME_TIMEOUT: 12000,
  IFRAME_CHECK_DELAY: 300
};
