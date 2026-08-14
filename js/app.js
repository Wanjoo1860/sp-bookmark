;(function(){
'use strict';

/* ─── 상수 ─── */
const ST_BL = 'portal_blocked_v7';

const KNOWN_BLOCKED = [
  'google.com','youtube.com','github.com','naver.com','daum.net','kakao.com',
  'mail.google.com','chat.openai.com','claude.ai','facebook.com','instagram.com',
  'twitter.com','x.com','linkedin.com','reddit.com','netflix.com','amazon.com',
  'apple.com','microsoft.com','notion.so','figma.com','slack.com','discord.com',
  'dropbox.com','drive.google.com','stackoverflow.com','openai.com','tistory.com',
  'velog.io','medium.com','twitch.tv','spotify.com','pinterest.com','zoom.us',
  'teams.microsoft.com','outlook.com','office.com','outlook.cloud.microsoft',
  'vercel.com','netlify.com','linear.app','developer.mozilla.org','yahoo.com'
];

/* ─── 상태 ─── */
let currentUser    = null;   // { id, email, name, role }
let currentUrl     = '';
let bookmarks      = [];
let dynamicBlocked = [];
let checkTimer     = null;
let loadTimer      = null;
let pageCallId     = 0;
let hoverTimer     = null;
let editingId      = null;

/* ─── DOM ─── */
const $ = s => document.querySelector(s);
const sidebar       = $('#sidebar');
const btnToggle     = $('#btnToggle');
const btnManager    = $('#btnManager');
const btnLogout     = $('#btnLogout');
const navList       = $('#navList');
const contentFrame  = $('#contentFrame');
const welcomeScreen = $('#welcomeScreen');
const errorScreen   = $('#errorScreen');
const loadingScreen = $('#loadingScreen');
const errorDomain   = $('#errorDomain');
const btnOpenNew    = $('#btnOpenNew');
const loginWrap     = $('#loginWrap');
const modalOverlay  = $('#modalOverlay');
const btnCloseModal = $('#btnCloseModal');
const inputUrl      = $('#inputUrl');
const inputName     = $('#inputName');
const inputDesc     = $('#inputDesc');
const inputVis      = $('#inputVis');
const inputHint     = $('#inputHint');
const previewFav    = $('#previewFav');
const btnAddBm      = $('#btnAddBm');
const bmSections    = $('#bmSections');
const footerUser    = $('#footerUser');
const visRow        = $('#visRow');
const formTitle     = $('#formTitle');
const hoverCard     = $('#hoverCard');
const hoverFav      = $('#hoverFav');
const hoverName     = $('#hoverName');
const hoverUrl      = $('#hoverUrl');
const hoverDesc     = $('#hoverDesc');
const hoverTag      = $('#hoverTag');
const editOverlay   = $('#editOverlay');
const btnCloseEdit  = $('#btnCloseEdit');
const editUrl       = $('#editUrl');
const editName      = $('#editName');
const editDesc      = $('#editDesc');
const editVis       = $('#editVis');
const editFav       = $('#editFav');
const btnSaveEdit   = $('#btnSaveEdit');
const editVisRow    = $('#editVisRow');
const panelBookmarks = $('#panelBookmarks');
const panelUsers     = $('#panelUsers');
const tabUsers       = $('#tabUsers');
const userList       = $('#userList');
const userCount      = $('#userCount');
const toastEl        = $('#toastMsg');

/* ─── 유틸 ─── */
function loadJSON(key, def){
  try{ return JSON.parse(localStorage.getItem(key)) || def; }
  catch(e){ return def; }
}
function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function getHostname(url){
  try{ return new URL(url.startsWith('http') ? url : 'https://'+url).hostname.toLowerCase(); }
  catch(e){ return ''; }
}

function isBlocked(url){
  const h = getHostname(url);
  if(!h) return false;
  for(const d of KNOWN_BLOCKED){ if(h === d || h.endsWith('.'+d)) return true; }
  for(const d of dynamicBlocked){ if(h === d || h.endsWith('.'+d)) return true; }
  return false;
}

function addToDynamicBlocked(url){
  const h = getHostname(url);
  if(h && !dynamicBlocked.includes(h)){ dynamicBlocked.push(h); saveJSON(ST_BL, dynamicBlocked); }
}

function faviconUrl(url, sz){
  const h = getHostname(url);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=${sz||64}` : '';
}

function fallbackIcon(name){
  const ch = (name || '?').charAt(0).toUpperCase();
  const hue = (ch.charCodeAt(0) * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="hsl(${hue},55%,45%)"/><text x="32" y="44" font-size="32" font-weight="bold" font-family="Arial,sans-serif" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function handleImgError(img, url, name){
  const h = getHostname(url);
  if(!img.dataset.retry){ img.dataset.retry='1'; img.src=`https://icons.duckduckgo.com/ip3/${h}.ico`; return; }
  if(img.dataset.retry==='1'){ img.dataset.retry='2'; img.src=fallbackIcon(name||h); return; }
  img.style.display='none';
}

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2500);
}

