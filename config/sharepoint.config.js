/**
 * SharePoint 사이트 및 List 설정
 */
export const sharepointConfig = {
  siteId: 'myworkweb.sharepoint.com,41f0478e-0b56-4582-9b9a-555e8bb6556d,c7c8a765-6546-4d7e-8bc1-ced6c7a1930e',
  siteUrl: 'https://myworkweb.sharepoint.com/sites/Dev',

  lists: {
    bookmarks: {
      id: 'db78a289-03d0-44f2-97c6-5ab3a98e6cdd',
      name: 'Bookmarks',
      columns: {
        title: 'Title',           // 북마크 이름
        url: 'URL',               // 북마크 URL
        description: 'Description', // 설명
        visibility: 'Visibility', // public | admin | private
        owner: 'Owner',           // 소유자 email
        sortOrder: 'SortOrder'    // 정렬 순서 (number)
      }
    }
  },

  // Graph API base path
  get basePath() {
    return `/sites/${this.siteId}`;
  },

  get bookmarksListPath() {
    return `${this.basePath}/lists/${this.lists.bookmarks.id}`;
  }
};
