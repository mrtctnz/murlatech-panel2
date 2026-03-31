'use strict';

// ══════════════════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════════════════
const SUPABASE_URL = 'https://kyxdvwbcmptkpdcbfdis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eGR2d2JjbXB0a3BkY2JmZGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTg1MjEsImV4cCI6MjA5MDI5NDUyMX0.nbxnSFBzCRleyz6_h7TEzO2wLKX-vV2XUlGAkJARdsQ';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ══════════════════════════════════════════════════════
// CONSTANTS & STATE
// ══════════════════════════════════════════════════════
const TYPES   = ['dana','duve','koc','koyun','kuzu'];
const TLABEL  = {dana:'Dana 🐄',duve:'Düve 🐮',koc:'Koç 🐏',koyun:'Koyun 🐑',kuzu:'Kuzu 🐑'};
const THEX    = {dana:'#e87040',duve:'#e840a0',koc:'#4070e8',koyun:'#40b870',kuzu:'#a060e8'};
const TEMOJI  = {dana:'🐄',duve:'🐮',koc:'🐏',koyun:'🐑',kuzu:'🐑'};
const SCOLS   = ['#e87040','#4070e8','#40b870','#a060e8','#e840a0','#40c8e8','#e8a020','#e85050'];
const AVCOLS  = ['#e87040','#e840a0','#4070e8','#40b870','#a060e8','#e8a020','#40c8e8','#e85050'];
const UKEY    = 'sU_v6';
const HDR_CSV = 'Sezon,Tür,Sıra,Ad Soyad,Telefon,TC Kimlik,Küpe No,Pay,Hayvan,Kesim Tarihi,Satış ₺,Kapora,Kalan,Notlar';

let activeTab    = 'genel';
let sortCol      = 'sira';
let sortDir      = 1;
let editMId      = null;
let editMType    = null;
const editMTypeOf = id => { for(const t of TYPES){if(getRows(t).find(r=>r.id===id))return t;} return null; };
let editHKupe    = null;
let curHdKupe    = null;
let curMdKey     = null;
let selRows      = new Set();
let currentUser  = null;
let havSort      = 'sira';
let kesimDate    = new Date().toISOString().slice(0,10);
let currentSeason= null;
let activeIsletmeId = null;
let pinSelectedUser = null;
let pinBuffer='', loginAttempts=0, loginLockUntil=0;
let hesapHistory = [];
let _histCache   = null;
let odemeRowId   = null;
let odemeRowType = null;

// ══════════════════════════════════════════════════════
// LocalStorage helpers
// ══════════════════════════════════════════════════════
const ls  = k => { try{ return JSON.parse(localStorage.getItem(k))||null; }catch{ return null; } };
const lss = (k,v) => localStorage.setItem(k, JSON.stringify(v));

const PFX = () => activeIsletmeId ? `isl_${activeIsletmeId}_` : 'sa_';
function mKey(sid){ return `${PFX()}sM_${sid}`; }
function hKey(sid){ return `${PFX()}sH_${sid}`; }
function seasonsKey(){ return `${PFX()}seasons`; }
function activeKey(){ return `${PFX()}active`; }
function dirStoreKey(){ return `${PFX()}dir`; }