function escHtml(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* ─── 화면 전환 ─── */
function hideAll(){
  welcomeScreen.style.display='none'; errorScreen.style.display='none';
  loadingScreen.style.display='none'; contentFrame.style.display='none';
}
function showWelcome(){ hideAll(); welcomeScreen.style.display='flex'; }
function showError(url){ hideAll(); errorDomain.textContent=getHostname(url)||url; errorScreen.style.display='flex'; }
function showLoading(){ hideAll(); loadingScreen.style.display='flex'; }
function showFrame(){ hideAll(); contentFrame.style.display='block'; }

/* ─── iframe ─── */
function clearChecks(){
  if(checkTimer){clearTimeout(checkTimer);checkTimer=null;}
  if(loadTimer){clearTimeout(loadTimer);loadTimer=null;}
  contentFrame.onload=null; contentFrame.onerror=null;
}

function openPage(url){
  clearChecks(); pageCallId++;
  const myId = pageCallId;
  if(!url.startsWith('http')) url='https://'+url;
  currentUrl = url;
  if(isBlocked(url)){ contentFrame.src='about:blank'; showError(url); return; }
  showLoading();
  const startTime = Date.now();
  contentFrame.onload = function(){
    if(myId!==pageCallId) return; clearChecks();
    const elapsed=Date.now()-startTime;
    try{ const loc=contentFrame.contentWindow.location.href; if(loc==='about:blank'){addToDynamicBlocked(url);showError(url);return;} }catch(e){}
    if(elapsed<200){ checkTimer=setTimeout(function(){ if(myId!==pageCallId)return; try{const loc=contentFrame.contentWindow.location.href;if(loc==='about:blank'){addToDynamicBlocked(url);showError(url);return;}}catch(e){} showFrame();},300); }
    else{ showFrame(); }
  };
  contentFrame.onerror = function(){ if(myId!==pageCallId)return; clearChecks(); addToDynamicBlocked(url); showError(url); };
  loadTimer = setTimeout(function(){ if(myId!==pageCallId)return; clearChecks(); addToDynamicBlocked(url); showError(url); },12000);
  contentFrame.src = url;
}

document.addEventListener('securitypolicyviolation', function(e){
  if(e.blockedURI && currentUrl){
    const bh=getHostname(e.blockedURI); const ch=getHostname(currentUrl);
    if(bh===ch){clearChecks();addToDynamicBlocked(currentUrl);showError(currentUrl);}
  }
});

btnOpenNew.addEventListener('click', function(){
  if(currentUrl) window.open(currentUrl,'_blank','noopener,noreferrer');
});

/* ─── 사이드바 토글 ─── */
const isMobile = () => window.innerWidth <= 768;
btnToggle.addEventListener('click', function(){
  if(isMobile()){ sidebar.classList.remove('collapsed'); sidebar.classList.toggle('expanded'); }
  else{ sidebar.classList.remove('expanded'); sidebar.classList.toggle('collapsed'); }
});
navList.addEventListener('click', function(){
  if(isMobile() && sidebar.classList.contains('expanded')) sidebar.classList.remove('expanded');
});

/* ─── 가시성 ─── */
function visible(bm){
  if(!currentUser) return false;
  if(bm.vis==='public') return true;
  if(bm.vis==='admin' && currentUser.role==='admin') return true;
  if(bm.vis==='private' && bm.owner===currentUser.email) return true;
  return false;
}

/* ─── 호버 카드 ─── */
function showHoverCard(bm, targetEl){
  hoverFav.src=faviconUrl(bm.url); hoverFav.onerror=function(){this.style.display='none';};
  hoverFav.style.display='inline-block';
  hoverName.textContent=bm.name; hoverUrl.textContent=getHostname(bm.url);
  hoverDesc.textContent=bm.desc||'';
  if(isBlocked(bm.url)){ hoverTag.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> 새 창으로 열림'; }
  else{ hoverTag.textContent=''; }
  hoverCard.classList.add('show');
  const r=targetEl.getBoundingClientRect();
  let left=r.right+10, top=r.top+r.height/2-hoverCard.offsetHeight/2;
  if(left+hoverCard.offsetWidth>window.innerWidth-10) left=r.left-hoverCard.offsetWidth-10;
  if(top<5) top=5; if(top+hoverCard.offsetHeight>window.innerHeight-5) top=window.innerHeight-hoverCard.offsetHeight-5;
  hoverCard.style.left=left+'px'; hoverCard.style.top=top+'px';
}
function hideHoverCard(){ hoverCard.classList.remove('show'); }

/* ─── 사이드바 렌더링 ─── */
function renderNav(){
  navList.innerHTML='';
  const pubItems=bookmarks.filter(b=>b.vis==='public'&&visible(b));
  const admItems=bookmarks.filter(b=>b.vis==='admin'&&visible(b));
  const privItems=bookmarks.filter(b=>b.vis==='private'&&visible(b));

  function makeSection(label, items, cls){
    if(items.length===0) return;
    const sec=document.createElement('div'); sec.className='nav-section '+cls;
    const lbl=document.createElement('div'); lbl.className='nav-section-label'; lbl.textContent=label;
    sec.appendChild(lbl);
    items.sort((a,b)=>(a.ord||0)-(b.ord||0));
    items.forEach(bm=>{
      const item=document.createElement('div'); item.className='nav-item'; item.dataset.id=bm.id;
      const icon=document.createElement('img'); icon.className='nav-icon'; icon.src=faviconUrl(bm.url); icon.alt='';
      icon.onerror=function(){handleImgError(this,bm.url,bm.name);};
      const name=document.createElement('span'); name.className='nav-name'; name.textContent=bm.name;
      item.appendChild(icon); item.appendChild(name);
      if(bm.vis==='admin'){const badge=document.createElement('span');badge.className='adm-badge';badge.textContent='ADM';item.appendChild(badge);}
      if(isBlocked(bm.url)){const tag=document.createElement('span');tag.className='blocked-tag';tag.textContent='새 창';item.appendChild(tag);}
      item.addEventListener('click',function(){
        document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
        item.classList.add('active'); openPage(bm.url);
      });
      item.addEventListener('mouseenter',function(){clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showHoverCard(bm,item),400);});
      item.addEventListener('mouseleave',function(){clearTimeout(hoverTimer);hideHoverCard();});
      sec.appendChild(item);
    });
    navList.appendChild(sec);
  }

  makeSection('공개',pubItems,'sec-public');
  makeSection('관리자',admItems,'sec-admin');
  makeSection('개인',privItems,'sec-private');
}

/* ─── 편집 모달 ─── */
function openEditModal(bm){
  editingId=bm.id; editUrl.value=bm.url; editName.value=bm.name; editDesc.value=bm.desc||'';
  editVis.value=bm.vis; editFav.src=faviconUrl(bm.url); editFav.style.display='inline-block';
  editFav.onerror=function(){this.style.display='none';};
  editVisRow.style.display=(currentUser.role==='admin')?'flex':'none';
  editOverlay.classList.add('show');
}
function closeEditModal(){ editOverlay.classList.remove('show'); editingId=null; }

async function saveEdit(){
  if(!editingId) return;
  const bm=bookmarks.find(b=>b.id===editingId);
  if(!bm) return;
  const url=editUrl.value.trim(); const name=editName.value.trim(); const desc=editDesc.value.trim();
  if(!url||!name){toast('URL과 이름을 입력하세요');return;}
  const fullUrl=url.startsWith('http')?url:'https://'+url;
  const fields={name,url:fullUrl,desc};
  if(currentUser.role==='admin') fields.vis=editVis.value;
  try{
    await GRAPH_API.updateBookmark(editingId, fields);
    bm.url=fullUrl; bm.name=name; bm.desc=desc;
    if(fields.vis) bm.vis=fields.vis;
    renderBmList(); renderNav(); closeEditModal(); toast('수정 완료');
  }catch(e){ toast('수정 실패: '+e.message); }
}

editUrl.addEventListener('input',function(){
  const url=editUrl.value.trim();
  if(url){editFav.src=faviconUrl(url.startsWith('http')?url:'https://'+url);editFav.style.display='inline-block';}
  else{editFav.style.display='none';}
});
btnSaveEdit.addEventListener('click', saveEdit);
btnCloseEdit.addEventListener('click', closeEditModal);
editOverlay.addEventListener('click',function(e){if(e.target===editOverlay)closeEditModal();});

/* ─── 관리 모달 — 즐겨찾기 ─── */
function renderBmList(){
  bmSections.innerHTML='';
  if(currentUser.role==='admin'){
    renderBmSection('공개','public',false);
    renderBmSection('관리자 전용','admin',false);
    renderBmSection('개인','private',true);
  } else {
    renderBmSection('내 북마크','private',true);
  }
}

function renderBmSection(label, vis, ownerOnly){
  let items;
  if(ownerOnly){ items=bookmarks.filter(b=>b.vis===vis&&b.owner===currentUser.email); }
  else{ items=bookmarks.filter(b=>b.vis===vis); }
  items.sort((a,b)=>(a.ord||0)-(b.ord||0));

  const block=document.createElement('div'); block.className='bm-block';
  const header=document.createElement('div'); header.className='bm-block-header bm-block-'+vis;
  header.innerHTML='<span class="bm-block-dot"></span> '+label;
  block.appendChild(header);

  const list=document.createElement('div'); list.className='bm-block-list';
  if(items.length===0){
    const empty=document.createElement('div'); empty.className='bm-empty'; empty.textContent='등록된 항목이 없습니다.';
    list.appendChild(empty);
  }

  items.forEach(bm=>{
    const row=document.createElement('div'); row.className='bm-row'; row.draggable=true; row.dataset.id=bm.id; row.dataset.vis=vis;
    const favicon=document.createElement('img'); favicon.className='bm-favicon'; favicon.src=faviconUrl(bm.url,32); favicon.alt='';
    favicon.onerror=function(){handleImgError(this,bm.url,bm.name);};
    const infoWrap=document.createElement('div'); infoWrap.className='bm-info-wrap';
    const info=document.createElement('span'); info.className='bm-info'; info.textContent=bm.name;
    const sub=document.createElement('span'); sub.className='bm-sub'; sub.textContent=getHostname(bm.url);
    infoWrap.appendChild(info); infoWrap.appendChild(sub);
    row.appendChild(favicon); row.appendChild(infoWrap);

    if(isBlocked(bm.url)){const tag=document.createElement('span');tag.className='blocked-tag';tag.textContent='새 창';row.appendChild(tag);}

    const edit=document.createElement('button'); edit.className='bm-btn'; edit.title='편집';
    edit.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    edit.addEventListener('click',function(e){e.stopPropagation();openEditModal(bm);});

    const del=document.createElement('button'); del.className='bm-btn bm-del'; del.title='삭제'; del.textContent='\u00D7';
    del.addEventListener('click', async function(e){
      e.stopPropagation();
      if(!confirm(bm.name+' 을(를) 삭제하시겠습니까?')) return;
      try{
        await GRAPH_API.deleteBookmark(bm.id);
        bookmarks=bookmarks.filter(b=>b.id!==bm.id);
        renderBmList(); renderNav(); toast('삭제 완료');
      }catch(err){ toast('삭제 실패: '+err.message); }
    });

    row.appendChild(edit); row.appendChild(del);

    // 드래그앤드롭
    row.addEventListener('dragstart',function(e){e.dataTransfer.setData('text/plain',bm.id);e.dataTransfer.setData('text/vis',vis);row.classList.add('dragging');});
    row.addEventListener('dragend',function(){row.classList.remove('dragging');});
    row.addEventListener('dragover',function(e){e.preventDefault();row.classList.add('drag-over');});
    row.addEventListener('dragleave',function(){row.classList.remove('drag-over');});
    row.addEventListener('drop', async function(e){
      e.preventDefault(); row.classList.remove('drag-over');
      const dragId=e.dataTransfer.getData('text/plain');
      const dragVis=e.dataTransfer.getData('text/vis');
      if(dragVis!==vis||dragId===bm.id) return;
      await reorderInSection(dragId, bm.id, vis, ownerOnly);
    });

    list.appendChild(row);
  });

  block.appendChild(list); bmSections.appendChild(block);
}

async function reorderInSection(dragId, targetId, vis, ownerOnly){
  let sectionItems;
  if(ownerOnly){ sectionItems=bookmarks.filter(b=>b.vis===vis&&b.owner===currentUser.email).sort((a,b)=>(a.ord||0)-(b.ord||0)); }
  else{ sectionItems=bookmarks.filter(b=>b.vis===vis).sort((a,b)=>(a.ord||0)-(b.ord||0)); }
  const dragIdx=sectionItems.findIndex(b=>b.id===dragId);
  const targetIdx=sectionItems.findIndex(b=>b.id===targetId);
  if(dragIdx===-1||targetIdx===-1) return;
  const [moved]=sectionItems.splice(dragIdx,1);
  sectionItems.splice(targetIdx,0,moved);
  // 순서 업데이트
  for(let i=0;i<sectionItems.length;i++){
    sectionItems[i].ord=i;
    try{ await GRAPH_API.updateBookmark(sectionItems[i].id, {ord:i}); }catch(e){}
  }
  renderBmList(); renderNav();
}

/* ─── URL 입력 ─── */
function onUrlInput(){
  const url=inputUrl.value.trim();
  if(!url){previewFav.style.display='none';inputHint.textContent='';return;}
  const full=url.startsWith('http')?url:'https://'+url;
  previewFav.src=faviconUrl(full); previewFav.style.display='inline-block';
  previewFav.onerror=function(){this.style.display='none';};
  if(isBlocked(full)){inputHint.textContent='\u26A0 이 사이트는 iframe 차단됨 (새 창에서 열림)';inputHint.style.color='#f0883e';}
  else{inputHint.textContent='';inputHint.style.color='';}
  if(!inputName.value.trim()){const h=getHostname(full);if(h)inputName.value=h.replace(/^www\./,'');}
}
inputUrl.addEventListener('input', onUrlInput);

/* ─── 북마크 추가 ─── */
btnAddBm.addEventListener('click', async function(){
  const url=inputUrl.value.trim(); const name=inputName.value.trim();
  const desc=inputDesc?inputDesc.value.trim():'';
  if(!url||!name){toast('URL과 이름을 입력하세요');return;}
  const full=url.startsWith('http')?url:'https://'+url;
  let vis=(currentUser.role==='admin')?inputVis.value:'private';

  const bm={name, url:full, desc, vis, owner:currentUser.email, ord:bookmarks.length, category:'', iconUrl:''};
  try{
    const created=await GRAPH_API.addBookmark(bm);
    bookmarks.push(created);
    inputUrl.value='';inputName.value='';if(inputDesc)inputDesc.value='';
    inputHint.textContent='';previewFav.style.display='none';
    renderBmList(); renderNav(); toast('추가 완료');
  }catch(e){ toast('추가 실패: '+e.message); }
});

/* ─── 탭 전환 ─── */
document.querySelectorAll('.modal-tab').forEach(tab=>{
  tab.addEventListener('click',function(){
    document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const t=tab.dataset.tab;
    panelBookmarks.style.display=(t==='bookmarks')?'':'none';
    panelUsers.style.display=(t==='users')?'':'none';
  });
});

/* ─── 관리 모달 열기/닫기 ─── */
btnManager.addEventListener('click', function(){
  document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="bookmarks"]').classList.add('active');
  panelBookmarks.style.display=''; panelUsers.style.display='none';
  tabUsers.style.display=(currentUser.role==='admin')?'':'none';
  inputVis.style.display=(currentUser.role==='admin')?'':'none';
  renderBmList();
  if(currentUser.role==='admin') renderUserList();
  modalOverlay.classList.add('show');
});
btnCloseModal.addEventListener('click',function(){modalOverlay.classList.remove('show');});
modalOverlay.addEventListener('click',function(e){if(e.target===modalOverlay)modalOverlay.classList.remove('show');});

