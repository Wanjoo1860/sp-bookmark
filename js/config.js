/**
 * config.js — Azure AD / SharePoint 설정
 */
var CONFIG = {
  clientId: '4aeb92a9-8ef6-476a-a419-9125032309fd',
  tenantId: 'cc13b6f1-ef21-479f-9853-3e2dffa71d6b',
  redirectUri: window.location.origin + window.location.pathname,

  // SharePoint
  siteHostname: 'globalsoft.sharepoint.com',
  sitePath: '/sites/Dev896',
  listName: 'TestData',

  // SharePoint 목록 필드 (내부 이름 기준)
  // Title: 이름, Url: URL, Description: 설명, Visibility: 공개범위, Owner: 소유자email, Ord: 정렬순서
  fields: {
    title: 'Title',         // 북마크 이름
    url: 'Url',             // URL
    description: 'Description',  // 설명
    visibility: 'Visibility',    // public | admin | private
    owner: 'Owner',              // 소유자 이메일
    ord: 'Ord'                   // 정렬 순서 (숫자)
  },

  // 관리자 그룹
  adminGroupId: 'bc9227b3-a99a-459e-bfc7-71c7166f19c4',

  // Graph API
  scopes: [
    'User.Read',
    'User.Read.All',
    'Sites.ReadWrite.All',
    'GroupMember.ReadWrite.All',
    'Group.ReadWrite.All',
    'RoleManagement.ReadWrite.Directory'
  ],
  graphUrl: 'https://graph.microsoft.com/v1.0',

  // iframe 차단 목록
  knownBlocked: [
    'google.com','youtube.com','github.com','naver.com','daum.net','kakao.com',
    'mail.google.com','chat.openai.com','claude.ai','facebook.com','instagram.com',
    'twitter.com','x.com','linkedin.com','reddit.com','netflix.com','amazon.com',
    'apple.com','microsoft.com','notion.so','figma.com','slack.com','discord.com',
    'dropbox.com','drive.google.com','stackoverflow.com','openai.com','tistory.com',
    'velog.io','medium.com','twitch.tv','spotify.com','pinterest.com','zoom.us',
    'teams.microsoft.com','outlook.com','office.com','vercel.com','netlify.com',
    'linear.app','developer.mozilla.org','yahoo.com'
  ]
};