function getMD(sid){ sid=sid||currentSeason; return ls(mKey(sid))||{}; }
function setMD(d,sid){ sid=sid||currentSeason; lss(mKey(sid),d); }
function getHD(sid){ sid=sid||currentSeason; return ls(hKey(sid))||{}; }
function setHD(d,sid){ sid=sid||currentSeason; lss(hKey(sid),d); }
function getSeasons(){ return ls(seasonsKey())||{}; }
function setSeasons(d){ lss(seasonsKey(),d); }
function getActiveSid(){ return localStorage.getItem(activeKey())||null; }
function setActiveSid(id){ localStorage.setItem(activeKey(),id); }
function getRows(t,sid){ return getMD(sid)[t]||[]; }
function setRows(t,rows,sid){ const d=getMD(sid); d[t]=rows; setMD(d,sid); }
function getHav(k,sid){ return getHD(sid)[k]||null; }
function setHav(k,v,sid){ const d=getHD(sid); d[k]=v; setHD(d,sid); }
function allRows(sid){ const d=getMD(sid); return TYPES.flatMap(t=>(d[t]||[]).map(r=>({...r,_t:t}))); }
function getDir(){ return ls(dirStoreKey())||{}; }
function setDir(d){ lss(dirStoreKey(),d); }
function bc(){}
function dirKey(ad,tel,tc){
  if(tc&&tc.length===11) return 'tc:'+tc.trim();
  return ((ad||'')+'|'+(tel||'')).toLowerCase().trim();
}
function saveToDir(ad,tel,tc){
  if(!ad) return;
  const d=getDir(); const k=dirKey(ad,tel,tc);
  if(!d[k]) d[k]={ad,tel:tel||'',tc:tc||'',firstSeen:currentSeason};
  else{ d[k].ad=ad; d[k].tel=tel||''; if(tc)d[k].tc=tc; }
  setDir(d);
}
function clearHistCache(){ _histCache=null; }
function getCustomerHistory(ad,tel,tc){
  const seasons=getSeasons(); const k=dirKey(ad,tel,tc); const hist=[];
  Object.keys(seasons).forEach(sid=>{
    const rows=allRows(sid).filter(r=>dirKey(r.ad,r.tel,r.tc)===k);
    if(rows.length) hist.push({sid,season:seasons[sid],rows});
  });
  hist.sort((a,b)=>b.season.createdAt.localeCompare(a.season.createdAt));
  return hist;
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/'/g,'&#39;'); }
function fmt(n){ return (Math.round((n||0)*100)/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function sq(){ return (document.getElementById('sbox')?.value||'').toLowerCase().trim(); }
function mq(r,q){ return ['ad','tel','kupe','tc','notlar'].some(f=>(r[f]||'').toLowerCase().includes(q)); }
function kcls(kalan,fiyat){ if(kalan<=0)return'odendi'; if(kalan<(fiyat||0))return'bekliyor'; return'cok'; }
function payStr(r){ if(!r.musteriPay||!r.toplamPay)return''; return `${r.musteriPay}/${r.toplamPay}`; }
function toast(msg,type='ok'){
  const c=document.getElementById('toasts'); if(!c)return;
  const t=document.createElement('div');
  t.className=`toast ${type}`; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}
function getUsers(){ return ls(UKEY)||{}; }
function setUsers(u){ lss(UKEY,u); }
function renderOU(){
  const u=getUsers(),now=Date.now();
  const active=Object.values(u).filter(x=>now-x.ts<15000);
  document.getElementById('onlineUsers').innerHTML=
    `<div class="av-stack">${active.map(x=>`<div class="av" style="background:${x.color}" title="${esc(x.name||'')}">${(x.name||'?')[0].toUpperCase()}</div>`).join('')}</div><span>${active.length} çevrimiçi</span>`;
}
function updStats(){
  const rows=allRows();
  document.getElementById('sTotal').textContent=rows.length;
  document.getElementById('sSatis').textContent='₺'+fmt(rows.reduce((a,r)=>a+(r.fiyat||0),0));
  document.getElementById('sKapora').textContent='₺'+fmt(rows.reduce((a,r)=>a+(r.kapora||0),0));
  document.getElementById('sKalan').textContent='₺'+fmt(rows.reduce((a,r)=>a+((r.fiyat||0)-(r.kapora||0)),0));
  document.getElementById('sHayvan').textContent=Object.keys(getHD()).length;
}
function renderAll(){ renderTabs(); renderMain(); renderOU(); setTimeout(updateArrows,50); }
function toggleExp(){ document.getElementById('emenu').classList.toggle('open'); }
document.addEventListener('click',e=>{ if(!e.target.closest('.tright')) document.getElementById('emenu')?.classList.remove('open'); });

// ══════════════════════════════════════════════════════
// OFFLINE / SYNC
// ══════════════════════════════════════════════════════
const IDB_NAME='murlatech_q', IDB_STORE='q';
let idb=null;
function openIDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(IDB_NAME,1);
    r.onupgradeneeded=e=>e.target.result.createObjectStore(IDB_STORE,{keyPath:'id',autoIncrement:true});
    r.onsuccess=e=>{idb=e.target.result;res(idb);};
    r.onerror=()=>rej(r.error);
  });
}
async function queueOp(op){
  if(!idb) await openIDB();
  return new Promise((res,rej)=>{
    const tx=idb.transaction(IDB_STORE,'readwrite');
    tx.objectStore(IDB_STORE).add({...op,ts:Date.now()});
    tx.oncomplete=res; tx.onerror=()=>rej(tx.error);
  });
}
async function flushQueue(){
  if(!idb) await openIDB();
  const items=await new Promise((res,rej)=>{
    const tx=idb.transaction(IDB_STORE,'readonly');
    const req=tx.objectStore(IDB_STORE).getAll();
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
  if(!items.length) return;
  showSync('syncing');
  let ok=0,fail=0;
  for(const item of items){
    try{
      if(item.action==='upsert'){ const {error}=await sb.from(item.table).upsert(item.data); if(error)throw error; }
      else if(item.action==='delete'){ const {error}=await sb.from(item.table).delete().eq('id',item.data.id); if(error)throw error; }
      await new Promise((res,rej)=>{ const tx=idb.transaction(IDB_STORE,'readwrite'); tx.objectStore(IDB_STORE).delete(item.id); tx.oncomplete=res; tx.onerror=()=>rej(); });
      ok++;
    }catch(e){fail++;}
  }
  if(fail===0) showSync('ok'); else showSync('err');
  updatePendingBadge();
}
async function updatePendingBadge(){
  if(!idb) return;
  const n=await new Promise(res=>{ const tx=idb.transaction(IDB_STORE,'readonly'); const req=tx.objectStore(IDB_STORE).count(); req.onsuccess=()=>res(req.result); });
  const b=document.getElementById('pendingBadge');
  if(n>0){b.textContent=`⏳ ${n} bekleyen`;b.classList.add('show');}
  else b.classList.remove('show');
}
function showSync(state){ const b=document.getElementById('syncBar'); b.className='sync-bar '+state; }
let isOnline=navigator.onLine;
window.addEventListener('online',()=>{ isOnline=true; document.getElementById('offlineBadge').classList.remove('show'); flushQueue(); });
window.addEventListener('offline',()=>{ isOnline=false; document.getElementById('offlineBadge').classList.add('show'); });

async function dbUpsert(table,data){
  if(isOnline){ showSync('syncing'); const {error}=await sb.from(table).upsert(data); if(error){showSync('err');await queueOp({table,action:'upsert',data});}else showSync('ok'); }
  else{ await queueOp({table,action:'upsert',data}); updatePendingBadge(); }
}
async function dbDelete(table,id){
  if(isOnline){ showSync('syncing'); const {error}=await sb.from(table).delete().eq('id',id); if(error){showSync('err');await queueOp({table,action:'delete',data:{id}});}else showSync('ok'); }
  else{ await queueOp({table,action:'delete',data:{id}}); updatePendingBadge(); }
}

// ══════════════════════════════════════════════════════
// SHA256
// ══════════════════════════════════════════════════════
async function sha256(str){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ══════════════════════════════════════════════════════
// İŞLETME YÖNETİMİ
// ══════════════════════════════════════════════════════
const LS_ISL='murt_isletmeler';
const LS_USERS='murt_users_';
const SESSION_KEY='murt_sess_v1';

function getSession(){ return ls(SESSION_KEY); }
function setSession(s){ lss(SESSION_KEY,s); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

// ══════════════════════════════════════════════════════
// E-POSTA TABANLI GİRİŞ
// ══════════════════════════════════════════════════════
async function emailIleri(){
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const errEl = document.getElementById('emailError');
  if(!email || !email.includes('@')){ errEl.textContent='Geçerli bir e-posta girin.'; errEl.style.display='block'; return; }
  errEl.style.display='none';
  document.querySelector('#loginStep1 button').textContent='Aranıyor...';

  // Tüm kullanıcılar içinde e-postayı ara
  let foundUser = null;
  let foundIsletmeId = null;

  if(isOnline){
    const {data} = await sb.from('kullanicilar').select('*').eq('email', email).limit(1);
    if(data && data.length){
      foundUser = data[0];
      foundIsletmeId = foundUser.isletme_id || null;
    }
  } else {
    // Offline: cache'den ara
    const superUsers = ls(LS_USERS+'sa') || [];
    const found = superUsers.find(u=>u.email===email);
    if(found){ foundUser=found; foundIsletmeId=null; }
    else {
      const isletmeler = ls(LS_ISL) || [];
      for(const isl of isletmeler){
        const users = ls(LS_USERS+isl.id) || [];
        const f = users.find(u=>u.email===email);
        if(f){ foundUser=f; foundIsletmeId=isl.id; break; }
      }
    }
  }

  document.querySelector('#loginStep1 button').textContent='İLERİ →';

  if(!foundUser){
    errEl.textContent='Bu e-posta adresi kayıtlı değil.';
    errEl.style.display='block';
    return;
  }
  if(foundUser.rol === 'blocked'){
    errEl.textContent='Bu hesap engellenmiş. Yöneticinizle iletişime geçin.';
    errEl.style.display='block';
    return;
  }

  // Kullanıcıyı bul, işletmeyi ayarla, PIN adımına geç
  activeIsletmeId = foundIsletmeId;
  pinSelectedUser = foundUser;
  pinBuffer = ''; loginAttempts = 0;

  document.getElementById('pinAvatar').style.background = foundUser.color||'#e8a020';
  document.getElementById('pinAvatar').textContent = (foundUser.ad||'?')[0].toUpperCase();
  document.getElementById('pinUserName').textContent = foundUser.ad||'—';
  document.getElementById('pinUserEmail').textContent = foundUser.email||'';
  const rolLabel = foundUser.rol==='superadmin'?'👑 Süper Admin':foundUser.rol==='admin'?'⚙️ İşletme Yöneticisi':'👤 Kullanıcı';
  document.getElementById('pinUserRole').textContent = rolLabel;
  document.getElementById('loginError').style.display='none';
  document.getElementById('loginHint').textContent='';

  buildNumpad(); updatePinDots();
  document.getElementById('loginStep1').style.display='none';
  document.getElementById('loginStep2').style.display='block';
}

function pinGeriDon(){
  pinSelectedUser=null; pinBuffer=''; activeIsletmeId=null;
  document.getElementById('loginStep2').style.display='none';
  document.getElementById('loginStep1').style.display='block';
  document.getElementById('loginError').style.display='none';
  document.getElementById('emailError').style.display='none';
}

// Eski fonksiyonları stub olarak bırak (bağımlılık için)
async function renderIsletmePick(){}
async function selectIsletme(id){}
async function loginAsSuperAdmin(){}
function backToIsletmePick(){}
async function renderUserPickList(){}
function selectUserForLogin(uid){}

async function loadIsletmeler(){
  if(isOnline){
    const {data}=await sb.from('isletmeler').select('*').order('created_at');
    if(data){ lss(LS_ISL,data); return data; }
  }
  return ls(LS_ISL)||[];
}
async function loadUsers(islId){
  if(isOnline){
    let q=islId?sb.from('kullanicilar').select('*').eq('isletme_id',islId):sb.from('kullanicilar').select('*').is('isletme_id',null);
    const {data}=await q;
    if(data){ lss(LS_USERS+(islId||'sa'),data); return data; }
  }
  return ls(LS_USERS+(islId||'sa'))||[];
}

async function renderIsletmePick(){
  const list=await loadIsletmeler();
  document.getElementById('isletmePickList').innerHTML=list.length
    ?list.map(isl=>`<button class="user-pick-btn" onclick="selectIsletme('${isl.id}')">
        <div class="user-pick-av" style="background:${isl.color||'#4090e8'}">${isl.ad[0].toUpperCase()}</div>
        <div style="min-width:0;flex:1"><div class="user-pick-name">${esc(isl.ad)}</div><div class="user-pick-role">${isl.yetkili?esc(isl.yetkili):'—'}</div></div>
        <div style="margin-left:auto;color:var(--muted);font-size:20px">›</div>
      </button>`).join('')
    :'<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Henüz işletme yok.<br><small>Süper Admin girişi yapın.</small></div>';
}

async function selectIsletme(islId){
  activeIsletmeId=islId;
  const list=ls(LS_ISL)||[];
  const isl=list.find(i=>i.id===islId);
  document.getElementById('step1Sub').textContent=isl?`${isl.ad} — kullanıcı seçin`:'Kullanıcı seçin';
  document.getElementById('backToIsletmeWrap').style.display='';
  document.getElementById('loginStep0').style.display='none';
  document.getElementById('loginStep1').style.display='block';
  await renderUserPickList();
}
async function loginAsSuperAdmin(){
  activeIsletmeId=null;
  document.getElementById('step1Sub').textContent='👑 Süper Admin';
  document.getElementById('backToIsletmeWrap').style.display='none';
  document.getElementById('loginStep0').style.display='none';
  document.getElementById('loginStep1').style.display='block';
  await renderUserPickList();
}
function backToIsletmePick(){
  activeIsletmeId=null;
  document.getElementById('loginStep1').style.display='none';
  document.getElementById('loginStep0').style.display='block';
}
async function renderUserPickList(){
  const users=await loadUsers(activeIsletmeId);
  document.getElementById('userPickList').innerHTML=users.filter(u=>u.rol!=='blocked').map(u=>`
    <button class="user-pick-btn" onclick="selectUserForLogin('${u.id}')">
      <div class="user-pick-av" style="background:${u.color||'#e8a020'}">${(u.ad||'?')[0].toUpperCase()}</div>
      <div style="min-width:0">
        <div class="user-pick-name">${esc(u.ad||'—')}</div>
        <div class="user-pick-role" style="color:${u.rol==='superadmin'||u.rol==='admin'?'var(--accent)':'var(--muted)'}">
          ${u.rol==='superadmin'?'👑 Süper Admin':u.rol==='admin'?'⚙️ Yönetici':'👤 Kullanıcı'}
        </div>
      </div>
      <div style="margin-left:auto;color:var(--muted);font-size:20px">›</div>
    </button>`).join('')||'<div style="text-align:center;padding:20px;color:var(--muted)">Kullanıcı yok.</div>';
}
function selectUserForLogin(uid){
  const users=ls(LS_USERS+(activeIsletmeId||'sa'))||[];
  pinSelectedUser=users.find(u=>u.id===uid);
  if(!pinSelectedUser) return;
  pinBuffer=''; loginAttempts=0;
  document.getElementById('pinAvatar').style.background=pinSelectedUser.color||'#e8a020';
  document.getElementById('pinAvatar').textContent=(pinSelectedUser.ad||'?')[0].toUpperCase();
  document.getElementById('pinUserName').textContent=pinSelectedUser.ad||'—';
  document.getElementById('pinUserEmail').textContent=pinSelectedUser.email||'';
  document.getElementById('pinUserRole').textContent=pinSelectedUser.rol==='superadmin'?'👑 Süper Admin':pinSelectedUser.rol==='admin'?'⚙️ Yönetici':'👤 Kullanıcı';
  document.getElementById('loginError').style.display='none';
  document.getElementById('loginHint').textContent='';
  buildNumpad(); updatePinDots();
  document.getElementById('loginStep1').style.display='none';
  document.getElementById('loginStep2').style.display='block';
  document.getElementById('pinBackBtn').onclick=()=>{
    pinSelectedUser=null; pinBuffer='';
    document.getElementById('loginStep2').style.display='none';
    document.getElementById('loginStep1').style.display='block';
  };
}

// ══════════════════════════════════════════════════════
// PIN AUTH
// ══════════════════════════════════════════════════════
function buildNumpad(){
  const keys=['1','2','3','4','5','6','7','8','9','','0','⌫'];
  document.getElementById('numpad').innerHTML=keys.map(k=>{
    if(!k)return'<div></div>';
    const d=k==='⌫';
    return`<button class="numpad-btn${d?' del':''}" onclick="pinKey('${d?'DEL':k}')">${k}</button>`;
  }).join('');
  document.onkeydown=e=>{
    if(document.getElementById('loginStep2').style.display==='none')return;
    if(/^[0-9]$/.test(e.key))pinKey(e.key);
    else if(e.key==='Backspace')pinKey('DEL');
  };
}
function updatePinDots(){
  const n=Math.max(4,pinBuffer.length<4?4:pinBuffer.length);
  document.getElementById('pinDots').innerHTML=Array.from({length:n},(_,i)=>`<div class="pin-dot${i<pinBuffer.length?' filled':''}"></div>`).join('');
}
async function pinKey(k){
  const now=Date.now();
  if(now<loginLockUntil){showLoginErr(`⏳ ${Math.ceil((loginLockUntil-now)/1000)}s`);return;}
  if(k==='DEL'){pinBuffer=pinBuffer.slice(0,-1);updatePinDots();document.getElementById('loginError').style.display='none';return;}
  if(pinBuffer.length>=6)return;
  pinBuffer+=k; updatePinDots();
  if(pinBuffer.length>=4){await new Promise(r=>setTimeout(r,100));await tryPinLogin();}
}
async function tryPinLogin(){
  if(!pinSelectedUser)return;
  const hash=await sha256(pinBuffer);
  if(hash===pinSelectedUser.pin_hash){
    loginAttempts=0; loginLockUntil=0; document.onkeydown=null;
    currentUser={id:pinSelectedUser.id,name:pinSelectedUser.ad,ad:pinSelectedUser.ad,email:pinSelectedUser.email||'',color:pinSelectedUser.color,rol:pinSelectedUser.rol};
    setSession({...currentUser,islId:activeIsletmeId,ts:Date.now()});
    applySession();
    document.getElementById('loginOverlay').classList.remove('open');
    await initAfterLogin();
  } else if(pinBuffer.length<6){
    document.querySelectorAll('.pin-dot.filled').forEach(d=>d.classList.add('error'));
    setTimeout(()=>document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('error')),400);
  } else {
    pinBuffer=''; updatePinDots();
    document.querySelectorAll('.pin-dot.filled').forEach(d=>d.classList.add('error'));
    setTimeout(()=>document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('error')),400);
    loginAttempts++;
    if(loginAttempts>=5){loginLockUntil=Date.now()+60000;loginAttempts=0;showLoginErr('⛔ 5 hatalı. 60sn bekleyin.');}
    else showLoginErr(`❌ Hatalı PIN. (${loginAttempts}/5)`);
  }
}
function showLoginErr(msg){const e=document.getElementById('loginError');e.textContent=msg;e.style.display='block';}
function applySession(){
  if(!currentUser)return;
  document.getElementById('cuName').textContent=currentUser.ad||'—';
  const isSA=currentUser.rol==='superadmin';
  const isA=currentUser.rol==='admin';
  document.getElementById('cuRole').textContent=isSA?'SÜPER ADMİN':isA?'YÖNETİCİ':'';
  document.getElementById('adminBtn').style.display=isA&&!isSA?'':'none';
  document.getElementById('superAdminBtn').style.display=isSA?'':'none';
  if(activeIsletmeId){
    const list=ls(LS_ISL)||[];
    const isl=list.find(i=>i.id===activeIsletmeId);
    const b=document.getElementById('isletmeBadge');
    if(isl){b.textContent=`🏢 ${isl.ad}`;b.style.display='';}
  } else {
    document.getElementById('isletmeBadge').style.display='none';
  }
}
async function doLogout(){
  if(!confirm('Çıkış yapmak istiyor musunuz?'))return;
  clearSession(); currentUser=null; pinSelectedUser=null; pinBuffer=''; activeIsletmeId=null;
  document.onkeydown=null;
  document.getElementById('isletmeBadge').style.display='none';
  document.getElementById('superAdminBtn').style.display='none';
  document.getElementById('adminBtn').style.display='none';
  document.getElementById('loginEmail').value='';
  document.getElementById('emailError').style.display='none';
  document.getElementById('loginError').style.display='none';
  document.getElementById('loginStep2').style.display='none';
  document.getElementById('loginStep1').style.display='block';
  document.getElementById('loginOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('loginEmail')?.focus(), 100);
}

// ══════════════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════════════
const auCpEl=document.getElementById('au_cpick');
AVCOLS.forEach((c,i)=>{
  const b=document.createElement('div');
  b.style.cssText=`width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;border:2px solid transparent;transition:.15s`;
  b.dataset.c=c;
  b.onclick=()=>{auCpEl.querySelectorAll('div').forEach(x=>x.style.borderColor='transparent');b.style.borderColor='#fff';};
  if(i===0)b.style.borderColor='#fff';
  auCpEl.appendChild(b);
});
async function openAdmin(){
  if(currentUser?.rol!=='admin'&&currentUser?.rol!=='superadmin'){toast('Yalnızca yöneticiler açabilir.','err');return;}
  const isl=(ls(LS_ISL)||[]).find(i=>i.id===activeIsletmeId);
  document.getElementById('adminTitle').textContent=isl?`⚙️ ${isl.ad} — Kullanıcılar`:'⚙️ Kullanıcı Yönetimi';
  await renderAdminUserList();
  document.getElementById('adminOverlay').classList.add('open');
}
function closeAdmin(){document.getElementById('adminOverlay').classList.remove('open');}
function closeAdminBg(e){if(e.target===document.getElementById('adminOverlay'))closeAdmin();}
async function renderAdminUserList(){
  const users=await loadUsers(activeIsletmeId);
  document.getElementById('adminUserList').innerHTML=users.map(u=>`
    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--surface2);border-radius:7px;margin-bottom:6px;border-left:3px solid ${u.color||'#e8a020'}">
      <div style="width:32px;height:32px;border-radius:50%;background:${u.color||'#e8a020'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0">${(u.ad||'?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${esc(u.ad||'—')}</div>
        <div style="font-size:10px;color:var(--muted)">${u.email||'—'}</div>
        <div style="font-size:10px;color:${u.rol==='admin'||u.rol==='superadmin'?'var(--accent)':'var(--muted)'}">${u.rol==='superadmin'?'👑 Süper Admin':u.rol==='admin'?'⚙️ Yönetici':u.rol==='blocked'?'🚫 Engelli':'👤 Kullanıcı'}</div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        <button onclick="editUserPin('${u.id}')" style="background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit">🔑</button>
        <select onchange="changeRole('${u.id}',this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text);font-size:11px;font-family:inherit;cursor:pointer">
          <option value="user" ${u.rol==='user'?'selected':''}>👤 Kullanıcı</option>
          <option value="admin" ${u.rol==='admin'?'selected':''}>⚙️ Yönetici</option>
          <option value="blocked" ${u.rol==='blocked'?'selected':''}>🚫 Engelli</option>
        </select>
        <button onclick="removeUser('${u.id}')" style="background:transparent;color:var(--red);border:1px solid var(--red);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit">🗑️</button>
      </div>
    </div>`).join('')||'<div style="color:var(--muted);padding:10px 0">Kullanıcı yok.</div>';
}
async function addUser(){
  const name=document.getElementById('au_name').value.trim();
  const email=document.getElementById('au_email').value.trim().toLowerCase();
  const pin=document.getElementById('au_pin').value.replace(/\D/g,'');
  const role=document.getElementById('au_role').value;
  const sel=auCpEl.querySelector('div[style*="rgb(255"]')||auCpEl.firstChild;
  const color=sel?sel.dataset.c:AVCOLS[0];
  if(!name){toast('Ad zorunlu!','err');return;}
  if(!pin||pin.length<4){toast('PIN 4-6 hane!','err');return;}
  const pinHash=await sha256(pin);
  const {data,error}=await sb.from('kullanicilar').insert({isletme_id:activeIsletmeId||null,ad:name,email:email||null,color,rol:role,pin_hash:pinHash}).select().single();
  if(error){toast('Hata: '+error.message,'err');return;}
  const cached=ls(LS_USERS+(activeIsletmeId||'sa'))||[];
  cached.push(data); lss(LS_USERS+(activeIsletmeId||'sa'),cached);
  ['au_name','au_email','au_pin'].forEach(id=>document.getElementById(id).value='');
  await renderAdminUserList();
  toast(`✔ "${esc(name)}" eklendi (PIN: ${pin})`,'ok');
}
async function editUserPin(uid){
  const newPin=prompt('Yeni PIN (4-6 rakam):');
  if(!newPin)return;
  const clean=newPin.replace(/\D/g,'');
  if(clean.length<4||clean.length>6){toast('PIN 4-6 hane!','err');return;}
  const pinHash=await sha256(clean);
  const {error}=await sb.from('kullanicilar').update({pin_hash:pinHash}).eq('id',uid);
  if(error){toast('Güncellenemedi!','err');return;}
  const cached=ls(LS_USERS+(activeIsletmeId||'sa'))||[];
  const u=cached.find(u=>u.id===uid); if(u){u.pin_hash=pinHash;lss(LS_USERS+(activeIsletmeId||'sa'),cached);}
  toast('✔ PIN güncellendi','ok');
}
async function changeRole(uid,role){
  const {error}=await sb.from('kullanicilar').update({rol:role}).eq('id',uid);
  if(error){toast('Güncellenemedi!','err');return;}
  const cached=ls(LS_USERS+(activeIsletmeId||'sa'))||[];
  const u=cached.find(u=>u.id===uid); if(u){u.rol=role;lss(LS_USERS+(activeIsletmeId||'sa'),cached);}
  await renderAdminUserList(); toast('✔ Rol güncellendi','ok');
}
async function removeUser(uid){
  if(!confirm('Silinsin mi?'))return;
  const {error}=await sb.from('kullanicilar').delete().eq('id',uid);
  if(error){toast('Silinemedi!','err');return;}
  const cached=(ls(LS_USERS+(activeIsletmeId||'sa'))||[]).filter(u=>u.id!==uid);
  lss(LS_USERS+(activeIsletmeId||'sa'),cached);
  await renderAdminUserList(); toast('🗑️ Silindi','err');
}

// ══════════════════════════════════════════════════════
// SÜPER ADMİN
// ══════════════════════════════════════════════════════
let _saActiveTab = 'isletmeler';

function saTab(tab){
  _saActiveTab = tab;
  ['isletmeler','tumdata','yeni','ayarlar'].forEach(t=>{
    const btn = document.getElementById('saTab_'+t);
    const panel = document.getElementById('saPanel_'+t);
    if(btn) {
      if(t===tab){
        btn.style.background='var(--accent)';btn.style.color='#0f1117';
      } else {
        btn.style.background='transparent';btn.style.color='var(--muted)';
      }
    }
    if(panel) panel.style.display = t===tab ? '' : 'none';
  });
  if(tab==='tumdata') renderSATumData();
  if(tab==='ayarlar') renderSAyarlar();
}

async function openSuperAdmin(){
  await renderIsletmeListUI();
  saTab('isletmeler');
  document.getElementById('superAdminOverlay').classList.add('open');
}
function closeSuperAdmin(){document.getElementById('superAdminOverlay').classList.remove('open');}

async function renderIsletmeListUI(){
  const list=await loadIsletmeler();
  document.getElementById('isletmeList').innerHTML=list.length
    ?list.map(isl=>`
      <div style="background:var(--surface2);border-radius:8px;margin-bottom:8px;border-left:3px solid ${isl.color||'#4090e8'}">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px">
          <div style="width:36px;height:36px;border-radius:50%;background:${isl.color||'#4090e8'};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0">${isl.ad[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600">${esc(isl.ad)}</div>
            <div style="font-size:11px;color:var(--muted)">${isl.yetkili?esc(isl.yetkili):'—'}</div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button onclick="duzeltIsletme('${isl.id}')" style="background:transparent;color:var(--blue);border:1px solid var(--blue);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit">✏️ İşletme</button>
            <button onclick="duzeltIsletmeAdmin('${isl.id}')" style="background:transparent;color:var(--teal);border:1px solid var(--teal);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit">🔑 Admin</button>
            <button onclick="silIsletme('${isl.id}')" style="background:transparent;color:var(--red);border:1px solid var(--red);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit">🗑️</button>
          </div>
        </div>
      </div>`).join('')
    :'<div style="text-align:center;padding:20px;color:var(--muted)">Henüz işletme yok.</div>';
}

// İşletme adı/yetkili düzenleme
let _duzeltIsletmeId2 = null;
async function duzeltIsletme(islId){
  const list = ls(LS_ISL)||[];
  const isl = list.find(i=>i.id===islId);
  if(!isl) return;
  _duzeltIsletmeId2 = islId;
  document.getElementById('isletmeDuzeltAd').value = isl.ad||'';
  document.getElementById('isletmeDuzeltYetkili').value = isl.yetkili||'';
  document.getElementById('isletmeDuzeltOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('isletmeDuzeltAd').focus(), 80);
}
async function kaydetIsletmeDuzelt(){
  if(!_duzeltIsletmeId2) return;
  const ad = document.getElementById('isletmeDuzeltAd').value.trim();
  const yetkili = document.getElementById('isletmeDuzeltYetkili').value.trim();
  if(!ad){toast('İşletme adı zorunlu!','err');return;}
  showSync('syncing');
  const {error} = await sb.from('isletmeler').update({ad, yetkili:yetkili||null}).eq('id',_duzeltIsletmeId2);
  if(error){showSync('err');toast('Güncellenemedi!','err');return;}
  showSync('ok');
  const list = ls(LS_ISL)||[];
  const isl = list.find(i=>i.id===_duzeltIsletmeId2);
  if(isl){isl.ad=ad; isl.yetkili=yetkili||null; lss(LS_ISL,list);}
  document.getElementById('isletmeDuzeltOverlay').classList.remove('open');
  _duzeltIsletmeId2=null;
  await renderIsletmeListUI();
  toast('✔ İşletme güncellendi','ok');
}

// Tüm verileri süper admin için yükle
async function renderSAyarlar(){
  if(!currentUser) return;
  document.getElementById('saAyarlarMevcut').textContent = `${currentUser.ad||'—'} · ${currentUser.email||'—'}`;
  document.getElementById('saAyarlarAd').value = currentUser.ad||'';
  document.getElementById('saAyarlarEmail').value = '';
  document.getElementById('saAyarlarPin').value = '';
}

async function kaydetSAyarlar(){
  if(!currentUser) return;
  const ad = document.getElementById('saAyarlarAd').value.trim();
  const email = document.getElementById('saAyarlarEmail').value.trim().toLowerCase();
  const pin = document.getElementById('saAyarlarPin').value.replace(/\D/g,'');
  if(!ad){toast('Ad zorunlu!','err');return;}
  const update = {ad};
  if(email){
    if(!email.includes('@')){toast('Geçerli e-posta girin!','err');return;}
    update.email = email;
  }
  if(pin){
    if(pin.length<4||pin.length>6){toast('PIN 4-6 hane!','err');return;}
    update.pin_hash = await sha256(pin);
  }
  showSync('syncing');
  const {error} = await sb.from('kullanicilar').update(update).eq('id',currentUser.id);
  if(error){showSync('err');toast('Güncellenemedi: '+error.message,'err');return;}
  showSync('ok');
  // Session güncelle
  currentUser.ad = ad;
  if(email) currentUser.email = email;
  setSession({...currentUser, ts:Date.now()});
  applySession();
  document.getElementById('saAyarlarMevcut').textContent = `${currentUser.ad} · ${currentUser.email||'—'}`;
  // Cache güncelle
  const cached = ls(LS_USERS+'sa')||[];
  const u = cached.find(u=>u.id===currentUser.id);
  if(u){Object.assign(u,update);lss(LS_USERS+'sa',cached);}
  toast('✔ Bilgiler güncellendi'+(pin?` · Yeni PIN: ${pin}`:''),'ok');
}

async function renderSATumData(){
  const el = document.getElementById('saAllData');
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Yükleniyor...</div>';
  const list = ls(LS_ISL)||[];
  if(!list.length){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted)">İşletme yok.</div>';return;}
  let html = '';
  for(const isl of list){
    const [{data:satislar},{data:hayvanlar}] = await Promise.all([
      sb.from('satislar').select('*').eq('isletme_id',isl.id),
      sb.from('hayvanlar').select('*').eq('isletme_id',isl.id)
    ]);
    const topSatis=(satislar||[]).reduce((a,r)=>a+(r.fiyat||0),0);
    const topKapora=(satislar||[]).reduce((a,r)=>a+(r.kapora||0),0);
    const topKalan=topSatis-topKapora;
    html+=`<div style="background:var(--surface2);border-radius:10px;margin-bottom:12px;border-left:4px solid ${isl.color||'#4090e8'}">
      <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:${isl.color||'#4090e8'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff">${isl.ad[0].toUpperCase()}</div>
          <div><div style="font-size:14px;font-weight:600">${isl.ad}</div>
          <div style="font-size:11px;color:var(--muted)">${(hayvanlar||[]).length} hayvan · ${(satislar||[]).length} satış</div></div>
        </div>
        <div style="display:flex;gap:16px;font-family:'IBM Plex Mono',monospace;font-size:12px">
          <div><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Satış</div><div>₺${(topSatis/1000).toFixed(0)}K</div></div>
          <div><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Kapora</div><div style="color:var(--accent)">₺${(topKapora/1000).toFixed(0)}K</div></div>
          <div><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Kalan</div><div style="color:${topKalan>0?'var(--red)':'var(--green)'}">₺${(topKalan/1000).toFixed(0)}K</div></div>
        </div>
      </div>
      ${(satislar||[]).length?`<div style="padding:8px 14px;overflow-x:auto">
        <table style="width:100%;font-size:11px;border-collapse:collapse;min-width:400px">
          <thead><tr style="color:var(--muted)">
            <th style="text-align:left;padding:4px 6px;font-weight:500">Ad Soyad</th>
            <th style="text-align:left;padding:4px 6px;font-weight:500">Tür</th>
            <th style="text-align:left;padding:4px 6px;font-weight:500">Küpe</th>
            <th style="text-align:right;padding:4px 6px;font-weight:500">Satış</th>
            <th style="text-align:right;padding:4px 6px;font-weight:500">Kalan</th>
          </tr></thead>
          <tbody>${(satislar||[]).map(s=>{
            const k=(s.fiyat||0)-(s.kapora||0);
            return `<tr style="border-top:1px solid rgba(42,48,80,.3)">
              <td style="padding:4px 6px;font-weight:500">${s.ad||'—'}</td>
              <td style="padding:4px 6px;color:var(--muted)">${s.tur||'—'}</td>
              <td style="padding:4px 6px;font-family:'IBM Plex Mono',monospace;color:var(--teal)">${s.kupe||'—'}</td>
              <td style="padding:4px 6px;text-align:right;font-family:'IBM Plex Mono',monospace">₺${Math.round(s.fiyat||0).toLocaleString('tr-TR')}</td>
              <td style="padding:4px 6px;text-align:right;font-family:'IBM Plex Mono',monospace;color:${k>0?'var(--red)':'var(--green)'}">₺${Math.round(k).toLocaleString('tr-TR')}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`:`<div style="padding:10px 14px;font-size:12px;color:var(--muted)">Henüz satış kaydı yok.</div>`}
    </div>`;
  }
  el.innerHTML = html;
}

let _duzeltUserId = null;

async function duzeltIsletmeAdmin(islId){
  const list = ls(LS_ISL)||[];
  const isl = list.find(i=>i.id===islId);
  const {data:users} = await sb.from('kullanicilar').select('*').eq('isletme_id',islId).eq('rol','admin').limit(1);
  if(!users||!users.length){toast('Bu işletmede admin yok!','err');return;}
  const u = users[0];
  _duzeltUserId = u.id;
  document.getElementById('adminDuzeltIsletmeAd').textContent = isl ? `🏢 ${isl.ad}` : '';
  document.getElementById('adminDuzeltMevcut').textContent = u.email || '— (e-posta tanımlı değil)';
  document.getElementById('adminDuzeltEmail').value = '';
  document.getElementById('adminDuzeltPin').value = '';
  document.getElementById('adminDuzeltOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('adminDuzeltEmail').focus(), 80);
}

async function kaydetAdminDuzelt(){
  if(!_duzeltUserId) return;
  const email = document.getElementById('adminDuzeltEmail').value.trim().toLowerCase();
  const pin = document.getElementById('adminDuzeltPin').value.replace(/\D/g,'');
  const update = {};
  if(email){
    if(!email.includes('@')){toast('Geçerli e-posta girin!','err');return;}
    update.email = email;
  }
  if(pin){
    if(pin.length<4||pin.length>6){toast('PIN 4-6 hane olmalı!','err');return;}
    update.pin_hash = await sha256(pin);
  }
  if(!Object.keys(update).length){toast('Değişiklik yapılmadı.','err');return;}
  showSync('syncing');
  const {error} = await sb.from('kullanicilar').update(update).eq('id',_duzeltUserId);
  if(error){showSync('err');toast('Güncellenemedi: '+error.message,'err');return;}
  showSync('ok');
  closeAdminDuzelt();
  await renderIsletmeListUI();
  toast('✔ Admin bilgileri güncellendi'+(pin?` · Yeni PIN: ${pin}`:''),'ok');
}

function closeAdminDuzelt(){
  document.getElementById('adminDuzeltOverlay').classList.remove('open');
  _duzeltUserId = null;
}
async function addIsletme(){
  const ad=document.getElementById('ni_ad').value.trim();
  const yetkili=document.getElementById('ni_yetkili').value.trim();
  const adminAd=document.getElementById('ni_admin_ad').value.trim();
  const email=document.getElementById('ni_email').value.trim().toLowerCase();
  const pin=document.getElementById('ni_pin').value.replace(/\D/g,'');
  if(!ad){toast('İşletme adı zorunlu!','err');return;}
  if(!adminAd){toast('Admin adı zorunlu!','err');return;}
  if(!email||!email.includes('@')){toast('Geçerli e-posta girin!','err');return;}
  if(!pin||pin.length<4){toast('PIN 4-6 hane!','err');return;}
  const colors=['#4090e8','#e87040','#40b870','#a060e8','#e840a0','#40c8e8','#e8a020'];
  const list=ls(LS_ISL)||[];
  // E-posta daha önce kullanılmış mı?
  if(isOnline){
    const {data:existing}=await sb.from('kullanicilar').select('id').eq('email',email).limit(1);
    if(existing&&existing.length){toast('Bu e-posta zaten kayıtlı!','err');return;}
  }
  const color=colors[list.length%colors.length];
  showSync('syncing');
  const {data:isl,error:islErr}=await sb.from('isletmeler').insert({ad,yetkili:yetkili||null,color}).select().single();
  if(islErr){showSync('err');toast('Eklenemedi: '+islErr.message,'err');return;}
  const pinHash=await sha256(pin);
  const {error:uErr}=await sb.from('kullanicilar').insert({
    isletme_id:isl.id, ad:adminAd, email, color, rol:'admin', pin_hash:pinHash
  });
  if(uErr){showSync('err');toast('Admin kullanıcı eklenemedi: '+uErr.message,'err');return;}
  showSync('ok');
  lss(LS_ISL,[...list,isl]);
  ['ni_ad','ni_yetkili','ni_admin_ad','ni_email','ni_pin'].forEach(id=>document.getElementById(id).value='');
  await renderIsletmeListUI();
  toast(`✔ "${esc(ad)}" eklendi · Admin: ${email} · PIN: ${pin}`,'ok');
}
async function silIsletme(islId){
  const list=ls(LS_ISL)||[];
  const isl=list.find(i=>i.id===islId);
  if(!isl)return;
  if(!confirm(`"${isl.ad}" silinsin mi?`))return;
  await sb.from('isletmeler').delete().eq('id',islId);
  lss(LS_ISL,list.filter(i=>i.id!==islId));
  await renderIsletmeListUI();
  toast(`🗑️ "${esc(isl.ad)}" silindi`,'err');
}

// ══════════════════════════════════════════════════════
// SEZON YÖNETİMİ
// ══════════════════════════════════════════════════════
async function initSeasons(){
  if(isOnline&&activeIsletmeId){
    const {data}=await sb.from('sezonlar').select('*').eq('isletme_id',activeIsletmeId).order('created_at');
    if(data&&data.length){
      const map={};
      data.forEach(s=>{map[s.id]={id:s.id,name:s.ad,createdAt:s.created_at};});
      setSeasons(map);
    } else {
      const yr=new Date().getFullYear().toString();
      const {data:ns}=await sb.from('sezonlar').insert({isletme_id:activeIsletmeId,ad:yr}).select().single();
      if(ns){ const map={[ns.id]:{id:ns.id,name:ns.ad,createdAt:ns.created_at}}; setSeasons(map); }
    }
  }
  const seasons=getSeasons();
  let sid=getActiveSid();
  if(!sid||!seasons[sid]) sid=Object.keys(seasons)[0];
  currentSeason=sid;
  if(sid) setActiveSid(sid);
}
function renderSeasonBar(){
  const seasons=getSeasons();
  const sel=document.getElementById('seasonSel');
  sel.innerHTML='';
  Object.values(seasons).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).forEach(s=>{
    const o=document.createElement('option');
    o.value=s.id; o.textContent=s.name;
    if(s.id===currentSeason) o.selected=true;
    sel.appendChild(o);
  });
  const cur=seasons[currentSeason];
  document.getElementById('seasonBadge').textContent=cur?`Aktif: ${cur.name} sezonu`:'';
}
async function changeSeason(){
  currentSeason=document.getElementById('seasonSel').value;
  setActiveSid(currentSeason);
  clearHistCache(); selRows.clear();
  await loadFromSupabase();
  renderAll();
}
function openNewSeason(){
  document.getElementById('ns_name').value=(new Date().getFullYear()+1).toString();
  document.getElementById('nsOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('ns_name').select(),80);
}
function closeNS(){document.getElementById('nsOverlay').classList.remove('open');}
function closeNSBg(e){if(e.target===document.getElementById('nsOverlay'))closeNS();}
async function saveNewSeason(){
  const name=document.getElementById('ns_name').value.trim();
  if(!name){toast('Sezon adı giriniz','err');return;}
  const seasons=getSeasons();
  let newSid;
  if(isOnline&&activeIsletmeId){
    const {data,error}=await sb.from('sezonlar').insert({isletme_id:activeIsletmeId,ad:name}).select().single();
    if(error){toast('Sezon oluşturulamadı!','err');return;}
    newSid=data.id;
    seasons[newSid]={id:newSid,name,createdAt:data.created_at};
  } else {
    newSid='s_'+Date.now().toString(36);
    seasons[newSid]={id:newSid,name,createdAt:new Date().toISOString()};
  }
  setSeasons(seasons);
  currentSeason=newSid; setActiveSid(newSid);
  closeNS(); renderSeasonBar(); renderAll();
  toast(`✔ "${esc(name)}" sezonu açıldı`,'ok');
}

// ══════════════════════════════════════════════════════
// SUPABASE VERİ SYNC
// ══════════════════════════════════════════════════════
async function loadFromSupabase(){
  if(!isOnline||!activeIsletmeId||!currentSeason) return;
  showSync('syncing');
  try{
    const [{data:satislar},{data:hayvanlar},{data:musteriler}]=await Promise.all([
      sb.from('satislar').select('*').eq('isletme_id',activeIsletmeId).eq('sezon_id',currentSeason),
      sb.from('hayvanlar').select('*').eq('isletme_id',activeIsletmeId).eq('sezon_id',currentSeason),
      sb.from('musteri_rehber').select('*').eq('isletme_id',activeIsletmeId)
    ]);
    if(satislar){
      const md={}; TYPES.forEach(t=>md[t]=[]);
      satislar.forEach(s=>{
        const t=s.tur; if(!md[t])md[t]=[];
        md[t].push({id:s.id,ad:s.ad,tel:s.tel||'',tc:s.tc||'',kupe:s.kupe||'',_t:t,
          musteriPay:s.pay_sayi||1,toplamPay:0,sira:s.sira||0,
          fiyat:s.fiyat||0,kapora:s.kapora||0,notlar:s.notlar||''});
      });
      setMD(md);
    }
    if(hayvanlar){
      const hd={};
      hayvanlar.forEach(h=>{
        hd[h.kupe]={kupe:h.kupe,isim:h.isim||'',type:h.tur||'dana',
          toplamPay:h.toplam_pay||7,sira:h.kesim_sirasi||0,
          kesimTarihi:h.kesim_tarihi||null,id:h.id};
      });
      setHD(hd);
      // sira'ları satışlara yansıt
      TYPES.forEach(t=>{
        const rows=getRows(t);
        rows.forEach(r=>{
          const hav=hd[r.kupe];
          if(hav){r.toplamPay=hav.toplamPay;r.sira=hav.sira;}
        });
        setRows(t,rows);
      });
    }
    if(musteriler){
      const dir={};
      musteriler.forEach(m=>{ const k=dirKey(m.ad,m.tel,m.tc); dir[k]={ad:m.ad,tel:m.tel||'',tc:m.tc||'',id:m.id}; });
      setDir(dir);
    }
    showSync('ok'); clearHistCache();
  }catch(e){showSync('err');console.error(e);}
}
async function syncSatis(row,type){
  await dbUpsert('satislar',{id:row.id,isletme_id:activeIsletmeId,sezon_id:currentSeason,
    tur:type,ad:row.ad,tel:row.tel||null,tc:row.tc||null,kupe:row.kupe||null,
    pay_sayi:row.musteriPay||1,fiyat:row.fiyat||0,kapora:row.kapora||0,
    notlar:row.notlar||null,sira:row.sira||0});
}
async function syncHayvan(h){
  await dbUpsert('hayvanlar',{id:h.id||undefined,isletme_id:activeIsletmeId,sezon_id:currentSeason,
    kupe:h.kupe,isim:h.isim||null,tur:h.type||'dana',
    toplam_pay:h.toplamPay||7,kesim_sirasi:h.sira||null,kesim_tarihi:h.kesimTarihi||null});
}

// ══════════════════════════════════════════════════════
// SAVE OVERRIDES (Supabase entegre)
// ══════════════════════════════════════════════════════
async function saveM(){
  const ad=document.getElementById('f_ad').value.trim();
  const type=document.getElementById('f_type').value;
  const kupe=(document.getElementById('f_kupe').value||'').trim();
  const tc=(document.getElementById('f_tc').value||'').trim();
  const musteriPay=+document.getElementById('f_musteri_pay').value||1;
  if(!ad){document.getElementById('f_ad').focus();toast('Ad Soyad zorunlu!','err');return;}
  if(kupe){
    const h=getHav(kupe);
    if(h){
      const rdolu=allRows().filter(r=>r.kupe===kupe&&r.id!==editMId).reduce((a,r)=>a+(r.musteriPay||1),0);
      if(musteriPay>h.toplamPay-rdolu){toast(`⚠️ Sadece ${h.toplamPay-rdolu} boş pay var!`,'err');return;}
    }
  }
  const hav=getHav(kupe);
  const obj={ad,tel:document.getElementById('f_tel').value.trim(),tc,kupe,musteriPay,
    toplamPay:hav?.toplamPay||0,sira:hav?.sira||0,
    fiyat:+document.getElementById('f_fiyat').value||0,
    kapora:+document.getElementById('f_kapora').value||0,
    notlar:document.getElementById('f_notlar').value.trim()};
  if(editMId){
    const oldT=editMType||type;
    if(oldT!==type){setRows(oldT,getRows(oldT).filter(r=>r.id!==editMId));
      const nr=getRows(type);
      const rec={id:editMId,...obj,_t:type};
      nr.push(rec); setRows(type,nr);
      await syncSatis(rec,type);
    } else {
      const rows=getRows(type);
      const row=rows.find(r=>r.id===editMId);
      if(row){Object.assign(row,obj,{_t:type});}
      setRows(type,rows);
      await syncSatis(row||{id:editMId,...obj},type);
    }
  } else {
    const rows=getRows(type);
    const rec={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),...obj,_t:type};
    rows.push(rec); setRows(type,rows);
    await syncSatis(rec,type);
  }
  saveToDir(ad,document.getElementById('f_tel').value.trim(),tc);
  if(activeIsletmeId){
    const existing=getDir()[dirKey(ad,document.getElementById('f_tel').value.trim(),tc)];
    await dbUpsert('musteri_rehber',{id:existing?.id||undefined,isletme_id:activeIsletmeId,ad,tel:document.getElementById('f_tel').value.trim()||null,tc:tc||null});
  }
  clearHistCache();
  closeM(); renderAll(); toast(editMId?'✔ Güncellendi':'✔ Kayıt eklendi','ok');
}
async function saveH(){
  const kupe=(document.getElementById('h_kupe').value||'').trim();
  const toplamPay=+document.getElementById('h_toplamPay').value||0;
  if(!kupe){document.getElementById('h_kupe').focus();toast('Küpe No zorunlu!','err');return;}
  if(!toplamPay){document.getElementById('h_toplamPay').focus();toast('Toplam pay zorunlu!','err');return;}
  const sira=+document.getElementById('h_sira').value||0;
  const existingSiras=Object.entries(getHD()).filter(([k])=>k!==kupe).map(([,h])=>h.sira||0).filter(Boolean);
  const autoSira=sira||(existingSiras.length?Math.max(...existingSiras)+1:1);
  const existing=getHav(kupe);
  const hayvanObj={kupe,isim:document.getElementById('h_isim').value.trim(),
    type:document.getElementById('h_type').value,toplamPay,sira:autoSira,
    kesimTarihi:document.getElementById('h_tarih').value||null,id:existing?.id};
  setHav(kupe,hayvanObj);
  TYPES.forEach(t=>{
    const rows=getRows(t);let changed=false;
    rows.forEach(r=>{if(r.kupe===kupe){r.sira=autoSira;r.toplamPay=toplamPay;changed=true;}});
    if(changed)setRows(t,rows);
  });
  await syncHayvan(hayvanObj);
  closeH(); renderAll(); toast('✔ Hayvan kaydedildi','ok');
}
async function delM(id,type){
  if(!confirm('Bu kaydı silmek istiyor musunuz?'))return;
  setRows(type,getRows(type).filter(r=>r.id!==id));
  await dbDelete('satislar',id);
  selRows.delete(id); renderAll(); toast('🗑️ Silindi','err');
}
async function updT(id,field,value,type){
  const rows=getRows(type);const row=rows.find(r=>r.id===id);
  if(!row||row[field]===value)return;
  row[field]=value; setRows(type,rows);
  const fm={fiyat:'fiyat',kapora:'kapora',tel:'tel',notlar:'notlar'};
  if(fm[field]&&activeIsletmeId) await dbUpsert('satislar',{id,isletme_id:activeIsletmeId,sezon_id:currentSeason,[fm[field]]:value});
  renderAll(); toast('✔ Güncellendi','ok');
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
async function initAfterLogin(){
  if(activeIsletmeId){
    await initSeasons();
    await loadFromSupabase();
  }
  renderSeasonBar();
  renderAll();
  const u=getUsers();
  u[currentUser.id]={name:currentUser.ad,color:currentUser.color,ts:Date.now()};
  setUsers(u);
  setInterval(()=>{
    const u=getUsers();
    u[currentUser.id]={name:currentUser.ad,color:currentUser.color,ts:Date.now()};
    setUsers(u); renderOU();
  },5000);
  if(isOnline) await flushQueue();
  updatePendingBadge();
  setInterval(async()=>{if(isOnline&&activeIsletmeId)await loadFromSupabase();},30000);
}
async function start(){
  await openIDB();
  const sess=getSession();
  if(sess&&sess.ts&&Date.now()-sess.ts<8*60*60*1000){
    activeIsletmeId=sess.islId||null;
    currentUser=sess;
    const users=await loadUsers(activeIsletmeId);
    const user=users.find(u=>u.id===sess.id);
    if(user&&user.rol!=='blocked'){
      currentUser={...sess,ad:user.ad,color:user.color,rol:user.rol};
      applySession();
      document.getElementById('loginOverlay').classList.remove('open');
      await initAfterLogin();
      return;
    }
    clearSession();
  }
  // Login ekranını göster — direkt e-posta adımı
  document.getElementById('loginStep1').style.display='block';
  document.getElementById('loginStep2').style.display='none';
  document.getElementById('loginOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('loginEmail')?.focus(), 100);
}
// ══════════════════════════════════════════════════════
// TABS + NAVIGATION
// ══════════════════════════════════════════════════════
function scrollTabs(dir){
  const bar=document.getElementById('tabsBar');
  bar.scrollBy({left:dir*160,behavior:'smooth'});
  setTimeout(updateArrows,200);
}
function updateArrows(){
  const bar=document.getElementById('tabsBar'); if(!bar) return;
  const l=document.getElementById('tabLeft');
  const r=document.getElementById('tabRight');
  if(l) l.disabled=bar.scrollLeft<=0;
  if(r) r.disabled=bar.scrollLeft+bar.clientWidth>=bar.scrollWidth-2;
}
function renderTabs(){
  const d=getMD();
  const total=TYPES.reduce((a,t)=>a+(d[t]||[]).length,0);
  const havSay=Object.keys(getHD()).length;
  const noK=allRows().filter(r=>!r.kupe).length;
  const warn=noK>0?` <span style="color:var(--red);font-size:10px">⚠${noK}</span>`:'';
  const dirCount=Object.keys(getDir()).length;
  document.getElementById('tabsBar').innerHTML=[
    `<button class="tab-btn${activeTab==='genel'?' active':''}" data-t="genel" onclick="sw('genel')">🗂️ Genel <span class="tc">${total}</span></button>`,
    ...TYPES.map(t=>`<button class="tab-btn${activeTab===t?' active':''}" data-t="${t}" onclick="sw('${t}')">${TLABEL[t]} <span class="tc">${(d[t]||[]).length}</span></button>`),
    `<button class="tab-btn${activeTab==='hayvanlar'?' active':''}" data-t="hayvanlar" onclick="sw('hayvanlar')">🏷️ Hayvanlar <span class="tc">${havSay}</span>${warn}</button>`,
    `<button class="tab-btn${activeTab==='musteri'?' active':''}" data-t="musteri" onclick="sw('musteri')">👥 Rehber <span class="tc">${dirCount}</span></button>`,
    `<button class="tab-btn${activeTab==='kesim'?' active':''}" data-t="kesim" onclick="sw('kesim')">✂️ Kesim Planı</button>`,
    `<button class="tab-btn${activeTab==='finans'?' active':''}" data-t="finans" onclick="sw('finans')">💰 Finans</button>`,
    `<button class="tab-btn${activeTab==='dashboard'?' active':''}" data-t="dashboard" onclick="sw('dashboard')">📊 İzleme</button>`,
    `<button class="tab-btn${activeTab==='hesap'?' active':''}" data-t="hesap" onclick="sw('hesap')">🧮 Hesap</button>`
  ].join('');
  const activeBtn=document.querySelector('.tab-btn.active');
  if(activeBtn) activeBtn.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
  setTimeout(updateArrows,100);
}
function sw(t){ activeTab=t; selRows.clear(); renderAll(); }

// ══════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════

function renderMain(){
  if(activeTab==='genel') renderGenel();
  else if(activeTab==='hayvanlar') renderHayvanlar();
  else if(activeTab==='musteri') renderMusteriRehber();
  else if(activeTab==='kesim') renderKesimPlani();
  else if(activeTab==='finans') renderFinans();
  else if(activeTab==='dashboard') renderDashboard();
  else if(activeTab==='hesap') renderHesap();
  else renderTable();
  updStats();
}

// ── GENEL ──
function renderGenel(){
  const q=sq();
  const sections=TYPES.map(type=>{
    let rows=[...getRows(type)];
    if(q) rows=rows.filter(r=>mq(r,q));
    rows.sort((a,b)=>(a.sira||999)-(b.sira||999));
    const c=THEX[type];
    const body=rows.length?rows.map(r=>{
      const kalan=(r.fiyat||0)-(r.kapora||0);
      const kc=kcls(kalan,r.fiyat);
      const hav=getHav(r.kupe);
      const payTxt=payStr(r);
      return `<tr>
        <td style="width:28px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${c}">${r.sira||'—'}</td>
        <td style="font-weight:500;font-size:12px;cursor:pointer;color:var(--blue)" onclick="openMdByRow('${esc(r.ad)}','${esc(r.tel||'')}','${esc(r.tc||'')}')">${esc(r.ad||'—')}</td>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted)">${r.tel||'—'}</td>
        <td>${r.kupe?`<span class="klink" onclick="openHd('${esc(r.kupe)}')">🏷️ ${esc(r.kupe)}</span>${payTxt?`<span class="pay-chip">${payTxt}</span>`:''}`:`<span class="kempty" onclick="editM('${r.id}')">+ Küpe</span>`}</td>
        <td style="font-size:11px;color:${c}">${hav?.isim?esc(hav.isim):''}</td>
        <td><span class="kb ${kc}">₺${fmt(kalan)}</span></td>
        <td><div class="grac">
          <button class="rab edit" onclick="editM('${r.id}')">✏️</button>
          <button class="rab" onclick="delM('${r.id}','${type}')">🗑️</button>
        </div></td>
      </tr>`;
    }).join(''):`<tr><td colspan="7" class="gempty">Kayıt yok — <a href="#" style="color:var(--accent);text-decoration:none" onclick="openMForType('${type}')">Ekle</a></td></tr>`;
    return `<div class="gsec">
      <div class="gsh"><div class="gst" style="color:${c}">${TLABEL[type]}</div><span class="gsc">${rows.length} kişi</span></div>
      <table class="gtbl"><thead><tr><th>#</th><th>Ad Soyad</th><th>Telefon</th><th>Küpe / Pay</th><th>Hayvan</th><th>Kalan</th><th></th></tr></thead>
      <tbody>${body}</tbody></table>
    </div>`;
  }).join('');
  document.getElementById('mc').innerHTML=`<div class="genel-wrap"><div class="genel-grid">${sections}</div></div>`;
}

// ── TÜR TABLOSU ──
function renderTable(){
  const q=sq();
  const thisTab=activeTab;
  let rows=[...getRows(thisTab)];
  if(q) rows=rows.filter(r=>mq(r,q));
  rows.sort((a,b)=>{
    let av=a[sortCol]||0, bv=b[sortCol]||0;
    if(typeof av==='string') return av.localeCompare(bv,'tr')*sortDir;
    return (av-bv)*sortDir;
  });
  const c=THEX[thisTab];

  // Bu türde kayıtlı ama henüz satışı olmayan hayvanları göster
  const hd=getHD();
  const kayitliKupeler=new Set(rows.map(r=>r.kupe).filter(Boolean));
  const satissizHayvanlar=Object.values(hd).filter(h=>h.type===thisTab&&!kayitsiizKupeler(h.kupe,kayitliKupeler));
  function kayitsiizKupeler(kupe,set){ return set.has(kupe); }

  const thead=`<thead><tr>
    <th style="width:30px"><input type="checkbox" id="chkAll" onchange="toggleAll()"></th>
    <th onclick="srt('sira')" class="${sortCol==='sira'?'sorted':''}">🔢 Sıra ${sa('sira')}</th>
    <th onclick="srt('ad')" class="${sortCol==='ad'?'sorted':''}">Ad Soyad ${sa('ad')}</th>
    <th>Telefon</th>
    <th onclick="srt('kupe')" class="${sortCol==='kupe'?'sorted':''}">🏷️ Küpe / Pay ${sa('kupe')}</th>
    <th>Hayvan</th>
    <th onclick="srt('fiyat')" class="${sortCol==='fiyat'?'sorted':''}">Satış ₺ ${sa('fiyat')}</th>
    <th>Kapora</th><th>Kalan</th><th>Notlar</th><th></th>
  </tr></thead>`;

  if(!rows.length && !satissizHayvanlar.length){
    document.getElementById('mc').innerHTML=`<div class="twrap"><table>${thead}<tbody><tr><td colspan="11"><div class="nodata"><div class="ic">🐑</div><p>Bu sezonda kayıt yok.</p></div></td></tr></tbody></table></div>`;
    return;
  }
  const tbody=rows.map(r=>{
    const kalan=(r.fiyat||0)-(r.kapora||0);
    const kc=kcls(kalan,r.fiyat);
    const hav=getHav(r.kupe);
    const pt=payStr(r);
    const chk=selRows.has(r.id)?'checked':'';
    // FIX #2: pass thisTab explicitly to upd via closure-captured variable
    return `<tr class="${selRows.has(r.id)?'sel':''}" data-id="${r.id}">
      <td><input type="checkbox" ${chk} onchange="toggleRow('${r.id}')"></td>
      <td><span class="sbadge" style="border-color:${c};color:${c};cursor:${r.kupe?'pointer':'default'}"
        ${r.kupe?`onclick="openHModal('${esc(r.kupe)}')" title="Hayvandan geliyor"`:''}>
        ${r.sira||'—'}</span>${r.kupe?`<span style="font-size:9px;color:var(--muted);margin-left:3px">🔒</span>`:''}</td>
      <td><span style="cursor:pointer;color:var(--blue);font-weight:500" onclick="openMdByRow('${esc(r.ad)}','${esc(r.tel||'')}','${esc(r.tc||'')}')">${esc(r.ad||'')}</span>${r.tc?`<span class="tc-badge valid" style="margin-left:4px" title="TC: ${esc(r.tc)}">🪪 ${r.tc.slice(0,3)}***${r.tc.slice(-2)}</span>`:''}</td>
      <td><input type="tel" value="${esc(r.tel||'')}" onblur="updT('${r.id}','tel',this.value,'${thisTab}')" style="min-width:90px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted)"></td>
      <td>${r.kupe?`<span class="klink" onclick="openHd('${esc(r.kupe)}')">🏷️ ${esc(r.kupe)}</span>${pt?`<span class="pay-chip">${pt}</span>`:''}`:`<span class="kempty" onclick="editM('${r.id}')">+ Küpe Ekle</span>`}</td>
      <td style="font-size:11px;color:${c}">${hav?.isim?esc(hav.isim):''}</td>
      <td><input type="number" value="${r.fiyat||''}" onblur="updT('${r.id}','fiyat',+this.value,'${thisTab}')" style="min-width:75px;font-family:'IBM Plex Mono',monospace"></td>
      <td><input type="number" value="${r.kapora||''}" onblur="updT('${r.id}','kapora',+this.value,'${thisTab}')" style="min-width:65px;font-family:'IBM Plex Mono',monospace;color:var(--accent)"></td>
      <td><span class="kb ${kc}">₺${fmt(kalan)}</span></td>
      <td><input type="text" value="${esc(r.notlar||'')}" onblur="updT('${r.id}','notlar',this.value,'${thisTab}')" style="min-width:95px;color:var(--muted)"></td>
      <td><div class="rac">
        <button class="rab edit" onclick="editM('${r.id}')">✏️</button>
        <button class="rab" onclick="delM('${r.id}','${thisTab}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
  // Satışsız hayvanlar için ek satırlar
  const satissizRows = satissizHayvanlar.map(h=>`
    <tr style="opacity:.7;border-left:3px solid ${c}">
      <td></td>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${c}">${h.sira||'—'}</span></td>
      <td><span style="color:var(--muted);font-style:italic;font-size:12px">Satış kaydı yok</span></td>
      <td></td>
      <td><span class="klink" onclick="openHd('${esc(h.kupe)}')">🏷️ ${esc(h.kupe)}</span></td>
      <td style="font-size:11px;color:${c}">${h.isim?esc(h.isim):''}</td>
      <td></td><td></td>
      <td><span class="kb bekliyor">Satış yok</span></td>
      <td></td>
      <td><button class="btn btn-primary" style="font-size:11px;padding:4px 10px" onclick="openMModal(null,'${esc(h.kupe)}')">➕ Satış Ekle</button></td>
    </tr>`).join('');

  document.getElementById('mc').innerHTML=`<div class="twrap"><table>${thead}<tbody>${tbody}${satissizRows}</tbody></table></div>`;
}
function srt(col){ if(sortCol===col)sortDir*=-1; else{sortCol=col;sortDir=1;} renderMain(); }
function sa(col){ return sortCol===col?(sortDir===1?'↑':'↓'):''; }

// ── HAYVANLAR ──
function renderHayvanlar(){
  const q=sq(); const hd=getHD(); const ar=allRows();
  const map={};
  Object.entries(hd).forEach(([k,h])=>{ map[k]={h,rows:[]}; });
  ar.forEach(r=>{ if(r.kupe){ if(!map[r.kupe]) map[r.kupe]={h:null,rows:[]}; map[r.kupe].rows.push(r); } });
  let entries=Object.entries(map);
  if(q) entries=entries.filter(([k,{h,rows}])=>k.toLowerCase().includes(q)||(h?.isim||'').toLowerCase().includes(q)||rows.some(r=>mq(r,q)));
  entries.sort(([ak,av],[bk,bv])=>{
    if(havSort==='sira') return (av.h?.sira||999)-(bv.h?.sira||999);
    if(havSort==='kupe') return ak.localeCompare(bk,'tr');
    if(havSort==='type'){ const at=av.h?.type||av.rows[0]?._t||''; const bt=bv.h?.type||bv.rows[0]?._t||''; return at.localeCompare(bt,'tr'); }
    if(havSort==='tarih') return (av.h?.kesimTarihi||'9999').localeCompare(bv.h?.kesimTarihi||'9999');
    return 0;
  });
  const cards=entries.map(([kupe,{h,rows}])=>{
    const type=h?.type||rows[0]?._t||'dana';
    const c=THEX[type]; const emoji=TEMOJI[type];
    const toplamPay=h?.toplamPay||0;
    const dolu=rows.reduce((a,r)=>a+(r.musteriPay||1),0);
    const bos=Math.max(0,toplamPay-dolu);
    let ring='';
    rows.forEach((r,i)=>{ const s=r.musteriPay||1; for(let j=0;j<s;j++) ring+=`<div class="pay-seg" style="background:${SCOLS[i%SCOLS.length]};flex:1" title="${esc(r.ad)}"></div>`; });
    for(let i=0;i<bos;i++) ring+=`<div class="pay-seg" style="background:var(--border);flex:1"></div>`;
    let tarihHtml='';
    if(h?.kesimTarihi){
      const diff=Math.ceil((new Date(h.kesimTarihi+' 12:00')-new Date())/(864e5));
      const ts=new Date(h.kesimTarihi+' 12:00').toLocaleDateString('tr-TR');
      const tcls=diff<0?'gecti':diff<=14?'yakin':'normal';
      const tlbl=diff<0?`⚠ ${Math.abs(diff)}g geçti`:diff===0?'Bugün!':`${diff}g kaldı`;
      tarihHtml=`<div class="hcard-tarih ${tcls}">✂️ ${ts} · ${tlbl}</div>`;
    }
    const sahipHtml=rows.map((r,i)=>{
      const kalan=(r.fiyat||0)-(r.kapora||0);
      const kc=kcls(kalan,r.fiyat);
      const pt=payStr(r);
      return `<div class="sahip-row">
        <div class="sahip-l">
          <div class="sahip-dot" style="background:${SCOLS[i%SCOLS.length]}"></div>
          <div><div class="sahip-ad">${esc(r.ad||'—')} ${pt?`<span class="pay-chip">${pt}</span>`:''}</div>${r.tel?`<div class="sahip-tel">${r.tel}</div>`:''}</div>
        </div>
        <div style="text-align:right"><div class="kb ${kc}" style="font-size:10px">₺${fmt(kalan)}</div></div>
      </div>`;
    }).join('');
    return `<div class="hcard" style="--type-color:${c}" onclick="openHd('${esc(kupe)}')">
      <div class="hcard-stripe"></div>
      <div class="hcard-top">
        <div>
          <div class="hcard-kupe">🏷️ ${esc(kupe)}</div>
          <div class="hcard-meta">${TLABEL[type]}${h?.sira?` · <span style="color:var(--accent);font-weight:600">Sıra #${h.sira}</span>`:'<span style="color:var(--red);font-size:10px"> · Sıra girilmemiş</span>'}</div>
          <div class="hcard-isim">${h?.isim?esc(h.isim):'<span style="color:var(--muted);font-style:italic">İsim yok</span>'}</div>
          ${tarihHtml}
        </div>
        <div><div class="hcard-emoji">${emoji}</div><div class="hcard-pay-info">${dolu}/${toplamPay||'?'} pay</div></div>
      </div>
      <div class="pay-wrap">
        <div class="pay-lbl"><span>${dolu} dolu · ${bos} boş</span><span style="color:var(--teal)">Toplam ${toplamPay||'?'} pay</span></div>
        <div class="pay-ring">${ring}</div>
      </div>
      <div class="hcard-sahipler">${sahipHtml||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:4px 0">Henüz sahip yok</div>'}</div>
    </div>`;
  }).join('');
  const noK=ar.filter(r=>!r.kupe);
  const noKHtml=noK.length?`<div class="nokupe-section"><div class="nokupe-warn">⚠️ Küpe girilmemiş (${noK.length} kayıt)</div>
    <div>${noK.map(r=>`<span class="nokupe-chip" onclick="editM('${r.id}')">⚠️ <strong>${esc(r.ad||'—')}</strong> — ${TLABEL[r._t]} → Küpe Ekle</span>`).join('')}</div></div>`:'';
  document.getElementById('mc').innerHTML=`<div class="hav-wrap">
    <div class="hav-toolbar">
      <span style="font-size:12px;color:var(--muted)">${entries.length} hayvan · ${getSeasons()[currentSeason]?.name||''} sezonu</span>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="sort-pill${havSort==='sira'?' active':''}" onclick="setHS('sira')">🔢 Sıra No</button>
        <button class="sort-pill${havSort==='kupe'?' active':''}" onclick="setHS('kupe')">Küpe No</button>
        <button class="sort-pill${havSort==='type'?' active':''}" onclick="setHS('type')">Türe Göre</button>
        <button class="sort-pill${havSort==='tarih'?' active':''}" onclick="setHS('tarih')">✂️ Kesim Tarihi</button>
      </div>
    </div>
    <div class="hav-grid">${cards||'<div style="padding:40px;text-align:center;color:var(--muted)">Bu sezonda hayvan kaydı yok.<br><br><button class="btn btn-teal" onclick="openHModal()" style="margin-top:8px">🏷️ Hayvan Ekle</button></div>'}</div>
    ${noKHtml}
  </div>`;
}
function setHS(s){ havSort=s; renderMain(); }

// ── HAYVAN DETAY ──
function openHd(kupe){
  curHdKupe=kupe;
  const h=getHav(kupe);
  const type=h?.type||'dana';
  const c=THEX[type]; const emoji=TEMOJI[type]||'🐾';
  const rows=allRows().filter(r=>r.kupe===kupe);
  const toplamPay=h?.toplamPay||0;
  const dolu=rows.reduce((a,r)=>a+(r.musteriPay||1),0);
  const bos=Math.max(0,toplamPay-dolu);
  document.getElementById('hd-kupe').textContent='🏷️ '+kupe;
  // FIX #4: guard undefined season name
  const sezonAd=getSeasons()[currentSeason]?.name||'';
  document.getElementById('hd-sub').textContent=TLABEL[type]+(sezonAd?' · '+sezonAd+' sezonu':'');
  document.getElementById('hd-isim').textContent=h?.isim||'(İsim girilmemiş)';
  document.getElementById('hd-emoji').textContent=emoji;
  document.getElementById('hd-edit-btn').onclick=()=>{ closeHd(); openHModal(kupe); };
  document.getElementById('hd-add-btn').onclick=()=>{ closeHd(); openMModal(null,kupe); };
  let tarihHtml='';
  if(h?.kesimTarihi){
    const diff=Math.ceil((new Date(h.kesimTarihi+' 12:00')-new Date())/(864e5));
    const ts=new Date(h.kesimTarihi+' 12:00').toLocaleDateString('tr-TR');
    const col=diff<0?'var(--red)':diff<=14?'var(--accent)':'var(--teal)';
    const lbl=diff<0?`⚠️ ${Math.abs(diff)} gün geçti`:diff===0?'🔴 Bugün':`🗓️ ${diff} gün kaldı`;
    tarihHtml=`<span style="font-size:12px;color:var(--muted)">✂️ Kesim:</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:${col}">${ts}</span>
      <span style="font-size:11px;color:${col}">${lbl}</span>`;
  } else {
    tarihHtml=`<a href="#" style="font-size:12px;color:var(--accent);text-decoration:none" onclick="closeHd();openHModal('${esc(kupe)}')">+ Kesim tarihi ekle</a>`;
  }
  document.getElementById('hd-tarih-row').innerHTML=tarihHtml;
  let ring='';
  rows.forEach((r,i)=>{ const s=r.musteriPay||1; for(let j=0;j<s;j++) ring+=`<div class="pay-seg" style="background:${SCOLS[i%SCOLS.length]};flex:1;height:100%" title="${esc(r.ad)}"></div>`; });
  for(let i=0;i<bos;i++) ring+=`<div class="pay-seg" style="background:var(--border);flex:1;height:100%"></div>`;
  document.getElementById('hd-pay-ring').innerHTML=ring;
  document.getElementById('hd-pay-txt').textContent=`${dolu}/${toplamPay||'?'} pay dolu`;
  const siraDisp=h?.sira
    ?`<span style="font-family:'IBM Plex Mono',monospace;color:var(--accent);margin-left:12px">🔢 Kesim Sırası: #${h.sira} <span style="color:var(--muted);font-size:10px">(tüm sahipler)</span></span>`
    :`<a href="#" style="color:var(--accent);text-decoration:none;margin-left:12px;font-size:11px" onclick="closeHd();openHModal('${esc(kupe)}')">+ Kesim sırası ekle</a>`;
  document.getElementById('hd-pay-info').innerHTML=(toplamPay?`Toplam ${toplamPay} pay · ${dolu} dolu · ${bos} boş`:'Pay sayısı girilmemiş')+siraDisp;
  let sahHtml=`<div class="hd-sah-title">SAHİPLER (${rows.length} kişi)</div>`;
  if(!rows.length){
    sahHtml+=`<div style="text-align:center;padding:16px;color:var(--muted)">Henüz sahip atanmamış.</div>`;
  } else {
    const totS=rows.reduce((a,r)=>a+(r.fiyat||0),0);
    const totKl=rows.reduce((a,r)=>a+((r.fiyat||0)-(r.kapora||0)),0);
    sahHtml+=rows.map((r,i)=>{
      const kalan=(r.fiyat||0)-(r.kapora||0);
      const kc=kcls(kalan,r.fiyat);
      const sc=SCOLS[i%SCOLS.length];
      const pt=r.musteriPay&&r.toplamPay?`${r.musteriPay}/${r.toplamPay} pay`:(r.toplamPay?`1/${r.toplamPay} pay`:'');
      return `<div class="hd-sah-row" style="border-left-color:${sc}">
        <div class="hd-sah-top">
          <span class="hd-sah-ad" style="cursor:pointer;color:var(--blue)" onclick="closeHd();openMdByRow('${esc(r.ad)}','${esc(r.tel||'')}','${esc(r.tc||'')}')">${esc(r.ad||'—')}</span>
          ${r.tc?`<span class="tc-badge valid" title="TC: ${esc(r.tc)}">🪪 ${r.tc.slice(0,3)}***${r.tc.slice(-2)}</span>`:''}
          ${pt?`<span class="hd-sah-pay-badge">${pt}</span>`:''}
          <div style="margin-left:auto;display:flex;gap:5px;flex-shrink:0">
            <button onclick="closeHd();editM('${r.id}')"
              style="background:rgba(64,200,112,.15);color:var(--green);border:1px solid var(--green);border-radius:5px;padding:3px 10px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:500"
              onmouseover="this.style.background='var(--green)';this.style.color='#fff'"
              onmouseout="this.style.background='rgba(64,200,112,.15)';this.style.color='var(--green)'">✏️ Düzenle</button>
            <button onclick="hdDelM('${r.id}','${r._t||type}')"
              style="background:rgba(232,80,80,.12);color:var(--red);border:1px solid var(--red);border-radius:5px;padding:3px 10px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:500"
              onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
              onmouseout="this.style.background='rgba(232,80,80,.12)';this.style.color='var(--red)'">🗑️</button>
          </div>
        </div>
        ${r.tel?`<div class="hd-sah-tel">${r.tel}</div>`:''}
        <div class="hd-sah-fin">
          <span>Satış: <b style="color:var(--text)">₺${fmt(r.fiyat||0)}</b></span>
          <span>Kapora: <b style="color:var(--accent)">₺${fmt(r.kapora||0)}</b></span>
          <span>Kalan: <b><span class="kb ${kc}" style="padding:1px 5px">₺${fmt(kalan)}</span></b></span>
        </div>
        ${r.notlar?`<div class="hd-sah-meta">${esc(r.notlar)}</div>`:''}
      </div>`;
    }).join('');
    sahHtml+=`<div class="hd-total"><span style="color:var(--muted)">Toplam</span>
      <span>Satış: ₺${fmt(totS)} · Kalan: <b style="color:${totKl>0?'var(--red)':'var(--green)'}">₺${fmt(totKl)}</b></span></div>`;
  }
  document.getElementById('hd-sahipler').innerHTML=sahHtml;
  document.getElementById('hdOverlay').classList.add('open');
}
function closeHd(){ document.getElementById('hdOverlay').classList.remove('open'); }
function closeHdBg(e){ if(e.target===document.getElementById('hdOverlay')) closeHd(); }
function hdDelM(id,type){
  if(!confirm('Bu müşteri kaydını silmek istiyor musunuz?')) return;
  setRows(type, getRows(type).filter(r=>r.id!==id));
  renderAll(); toast('🗑️ Silindi','err');
  if(curHdKupe) openHd(curHdKupe);
}

// ── HAYVAN MODAL ──
function openHModal(kupe=null){
  editHKupe=kupe;
  const h=kupe?getHav(kupe):null;
  document.getElementById('hTitle').textContent=kupe?'✏️ Hayvanı Düzenle':'🏷️ Hayvan Kaydı';
  document.getElementById('h_kupe').value=kupe||'';
  document.getElementById('h_kupe').disabled=!!kupe;
  document.getElementById('h_isim').value=h?.isim||'';
  document.getElementById('h_type').value=h?.type||'dana';
  document.getElementById('h_toplamPay').value=h?.toplamPay||'';
  document.getElementById('h_sira').value=h?.sira||'';
  document.getElementById('h_tarih').value=h?.kesimTarihi||'';
  document.getElementById('hOverlay').classList.add('open');
  setTimeout(()=>document.getElementById(kupe?'h_isim':'h_kupe').focus(),80);
}
function closeH(){ document.getElementById('hOverlay').classList.remove('open'); editHKupe=null; }
function closeHBg(e){ if(e.target===document.getElementById('hOverlay')) closeH(); }

function onTcInput(el){
  const v=el.value.replace(/\D/g,''); el.value=v;
  const hint=document.getElementById('tcHint');
  if(!v){ hint.textContent=''; return; }
  if(v.length===11){
    const d=getDir(); const k='tc:'+v;
    if(d[k]&&!editMId){
      hint.style.color='var(--teal)';
      hint.textContent=`✔ Kayıtlı: ${esc(d[k].ad)} — ${getCustomerHistory(d[k].ad,d[k].tel,v).length} sezon geçmişi`;
    } else { hint.style.color='var(--green)'; hint.textContent='✔ 11 hane tamam'; }
  } else { hint.style.color='var(--red)'; hint.textContent=`${v.length}/11 hane`; }
}
function onAdInput(){
  const val=document.getElementById('f_ad').value.toLowerCase().trim();
  const suggest=document.getElementById('f_ad_suggest');
  if(val.length<2){ suggest.innerHTML=''; return; }
  const dir=getDir();
  const matches=Object.values(dir).filter(e=>(e.ad||'').toLowerCase().includes(val)||(e.tc||'').includes(val)).slice(0,5);
  if(!matches.length){ suggest.innerHTML=''; return; }
  suggest.innerHTML=`<div style="position:absolute;top:2px;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:5px;z-index:50;box-shadow:0 6px 20px rgba(0,0,0,.4)">
    ${matches.map(e=>`<div style="padding:7px 11px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
      onmousedown="selectSuggest('${esc(e.ad)}','${esc(e.tel||'')}','${esc(e.tc||'')}')">
      <b>${esc(e.ad)}</b>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);margin-left:5px">${e.tel||''}</span>
      ${e.tc?`<span class="tc-badge valid" style="margin-left:5px">🪪 ${e.tc.slice(0,3)}***${e.tc.slice(-2)}</span>`:'<span class="tc-badge" style="margin-left:4px">TC yok</span>'}
      <span style="font-size:10px;color:var(--accent);margin-left:5px">${getCustomerHistory(e.ad,e.tel,e.tc).length} sezon</span>
    </div>`).join('')}
  </div>`;
}
function selectSuggest(ad,tel,tc){
  document.getElementById('f_ad').value=ad;
  document.getElementById('f_tel').value=tel;
  if(tc) document.getElementById('f_tc').value=tc;
  document.getElementById('f_ad_suggest').innerHTML='';
  onTcInput(document.getElementById('f_tc'));
  const hist=getCustomerHistory(ad,tel,tc);
  const curHist=hist.find(h=>h.sid===currentSeason);
  const warn=document.getElementById('mSeasonWarn');
  if(curHist){
    warn.textContent=`⚠️ Bu müşteri ${getSeasons()[currentSeason]?.name||''} sezonunda zaten ${curHist.rows.length} kayıtla var. Farklı bir hayvan için tekrar ekleyebilirsiniz.`;
    warn.style.cssText='background:rgba(232,160,32,.1);border-color:rgba(232,160,32,.3);color:var(--accent)';
    warn.classList.add('show');
  } else {
    const prev=hist.filter(h=>h.sid!==currentSeason);
    if(prev.length){
      warn.textContent=`ℹ️ Bu müşteri ${prev.map(h=>h.season.name).join(', ')} sezonlarında kayıtlı. Bu sezonda yeni kayıt oluşturulacak.`;
      warn.style.cssText='background:rgba(64,144,232,.1);border-color:rgba(64,144,232,.3);color:var(--blue)';
      warn.classList.add('show');
    } else warn.classList.remove('show');
  }
}
function updateKupeDropdown(){
  const type = document.getElementById('f_type').value;
  const sel = document.getElementById('f_kupe');
  const hd = getHD();
  // Bu türdeki hayvanları filtrele
  const hayvanlar = Object.values(hd).filter(h=>h.type===type);
  sel.innerHTML = hayvanlar.length
    ? `<option value="">— Küpe seçin —</option>` +
      hayvanlar.sort((a,b)=>(a.sira||999)-(b.sira||999)).map(h=>{
        const rdolu=allRows().filter(r=>r.kupe===kupe&&r.id!==editMId).reduce((a,r)=>a+(r.musteriPay||1),0);
        const bos=Math.max(0,(h.toplamPay||0)-rdolu);
        return `<option value="${esc(h.kupe)}">${h.kupe}${h.isim?' — '+h.isim:''} (${bos} boş pay)</option>`;
      }).join('')
    : `<option value="">— Bu türde kayıtlı hayvan yok —</option>`;
  resetPayInfo();
  document.getElementById('kupeHint').textContent='';
}
function onKupeIn(){
  const k=(document.getElementById('f_kupe').value||'').trim();
  const h=getHav(k);
  const hint=document.getElementById('kupeHint');
  if(!k){ hint.textContent=''; resetPayInfo(); return; }
  if(h){
    const rdolu=allRows().filter(r=>r.kupe===k&&r.id!==editMId).reduce((a,r)=>a+(r.musteriPay||1),0);
    const bos=Math.max(0,(h.toplamPay||0)-rdolu);
    const siraInfo=h.sira?` · 🔢 Sıra: #${h.sira}`:'';
    hint.style.color='var(--teal)';
    hint.textContent=`✔ ${TLABEL[h.type]} · ${h.isim||''} · ${bos} boş pay${siraInfo}`;
    document.getElementById('f_toplamPay_info').textContent=`${h.toplamPay} pay (hayvandan — değiştirilemez)`;
    document.getElementById('f_bosPay_info').textContent=`${bos} pay boşta`;
    document.getElementById('f_bosPay_info').className='info-box '+(bos>0?'ok':'warn');
    if(!document.getElementById('f_musteri_pay').value) document.getElementById('f_musteri_pay').value='1';
    onMusteriPayIn();
  } else {
    hint.style.color='var(--red)';
    hint.textContent='⚠️ Bu küpe bu sezonda tanımlı değil — önce Hayvan Ekle ile kaydedin';
    resetPayInfo();
  }
}
function resetPayInfo(){
  document.getElementById('f_toplamPay_info').textContent='— Küpe girilince gelir';
  document.getElementById('f_bosPay_info').textContent='—';
  document.getElementById('f_bosPay_info').className='info-box';
  document.getElementById('f_pay_show').textContent='—';
}
function onMusteriPayIn(){
  const mp=+document.getElementById('f_musteri_pay').value||0;
  const k=(document.getElementById('f_kupe').value||'').trim();
  const h=getHav(k);
  if(!h||!mp){ document.getElementById('f_pay_show').textContent='—'; return; }
  const tp=h.toplamPay;
  const rdolu=allRows().filter(r=>r.kupe===k&&r.id!==editMId).reduce((a,r)=>a+(r.musteriPay||1),0);
  const bos=tp-rdolu;
  if(mp>bos){
    document.getElementById('f_pay_show').textContent=`⚠️ ${mp}/${tp} — ${bos} boş pay var!`;
    document.getElementById('f_pay_show').className='info-box warn';
  } else {
    document.getElementById('f_pay_show').textContent=`${mp}/${tp} pay`;
    document.getElementById('f_pay_show').className='info-box ok';
  }
  document.getElementById('musteriPayHint').textContent=`Bu müşteri ${mp}/${tp} pay alacak`;
}
function calcK(){
  const f=+document.getElementById('f_fiyat').value||0;
  const k=+document.getElementById('f_kapora').value||0;
  document.getElementById('f_kprev').textContent='₺'+fmt(f-k);
}
function openMModal(id=null,kupe=null,prefAd=null,prefTel=null,prefTc=null){
  editMId=id; editMType=null;
  const ts=document.getElementById('f_type');
  ts.value=(activeTab!=='genel'&&activeTab!=='hayvanlar'&&activeTab!=='musteri'&&activeTab!=='kesim'&&activeTab!=='finans')?activeTab:'dana';
  document.getElementById('mSeasonWarn').classList.remove('show');
  document.getElementById('f_ad_suggest').innerHTML='';
  resetPayInfo();
  updateKupeDropdown();
  if(id){
    editMType=editMTypeOf(id);
    const found=editMType?getRows(editMType).find(r=>r.id===id):null;
    if(!found) return;
    document.getElementById('mTitle').textContent='✏️ Satış Düzenle';
    document.getElementById('f_ad').value=found.ad||'';
    document.getElementById('f_tel').value=found.tel||'';
    document.getElementById('f_tc').value=found.tc||'';
    // Düzenleme modunda tür ayarla ve dropdown güncelle
    if(editMType){ ts.value=editMType; updateKupeDropdown(); }
    document.getElementById('f_kupe').value=found.kupe||'';
    document.getElementById('f_musteri_pay').value=found.musteriPay||'1';
    document.getElementById('f_fiyat').value=found.fiyat||'';
    document.getElementById('f_kapora').value=found.kapora||'';
    document.getElementById('f_notlar').value=found.notlar||'';
    ts.value=editMType;
    onKupeIn(); calcK(); onTcInput(document.getElementById('f_tc'));
  } else {
    document.getElementById('mTitle').textContent=`➕ Müşteri Satışı · ${getSeasons()[currentSeason]?.name||''} Sezonu`;
    ['f_ad','f_tel','f_tc','f_kupe','f_musteri_pay','f_fiyat','f_kapora','f_notlar'].forEach(x=>document.getElementById(x).value='');
    document.getElementById('kupeHint').textContent='';
    document.getElementById('f_kprev').textContent='₺0';
    document.getElementById('tcHint').textContent='';
    if(prefAd){ document.getElementById('f_ad').value=prefAd; selectSuggest(prefAd,prefTel||'',prefTc||''); }
    if(prefTc&&!prefAd){ document.getElementById('f_tc').value=prefTc; onTcInput(document.getElementById('f_tc')); }
    if(kupe){ document.getElementById('f_kupe').value=kupe; onKupeIn(); }
  }
  document.getElementById('mOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('f_ad').focus(),80);
}
function closeM(){ document.getElementById('mOverlay').classList.remove('open'); editMId=null; editMType=null; }
function closeMBg(e){ if(e.target===document.getElementById('mOverlay')) closeM(); }
function openMForType(type){ const p=activeTab; activeTab=type; openMModal(); activeTab=p; }
function editM(id){ openMModal(id); }



function toggleRow(id){ if(selRows.has(id)) selRows.delete(id); else selRows.add(id); renderMain(); }
function toggleAll(){
  const all=document.getElementById('chkAll')?.checked;
  const rows=TYPES.includes(activeTab)?getRows(activeTab):allRows();
  if(all) rows.forEach(r=>selRows.add(r.id)); else selRows.clear();
  renderMain();
}
function clearSel(){
  if(!selRows.size){ toast('Seçili kayıt yok','err'); return; }
  if(!confirm(`${selRows.size} kayıt silinsin mi?`)) return;
  TYPES.forEach(t=>setRows(t,getRows(t).filter(r=>!selRows.has(r.id))));
  selRows.clear(); renderAll(); toast('🗑️ Silindi','err');
}

// ── EXPORT — FIX #6: revoke blob URL ──
document.addEventListener('click',e=>{ if(!e.target.closest('.tright')) document.getElementById('emenu').classList.remove('open'); });
function csvRows(rows,sid){
  return rows.map(r=>{
    const h=getHav(r.kupe,sid);
    return [getSeasons()[sid]?.name||'',TLABEL[r._t]||'',r.sira||'',`"${r.ad||''}"`,r.tel||'',r.tc||'',r.kupe||'',
      `${r.musteriPay||1}/${r.toplamPay||'?'}`,`"${h?.isim||''}"`,h?.kesimTarihi||'',
      r.fiyat||0,r.kapora||0,(r.fiyat||0)-(r.kapora||0),`"${r.notlar||''}"`].join(',');
  });
}
function doCSV(){
  dl([HDR_CSV,...csvRows(allRows(),currentSeason)],'satis_'+(getSeasons()[currentSeason]?.name||'sezon')+'.csv');
  document.getElementById('emenu').classList.remove('open');
}
function doCSVAll(){
  const seasons=getSeasons(); let lines=[HDR_CSV];
  Object.keys(seasons).forEach(sid=>lines.push(...csvRows(allRows(sid),sid)));
  dl(lines,'satis_tum_sezonlar.csv');
  document.getElementById('emenu').classList.remove('open');
}
function dl(lines,fname){
  const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  // FIX #6: revoke URL after download
  const url=URL.createObjectURL(blob);
  Object.assign(document.createElement('a'),{href:url,download:fname}).click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast('📄 CSV indirildi','ok');
}

// ── MÜŞTERİ REHBERİ ──
function renderMusteriRehber(){
  const q=sq(); const dir=getDir();
  let entries=Object.values(dir);
  if(q) entries=entries.filter(e=>(e.ad||'').toLowerCase().includes(q)||(e.tel||'').includes(q)||(e.tc||'').includes(q));
  entries.sort((a,b)=>(a.ad||'').localeCompare(b.ad||'','tr'));
  const cards=entries.map(e=>{
    const hist=getCustomerHistory(e.ad,e.tel,e.tc);
    const histHtml=hist.slice(0,3).map(h=>{
      const topF=h.rows.reduce((a,r)=>a+(r.fiyat||0),0);
      const topK=h.rows.reduce((a,r)=>a+(r.kapora||0),0);
      const kalan=topF-topK; const kc=kcls(kalan,topF);
      const kupes=[...new Set(h.rows.map(r=>r.kupe).filter(Boolean))];
      return `<div class="mcard-season">
        <div>
          <span class="mcard-season-yr" style="color:${h.sid===currentSeason?'var(--accent)':'var(--muted)'}">${h.season.name}</span>
          ${h.sid===currentSeason?'<span style="font-size:9px;color:var(--green);margin-left:4px">● Aktif</span>':''}
          <div class="mcard-season-info">${h.rows.length} kayıt · ${kupes.map(k=>`🏷️${esc(k)}`).join(' ')}</div>
        </div>
        <span class="kb ${kc}" style="font-size:10px;padding:1px 6px">₺${fmt(kalan)}</span>
      </div>`;
    }).join('');
    const tcMasked=e.tc?`${e.tc.slice(0,3)}***${e.tc.slice(-2)}`:'';
    return `<div class="mcard" onclick="openMd('${esc(e.ad)}','${esc(e.tel||'')}','${esc(e.tc||'')}')">
      <div class="mcard-ad">${esc(e.ad)}</div>
      <div class="mcard-tel">${e.tel||'—'} <span style="font-size:10px;color:var(--muted);margin-left:6px">${hist.length} sezon</span>
        ${tcMasked?`<span class="tc-badge valid" style="margin-left:5px;vertical-align:middle">🪪 ${tcMasked}</span>`:'<span class="tc-badge" style="margin-left:5px;vertical-align:middle">TC yok</span>'}
      </div>
      <div class="mcard-history">${histHtml||'<div style="font-size:11px;color:var(--muted)">Geçmiş yok</div>'}</div>
    </div>`;
  }).join('');
  document.getElementById('mc').innerHTML=`<div class="musteri-wrap">
    <div style="margin-bottom:10px;font-size:12px;color:var(--muted)">${entries.length} kayıtlı müşteri · Üzerine tıklayarak tüm geçmişini görün</div>
    <div class="musteri-grid">${cards||'<div style="padding:40px;text-align:center;color:var(--muted)">Henüz müşteri kaydı yok.</div>'}</div>
  </div>`;
}

function openMdByRow(ad,tel,tc){ openMd(ad,tel,tc||''); }
function openMd(ad,tel,tc){
  tc=tc||'';
  curMdKey=dirKey(ad,tel,tc);
  const hist=getCustomerHistory(ad,tel,tc);
  document.getElementById('md-ad').textContent=ad;
  const tcMasked=tc?` · 🪪 ${tc.slice(0,3)}***${tc.slice(-2)}`:'';
  document.getElementById('md-tel').textContent=(tel||'Telefon girilmemiş')+tcMasked;
  document.getElementById('md-new-btn').onclick=()=>{ closeMd(); openMModal(null,null,ad,tel,tc); };
  let bodyHtml='';
  if(!hist.length){
    bodyHtml='<div style="text-align:center;padding:20px;color:var(--muted)">Geçmiş kayıt yok.</div>';
  } else {
    hist.forEach(h=>{
      const totF=h.rows.reduce((a,r)=>a+(r.fiyat||0),0);
      const totKl=h.rows.reduce((a,r)=>a+((r.fiyat||0)-(r.kapora||0)),0);
      const kc=kcls(totKl,totF); const isCur=h.sid===currentSeason;
      const rowsHtml=h.rows.map(r=>{
        const kalan=(r.fiyat||0)-(r.kapora||0); const rkc=kcls(kalan,r.fiyat);
        const hav=getHav(r.kupe,h.sid); const pt=payStr(r);
        return `<div class="md-row">
          <div>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:11px">${TLABEL[r._t||'']||''}</span>
            ${r.kupe?`<span class="klink" style="margin-left:4px;font-size:10px" onclick="closeMd();openHd('${esc(r.kupe)}')">🏷️ ${esc(r.kupe)}</span>`:''}
            ${pt?`<span class="pay-chip">${pt}</span>`:''}
            ${hav?.isim?`<span style="font-size:11px;color:var(--muted);margin-left:4px">${esc(hav.isim)}</span>`:''}
            ${r.notlar?`<div style="font-size:10px;color:var(--muted);margin-top:2px">${esc(r.notlar)}</div>`:''}
          </div>
          <div style="text-align:right">
            <div class="kb ${rkc}" style="font-size:10px">₺${fmt(kalan)}</div>
            <div style="font-size:10px;color:var(--muted)">Sıra #${r.sira||'—'}</div>
          </div>
        </div>`;
      }).join('');
      bodyHtml+=`<div class="md-season-block">
        <div class="md-season-hdr">
          <span class="md-season-yr" style="color:${isCur?'var(--accent)':'var(--muted)'}">${esc(h.season.name)} ${isCur?'<span style="font-size:10px;color:var(--green)">● Aktif Sezon</span>':''}</span>
          <span class="kb ${kc}" style="font-size:11px">Kalan: ₺${fmt(totKl)}</span>
        </div>
        <div class="md-season-rows">${rowsHtml}</div>
      </div>`;
    });
  }
  document.getElementById('md-body').innerHTML=bodyHtml;
  document.getElementById('mdOverlay').classList.add('open');
}
function closeMd(){ document.getElementById('mdOverlay').classList.remove('open'); curMdKey=null; }
function closeMdBg(e){ if(e.target===document.getElementById('mdOverlay')) closeMd(); }

// ── KESİM PLANI ──
function renderKesimPlani(){
  const mc=document.getElementById('mc'); const hd=getHD(); const ar=allRows();
  const allDates=[...new Set(Object.values(hd).map(h=>h.kesimTarihi).filter(Boolean))].sort();
  const selDate=kesimDate;
  const dateObj=selDate?new Date(selDate+' 12:00:00'):null;
  const dayNames=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const dayLabel=dateObj?`${dayNames[dateObj.getDay()]}, ${dateObj.toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'})}`:' ';
  const animalsToday=Object.values(hd).filter(h=>h.kesimTarihi===selDate);
  const ownersToday=animalsToday.flatMap(h=>ar.filter(r=>r.kupe===h.kupe));
  const totSatis=ownersToday.reduce((a,r)=>a+(r.fiyat||0),0);
  const totKapora=ownersToday.reduce((a,r)=>a+(r.kapora||0),0);
  const totKalan=totSatis-totKapora;
  const totPay=animalsToday.reduce((a,h)=>a+(h.toplamPay||0),0);
  const summaryHtml=animalsToday.length?`<div class="kesim-summary">
    <div class="ksump"><div class="ksump-lbl">Hayvan Sayısı</div><div class="ksump-val">${animalsToday.length}</div></div>
    <div class="ksump"><div class="ksump-lbl">Toplam Pay</div><div class="ksump-val">${totPay}</div></div>
    <div class="ksump"><div class="ksump-lbl">Sahip Sayısı</div><div class="ksump-val">${ownersToday.length}</div></div>
    <div class="ksump"><div class="ksump-lbl">Toplam Satış</div><div class="ksump-val">₺${fmt(totSatis)}</div></div>
    <div class="ksump"><div class="ksump-lbl">Toplam Kapora</div><div class="ksump-val">₺${fmt(totKapora)}</div></div>
    <div class="ksump"><div class="ksump-lbl" style="color:${totKalan>0?'var(--red)':'var(--green)'}">Kalan</div><div class="ksump-val" style="color:${totKalan>0?'var(--red)':'var(--green)'}">₺${fmt(totKalan)}</div></div>
  </div>`:'';
  const byType={}; TYPES.forEach(t=>{ byType[t]=animalsToday.filter(h=>h.type===t).sort((a,b)=>(a.sira||999)-(b.sira||999)); });
  const blocks=TYPES.map(type=>{
    const animals=byType[type]; if(!animals.length) return '';
    const c=THEX[type]; const emoji=TEMOJI[type];
    const typeTotS=animals.flatMap(h=>ar.filter(r=>r.kupe===h.kupe)).reduce((a,r)=>a+(r.fiyat||0),0);
    const typeTotKl=animals.flatMap(h=>ar.filter(r=>r.kupe===h.kupe)).reduce((a,r)=>a+((r.fiyat||0)-(r.kapora||0)),0);
    const animalCards=animals.map(h=>{
      const owners=ar.filter(r=>r.kupe===h.kupe).sort((a,b)=>(a.musteriPay||1)-(b.musteriPay||1));
      const dolu=owners.reduce((a,r)=>a+(r.musteriPay||1),0);
      const bos=Math.max(0,(h.toplamPay||0)-dolu);
      let payBar='';
      owners.forEach((r,i)=>{ const s=r.musteriPay||1; for(let j=0;j<s;j++) payBar+=`<div style="background:${SCOLS[i%SCOLS.length]};flex:1"></div>`; });
      for(let i=0;i<bos;i++) payBar+=`<div style="background:var(--border);flex:1"></div>`;
      const ownerChips=owners.map((r,i)=>{
        const kalan=(r.fiyat||0)-(r.kapora||0);
        const kc=kcls(kalan,r.fiyat);
        const pt=payStr(r); const sc=SCOLS[i%SCOLS.length];
        return `<div class="ko-chip" style="border-left-color:${sc}">
          <div class="ko-ad">
            <span style="width:8px;height:8px;border-radius:50%;background:${sc};display:inline-block;flex-shrink:0"></span>
            ${esc(r.ad||'—')} ${pt?`<span class="pay-chip" style="font-size:9px">${pt}</span>`:''}
            ${r.tc?`<span class="tc-badge valid" style="font-size:9px">🪪 ${r.tc.slice(0,3)}***${r.tc.slice(-2)}</span>`:''}
          </div>
          ${r.tel?`<div class="ko-tel">${r.tel}</div>`:''}
          <div class="ko-fin">
            <span>Satış: <b style="color:var(--text)">₺${fmt(r.fiyat||0)}</b></span>
            <span>Kapora: <b style="color:var(--accent)">₺${fmt(r.kapora||0)}</b></span>
            <span>Kalan: <b><span class="kb ${kc}" style="padding:1px 5px;font-size:10px">₺${fmt(kalan)}</span></b></span>
          </div>
        </div>`;
      }).join('');
      return `<div class="kacard">
        <div class="kacard-top">
          <span class="ka-sira">${h.sira?`#${h.sira}`:'Sıra ?'}</span>
          <span class="ka-kupe" onclick="openHd('${esc(h.kupe)}')">🏷️ ${esc(h.kupe)}</span>
          ${h.isim?`<span class="ka-isim">${esc(h.isim)}</span>`:''}
          <span style="font-size:12px;color:var(--muted);font-family:'IBM Plex Mono',monospace">${dolu}/${h.toplamPay||'?'} pay</span>
          ${bos>0?`<span style="font-size:11px;color:var(--red);font-family:'IBM Plex Mono',monospace">${bos} boş pay!</span>`:'<span style="font-size:11px;color:var(--green)">✔ Tam</span>'}
        </div>
        <div class="ka-pay-bar">${payBar}</div>
        <div class="ko-grid">${ownerChips||'<div style="font-size:12px;color:var(--muted)">Sahip yok</div>'}</div>
      </div>`;
    }).join('');
    return `<div class="ktblock">
      <div class="kthdr">
        <span style="font-size:22px">${emoji}</span>
        <span class="ktitle" style="color:${c}">${TLABEL[type]}</span>
        <span class="ktcount">${animals.length} hayvan · ${animals.flatMap(h=>ar.filter(r=>r.kupe===h.kupe)).length} sahip</span>
        <span class="kttotals">Satış: ₺${fmt(typeTotS)} · Kalan: <b style="color:${typeTotKl>0?'var(--red)':'var(--green)'}">₺${fmt(typeTotKl)}</b></span>
      </div>
      ${animalCards}
    </div>`;
  }).join('');
  const upcomingHtml=allDates.length?`<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-top:14px">
    <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:9px">Tüm Kesim Tarihleri</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${allDates.map(d=>{
        const cnt=Object.values(hd).filter(h=>h.kesimTarihi===d).length;
        const isSelected=d===selDate;
        const diff=Math.ceil((new Date(d+' 12:00')-new Date())/(864e5));
        const isPast=diff<0; const isToday=diff===0;
        return `<button onclick="setKesimDate('${d}')"
          style="padding:5px 11px;border-radius:5px;border:1px solid ${isSelected?'#ff6b35':'var(--border)'};
          background:${isSelected?'rgba(255,107,53,.2)':isPast?'rgba(42,48,80,.4)':'var(--surface2)'};
          color:${isSelected?'#ff6b35':isPast?'var(--muted)':'var(--text)'};
          font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;transition:all .15s;opacity:${isPast?.65:1}">
          ${new Date(d+' 12:00').toLocaleDateString('tr-TR',{day:'2-digit',month:'short'})}
          ${isToday?'🔴':''}
          <span style="color:var(--teal);margin-left:3px">${cnt}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`:'';
  const mainContent=animalsToday.length
    ?`${summaryHtml}${blocks}`
    :`<div class="kesim-empty"><div class="ik">✂️</div><p style="font-size:14px;margin-bottom:8px">Bu tarihte kesim planlanmamış</p><p style="font-size:12px">Hayvan eklerken kesim tarihi girin.</p></div>`;
  mc.innerHTML=`<div class="kesim-wrap">
    <div class="kesim-header">
      <button class="kesim-nav-btn" onclick="shiftKesimDate(-1)">◀</button>
      <input type="date" class="kesim-date-input" value="${selDate}" onchange="setKesimDate(this.value)">
      <button class="kesim-nav-btn" onclick="shiftKesimDate(1)">▶</button>
      <span class="kesim-day-label">${dayLabel}</span>
      <button class="kesim-nav-btn" onclick="setKesimDate(new Date().toISOString().slice(0,10))" style="font-size:12px;padding:5px 10px">Bugün</button>
      ${animalsToday.length?`<button onclick="window.print()" style="margin-left:auto;background:rgba(255,107,53,.15);color:#ff6b35;border:1px solid rgba(255,107,53,.4);border-radius:5px;padding:6px 13px;cursor:pointer;font-size:13px;font-family:inherit">🖨️ İş Emri Yazdır</button>`:''}
    </div>
    ${mainContent}
    ${upcomingHtml}
  </div>`;
}
function setKesimDate(d){ kesimDate=d; if(activeTab==='kesim') renderMain(); }
function shiftKesimDate(dir){ const d=new Date(kesimDate+' 12:00'); d.setDate(d.getDate()+dir); kesimDate=d.toISOString().slice(0,10); if(activeTab==='kesim') renderMain(); }

// ── FİNANS ──
function renderFinans(){
  const q=sq(); // FIX: apply search
  const arAll=allRows();
  const ar=q ? arAll.filter(r=>mq(r,q)||(r.odemeler||[]).some(o=>(o.not||'').toLowerCase().includes(q))) : arAll;
  const seasons=getSeasons(); const sezonAd=seasons[currentSeason]?.name||'—';
  // Stats always from full data, not filtered
  const totSatis=arAll.reduce((a,r)=>a+(r.fiyat||0),0);
  const totKapora=arAll.reduce((a,r)=>a+(r.kapora||0),0);
  const totKalan=totSatis-totKapora;
  const odenmisSay=arAll.filter(r=>((r.fiyat||0)-(r.kapora||0))<=0).length;
  const bekleyenSay=arAll.filter(r=>((r.fiyat||0)-(r.kapora||0))>0).length;
  const typeRows=q ? '' : TYPES.map(type=>{  // hide type breakdown when searching
    const rows=getRows(type); if(!rows.length) return '';
    const c=THEX[type]; const ts=rows.reduce((a,r)=>a+(r.fiyat||0),0);
    const tk=rows.reduce((a,r)=>a+(r.kapora||0),0); const tkl=ts-tk;
    const pct=ts>0?Math.round(tk/ts*100):0;
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:13px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:${c};width:110px">${TLABEL[type]}</div>
      <div style="flex:1;min-width:180px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:5px"><span>Kapora tahsilatı</span><span style="font-family:'IBM Plex Mono',monospace">${pct}%</span></div>
        <div style="height:7px;background:var(--surface2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${c};border-radius:4px"></div></div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Satış</div><div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600">₺${fmt(ts)}</div></div>
        <div style="text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Kapora</div><div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--accent)">₺${fmt(tk)}</div></div>
        <div style="text-align:center"><div style="font-size:9px;color:${tkl>0?'var(--red)':'var(--green)'};text-transform:uppercase;letter-spacing:.8px">Kalan</div><div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:${tkl>0?'var(--red)':'var(--green)'}">₺${fmt(tkl)}</div></div>
        <div style="text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Kayıt</div><div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600">${rows.length}</div></div>
      </div>
    </div>`;
  }).join('');
  const bekleyenRows=ar.filter(r=>((r.fiyat||0)-(r.kapora||0))>0).sort((a,b)=>((b.fiyat||0)-(b.kapora||0))-((a.fiyat||0)-(a.kapora||0)));
  const odenenRows=ar.filter(r=>((r.fiyat||0)-(r.kapora||0))<=0);
  const bekleyenHtml=bekleyenRows.map((r,i)=>{
    const kalan=(r.fiyat||0)-(r.kapora||0); const pct=r.fiyat>0?Math.round((r.kapora||0)/r.fiyat*100):0;
    const c=THEX[r._t]||'var(--accent)'; const hav=getHav(r.kupe);
    // Payment log rows
    const odHtml=(r.odemeler||[]).map(o=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 8px;background:rgba(64,200,112,.06);border-radius:4px;margin-top:3px;font-size:10px;font-family:'IBM Plex Mono',monospace">
        <span style="color:var(--muted)">${o.tarih||''}</span>
        <span style="color:var(--green);font-weight:600">+₺${fmt(o.tutar)}</span>
        ${o.not?`<span style="color:var(--muted)">${esc(o.not)}</span>`:''}
        ${o.by?`<span style="color:var(--muted)">${esc(o.by)}</span>`:''}
      </div>`).join('');
    return `<tr style="${i%2===0?'':'background:rgba(42,48,80,.3)'}">
      <td style="padding:7px 10px;font-weight:500;cursor:pointer;color:var(--blue)" onclick="openMdByRow('${esc(r.ad)}','${esc(r.tel||'')}','${esc(r.tc||'')}')">${esc(r.ad||'—')}</td>
      <td style="padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted)">${r.tel||'—'}</td>
      <td style="padding:7px 10px"><span style="font-size:11px;color:${c}">${TLABEL[r._t]||''}</span>${r.kupe?`<br><span class="klink" onclick="openHd('${esc(r.kupe)}')" style="font-size:10px;margin-top:2px">🏷️ ${esc(r.kupe)}</span>${hav?.sira?`<span style="font-size:10px;color:#ff6b35;margin-left:4px">#${hav.sira}</span>`:''}`:''}${hav?.kesimTarihi?`<br><span style="font-size:10px;color:var(--muted);font-family:'IBM Plex Mono',monospace">✂️ ${new Date(hav.kesimTarihi+' 12:00').toLocaleDateString('tr-TR')}</span>`:''}</td>
      <td style="padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:12px">₺${fmt(r.fiyat||0)}</td>
      <td style="padding:7px 10px">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--accent)">₺${fmt(r.kapora||0)}</span>
        ${odHtml}
      </td>
      <td style="padding:7px 10px">
        <span class="kb cok" style="font-size:11px">₺${fmt(kalan)}</span>
        <div style="height:4px;background:var(--surface2);border-radius:2px;margin-top:4px;width:80px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px"></div></div>
        <span style="font-size:9px;color:var(--muted)">${pct}% ödendi</span>
      </td>
      <td style="padding:7px 10px;white-space:nowrap">
        <button onclick="openOdeme('${r.id}','${r._t}')"
          style="background:rgba(64,200,112,.15);color:var(--green);border:1px solid var(--green);border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600;margin-bottom:4px;display:block;width:100%"
          onmouseover="this.style.background='var(--green)';this.style.color='#0f1117'"
          onmouseout="this.style.background='rgba(64,200,112,.15)';this.style.color='var(--green)'">💰 Ödeme Al</button>
        <button onclick="editM('${r.id}')"
          style="background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:3px 10px;cursor:pointer;font-size:11px;font-family:inherit;display:block;width:100%">✏️ Düzenle</button>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('mc').innerHTML=`<div style="padding:14px">
    ${q?`<div style="background:rgba(64,200,200,.08);border:1px solid rgba(64,200,200,.3);border-radius:6px;padding:8px 13px;margin-bottom:12px;font-size:12px;color:var(--teal)">🔍 "<b>${esc(q)}</b>" için ${bekleyenRows.length+odenenRows.length} sonuç — bekleyen ve tamamlananlar gösteriliyor</div>`:''}
    ${!q?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:16px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Toplam Satış</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:#a0e840">₺${fmt(totSatis)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${arAll.length} kayıt · ${esc(sezonAd)}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Toplam Kapora</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:var(--accent)">₺${fmt(totKapora)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${totSatis>0?Math.round(totKapora/totSatis*100):0}% tahsil edildi</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px">
        <div style="font-size:9px;color:${totKalan>0?'var(--red)':'var(--green)'};text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Toplam Kalan</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:${totKalan>0?'var(--red)':'var(--green)'}">₺${fmt(totKalan)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${bekleyenSay} kişide bekliyor</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px">
        <div style="font-size:9px;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Tamamlanan</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:var(--green)">${odenmisSay}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">kişi tam ödedi</div>
      </div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Genel Tahsilat Durumu</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--accent)">${totSatis>0?Math.round(totKapora/totSatis*100):0}%</span>
      </div>
      <div style="height:10px;background:var(--surface2);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${totSatis>0?Math.round(totKapora/totSatis*100):0}%;background:linear-gradient(90deg,var(--accent),#a0e840);border-radius:5px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:5px">
        <span>₺0</span><span style="color:var(--accent)">Kapora: ₺${fmt(totKapora)}</span><span>₺${fmt(totSatis)}</span>
      </div>
    </div>
    <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Tür Bazlı Durum</div>
    <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">${typeRows||'<div style="color:var(--muted);font-size:13px;padding:14px">Kayıt yok.</div>'}</div>`:''}
    ${bekleyenRows.length?`
    <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
      Bekleyen Ödemeler <span style="font-family:'IBM Plex Mono',monospace;color:var(--red);margin-left:6px">${bekleyenRows.length} kişi · ₺${fmt(bekleyenRows.reduce((a,r)=>a+((r.fiyat||0)-(r.kapora||0)),0))}</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--surface2)">
          ${['Ad Soyad','Telefon','Hayvan / Kesim','Satış','Kapora / Ödemeler','Kalan',''].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);border-bottom:1px solid var(--border)">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${bekleyenHtml}</tbody>
      </table></div>
    </div>`:''}
    ${odenenRows.length?`
    <details ${q?'open':''} style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <summary style="padding:12px 16px;cursor:pointer;font-size:12px;color:var(--green);font-weight:500;user-select:none">
        ✅ Ödemesi Tamamlananlar <span style="font-family:'IBM Plex Mono',monospace;color:var(--muted);margin-left:6px">${odenenRows.length} kişi · ₺${fmt(odenenRows.reduce((a,r)=>a+(r.fiyat||0),0))}</span>
      </summary>
      <div style="padding:0 16px 14px;display:flex;flex-direction:column;gap:5px;margin-top:8px">
        ${odenenRows.map(r=>{
          const c=THEX[r._t]||'var(--accent)';
          const odLog=(r.odemeler||[]).map(o=>`<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--green)">+₺${fmt(o.tutar)} ${o.tarih||''}</span>`).join(' · ');
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(64,200,112,.06);border:1px solid rgba(64,200,112,.2);border-radius:5px;flex-wrap:wrap;gap:6px"> 
            <div>
              <span style="font-weight:500;font-size:13px">${esc(r.ad||'—')}</span>
              <span style="font-size:11px;color:${c};margin-left:8px">${TLABEL[r._t]||''}</span>
              ${r.kupe?`<span class="klink" onclick="openHd('${esc(r.kupe)}')" style="font-size:10px;margin-left:5px">🏷️ ${esc(r.kupe)}</span>`:''}
              ${odLog?`<div style="margin-top:3px">${odLog}</div>`:''}
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:12px">₺${fmt(r.fiyat||0)}</span>
              <span class="kb odendi" style="font-size:11px">✔ Tam Ödendi</span>
              <button onclick="editM('${r.id}')" style="background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;font-family:inherit">✏️</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </details>`:''}
  </div>`;
}

// ══════════════════════════════════════════════════════
// DASHBOARD / İZLEME
// ══════════════════════════════════════════════════════
function renderDashboard(){
  const hd=getHD(); const ar=allRows();
  const now=new Date(); const todayStr=now.toISOString().slice(0,10);
  const sezonAd=getSeasons()[currentSeason]?.name||'';

  // Per-animal status calculation
  // Status logic:
  //   🔴 BAŞLAMADI  : hayvan tanımlı, hiç sahip yok
  //   🟡 DEVAM EDİYOR : sahip var, bazı ödemeler eksik
  //   🟠 UYARI      : pay dolu değil (boş pay var)
  //   🟢 TAMAMLANDI : tüm sahiplerin ödemesi tamam AND pay doluluk tam
  //   ⚫ KESİLDİ    : kesim tarihi geçmiş

  const animals=Object.values(hd).sort((a,b)=>(a.sira||999)-(b.sira||999));

  // Summary
  const statCounts={tamamlandi:0,devam:0,baslamadi:0,uyari:0,kesildi:0};
  animals.forEach(h=>{
    const owners=ar.filter(r=>r.kupe===h.kupe);
    const dolu=owners.reduce((a,r)=>a+(r.musteriPay||1),0);
    const payTam=h.toplamPay&&dolu>=h.toplamPay;
    const odemeTam=owners.length>0&&owners.every(r=>((r.fiyat||0)-(r.kapora||0))<=0);
    const kesimGecti=h.kesimTarihi&&h.kesimTarihi<todayStr;
    if(kesimGecti) statCounts.kesildi++;
    else if(owners.length===0) statCounts.baslamadi++;
    else if(!payTam) statCounts.uyari++;
    else if(odemeTam) statCounts.tamamlandi++;
    else statCounts.devam++;
  });

  const totalKalan=ar.reduce((a,r)=>a+((r.fiyat||0)-(r.kapora||0)),0);
  const totalSatis=ar.reduce((a,r)=>a+(r.fiyat||0),0);
  const pctTahsilat=totalSatis>0?Math.round((totalSatis-totalKalan)/totalSatis*100):0;

  const summaryHtml=`<div class="db-summary-grid">
    <div class="db-sum" style="border-color:rgba(192,132,252,.3)"><div class="db-sum-lbl">Toplam Hayvan</div><div class="db-sum-val" style="color:#c084fc">${animals.length}</div></div>
    <div class="db-sum" style="border-color:rgba(64,200,112,.3)"><div class="db-sum-lbl">✅ Tamamlandı</div><div class="db-sum-val" style="color:var(--green)">${statCounts.tamamlandi}</div></div>
    <div class="db-sum" style="border-color:rgba(232,160,32,.3)"><div class="db-sum-lbl">🔄 Devam Ediyor</div><div class="db-sum-val" style="color:var(--accent)">${statCounts.devam}</div></div>
    <div class="db-sum" style="border-color:rgba(255,107,53,.3)"><div class="db-sum-lbl">⚠️ Boş Pay</div><div class="db-sum-val" style="color:#ff6b35">${statCounts.uyari}</div></div>
    <div class="db-sum" style="border-color:rgba(232,80,80,.3)"><div class="db-sum-lbl">🔴 Başlamadı</div><div class="db-sum-val" style="color:var(--red)">${statCounts.baslamadi}</div></div>
    <div class="db-sum" style="border-color:rgba(100,100,120,.3)"><div class="db-sum-lbl">✂️ Kesildi</div><div class="db-sum-val" style="color:var(--muted)">${statCounts.kesildi}</div></div>
    <div class="db-sum" style="border-color:rgba(160,232,64,.3)"><div class="db-sum-lbl">Tahsilat</div><div class="db-sum-val" style="color:#a0e840">${pctTahsilat}%</div></div>
    <div class="db-sum" style="border-color:rgba(232,80,80,.3)"><div class="db-sum-lbl">Kalan Borç</div><div class="db-sum-val" style="color:var(--red)">₺${fmt(totalKalan)}</div></div>
  </div>`;

  // Tahsilat progress bar
  const progressHtml=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:7px">
      <span style="text-transform:uppercase;letter-spacing:1px">Genel Tahsilat İlerlemesi</span>
      <span style="font-family:'IBM Plex Mono',monospace;color:#a0e840;font-size:12px">${pctTahsilat}% · ₺${fmt(totalSatis-totalKalan)} / ₺${fmt(totalSatis)}</span>
    </div>
    <div style="height:12px;background:var(--surface2);border-radius:6px;overflow:hidden">
      <div style="height:100%;width:${pctTahsilat}%;background:linear-gradient(90deg,var(--accent),#a0e840);border-radius:6px;transition:width .5s"></div>
    </div>
  </div>`;

  // Animal cards by type
  const typeBlocks=TYPES.map(type=>{
    const typeAnimals=animals.filter(h=>h.type===type);
    if(!typeAnimals.length) return '';
    const c=THEX[type]; const emoji=TEMOJI[type];
    const cards=typeAnimals.map(h=>{
      const owners=ar.filter(r=>r.kupe===h.kupe);
      const dolu=owners.reduce((a,r)=>a+(r.musteriPay||1),0);
      const bos=Math.max(0,(h.toplamPay||0)-dolu);
      const payTam=h.toplamPay&&dolu>=h.toplamPay;
      const odemeTam=owners.length>0&&owners.every(r=>((r.fiyat||0)-(r.kapora||0))<=0);
      const kesimDiff=h.kesimTarihi?Math.ceil((new Date(h.kesimTarihi+' 12:00')-now)/(864e5)):null;
      const kesimGecti=kesimDiff!==null&&kesimDiff<0;
      const kesimBugun=kesimDiff===0;
      const kesimYakin=kesimDiff!==null&&kesimDiff>=0&&kesimDiff<=3;

      // Status
      let statusColor,statusLabel,dotColor;
      if(kesimGecti){ statusColor='var(--muted)'; statusLabel='✂️ KESİLDİ'; dotColor='#555'; }
      else if(owners.length===0){ statusColor='var(--red)'; statusLabel='🔴 BAŞLAMADI'; dotColor='var(--red)'; }
      else if(!payTam){ statusColor='#ff6b35'; statusLabel='⚠️ BOŞ PAY'; dotColor='#ff6b35'; }
      else if(odemeTam){ statusColor='var(--green)'; statusLabel='✅ TAMAMLANDI'; dotColor='var(--green)'; }
      else { statusColor='var(--accent)'; statusLabel='🔄 DEVAM EDİYOR'; dotColor='var(--accent)'; }

      // Tarih display
      let tarihHtml='';
      if(h.kesimTarihi){
        const ts=new Date(h.kesimTarihi+' 12:00').toLocaleDateString('tr-TR');
        let tarihColor='var(--muted)';
        let tarihExtra='';
        if(kesimGecti){ tarihColor='var(--muted)'; tarihExtra=` (${Math.abs(kesimDiff)}g önce)`; }
        else if(kesimBugun){ tarihColor='var(--red)'; tarihExtra=' 🔴 BUGÜN'; }
        else if(kesimYakin){ tarihColor='var(--accent)'; tarihExtra=` (${kesimDiff}g kaldı)`; }
        else{ tarihExtra=` (${kesimDiff}g kaldı)`; }
        tarihHtml=`<div class="db-tarih" style="color:${tarihColor}">✂️ ${ts}${tarihExtra}</div>`;
      }

      // Pay ring
      let payRing='';
      owners.forEach((r,i)=>{ const s=r.musteriPay||1; for(let j=0;j<s;j++) payRing+=`<div class="db-pay-seg" style="background:${SCOLS[i%SCOLS.length]};flex:1"></div>`; });
      for(let i=0;i<bos;i++) payRing+=`<div class="db-pay-seg" style="background:var(--border);flex:1"></div>`;

      // Owners summary
      const ownerChips=owners.map((r,i)=>{
        const kalan=(r.fiyat||0)-(r.kapora||0);
        const chipColor=kalan<=0?'var(--green)':kalan>=(r.fiyat||0)/2?'var(--red)':'var(--accent)';
        const pt=payStr(r);
        return `<div class="db-owner-chip" style="border-color:${SCOLS[i%SCOLS.length]}40">
          <div class="db-owner-dot" style="background:${SCOLS[i%SCOLS.length]}"></div>
          <span style="font-weight:500">${esc(r.ad||'—')}</span>
          ${pt?`<span class="pay-chip" style="font-size:9px">${pt}</span>`:''}
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${chipColor}">${kalan<=0?'✔':'₺'+fmt(kalan)}</span>
          ${kalan>0?`<button onclick="openOdeme('${r.id}','${r._t}')" style="background:rgba(64,200,112,.15);color:var(--green);border:1px solid var(--green);border-radius:3px;padding:1px 6px;cursor:pointer;font-size:10px;font-family:inherit;white-space:nowrap" title="Ödeme Al">💰</button>`:''}
        </div>`;
      }).join('');

      const totKl=owners.reduce((a,r)=>a+((r.fiyat||0)-(r.kapora||0)),0);
      const totSt=owners.reduce((a,r)=>a+(r.fiyat||0),0);
      const rowPct=totSt>0?Math.round((totSt-totKl)/totSt*100):0;

      return `<div class="db-animal-row" style="border-color:${kesimBugun?'var(--red)':kesimYakin?'var(--accent)':'var(--border)'}">
        <div class="db-status-dot" style="background:${dotColor}"></div>
        <div class="db-animal-main">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="db-kupe" onclick="openHd('${esc(h.kupe)}')">🏷️ ${esc(h.kupe)}</span>
            ${h.isim?`<span class="db-animal-isim">${esc(h.isim)}</span>`:''}
            ${h.sira?`<span class="db-sira">#${h.sira}</span>`:''}
            <span class="db-status-label" style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44">${statusLabel}</span>
          </div>
          ${tarihHtml}
          <div style="margin-top:7px">
            <div class="db-pay-bar" style="width:200px">${payRing||'<div style="flex:1;background:var(--border)"></div>'}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">${dolu}/${h.toplamPay||'?'} pay${bos>0?` · <span style="color:#ff6b35">${bos} boş</span>`:' · <span style="color:var(--green)">Tam</span>'}</div>
          </div>
          <div class="db-owners" style="margin-top:8px">${ownerChips||'<span style="font-size:11px;color:var(--muted)">Sahip yok</span>'}</div>
        </div>
        <div class="db-pay-panel">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Tahsilat</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#a0e840;letter-spacing:1px">${rowPct}%</div>
          <div style="font-size:10px;color:var(--muted)">₺${fmt(totSt-totKl)} / ₺${fmt(totSt)}</div>
          ${totKl>0?`<div style="margin-top:5px"><span class="kb cok" style="font-size:11px">₺${fmt(totKl)} kalan</span></div>`:'<div style="margin-top:5px"><span class="kb odendi" style="font-size:11px">✔ Tam</span></div>'}
        </div>
      </div>`;
    }).join('');

    return `<div class="db-type-section">
      <div class="db-type-hdr" style="color:${c}">
        <span style="font-size:20px">${emoji}</span>${TLABEL[type]}
        <span style="font-size:12px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-left:auto">${typeAnimals.length} hayvan</span>
      </div>
      ${cards}
    </div>`;
  }).join('');

  const noAnimal=animals.length===0?`<div style="text-align:center;padding:60px 20px;color:var(--muted)"><div style="font-size:48px;margin-bottom:12px">📊</div><p>Henüz hayvan kaydı yok.<br>Hayvan ekleyince izleme ekranı dolacak.</p></div>`:'';

  document.getElementById('mc').innerHTML=`<div class="db-wrap">
    <div class="db-header">
      <div>
        <div class="db-title">📊 İzleme Ekranı</div>
        <div class="db-ts">${sezonAd} sezonu · ${now.toLocaleString('tr-TR')}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="renderDashboard()" style="background:rgba(192,132,252,.15);color:#c084fc;border:1px solid rgba(192,132,252,.4);border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit">🔄 Yenile</button>
        <button onclick="window.print()" style="background:var(--surface2);color:var(--muted);border:1px solid var(--border);border-radius:5px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit">🖨️ Yazdır</button>
      </div>
    </div>
    ${summaryHtml}
    ${progressHtml}
    ${noAnimal}
    ${typeBlocks}
  </div>`;
}
// ══════════════════════════════════════════════════════



// FIX #9: payStr reads toplamPay from hayvan live (not stale copy on row)


function openOdeme(id, type){
  const row = getRows(type).find(r => r.id === id);
  if(!row) return;
  odemeRowId = id; odemeRowType = type;
  const kalan = (row.fiyat||0) - (row.kapora||0);
  const hav = getHav(row.kupe);
  document.getElementById('od-musteri').textContent = row.ad||'—';
  document.getElementById('od-hayvan').textContent = [
    row.kupe ? '🏷️ '+row.kupe : '',
    hav?.isim ? hav.isim : '',
    TLABEL[type]||'',
    hav?.kesimTarihi ? '✂️ '+new Date(hav.kesimTarihi+' 12:00').toLocaleDateString('tr-TR') : ''
  ].filter(Boolean).join(' · ');
  document.getElementById('od-satis').textContent = '₺'+fmt(row.fiyat||0);
  document.getElementById('od-onceki').textContent = '₺'+fmt(row.kapora||0);
  document.getElementById('od-kalan').textContent = '₺'+fmt(kalan);
  // Default: today's date
  document.getElementById('od_tarih').value = new Date().toISOString().slice(0,10);
  // Default: full remaining amount
  document.getElementById('od_tutar').value = kalan > 0 ? kalan : '';
  document.getElementById('od_not').value = '';
  onOdemeTutarIn();
  document.getElementById('odemeOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('od_tutar').select(), 80);
}
function closeOdeme(){ document.getElementById('odemeOverlay').classList.remove('open'); odemeRowId=null; odemeRowType=null; }
function closeOdemeBg(e){ if(e.target===document.getElementById('odemeOverlay')) closeOdeme(); }

function onOdemeTutarIn(){
  const row = odemeRowId ? getRows(odemeRowType).find(r=>r.id===odemeRowId) : null;
  if(!row){ document.getElementById('od_sonuc').textContent='—'; return; }
  const kalan = (row.fiyat||0)-(row.kapora||0);
  const tutar = +document.getElementById('od_tutar').value||0;
  const el = document.getElementById('od_sonuc');
  if(!tutar){ el.style.color='var(--muted)'; el.textContent='Tutar girin…'; return; }
  if(tutar > kalan){
    el.style.color='var(--red)'; el.textContent=`⚠️ Fazla ödeme! Kalan yalnızca ₺${fmt(kalan)}.`; return;
  }
  const yeniKalan = kalan - tutar;
  if(yeniKalan === 0){
    el.style.color='var(--green)'; el.textContent=`✅ Tam ödeme — Borç kapanıyor → ₺0`;
  } else {
    el.style.color='var(--accent)'; el.textContent=`Yeni kalan: ₺${fmt(yeniKalan)} (₺${fmt(tutar)} alındı)`;
  }
}

function saveOdeme(){
  const tutar = +document.getElementById('od_tutar').value||0;
  const tarih = document.getElementById('od_tarih').value;
  const not   = document.getElementById('od_not').value.trim();
  if(!tutar||tutar<=0){ document.getElementById('od_tutar').focus(); toast('Tutar giriniz!','err'); return; }
  const rows = getRows(odemeRowType);
  const row  = rows.find(r=>r.id===odemeRowId);
  if(!row){ toast('Kayıt bulunamadı!','err'); return; }
  const kalan = (row.fiyat||0)-(row.kapora||0);
  if(tutar > kalan){ toast(`⚠️ Kalan sadece ₺${fmt(kalan)}!`,'err'); return; }
  // Append to kapora — this makes the kalan recalculate automatically
  const eskiKapora = row.kapora||0;
  row.kapora = eskiKapora + tutar;
  // Store payment log on the row
  if(!row.odemeler) row.odemeler=[];
  row.odemeler.push({ tarih, tutar, not, by: currentUser?.name||'', ts: new Date().toISOString() });
  row.updatedBy = currentUser?.name;
  row.updatedAt = new Date().toISOString();
  setRows(odemeRowType, rows);
  const yeniKalan = (row.fiyat||0)-row.kapora;
  closeOdeme();
  renderAll();
  if(yeniKalan <= 0){
    toast(`✅ ${esc(row.ad)} — Ödeme tamamlandı! Hesap kapatıldı.`, 'ok');
  } else {
    toast(`✔ ₺${fmt(tutar)} alındı · Kalan: ₺${fmt(yeniKalan)}`, 'ok');
  }
}

// ══════════════════════════════════════════════════════
// HESAP MAKİNESİ
// ══════════════════════════════════════════════════════


function renderHesap(){
  const mc=document.getElementById('mc');
  const kg=parseFloat(document.getElementById('h_kg')?.value)||0;
  const bp=parseFloat(document.getElementById('h_fiyat')?.value)||0;

  mc.innerHTML=`<div class="hesap-wrap">

    <!-- GİRİŞ SATIRLARI -->
    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:8px;margin-bottom:8px">
      <div class="hesap-card" style="margin-bottom:0">
        <div class="hesap-label">⚖️ Ağırlık (Tartı)</div>
        <div class="hesap-input-row">
          <input class="hesap-input" id="h_kg" type="number" inputmode="decimal" placeholder="0.000"
            step="0.001" min="0" value="" oninput="hesapHesapla()" onfocus="this.select()">
          <span class="hesap-unit">KG</span>
        </div>
      </div>
      <div class="hesap-op">×</div>
      <div class="hesap-card" style="margin-bottom:0">
        <div class="hesap-label">💰 Birim Fiyat</div>
        <div class="hesap-input-row">
          <input class="hesap-input" id="h_fiyat" type="number" inputmode="decimal" placeholder="0.00"
            step="0.01" min="0" value="" oninput="hesapHesapla()" onfocus="this.select()">
          <span class="hesap-unit">₺/KG</span>
        </div>
      </div>
    </div>

    <!-- SONUÇ -->
    <div class="hesap-result-card">
      <div class="hesap-result-label">= Hesaplanan Tutar</div>
      <div class="hesap-result-val" id="hesapResultVal">₺ —</div>
      <div class="hesap-result-sub" id="hesapResultSub"></div>
    </div>

    <!-- ANLAŞILAN FİYAT -->
    <div class="hesap-anlasman-card">
      <div class="hesap-label">🤝 Anlaşılan / Yuvarlanan Satış Fiyatı</div>
      <div class="hesap-anlasman-row">
        <span style="font-size:24px;color:var(--muted);font-family:'Bebas Neue',sans-serif;letter-spacing:2px;flex-shrink:0">₺</span>
        <input class="hesap-anlasman-input" id="h_anlasman" type="number" inputmode="numeric"
          placeholder="Anlaşılan tutar" oninput="hesapFark()" onfocus="this.select()">
      </div>
      <div class="hesap-diff" id="hesapDiff" style="display:none"></div>
      <div style="margin-top:10px;display:flex;gap:7px;flex-wrap:wrap;align-items:center">
        <button class="hesap-round-btn" onclick="hesapYuvarla(-1)">▼ 100'e Aşağı</button>
        <button class="hesap-round-btn" onclick="hesapYuvarla(1)">▲ 100'e Yukarı</button>
        <button class="hesap-round-btn" onclick="hesapYuvarla(0)">≈ Tam Yuvarla</button>
        <div style="flex:1"></div>
        <button onclick="hesapKaydet()"
          style="background:rgba(52,211,153,.15);border:1px solid #34d399;border-radius:6px;padding:8px 16px;cursor:pointer;color:#34d399;font-size:13px;font-family:inherit;font-weight:600;transition:all .15s"
          onmouseover="this.style.background='#34d399';this.style.color='#0f1117'"
          onmouseout="this.style.background='rgba(52,211,153,.15)';this.style.color='#34d399'">
          📋 Geçmişe Kaydet
        </button>
      </div>
    </div>

    <!-- GEÇMİŞ -->
    ${hesapHistory.length?`
    <div class="hesap-history">
      <div class="hesap-history-hdr">
        <span>Son Hesaplamalar <span style="color:var(--accent);font-family:'IBM Plex Mono',monospace">${hesapHistory.length}</span></span>
        <button onclick="hesapHistory=[];renderHesap()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;font-family:inherit;text-decoration:underline">Temizle</button>
      </div>
      ${hesapHistory.slice().reverse().map(h=>{
        const diff=h.anlasman!=null?(h.anlasman-h.carpim):null;
        const dc=diff==null?'var(--muted)':diff>0?'var(--green)':diff<0?'var(--red)':'var(--muted)';
        const dt=diff==null?'':(diff>0?'+':'')+`₺${Math.abs(diff).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
        const ts=new Date(h.ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
        return `<div class="hesap-hist-row">
          <div>
            <span style="font-family:'IBM Plex Mono',monospace;font-weight:600">${h.kg} kg</span>
            <span style="color:var(--muted);font-size:11px;margin:0 4px">×</span>
            <span style="font-family:'IBM Plex Mono',monospace">₺${h.birimFiyat}</span>
            <span style="color:var(--muted);font-size:11px;margin:0 4px">=</span>
            <span style="font-family:'IBM Plex Mono',monospace;color:#34d399;font-weight:600">₺${h.carpim.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            ${h.anlasman!=null?`<span style="font-size:11px;color:var(--accent);margin-left:7px">→ ₺${fmt(h.anlasman)}</span>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${diff!=null?`<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${dc}">${dt}</div>`:''}
            <div style="font-size:10px;color:var(--muted)">${ts}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`:''}

  </div>`;

  setTimeout(()=>{ document.getElementById('h_kg')?.focus(); },80);
}

function hesapHesapla(){
  const kg=parseFloat(document.getElementById('h_kg')?.value)||0;
  const bp=parseFloat(document.getElementById('h_fiyat')?.value)||0;
  const val=document.getElementById('hesapResultVal');
  const sub=document.getElementById('hesapResultSub');
  if(!val) return;
  if(!kg||!bp){ val.textContent='₺ —'; if(sub) sub.textContent=''; return; }
  const carpim=kg*bp;
  val.classList.remove('anim'); void val.offsetWidth; val.classList.add('anim');
  val.textContent='₺ '+carpim.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(sub) sub.textContent=`${kg} kg  ×  ₺${bp}/kg`;
  hesapFark();
}

function hesapFark(){
  const kg=parseFloat(document.getElementById('h_kg')?.value)||0;
  const bp=parseFloat(document.getElementById('h_fiyat')?.value)||0;
  const an=parseFloat(document.getElementById('h_anlasman')?.value);
  const el=document.getElementById('hesapDiff');
  if(!el) return;
  if(!kg||!bp||isNaN(an)||!an){ el.style.display='none'; return; }
  const carpim=kg*bp;
  const diff=an-carpim;
  const pct=carpim>0?diff/carpim*100:0;
  const dc=diff>0?'var(--green)':diff<0?'var(--red)':'var(--muted)';
  el.style.display='flex';
  el.innerHTML=`
    <div class="hesap-diff-item"><div class="hesap-diff-lbl">Hesaplanan</div>
      <div class="hesap-diff-val" style="color:#34d399">₺${carpim.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
    <div class="hesap-diff-item"><div class="hesap-diff-lbl">Anlaşılan</div>
      <div class="hesap-diff-val" style="color:var(--accent)">₺${fmt(an)}</div></div>
    <div class="hesap-diff-item"><div class="hesap-diff-lbl">Fark</div>
      <div class="hesap-diff-val" style="color:${dc}">${diff>=0?'+':''}₺${Math.abs(diff).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
    <div class="hesap-diff-item"><div class="hesap-diff-lbl">% Fark</div>
      <div class="hesap-diff-val" style="color:${dc}">${pct>=0?'+':''}${pct.toFixed(1)}%</div></div>`;
}

function hesapYuvarla(dir){
  const kg=parseFloat(document.getElementById('h_kg')?.value)||0;
  const bp=parseFloat(document.getElementById('h_fiyat')?.value)||0;
  if(!kg||!bp){ toast('Önce kg ve birim fiyat girin','err'); return; }
  const carpim=kg*bp;
  const yuv=dir===0?Math.round(carpim):dir>0?Math.ceil(carpim/100)*100:Math.floor(carpim/100)*100;
  const inp=document.getElementById('h_anlasman');
  if(inp){ inp.value=yuv; hesapFark(); }
}

function hesapKaydet(){
  const kg=parseFloat(document.getElementById('h_kg')?.value)||0;
  const bp=parseFloat(document.getElementById('h_fiyat')?.value)||0;
  if(!kg||!bp){ toast('Hesaplamak için kg ve birim fiyat girin','err'); return; }
  const carpim=+(kg*bp).toFixed(2);
  const anRaw=parseFloat(document.getElementById('h_anlasman')?.value);
  const anlasman=isNaN(anRaw)?null:anRaw;
  hesapHistory.push({kg,birimFiyat:bp,carpim,anlasman,ts:Date.now()});
  if(hesapHistory.length>30) hesapHistory.shift();
  document.getElementById('h_kg').value='';
  document.getElementById('h_fiyat').value='';
  document.getElementById('h_anlasman').value='';
  renderHesap();
  toast('📋 Geçmişe eklendi','ok');
}




start();