/* ==========================================================
   사용자 관리 (관리자 전용) — Entra ID 연동
   ========================================================== */
async function renderUserList(){
  if(!currentUser||currentUser.role!=='admin') return;
  userList.innerHTML='<div class="bm-empty">로딩 중...</div>';
  try{
    const owners = await GRAPH_API.getOwners();
    const members = await GRAPH_API.getMembers();
    const ownerIds = owners.map(o=>o.id);

    // 중복 제거 (소유자도 멤버에 포함됨)
    const allUsers = [];
    const seen = new Set();
    [...owners, ...members].forEach(u=>{
      if(!seen.has(u.id)){ seen.add(u.id); allUsers.push(u); }
    });

    userList.innerHTML='';
    userCount.textContent=allUsers.length+'명';

    allUsers.forEach(u=>{
      const isOwner=ownerIds.includes(u.id);
      const isMe=(u.id===currentUser.id);
      const item=document.createElement('div'); item.className='user-item';
      const initial=(u.name||'?').charAt(0).toUpperCase();
      const roleLabel=isOwner?'관리자':'사용자';
      const typeLabel=u.type==='Guest'?' (게스트)':'';

      item.innerHTML=`
        <div class="user-avatar ${isOwner?'role-admin':'role-user'}">${initial}</div>
        <div class="user-info">
          <div class="user-info-id">${escHtml(u.name)}${isMe?'<span class="me-badge">(나)</span>':''}${typeLabel}</div>
          <div class="user-info-role">${escHtml(u.email)} · ${roleLabel}</div>
        </div>
        <div class="user-actions">
          ${!isMe?`<button class="btn-user-role" data-uid="${u.id}" data-owner="${isOwner}">${isOwner?'→ 사용자':'→ 관리자'}</button>`:''}
          ${!isMe?`<button class="btn-user-del" data-uid="${u.id}" data-email="${escHtml(u.email)}" data-owner="${isOwner}" data-name="${escHtml(u.name)}">삭제</button>`:''}
        </div>
      `;
      userList.appendChild(item);
    });

    // 역할 변경
    userList.querySelectorAll('.btn-user-role').forEach(btn=>{
      btn.addEventListener('click', async function(){
        const uid=btn.dataset.uid;
        const isOwner=btn.dataset.owner==='true';
        const action=isOwner?'사용자로 변경':'관리자로 변경';
        if(!confirm(`${action}하시겠습니까?`)) return;
        try{
          if(isOwner){ await GRAPH_API.removeOwner(uid); toast('사용자로 변경 완료'); }
          else{ await GRAPH_API.addOwner(uid); toast('관리자로 변경 완료'); }
          renderUserList();
        }catch(e){ toast('변경 실패: '+e.message); }
      });
    });

    // 삭제
    userList.querySelectorAll('.btn-user-del').forEach(btn=>{
      btn.addEventListener('click', async function(){
        const uid=btn.dataset.uid;
        const email=btn.dataset.email;
        const name=btn.dataset.name;
        const isOwner=btn.dataset.owner==='true';

        let msg=`"${name}" 사용자를 삭제하시겠습니까?\n`;
        if(isOwner){ msg+='관리자 개인이 등록한 사이트만 삭제됩니다.'; }
        else{ msg+='해당 사용자가 등록한 모든 즐겨찾기도 함께 삭제됩니다.'; }
        if(!confirm(msg)) return;

        try{
          // 관리자: 개인 북마크만 삭제 / 일반 사용자: 전체 삭제
          if(isOwner){
            await GRAPH_API.deletePrivateBookmarksByOwner(email);
            await GRAPH_API.removeOwner(uid);
          } else {
            await GRAPH_API.deleteBookmarksByOwner(email);
          }
          // 멤버에서 제거
          try{ await GRAPH_API.removeMember(uid); }catch(e){}
          // 로컬 목록 갱신
          bookmarks = await GRAPH_API.getBookmarks();
          renderNav(); renderUserList(); toast(`"${name}" 삭제 완료`);
        }catch(e){ toast('삭제 실패: '+e.message); }
      });
    });

  }catch(e){
    userList.innerHTML='<div class="bm-empty">사용자 목록을 불러올 수 없습니다: '+escHtml(e.message)+'</div>';
  }
}

