// ============================================================
// 설정값 + 전역 상태
// ============================================================

var CONFIG = {
    clientId: "c33acf54-975e-45dc-9577-17df0296f4f4",
    tenantId: "77ad8ab8-7d87-4c2c-a442-8d26f9c8fab1",
    redirectUri: "https://sp-bookmark.wjlee1860.workers.dev/",

    siteId: "myworkweb.sharepoint.com,41f0478e-0b56-4582-9b9a-555e8bb6556d,c7c8a765-6546-4d7e-8bc1-ced6c7a1930e",
    bookmarksListId: "db78a289-03d0-44f2-97c6-5ab3a98e6cdd",
    groupId: "cb77a63e-8b14-441b-ba7b-956a47cfb2ae",

    graphUrl: "https://graph.microsoft.com/v1.0",
    scopes: [
        "User.Read",
        "User.Read.All",
        "Sites.ReadWrite.All",
        "GroupMember.Read.All",
        "Group.ReadWrite.All"
    ]
};

var APP = {
    msalInstance: null,
    msalReady: false,
    isInTeams: false,
    accessToken: null,

    currentUser: null,
    currentUserId: '',
    currentUserEmail: '',
    currentUserRole: 'user',

    bookmarks: [],
    adminMembers: [],
    dynamicBlocked: [],

    currentUrl: '',
    pageCallId: 0,
    checkTimer: null,
    loadTimer: null,
    hoverTimer: null,
    editingId: null,
    sidebarOpen: true
};

// 알려진 iframe 차단 도메인
var KNOWN_BLOCKED = [
    'google.com','youtube.com','github.com','naver.com','daum.net','kakao.com',
    'mail.google.com','chat.openai.com','claude.ai','facebook.com','instagram.com',
    'twitter.com','x.com','linkedin.com','reddit.com','netflix.com','amazon.com',
    'apple.com','microsoft.com','notion.so','figma.com','slack.com','discord.com',
    'dropbox.com','drive.google.com','stackoverflow.com','openai.com','tistory.com',
    'velog.io','medium.com','twitch.tv','spotify.com','pinterest.com','zoom.us',
    'teams.microsoft.com','outlook.com','office.com','outlook.cloud.microsoft',
    'vercel.com','netlify.com','linear.app','developer.mozilla.org','yahoo.com'
];
