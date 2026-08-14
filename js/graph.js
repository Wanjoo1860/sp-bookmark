;(function(){
'use strict';

const GRAPH = "https://graph.microsoft.com/v1.0";
const SITE = `${GRAPH}/sites/${CONFIG.siteId}`;
const BM_LIST = `${SITE}/lists/${CONFIG.bookmarksListId}`;

async function callGraph(url, method, body) {
  const token = await AUTH.getToken();
  const opts = {
    method: method || "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };
  if(body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  if(resp.status === 204) return null;
  if(!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || resp.statusText);
  }
  return resp.json();
}

window.GRAPH_API = {
  /* ─── Bookmarks CRUD ─── */

  /** 전체 북마크 가져오기 */
  async getBookmarks() {
    const data = await callGraph(
      `${BM_LIST}/items?$expand=fields&$top=999`
    );
    return (data.value || []).map(item => ({
      id: item.id,
      name: item.fields.Title || "",
      url: item.fields.Url || "",
      desc: item.fields.Description || "",
      category: item.fields.Category || "",
      vis: item.fields.Visibility || "public",
      owner: item.fields.Owner || "",
      ord: item.fields.SortOrder || 0,
      iconUrl: item.fields.IconUrl || ""
    }));
  },

  /** 북마크 추가 */
  async addBookmark(bm) {
    const body = {
      fields: {
        Title: bm.name,
        Url: bm.url,
        Description: bm.desc || "",
        Category: bm.category || "",
        Visibility: bm.vis || "public",
        Owner: bm.owner,
        SortOrder: bm.ord || 0,
        IconUrl: bm.iconUrl || ""
      }
    };
    const data = await callGraph(`${BM_LIST}/items`, "POST", body);
    return {
      id: data.id,
      name: data.fields.Title,
      url: data.fields.Url,
      desc: data.fields.Description || "",
      category: data.fields.Category || "",
      vis: data.fields.Visibility || "public",
      owner: data.fields.Owner,
      ord: data.fields.SortOrder || 0,
      iconUrl: data.fields.IconUrl || ""
    };
  },

  /** 북마크 수정 */
  async updateBookmark(itemId, fields) {
    const body = { fields: {} };
    if(fields.name !== undefined) body.fields.Title = fields.name;
    if(fields.url !== undefined) body.fields.Url = fields.url;
    if(fields.desc !== undefined) body.fields.Description = fields.desc;
    if(fields.category !== undefined) body.fields.Category = fields.category;
    if(fields.vis !== undefined) body.fields.Visibility = fields.vis;
    if(fields.owner !== undefined) body.fields.Owner = fields.owner;
    if(fields.ord !== undefined) body.fields.SortOrder = fields.ord;
    if(fields.iconUrl !== undefined) body.fields.IconUrl = fields.iconUrl;
    await callGraph(`${BM_LIST}/items/${itemId}/fields`, "PATCH", body.fields);
  },

  /** 북마크 삭제 */
  async deleteBookmark(itemId) {
    await callGraph(`${BM_LIST}/items/${itemId}`, "DELETE");
  },

  /** 특정 소유자의 북마크 전체 삭제 */
  async deleteBookmarksByOwner(ownerEmail) {
    const all = await this.getBookmarks();
    const targets = all.filter(b => b.owner === ownerEmail);
    for(const bm of targets) {
      await this.deleteBookmark(bm.id);
    }
  },

  /** 특정 소유자의 개인(private) 북마크만 삭제 */
  async deletePrivateBookmarksByOwner(ownerEmail) {
    const all = await this.getBookmarks();
    const targets = all.filter(b => b.owner === ownerEmail && b.vis === "private");
    for(const bm of targets) {
      await this.deleteBookmark(bm.id);
    }
  },

  /* ─── Group Owners (관리자) ─── */

  /** 그룹 소유자 목록 가져오기 */
  async getOwners() {
    const data = await callGraph(
      `${GRAPH}/groups/${CONFIG.groupId}/owners?$select=id,displayName,mail,userPrincipalName`
    );
    return (data.value || []).map(u => ({
      id: u.id,
      name: u.displayName,
      email: u.mail || u.userPrincipalName
    }));
  },

  /** 소유자 추가 */
  async addOwner(userId) {
    const body = {
      "@odata.id": `${GRAPH}/users/${userId}`
    };
    await callGraph(
      `${GRAPH}/groups/${CONFIG.groupId}/owners/$ref`, "POST", body
    );
  },

  /** 소유자 제거 */
  async removeOwner(userId) {
    await callGraph(
      `${GRAPH}/groups/${CONFIG.groupId}/owners/${userId}/$ref`, "DELETE"
    );
  },

  /** 현재 사용자가 소유자(관리자)인지 확인 */
  async isOwner(userId) {
    const owners = await this.getOwners();
    return owners.some(o => o.id === userId);
  },

  /* ─── Group Members (사용자) ─── */

  /** 그룹 멤버 목록 */
  async getMembers() {
    const data = await callGraph(
      `${GRAPH}/groups/${CONFIG.groupId}/members?$select=id,displayName,mail,userPrincipalName,userType`
    );
    return (data.value || []).map(u => ({
      id: u.id,
      name: u.displayName,
      email: u.mail || u.userPrincipalName,
      type: u.userType || "Member"
    }));
  },

  /** 멤버 추가 */
  async addMember(userId) {
    const body = {
      "@odata.id": `${GRAPH}/directoryObjects/${userId}`
    };
    await callGraph(
      `${GRAPH}/groups/${CONFIG.groupId}/members/$ref`, "POST", body
    );
  },

  /** 멤버 제거 */
  async removeMember(userId) {
    await callGraph(
      `${GRAPH}/groups/${CONFIG.groupId}/members/${userId}/$ref`, "DELETE"
    );
  },

  /* ─── 사용자 검색 ─── */

  /** 이름 또는 메일로 사용자 검색 */
  async searchUsers(query) {
    const token = await AUTH.getToken();
    const url = `${GRAPH}/users?$filter=startswith(displayName,'${query}') or startswith(mail,'${query}')&$select=id,displayName,mail,userPrincipalName,userType&$top=10`;
    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "ConsistencyLevel": "eventual"
      }
    });
    if(!resp.ok) {
      // fallback: $search 사용
      const url2 = `${GRAPH}/users?$search="displayName:${query}" OR "mail:${query}"&$select=id,displayName,mail,userPrincipalName,userType&$top=10&$count=true`;
      const resp2 = await fetch(url2, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "ConsistencyLevel": "eventual"
        }
      });
      const data2 = await resp2.json();
      return (data2.value || []).map(u => ({
        id: u.id,
        name: u.displayName,
        email: u.mail || u.userPrincipalName,
        type: u.userType || "Member"
      }));
    }
    const data = await resp.json();
    return (data.value || []).map(u => ({
      id: u.id,
      name: u.displayName,
      email: u.mail || u.userPrincipalName,
      type: u.userType || "Member"
    }));
  },

  /* ─── 내 프로필 ─── */
  async getMe() {
    return await callGraph(`${GRAPH}/me?$select=id,displayName,mail,userPrincipalName,userType`);
  }
};

})();