/* ─── 관리자 추가 (사용자 검색) ─── */
// 사용자 관리 탭의 기존 폼을 검색 UI로 변경
const userFormTitle = $('#userFormTitle');
const userInputId = $('#userInputId');
const userInputPw = $('#userInputPw');
const userInputRole = $('#userInputRole');
const btnAddUser = $('#btnAddUser');

// 비밀번호 필드를 검색 결과 영역으로 변경
userInputPw.style.display='none';
userInputRole.style.display='none';
userInputId.placeholder='이름 또는 이메일로 검색';
userInputId.type='search';
userInputId.autocomplete='off';
btnAddUser.textContent='검색';
userFormTitle.textContent='관리자 추가 (사용자 검색)';

let searchResults=[];
const searchResultDiv=document.createElement('div');
searchResultDiv.className='user-list';
searchResultDiv.id='searchResults';
userInputId.parentElement.parentElement.appendChild(searchResultDiv);

btnAddUser.addEventListener('click', async function(){
  const query=userInputId.value.trim();
  if(!query){toast('검색어를 입력하세요');return;}
  searchResultDiv.innerHTML='<div class="bm-empty">검색 중...</div>';
  try{
    searchResults=await GRAPH_API.searchUsers(query);
    if(searchResults.length===0){
      searchResultDiv.innerHTML='<div class="bm-empty">검색 결과 없음</div>';
      return;
    }
    searchResultDiv.innerHTML='';
    searchResults.forEach(u=>{
      const item=document.createElement('div'); item.className='user-item';
      const initial=(u.name||'?').charAt(0).toUpperCase();
      const typeLabel=u.type==='Guest'?' (게스트)':'';
      item.innerHTML=`
        <div class="user-avatar role-user">${initial}</div>
        <div class="user-info">
          <div class="user-info-id">${escHtml(u.name)}${typeLabel}</div>
          <div class="user-info-role">${escHtml(u.email)}</div>
        </div>
        <div class="user-actions">
          <button class="btn-user-role" data-uid="${u.id}">관리자 추가</button>
        </div>
      `;
      item.querySelector('.btn-user-role').addEventListener('click', async function(){
        if(!confirm(`"${u.name}"을(를) 관리자로 추가하시겠습니까?`)) return;
        try{
          // 멤버가 아닐 수 있으므로 먼저 멤버 추가 시도
          try{ await GRAPH_API.addMember(u.id); }catch(e){}
          await GRAPH_API.addOwner(u.id);
          toast(`"${u.name}" 관리자 추가 완료`);
          searchResultDiv.innerHTML='';
          userInputId.value='';
          renderUserList();
        }catch(e){ toast('추가 실패: '+e.message); }
      });
      searchResultDiv.appendChild(item);
    });
  }catch(e){ searchResultDiv.innerHTML='<div class="bm-empty">검색 실패: '+escHtml(e.message)+'</div>'; }
});

