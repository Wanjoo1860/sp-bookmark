/**
 * [config/sharepoint.config.js]
 * SharePoint 사이트 및 리스트 설정
 * ─────────────────────────────────────────
 * [AI 수정 가이드] 사이트/리스트/그룹 변경 시 이 파일만 수정
 */
export const sharepointConfig = {
  graphUrl: "https://graph.microsoft.com/v1.0",
  siteId: "myworkweb.sharepoint.com,41f0478e-0b56-4582-9b9a-555e8bb6556d,c7c8a765-6546-4d7e-8bc1-ced6c7a1930e",
  bookmarksListId: "db78a289-03d0-44f2-97c6-5ab3a98e6cdd",
  adminGroupId: "cb77a63e-8b14-441b-ba7b-956a47cfb2ae"
};

/**
 * SharePoint List 필드 매핑
 * 앱 내부 필드명 → SharePoint internal column name
 */
export const fieldMap = {
  name: "Title",
  url: "Url",
  desc: "Description",
  category: "Category",
  vis: "Visibility",
  owner: "Owner",
  ord: "SortOrder"
};
