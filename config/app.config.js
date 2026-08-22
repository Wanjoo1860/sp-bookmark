/**
 * 앱 전역 설정
 */
export const appConfig = {
  appName: '즐겨찾기 포털',
  version: '1.0.0',

  // iframe 차단 도메인 목록
  knownBlockedDomains: [
    'google.com','youtube.com','github.com','naver.com','daum.net','kakao.com',
    'mail.google.com','chat.openai.com','claude.ai','facebook.com','instagram.com',
    'twitter.com','x.com','linkedin.com','reddit.com','netflix.com','amazon.com',
    'apple.com','microsoft.com','notion.so','figma.com','slack.com','discord.com',
    'dropbox.com','drive.google.com','stackoverflow.com','openai.com','tistory.com',
    'velog.io','medium.com','twitch.tv','spotify.com','pinterest.com','zoom.us',
    'teams.microsoft.com','outlook.com','office.com','outlook.cloud.microsoft',
    'vercel.com','netlify.com','linear.app','developer.mozilla.org','yahoo.com'
  ],

  // iframe 로딩 타임아웃 (ms)
  iframeTimeout: 12000,

  // 호버 카드 딜레이 (ms)
  hoverDelay: 400,

  // 토스트 표시 시간 (ms)
  toastDuration: 2500,

  // 캐시 TTL (ms) - 5분
  cacheTTL: 5 * 60 * 1000
};