/* ─── 인증 ─── */
async function doMsLogin(){
  try{
    const account = await AUTH.login();
    if(!account) return;
    const me = await GRAPH_API.getMe();
    const isAdmin = await GRAPH_API.isOwner(me.id);
    currentUser = {
      id: me.id,
      email: me.mail || me.userPrincipalName,
      name: me.displayName,
      role: isAdmin ? 'admin' : 'user'
    };
    document.body.classList.toggle('is-admin', currentUser.role==='admin');
    footerUser.textContent = currentUser.name;

    // 사용자 자동 등록: 멤버가 아니면 추가
    try{ await GRAPH_API.addMember(me.id); }catch(e){/* 이미 멤버일 수 있음 */}

    showApp();
  }catch(e){
    console.error(e);
    toast('로그인 실패');
  }
}

async function showApp(){
  loginWrap.style.display='none';
  sidebar.style.display='flex';
  dynamicBlocked=loadJSON(ST_BL,[]);
  try{
    bookmarks=await GRAPH_API.getBookmarks();
  }catch(e){
    bookmarks=[];
    toast('북마크 로딩 실패: '+e.message);
  }
  renderNav();
  showWelcome();
}

function showLoginScreen(){
  loginWrap.style.display='flex';
  sidebar.style.display='none';
  hideAll(); contentFrame.src='about:blank';
}

/* 로그아웃 */
btnLogout.addEventListener('click', async function(){
  try{ await AUTH.logout(); }catch(e){}
  currentUser=null;
  document.body.classList.remove('is-admin');
  footerUser.textContent='';
  showLoginScreen();
});

/* ─── ESC 키 ─── */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(editOverlay.classList.contains('show'))closeEditModal();
    else if(modalOverlay.classList.contains('show'))modalOverlay.classList.remove('show');
  }
});

/* ─── 로그인 폼 → MS 로그인 버튼으로 교체 ─── */
const loginForm=$('#loginForm');
loginForm.innerHTML=`
  <h2 class="login-title">즐겨찾기 포털</h2>
  <p style="text-align:center;color:var(--text-secondary);font-size:13px;margin-bottom:8px;">Microsoft 계정으로 로그인하세요</p>
  <button type="button" id="btnMsLogin" class="btn-login" style="display:flex;align-items:center;justify-content:center;gap:8px;">
    <svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
    Microsoft로 로그인
  </button>
  <p id="loginError" class="login-error"></p>
`;
document.getElementById('btnMsLogin').addEventListener('click', doMsLogin);

/* ─── 초기화 ─── */
(async function init(){
  const account = AUTH.getAccount();
  if(account){
    try{
      const me = await GRAPH_API.getMe();
      const isAdmin = await GRAPH_API.isOwner(me.id);
      currentUser={id:me.id, email:me.mail||me.userPrincipalName, name:me.displayName, role:isAdmin?'admin':'user'};
      document.body.classList.toggle('is-admin', currentUser.role==='admin');
      footerUser.textContent=currentUser.name;
      showApp();
    }catch(e){
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
})();

})();
