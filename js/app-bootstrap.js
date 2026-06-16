// ══════════════════════════════════════
//  STATE
// ══════════════════════════════════════
let db = null, auth = null, currentUser = null, isAdmin = false;
const LS_LAST_PAGE = 'ld_last_page';
const ADMIN_ONLY_PAGES = new Set(['tienda','inscripciones','arbitros','calendario','resumen','admin-arbitrajes','mercadotecnia']);
const OWNER_EMAILS = ['edanchra@gmail.com','admincanchadigital@gmail.com'];

function canSeedProducts(){
  const inBox = typeof isBoxBusiness === 'function' && isBoxBusiness(currentBusinessId);
  return (isAdmin || isOwner) && !inBox;
}

// Resize handler for mobile tabla
(function(){
  let resizeTimer;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      const mobEl = document.getElementById('tablaBodyMobile');
      const tableEl = document.querySelector('#tablaBody')?.closest('table');
      if(!mobEl || !tableEl) return;
      const isMobile = window.innerWidth <= 640;
      mobEl.style.display = isMobile && mobEl.children.length > 0 ? 'flex' : 'none';
      tableEl.style.display = isMobile ? 'none' : '';
    }, 150);
  });
})();

// Default products
const DEFAULT_PRODUCTS = [
  {emoji:'💧',nombre:'Agua',precio:20,stock:30},
  {emoji:'🍵',nombre:'JazTé',precio:25,stock:20},
  {emoji:'🥭',nombre:'Jumex',precio:15,stock:20},
  {emoji:'💎',nombre:'TopoChico',precio:30,stock:20},
  {emoji:'🧪',nombre:'Suero',precio:30,stock:15},
  {emoji:'🥤',nombre:'CocaCola',precio:30,stock:24},
  {emoji:'⚡',nombre:'Powerade',precio:30,stock:18},
  {emoji:'🍦',nombre:'Pingüino',precio:15,stock:20},
  {emoji:'🍰',nombre:'Gansito',precio:15,stock:20},
  {emoji:'🍪',nombre:'Nito',precio:20,stock:20},
  {emoji:'🍟',nombre:'Sabritas',precio:25,stock:30},
  {emoji:'🥔',nombre:'Viejitas',precio:25,stock:30},
  {emoji:'🍪',nombre:'Galletas',precio:22,stock:20},
  {emoji:'🍿',nombre:'Palomitas',precio:25,stock:20},
  {emoji:'🌶️',nombre:'Gomitas Enchilosas',precio:2,stock:50},
  {emoji:'🥤',nombre:'Popotes',precio:2,stock:50},
  {emoji:'🍬',nombre:'Chicle',precio:2,stock:50},
  {emoji:'👋',nombre:'Cachetadas',precio:2,stock:50},
  {emoji:'🕯️',nombre:'Velitas',precio:2,stock:50},
  {emoji:'🍭',nombre:'Paleta',precio:6,stock:30},
  {emoji:'🍭',nombre:'Paleta Premium',precio:8,stock:30},
  {emoji:'🌰',nombre:'Mazapán',precio:8,stock:30},
  {emoji:'🏳️',nombre:'Banderita',precio:10,stock:20},
  {emoji:'🪅',nombre:'Pirulines',precio:25,stock:15},
  {emoji:'🧦',nombre:'Medias',precio:50,stock:10},
];

function onAuthChange(user){
  if (typeof resetBoxListenersForAuthChange === 'function') resetBoxListenersForAuthChange();
  currentUser = user;
  isOwner = !!(user && OWNER_EMAILS.includes((user.email||'').toLowerCase()));

  if(!user){
    isAdmin = false;
    isOwner = false;
    adminScope = {};
    isCaptain = false;
    captainEquipoKey = null;
    // Hide viewer overlay if visible
    const vp = document.getElementById('viewerProfileOverlay');
    if(vp) vp.style.display = 'none';
    updateAdminUI(false, false, false, null);
    return;
  }

  const uid = user.uid;

  // If registrarUsuario already wrote the profile, skip the DB write here
  if(window._skipAuthWrite) {
    window._skipAuthWrite = false;
    return; // registrarUsuario handles the flow
  }

  const applyUserProfile = (userData = {}) => {
    if (uid && C?.usuarios) C.usuarios[uid] = { ...(C.usuarios[uid] || {}), ...userData, uid };
    const role = isOwner ? 'admin' : (userData.role||'viewer');
    isAdmin = isOwner || (role === 'admin');
    const normalizedScope = normalizeAdminScope(userData.adminScope || {});
    adminScope = isOwner
      ? normalizeAdminScope(buildFullAdminScope())
      : normalizedScope;
    const capFlag = (role === 'captain');
    const capKey  = userData.equipoKey || null;
    updateAdminUI(isAdmin, isOwner, capFlag, capKey);
    if (typeof isBoxBusiness === 'function' && isBoxBusiness(currentBusinessId) && typeof enterBoxBusiness === 'function') {
      setTimeout(() => enterBoxBusiness(), 0);
    }
  };
  if(fs){
    const ref = fs.collection('usuarios').doc(uid);
    ref.get().then(async snap=>{
      if(!snap.exists){
        const nombre = user.displayName || user.email.split('@')[0];
        const data = {
          email: user.email, nombre,
          role: isOwner ? 'admin' : 'viewer',
          adminScope: isOwner ? buildFullAdminScope() : {},
          creadoAt: Date.now(), uid,
          lastLogin: Date.now(),
          creadoEn: firestoreServerTimestamp(),
          actualizadoEn: firestoreServerTimestamp()
        };
        await ref.set(data, { merge:true });
        applyUserProfile(data);
      } else {
        const patch = { lastLogin: Date.now(), actualizadoEn: firestoreServerTimestamp() };
        if(isOwner) patch.role = 'admin';
        await ref.set(patch, { merge:true });
        applyUserProfile({ ...(snap.data() || {}), ...patch });
      }
    }).catch(()=>{ updateAdminUI(false, isOwner, false, null); });
    return;
  }
  db.ref('usuarios/'+uid).once('value').then(snap=>{
    if(!snap.exists()){
      const nombre = user.displayName || user.email.split('@')[0];
      db.ref('usuarios/'+uid).set({
        email: user.email, nombre,
        role: isOwner ? 'admin' : 'viewer',
        adminScope: isOwner ? buildFullAdminScope() : {},
        creadoAt: Date.now(), uid
      }).catch(e => console.warn('DB write failed:', e.code));
    } else {
      db.ref('usuarios/'+uid+'/lastLogin').set(Date.now()).catch(()=>{});
      if(isOwner) db.ref('usuarios/'+uid+'/role').set('admin').catch(()=>{});
    }
    db.ref('usuarios/'+uid).once('value').then(rSnap=>applyUserProfile(rSnap.val() || {})).catch(()=>{ updateAdminUI(false, isOwner, false, null); });
  }).catch(()=>{ updateAdminUI(false, isOwner, false, null); });
}

function updateAdminUI(adminFlag, ownerFlag, captainFlag, capEquipoKey){
  isCaptain = !!captainFlag;
  captainEquipoKey = capEquipoKey || null;
  const canAct = adminFlag || captainFlag;
  const adminBadge = document.getElementById('adminBadge');
  const loginBtn   = document.getElementById('loginBtn');
  const logoutBtn  = document.getElementById('logoutBtn');
  const usersBtn   = document.getElementById('usersBtn');
  const userChip   = document.getElementById('userChip');
  const userChipName = document.getElementById('userChipName');
  if(adminBadge) adminBadge.style.display = canAct?'block':'none';
  if(loginBtn)   loginBtn.style.display   = currentUser ? 'none' : 'block';
  if(logoutBtn)  logoutBtn.style.display  = currentUser ? 'block' : 'none';
  if(usersBtn)   usersBtn.style.display   = ownerFlag?'':'none';
  if(userChip){
    userChip.classList.toggle('show', !!currentUser);
    if(userChipName){
      const label = (currentUser?.displayName || currentUser?.email || 'Conectado').split('@')[0];
      userChipName.textContent = label.slice(0,16);
    }
  }
  // Captain badge
  let capBadgeEl = document.getElementById('captainBadge');
  if(!capBadgeEl && captainFlag && !adminFlag){
    capBadgeEl = document.createElement('span');
    capBadgeEl.id = 'captainBadge';
    capBadgeEl.className = 'captain-badge';
    capBadgeEl.textContent = '⚽ Capitán';
    if(adminBadge && adminBadge.parentNode) adminBadge.parentNode.insertBefore(capBadgeEl, adminBadge.nextSibling);
  }
  if(capBadgeEl) capBadgeEl.style.display = (captainFlag&&!adminFlag)?'':'none';
  // Admin-only elements
  document.querySelectorAll('.admin-only').forEach(x=>{ adminFlag?x.classList.add('show'):x.classList.remove('show'); });
  // Update porteros & copa visibility toggle buttons
  setTimeout(()=>{ updatePorterosPublicUI(); updateCuadroCopaUI(); updateGoleadoresPublicUI(); }, 0);
  const addPartido = document.getElementById('adminAddPartido');
  const addEquipo  = document.getElementById('adminAddEquipo');
  const aTemp      = document.getElementById('adminAddTemporada');
  if(addPartido) addPartido.style.display = adminFlag?'block':'none';
  if(addEquipo)  addEquipo.style.display  = adminFlag?'block':'none';
  if(aTemp)      aTemp.style.display      = adminFlag?'block':'none';
  const catPanel = document.getElementById('adminCatPanel');
  if(catPanel)   catPanel.style.display   = adminFlag?'block':'none';
  const catAddBtn = document.getElementById('catAddBtn');
  if(catAddBtn)  catAddBtn.style.display  = adminFlag?'':'none';
  const tiendaToggleWrap = document.getElementById('adminTiendaToggleWrap');
  if(tiendaToggleWrap) tiendaToggleWrap.style.display = adminFlag ? 'block' : 'none';
  ensureAllowedTournamentAndCat();
  // Always show the tournament selector first when opening the link.
  const saved = appTorneoId(localStorage.getItem('ld_torneo'));
  if(saved && TORNEO_NAMES[saved] && canAccessTorneo(saved)) currentTorneo = saved;
  if(saved && saved !== localStorage.getItem('ld_torneo')) localStorage.setItem('ld_torneo', saved);
  if(saved && !TORNEO_NAMES[saved]) localStorage.removeItem('ld_torneo');
  document.getElementById('splash').style.display='flex';
  document.getElementById('appShell').style.display='none';
  const splashBrandImg = document.querySelector('#splash > div img');
  if(splashBrandImg) splashBrandImg.src = SPLASH_BIG_LOGO;
  hydrateSplashTournamentCards();
}

startFirebaseBoot({
  applyTheme,
  onAuthChange,
  showToast,
  setDb(value){ db = value; },
  setAuth(value){ auth = value; },
  setFs(value){ fs = value; }
});

// ══════════════════════════════════════════════
//  JOIN REQUEST — viewer sends request to a team
// ══════════════════════════════════════════════
function openJoinRequest(){
  const sel = document.getElementById('jr_equipo_sel');
  if(!sel) return;
  const equipos = Object.entries(C.equipos||{})
    .map(([k,e]) => [k, normalizeScopedRecord(e)])
    .filter(([,e])=>e.torneo===currentTorneo)
    .sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||''));
  sel.innerHTML = '<option value="">— Seleccionar equipo —</option>' +
    equipos.map(([k,e])=>`<option value="${k}">${e.nombre} (${CAT_NAMES[e.cat]||e.cat})</option>`).join('');
  openModal('modalJoinRequest');
}

async function sendJoinRequest(){
  const equipoKey = document.getElementById('jr_equipo_sel').value;
  const msg = document.getElementById('jr_mensaje').value.trim();
  if(!equipoKey){ showToast('Selecciona un equipo','ta'); return; }
  if(!currentUser){ showToast('Debes iniciar sesión','ta'); return; }
  const uid = currentUser.uid;
  const userData = C.usuarios[uid]||{};
  // Check if already has pending request
  const existing = Object.values(C.solicitudes||{}).find(s=>s.uid===uid&&s.status==='pending');
  if(existing){ showToast('Ya tienes una solicitud pendiente','ta'); return; }
  const equipo = C.equipos[equipoKey] || {};
  const requestData = scopedPayload({
    uid, nombre:userData.nombre||'', email:userData.email||'',
    equipoKey, equipoNombre:equipo.nombre||'',
    mensaje:msg, status:'pending', fecha:Date.now(),
    torneo: equipo.torneo || currentTorneo,
    cat: equipo.cat || currentCat
  });
  try{
    if(fs) await saveDoc('solicitudes', null, requestData);
    else await db.ref('solicitudes').push(requestData);
    closeModal('modalJoinRequest');
    showToast('Solicitud enviada — el capitán o admin la revisará','tg');
    renderViewerProfile();
  }catch(e){
    showToast('Error: '+e.message,'tr');
  }
}

function renderViewerProfile(){
  const el = document.getElementById('viewerProfile');
  if(!el||!currentUser) return;
  const uid = currentUser.uid;
  // Try from C.usuarios first, then read from DB
  const u = C.usuarios[uid]||{};
  const myReq      = Object.entries(C.solicitudes||{}).find(([,s])=>s.uid===uid&&s.status==='pending');
  const acceptedReq = Object.entries(C.solicitudes||{}).find(([,s])=>s.uid===uid&&s.status==='accepted');
  el.innerHTML = `
    <div style="text-align:center;padding:20px 0 10px">
      <div style="width:60px;height:60px;background:var(--acc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:28px;color:#fff;margin:0 auto 10px">${(u.nombre||'?')[0].toUpperCase()}</div>
      <div style="font-size:16px;font-weight:800">${u.nombre||'Usuario'}</div>
      <div style="font-size:11px;color:var(--muted);font-weight:600">${u.email||''}</div>
      <div style="margin-top:6px"><span style="background:rgba(77,126,245,.12);color:var(--acc);border:1px solid rgba(77,126,245,.3);border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800">👁️ Espectador</span></div>
    </div>
    <div style="background:rgba(77,126,245,.06);border:1px solid rgba(77,126,245,.15);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--muted);font-weight:600;line-height:1.6">
      Tu cuenta está pendiente de asignación de rol por el administrador.
    </div>
    ${myReq?`
    <div style="background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.2);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:800;color:var(--amber);margin-bottom:4px">⏳ Solicitud pendiente</div>
      <div style="font-size:11px;color:var(--muted);font-weight:600">Esperando respuesta de <strong>${myReq[1].equipoNombre}</strong></div>
    </div>`:acceptedReq?`
    <div style="background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.2);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:800;color:#16a34a;margin-bottom:4px">✅ ¡Solicitud aceptada!</div>
      <div style="font-size:11px;color:var(--muted);font-weight:600">Fuiste agregado a <strong>${acceptedReq[1].equipoNombre}</strong></div>
    </div>`:`
    <button class="btn btn-g btn-full" onclick="openJoinRequest()" style="margin-bottom:10px">⚽ Solicitar unirse a un equipo</button>
    <div style="font-size:10px;color:var(--muted);text-align:center;font-weight:600">Solo puedes solicitar unirte a un equipo a la vez</div>`}
    <button class="btn btn-out btn-sm btn-full" onclick="signOut()" style="margin-top:10px">🚪 Cerrar sesión</button>`;
}

async function seedProducts(){
  if (!canSeedProducts()) return;
  try {
    if(fs){
      const snap = await fs.collection('productos').limit(1).get();
      if(!snap.empty) return;
      const batch = fs.batch();
      DEFAULT_PRODUCTS.forEach(p=>{
        batch.set(fs.collection('productos').doc(newDocId('producto', p.nombre)), {
          ...p,
          creadoEn: firestoreServerTimestamp(),
          actualizadoEn: firestoreServerTimestamp()
        }, { merge:true });
      });
      await batch.commit();
      return;
    }
    db.ref('productos').once('value', snap=>{
      if(snap.exists()){
        // Migration: fix any product with broken/light emoji named "Medias"
        snap.forEach(child=>{
          const p = child.val();
          if(p.nombre==='Medias' && (p.emoji==='💡'||p.emoji==='🧦'||!p.emoji)){
            db.ref('productos/'+child.key+'/emoji').set('🧦');
          }
        });
        return;
      }
      DEFAULT_PRODUCTS.forEach(p=>db.ref('productos').push(p));
    });
  } catch (error) {
    console.warn('Seed productos omitido:', error?.code || error?.message || error);
  }
}

async function resetProductos(){
  if(!confirm('¿Resetear productos a la lista oficial de 25 productos? Se eliminarán todos los productos actuales.'))return;
  if(fs){
    const snap = await fs.collection('productos').get();
    const batch = fs.batch();
    snap.forEach(doc=>batch.delete(doc.ref));
    DEFAULT_PRODUCTS.forEach(p=>{
      batch.set(fs.collection('productos').doc(newDocId('producto', p.nombre)), {
        ...p,
        creadoEn: firestoreServerTimestamp(),
        actualizadoEn: firestoreServerTimestamp()
      }, { merge:true });
    });
    await batch.commit();
    showToast('✅ Productos actualizados a la lista oficial','tg');
    return;
  }
  db.ref('productos').remove().then(()=>{
    DEFAULT_PRODUCTS.forEach(p=>db.ref('productos').push(p));
    showToast('✅ Productos actualizados a la lista oficial','tg');
  });
}

const isPageActive = p => document.getElementById('page-'+p)?.classList.contains('active');

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
const scopeTorneoOf = (record) => appTorneoId(record?.torneo || record?.torneoId || 'lombardo_toledano');
const scopeCatOf = (record) => appCatId(record?.cat || record?.categoriaId || 'cat_libre_varonil');
const canReadScopedRecord = (record, useCat = true) => {
  if (!isAdmin || isOwner) return true;
  const torneo = scopeTorneoOf(record);
  const cat = scopeCatOf(record);
  return canAccessTorneo(torneo) && (!useCat || canAccessCat(cat, torneo));
};
const getParts = () => Object.entries(C.partidos).map(([k,v])=>normalizeScopedRecord({ ...v, _key: k }));
const getEqs = () => Object.entries(C.equipos).map(([k,v])=>normalizeScopedRecord({ ...v, _key: k }));
const getProd = () => Object.entries(C.productos).map(([k,v])=>({ ...v, _key: k }));
const getVentas = () => Object.entries(C.ventas).map(([k,v])=>normalizeScopedRecord({ ...v, _key: k })).filter((v)=>canReadScopedRecord(v)).sort((a,b)=>b.ts-a.ts);
const getArbs = () => Object.entries(C.arbitros).map(([k,v])=>({ ...v, _key: k }));
const getInsc = () => Object.entries(C.inscripciones).map(([k,v])=>normalizeScopedRecord({ ...v, _key: k })).filter((v)=>canReadScopedRecord(v));
const fmt = s=>{ const m=Math.floor(s/60),ss=Math.floor(s%60); return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; };
const fmtDate = d=>{ if(!d)return'—'; const dt=new Date(d+'T12:00:00'); const days=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']; const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`; };

const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  return local.toISOString().split('T')[0];
};
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const slugifyBasic = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
// Las integraciones externas deben ejecutarse desde backend/Firebase Functions, no desde GitHub Pages.
async function intentarSincronizarResultado(partidoKey, partido) {
  console.info('[Sync externo deshabilitado] Resultado guardado localmente/Firestore:', partidoKey);
  return { ok: true, skipped: true };
}
function filteredParts(){ return getParts().filter(p => p.torneo===currentTorneo && p.cat===currentCat); }

function getTopScorersData(limit=10){
  const byP={};
  filteredParts().filter(p=>p.status==='terminado').forEach(p=>{
    const goles=p.goles?Object.values(p.goles):[];
    goles.forEach(g=>{
      const team=g.equipo==='local'?(p.localNombre||p.local):(p.visitaNombre||p.visita);
      const key=(g.jugador||'')+'|'+team;
      if(!byP[key]) byP[key]={jugador:g.jugador,equipo:team,goles:0};
      byP[key].goles++;
    });
  });
  return Object.values(byP).sort((a,b)=>b.goles-a.goles||a.jugador.localeCompare(b.jugador)).slice(0,limit);
}

function findEquipoMatchRef(ref, torneo=currentTorneo, cat=currentCat){
  if(!ref) return null;
  return getEqs().find(e=>(e._key===ref||e.nombre===ref)&&(!torneo||e.torneo===torneo)&&(!cat||e.cat===cat))
    || getEqs().find(e=>e._key===ref||e.nombre===ref)
    || null;
}

function resolveMatchGoalkeeperName(partido, side, equipo=null){
  const explicit = side==='local' ? partido.porteroLocal : partido.porteroVisita;
  const fallback = equipo?.portero || '';
  return String(explicit || fallback || '').trim();
}

function getTopGoalkeepersData(limit=10){
  const byKeeper={};
  filteredParts().filter(p=>p.status==='terminado').forEach(p=>{
    const torneo=p.torneo||currentTorneo;
    const cat=p.cat||currentCat;
    const eqL=findEquipoMatchRef(p.local, torneo, cat) || findEquipoMatchRef(p.localNombre, torneo, cat);
    const eqV=findEquipoMatchRef(p.visita, torneo, cat) || findEquipoMatchRef(p.visitaNombre, torneo, cat);
    const teamLocal=p.localNombre||eqL?.nombre||'';
    const teamVisita=p.visitaNombre||eqV?.nombre||'';
    const porteroLocal=resolveMatchGoalkeeperName(p,'local',eqL);
    const porteroVisita=resolveMatchGoalkeeperName(p,'visita',eqV);
    const registerKeeper=(portero,equipo,golesRecibidos)=>{
      const nombre=String(portero||'').trim();
      const team=String(equipo||'').trim();
      if(!nombre||!team) return;
      const key=`${nombre}__${team}`;
      if(!byKeeper[key]){
        byKeeper[key]={
          portero:nombre,
          equipo:team,
          partidos:0,
          golesRecibidos:0,
          porteriasImbatidas:0,
          promedioGC:0,
          score:0,
          equation:''
        };
      }
      byKeeper[key].partidos++;
      byKeeper[key].golesRecibidos+=(Number(golesRecibidos)||0);
      if((Number(golesRecibidos)||0)===0) byKeeper[key].porteriasImbatidas++;
    };
    registerKeeper(porteroLocal,teamLocal,p.gV||0);
    registerKeeper(porteroVisita,teamVisita,p.gL||0);
  });
  return Object.values(byKeeper).map(g=>{
    const promedio=Number((g.golesRecibidos/Math.max(g.partidos,1)).toFixed(2));
    const score=Number(((g.porteriasImbatidas*1000)-(promedio*100)-g.golesRecibidos).toFixed(2));
    return {
      ...g,
      promedioGC:promedio,
      score,
      equation:`(${g.porteriasImbatidas} PI × 1000) - (${promedio.toFixed(2)} GC/PJ × 100) - ${g.golesRecibidos} GC = ${score.toFixed(2)}`
    };
  }).sort((a,b)=>b.score-a.score||b.porteriasImbatidas-a.porteriasImbatidas||a.promedioGC-b.promedioGC||a.golesRecibidos-b.golesRecibidos||b.partidos-a.partidos||a.portero.localeCompare(b.portero)).slice(0,limit);
}

function getMarketingKey(){
  return `${currentTorneo}_${currentCat}`;
}

function getMarketingData(){
  return C.mercadotecnia[getMarketingKey()] || {};
}

function uploadImg(inputId, prevId, lblId, maxPx){
  const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange = e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader(); r.onload=ev=>{
      const img=new Image(); img.onload=()=>{
        const c=document.createElement('canvas'); let w=img.width,h=img.height;
        if(w>h){if(w>maxPx){h=h*maxPx/w;w=maxPx;}}else{if(h>maxPx){w=w*maxPx/h;h=maxPx;}}
        c.width=w;c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
        const data=c.toDataURL('image/jpeg',.65);
        document.getElementById(inputId).value=data;
        const prev=document.getElementById(prevId); prev.src=data; prev.style.display='block';
        document.getElementById(lblId).style.display='none';
      }; img.src=ev.target.result;
    }; r.readAsDataURL(f);
  }; inp.click();
}

// ══════════════════════════════════════
//  REINICIAR ESTADÍSTICAS
// ══════════════════════════════════════
let lastResetBackup = null;

function openResetModal(tipo){
  document.getElementById('reset_tipo').value=tipo;
  const descs={
    ventas:'Eliminar ventas de la Tienda',
    partidos:'Eliminar partidos y resultados',
    inscripciones:'Eliminar abonos de inscripciones',
    arbitrajes:'Reiniciar cobros de arbitraje',
    todo:'Eliminar TODO (ventas, partidos, inscripciones, arbitrajes)'
  };
  document.getElementById('resetModalTitle').textContent=`⚠️ ${descs[tipo]||'Reiniciar'}`;
  document.getElementById('resetModalDesc').textContent=descs[tipo]||'';
  document.getElementById('reset_desde_fecha').value='';
  document.getElementById('reset_hasta_fecha').value='';
  document.getElementById('reset_desde_hora').value='';
  document.getElementById('reset_hasta_hora').value='';
  document.getElementById('resetPreviewInfo').textContent='';
  document.getElementById('undoResetBtn').style.display=lastResetBackup?'block':'none';
  openModal('modalReset');
}

async function confirmarReset(){
  const tipo=document.getElementById('reset_tipo').value;
  const desdeFecha=document.getElementById('reset_desde_fecha').value;
  const hastaFecha=document.getElementById('reset_hasta_fecha').value;
  const desdeHora=document.getElementById('reset_desde_hora').value;
  const hastaHora=document.getElementById('reset_hasta_hora').value;

  const inRango=(ts, fecha)=>{
    if(!desdeFecha&&!hastaFecha) return true;
    if(fecha){
      if(desdeFecha&&fecha<desdeFecha) return false;
      if(hastaFecha&&fecha>hastaFecha) return false;
      return true;
    }
    if(!ts) return true;
    const d=new Date(ts);
    const fStr=d.toISOString().split('T')[0];
    const hStr=d.toTimeString().substring(0,5);
    if(desdeFecha&&fStr<desdeFecha) return false;
    if(hastaFecha&&fStr>hastaFecha) return false;
    if(desdeHora&&hStr<desdeHora) return false;
    if(hastaHora&&hStr>hastaHora) return false;
    return true;
  };

  // Save backup for undo
  lastResetBackup={tipo, data:{}, timestamp:Date.now()};

  const batch={};

  if(tipo==='ventas'||tipo==='todo'){
    getVentas().filter(v=>inRango(v.ts, null)).forEach(v=>{
      lastResetBackup.data[`ventas/${v._key}`]=v;
      batch[`ventas/${v._key}`]=null;
    });
  }
  if(tipo==='partidos'||tipo==='todo'){
    getParts().filter(p=>inRango(p.creadoAt,p.fecha)).forEach(p=>{
      lastResetBackup.data[`partidos/${p._key}`]=p;
      batch[`partidos/${p._key}`]=null;
    });
  }
  if(tipo==='inscripciones'||tipo==='todo'){
    getInsc().forEach(i=>{
      const abonos=i.abonos?Object.entries(i.abonos):[];
      abonos.filter(([,a])=>inRango(a.ts,a.fecha)).forEach(([k,a])=>{
        lastResetBackup.data[`inscripciones/${i._key}/abonos/${k}`]=a;
        batch[`inscripciones/${i._key}/abonos/${k}`]=null;
      });
    });
  }
  if(tipo==='arbitrajes'||tipo==='todo'){
    getParts().filter(p=>inRango(p.creadoAt,p.fecha)).forEach(p=>{
      lastResetBackup.data[`partidos/${p._key}/arbPago`]=p.arbPago||{};
      batch[`partidos/${p._key}/arbPago`]={local:{ef:0,tr:0,pp:0},visita:{ef:0,tr:0,pp:0}};
      batch[`partidos/${p._key}/arbPagado`]=false;
    });
  }

  if(fs){
    const firestoreBatch = fs.batch();
    let count = 0;
    if(tipo==='ventas'||tipo==='todo'){
      getVentas().filter(v=>inRango(v.ts, null)).forEach(v=>{
        lastResetBackup.data[`ventas/${v._key}`]=v;
        firestoreBatch.delete(fs.collection('ventas').doc(v._key));
        count++;
      });
    }
    if(tipo==='partidos'||tipo==='todo'){
      getParts().filter(p=>inRango(p.creadoAt,p.fecha)).forEach(p=>{
        lastResetBackup.data[`partidos/${p._key}`]=p;
        firestoreBatch.delete(fs.collection('partidos').doc(p._key));
        count++;
      });
    }
    if(tipo==='inscripciones'||tipo==='todo'){
      Object.entries(C.pagos || {}).map(([k,v])=>({ ...v, _key:k })).filter(p=>!p.cancelado && inRango(p.ts,p.fecha)).forEach(p=>{
        lastResetBackup.data[`pagos/${p._key}`]=p;
        firestoreBatch.set(fs.collection('pagos').doc(p._key), { cancelado:true, canceladoEn:firestoreServerTimestamp(), actualizadoEn:firestoreServerTimestamp() }, { merge:true });
        count++;
      });
    }
    if(tipo==='arbitrajes'||tipo==='todo'){
      getParts().filter(p=>inRango(p.creadoAt,p.fecha)).forEach(p=>{
        lastResetBackup.data[`partidos/${p._key}/arbPago`]=p.arbPago||{};
        firestoreBatch.set(fs.collection('partidos').doc(p._key), {
          arbPago:{local:{ef:0,tr:0,pp:0},visita:{ef:0,tr:0,pp:0}},
          arbPagado:false,
          actualizadoEn:firestoreServerTimestamp()
        }, { merge:true });
        count++;
      });
    }
    if(!count){showToast('No hay registros en ese rango','ta');return;}
    await firestoreBatch.commit();
    closeModal('modalReset');
    showToast(`✅ ${count} registros eliminados`,'tg');
    document.getElementById('undoResetBtn').style.display='block';
    renderResumen();
    return;
  }
  const count=Object.keys(batch).length;
  if(!count){showToast('No hay registros en ese rango','ta');return;}

  db.ref().update(batch).then(()=>{
    closeModal('modalReset');
    showToast(`✅ ${count} registros eliminados`,'tg');
    document.getElementById('undoResetBtn').style.display='block';
    renderResumen();
  });
}

async function deshacerReset(){
  if(!lastResetBackup){showToast('No hay acción para deshacer','ta');return;}
  if(fs){
    const firestoreBatch = fs.batch();
    Object.entries(lastResetBackup.data).forEach(([path,val])=>{
      const [collection, id, child] = path.split('/');
      if(collection==='partidos' && child==='arbPago'){
        firestoreBatch.set(fs.collection('partidos').doc(id), { arbPago:val, arbPagado:false, actualizadoEn:firestoreServerTimestamp() }, { merge:true });
      }else if(collection && id){
        const payload = collection==='pagos' ? { ...val, cancelado:false, actualizadoEn:firestoreServerTimestamp() } : { ...val, actualizadoEn:firestoreServerTimestamp() };
        firestoreBatch.set(fs.collection(collection).doc(id), payload, { merge:true });
      }
    });
    await firestoreBatch.commit();
    showToast('↩️ Acción deshecha correctamente','tb');
    lastResetBackup=null;
    closeModal('modalReset');
    renderResumen();
    return;
  }
  const batch={};
  Object.entries(lastResetBackup.data).forEach(([path,val])=>{batch[path]=val;});
  db.ref().update(batch).then(()=>{
    showToast('↩️ Acción deshecha correctamente','tb');
    lastResetBackup=null;
    closeModal('modalReset');
    renderResumen();
  });
}

// ══════════════════════════════════════
//  CAMBIAR TORNEO
// ══════════════════════════════════════
function cambiarTorneo(){
  localStorage.removeItem('ld_torneo');
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('splash').style.display = 'flex';
  hydrateSplashTournamentCards();
}

// ═══════════════════════════════════════
//  INCOME CHART
// ═══════════════════════════════════════
function renderAdminFinalissimaPanel(tableData, cupData=null){
  const panel = document.getElementById('adminFinalissimaPanel');
  if(!panel) return;
  if(!isAdmin){ panel.style.display='none'; return; }
  const cup = cupData || buildCupProjectionData(tableData);
  if(!cup){
    panel.style.display='none';
    panel.innerHTML='';
    return;
  }
  panel.style.display='block';
  const marketingMeta = getMarketingData().autoPostsMeta || {};
  const lastSync = marketingMeta.updatedAt
    ? new Date(marketingMeta.updatedAt).toLocaleString('es-MX',{ day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    : 'Pendiente';
  panel.innerHTML = `
    <div class="cup-admin-note">
      <div style="font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:var(--acc2);margin-bottom:8px">🏆 Copa automática</div>
      <div style="font-size:13px;font-weight:700;line-height:1.65;color:var(--text2)">
        El cuadro de copa ahora nace directo de la tabla. Hoy la categoría abriría en <strong>${escapeHtml(cup.stageLabel)}</strong> con <strong>${cup.qualifiedTeams} equipos</strong>${cup.hasByes ? ', respetando byes automáticos para los mejores seeds.' : ' y sin byes porque la llave ya está completa.'}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <span class="cup-summary-chip"><strong>${cup.rounds.length}</strong> rondas</span>
        <span class="cup-summary-chip"><strong>${escapeHtml(cup.leader?.nombre || '—')}</strong> líder actual</span>
        <span class="cup-summary-chip"><strong>${lastSync}</strong> última automatización</span>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════
//  AUTH TABS (login / registro)
// ══════════════════════════════════════════════
function irALogin(){
  document.getElementById('formRegSuccess').style.display='none';
  document.getElementById('formReg').style.display='none';
  document.getElementById('formLogin').style.display='';
  document.getElementById('tabLogin').className='reg-tab active';
  document.getElementById('tabReg').className='reg-tab';
  document.getElementById('lmerr').textContent='';
  // Pre-fill email if they just registered
  const lastEmail = document.getElementById('r_email')?.value;
  if(lastEmail){
    const loginEmail = document.getElementById('l_email');
    if(loginEmail) loginEmail.value = lastEmail;
  }
}

function switchAuthTab(tab){
  const isLogin = tab === 'login';
  document.getElementById('formLogin').style.display    = isLogin ? '' : 'none';
  document.getElementById('formReg').style.display      = isLogin ? 'none' : '';
  const frs = document.getElementById('formRegSuccess');
  if(frs) frs.style.display = 'none';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabReg').classList.toggle('active', !isLogin);
  document.getElementById('lmerr').textContent = '';
}

// ══════════════════════════════════════════════
//  REGISTRO DE USUARIO
// ══════════════════════════════════════════════
function registrarUsuario(){
  try {
    const nombre = (document.getElementById('r_nombre').value||'').trim();
    const email  = (document.getElementById('r_email').value||'').trim();
    const pass   = document.getElementById('r_pass').value||'';
    const pass2  = document.getElementById('r_pass2').value||'';

    // Show error using toast (always visible) + inline div
    const showErr = (msg) => {
      showToast(msg, 'tr');
      const errEl = document.getElementById('lmerr');
      if(errEl){ errEl.textContent = msg; errEl.style.display = 'block'; }
    };

    if(!nombre){ showErr('Ingresa tu nombre completo'); return; }
    if(!email)  { showErr('Ingresa tu correo electrónico'); return; }
    if(pass.length < 6){ showErr('Contraseña debe tener mínimo 6 caracteres'); return; }
    if(pass !== pass2){ showErr('Las contraseñas no coinciden'); return; }

    if(!auth){ showErr('Firebase no está listo — recarga la página'); return; }
    if(!db && !fs)  { showErr('Base de datos no disponible — recarga la página'); return; }

    const btn = document.getElementById('btnRegistrar');
    if(btn){ btn.textContent='Creando cuenta...'; btn.disabled=true; }
    window._skipAuthWrite = true;
    let createdUid = null;

    auth.createUserWithEmailAndPassword(email, pass)
      .then(cred => {
        createdUid = cred.user.uid;
        const data = { email, nombre, role:'viewer', creadoAt:Date.now(), uid:createdUid };
        if(fs) return saveDoc('usuarios', createdUid, data);
        return db.ref('usuarios/'+createdUid).set(data);
      })
      .then(() => auth.signOut())
      .then(() => {
        if(btn){ btn.textContent='Crear cuenta'; btn.disabled=false; }
        window._skipAuthWrite = false;
        ['r_nombre','r_email','r_pass','r_pass2'].forEach(id=>{
          const el=document.getElementById(id); if(el) el.value='';
        });
        const errEl = document.getElementById('lmerr');
        if(errEl){ errEl.textContent=''; errEl.style.display='none'; }
        document.getElementById('formReg').style.display='none';
        document.getElementById('formRegSuccess').style.display='block';
        showToast('¡Cuenta creada exitosamente!','tg');
      })
      .catch(e => {
        if(btn){ btn.textContent='Crear cuenta'; btn.disabled=false; }
        window._skipAuthWrite = false;
        if(createdUid) auth.signOut().catch(()=>{});
        const msgs = {
          'auth/email-already-in-use':'Ese correo ya está registrado',
          'auth/invalid-email':'Correo electrónico inválido',
          'auth/weak-password':'Contraseña muy débil (mínimo 6 caracteres)',
          'auth/operation-not-allowed':'Registro deshabilitado — actívalo en Firebase Console → Authentication',
          'auth/network-request-failed':'Sin conexión — verifica tu internet',
          'PERMISSION_DENIED':'Sin permisos en Firebase — revisa las reglas de la base de datos'
        };
        const msg = msgs[e.code] || ('Error ('+e.code+'): '+e.message);
        showErr(msg);
        console.error('REG ERROR:', e.code, e.message, e);
      });
  } catch(syncErr) {
    console.error('SYNC ERROR in registrarUsuario:', syncErr);
    showToast('Error inesperado: '+syncErr.message, 'tr');
    const btn = document.getElementById('btnRegistrar');
    if(btn){ btn.textContent='Crear cuenta'; btn.disabled=false; }
    window._skipAuthWrite = false;
  }
}

// ══════════════════════════════════════════════
//  PANEL GESTION DE USUARIOS
// ══════════════════════════════════════════════
function renderUsuariosPanel(filter=''){
  const el = document.getElementById('usuariosList');
  if(!el) return;
  let users = Object.values(C.usuarios||{}).sort((a,b)=>(b.creadoAt||0)-(a.creadoAt||0));
  if(filter){
    const q = filter.toLowerCase();
    users = users.filter(u=>(u.nombre||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));
  }
  if(!users.length){
    el.innerHTML='<div class="empty"><span class="empty-icon">👥</span>'+(filter?'Sin resultados':'Sin usuarios registrados')+'</div>';
    return;
  }
  const total = Object.keys(C.usuarios||{}).length;
  el.innerHTML = `<div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">${total} usuario${total!==1?'s':''} registrado${total!==1?'s':''}${filter?' · '+users.length+' resultado'+( users.length!==1?'s':''):''}</div>`+
  users.map(u=>{
    const isOwnerU = OWNER_EMAILS.includes((u.email||'').toLowerCase());
    const initials = (u.nombre||u.email||'?')[0].toUpperCase();
    const fecha = u.creadoAt ? new Date(u.creadoAt).toLocaleDateString('es-MX') : '—';
    const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('es-MX') : null;
    const roleBadgeClass = isOwnerU?'role-owner':u.role==='admin'?'role-admin':u.role==='captain'?'role-captain':'role-viewer';
    const roleLabel = isOwnerU?'👑 Owner':u.role==='admin'?'⚙️ Admin':u.role==='captain'?'⚽ Capitán':'👁️ Espectador';
    const equipoNombre = u.equipoKey && C.equipos[u.equipoKey] ? C.equipos[u.equipoKey].nombre : '';
    const scopeLabel = formatUserAdminScope(u.adminScope);
    const boxRoleLabel = getBoxRoleLabel(u.businessRoles?.[BOX_LOMBARDO_BUSINESS_ID]?.role || '');
    const actionBtns = isOwnerU ? '' : `
      <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;margin-top:6px">
        ${isOwner ? `<button class="btn btn-g btn-sm" onclick="openSetAdmin('${u.uid}')">Permisos</button>` : ''}
        ${isOwner && u.role!=='captain' ? `<button class="btn btn-sm" style="background:rgba(16,185,129,.12);color:#059669;border:1px solid rgba(16,185,129,.25);border-radius:7px;padding:4px 8px;cursor:pointer;font-size:10px;font-weight:800" onclick="openSetCaptain('${u.uid}')">⚽ Capitán</button>` : ''}
        ${isOwner && u.role!=='viewer' ? `<button class="btn btn-out btn-sm" onclick="setUserRole('${u.uid}','viewer')">Quitar rol</button>` : ''}
      </div>`;
    return `<div class="user-row" style="flex-wrap:wrap;align-items:flex-start">
      <div class="user-avatar" style="margin-top:2px">${initials}</div>
      <div class="user-info" style="min-width:0;flex:1">
        <div class="user-email">${u.nombre||'Sin nombre'}</div>
        <div class="user-meta">${u.email||'—'}</div>
        <div class="user-meta" style="margin-top:2px">Registro: ${fecha}${lastLogin?' · Último acceso: '+lastLogin:''}${equipoNombre?' · Equipo: '+equipoNombre:''}</div>
        ${u.role==='admin' && scopeLabel ? `<div class="user-meta" style="margin-top:2px;color:var(--acc);font-weight:800">Permisos: ${scopeLabel}</div>` : ''}
        ${boxRoleLabel ? `<div class="user-meta" style="margin-top:2px;color:#92400e;font-weight:800">Shark Boxing Gym: ${boxRoleLabel}</div>` : ''}
        <div style="margin-top:4px"><span class="role-badge ${roleBadgeClass}">${roleLabel}</span></div>
        ${actionBtns}
      </div>
    </div>`;
  }).join('');
}

function filterUsuarios(q){
  renderUsuariosPanel(q);
}

async function setUserRole(uid, role){
  if(!isOwner){
    showToast('Solo el propietario puede modificar roles','tr');
    return;
  }
  const updates = { role };
  if(role === 'viewer'){
    updates.equipoKey = null;
    updates.adminScope = null;
    updates.businessRoles = null;
  }
  try{
    if(fs) await updateDoc('usuarios', uid, updates);
    else await db.ref('usuarios/'+uid).update(updates);
    showToast(role==='admin'?'✅ Usuario promovido a Admin':'Usuario cambiado a Espectador','tg');
    renderUsuariosPanel();
  }catch(e){
    showToast('Error: '+e.message,'tr');
  }
}

function formatUserAdminScope(scopeRaw){
  const scope = normalizeAdminScope(scopeRaw || {});
  const chunks = Object.entries(scope).map(([torneo, cats])=>{
    const torneoName = TORNEO_NAMES[torneo] || torneo;
    const catNames = (cats || []).map((cat)=>DEFAULT_TOURNAMENT_CATEGORY_LABELS[cat] || cat).join(', ');
    return `${torneoName}${catNames ? ' · ' + catNames : ''}`;
  });
  return chunks.join(' | ');
}

function getBoxRoleLabel(role){
  return ({
    owner: 'Dueño del box',
    box_admin: 'Admin del box',
    trainer: 'Entrenador',
    auditor: 'Auditor'
  })[role] || '';
}

function ensureAdminPermissionsBoxRoleControl(){
  const wrap = document.getElementById('sa_cat_list');
  if(!wrap || document.getElementById('sa_box_role')) return;
  const holder = document.createElement('div');
  holder.className = 'fg';
  holder.innerHTML = `
    <label class="fl">Rol en Shark Boxing Gym</label>
    <select class="fi" id="sa_box_role">
      <option value="">Sin acceso al box</option>
      <option value="owner">Dueño / encargado</option>
      <option value="box_admin">Administrador del box</option>
      <option value="trainer">Entrenador</option>
      <option value="auditor">Auditor</option>
    </select>`;
  wrap.parentNode.insertBefore(holder, wrap);
}

function openSetAdmin(uid){
  if(!isOwner){
    showToast('Solo el propietario puede asignar administradores','tr');
    return;
  }
  const u = C.usuarios[uid]; if(!u) return;
  document.getElementById('sa_uid').value = uid;
  const info = document.getElementById('sa_user_info');
  if(info) info.textContent = (u.nombre||u.email) + ' · ' + (u.email||'');
  const help = info?.nextElementSibling;
  if(help) help.textContent = 'Solo el propietario puede asignar permisos. Marca todos los torneos, categorias y accesos del box que este usuario podra gestionar.';
  ensureAdminPermissionsBoxRoleControl();
  const boxRole = u.businessRoles?.[BOX_LOMBARDO_BUSINESS_ID]?.role || '';
  const boxRoleSelect = document.getElementById('sa_box_role');
  if(boxRoleSelect) boxRoleSelect.value = boxRole;
  const sel = document.getElementById('sa_torneo');
  if(sel) sel.closest('.fg').style.display = 'none';
  renderAdminCatPermissions();
  openModal('modalSetAdmin');
}

function renderAdminCatPermissions(){
  const uid = document.getElementById('sa_uid')?.value;
  const u = uid ? C.usuarios[uid] : null;
  const saved = normalizeAdminScope(u?.adminScope || {});
  const wrap = document.getElementById('sa_cat_list');
  if(!wrap) return;
  wrap.style.display = 'grid';
  wrap.style.gap = '10px';
  wrap.innerHTML = TOURNAMENT_OPTION_ORDER.map((torneo)=>{
    const cats = TORNEO_CONFIG[torneo]?.categories || [];
    const selected = saved[torneo] || [];
    return `<section class="admin-scope-card" data-admin-scope-torneo="${torneo}">
      <div class="admin-scope-head">
        <strong>${TORNEO_NAMES[torneo] || torneo}</strong>
        <button type="button" class="btn btn-out btn-sm" onclick="toggleAdminScopeTournament('${torneo}', true)">Todo</button>
        <button type="button" class="btn btn-out btn-sm" onclick="toggleAdminScopeTournament('${torneo}', false)">Nada</button>
      </div>
      <div class="admin-scope-cats">
        ${cats.map((cat)=>`
          <label class="resumen-cat-check">
            <input type="checkbox" data-admin-scope-cat="${cat.key}" ${selected.includes(cat.key)?'checked':''}/>
            <span>${cat.label}</span>
          </label>`).join('')}
      </div>
    </section>`;
  }).join('');
}

function toggleAdminScopeTournament(torneo, checked){
  document
    .querySelectorAll(`[data-admin-scope-torneo="${torneo}"] input[data-admin-scope-cat]`)
    .forEach((input)=>{ input.checked = !!checked; });
}

function collectAdminScopeFromModal(){
  const scope = {};
  document.querySelectorAll('[data-admin-scope-torneo]').forEach((section)=>{
    const torneo = section.getAttribute('data-admin-scope-torneo');
    const cats = Array.from(section.querySelectorAll('input[data-admin-scope-cat]:checked')).map((input)=>input.getAttribute('data-admin-scope-cat'));
    if(cats.length) scope[torneo] = catsToPermissionMap(cats);
  });
  return scope;
}

async function saveAdminRole(){
  if(!isOwner){
    showToast('Solo el propietario puede guardar estos permisos','tr');
    return;
  }
  const uid = document.getElementById('sa_uid').value;
  const adminScopePatch = collectAdminScopeFromModal();
  const boxRole = document.getElementById('sa_box_role')?.value || '';
  if(!uid){
    showToast('Selecciona usuario','ta');
    return;
  }
  if(!Object.keys(adminScopePatch).length && !boxRole){
    showToast('Selecciona al menos un permiso de torneo o rol de box','ta');
    return;
  }
  try{
    const patch = {
      role: Object.keys(adminScopePatch).length ? 'admin' : 'viewer',
      equipoKey:null,
      adminScope: Object.keys(adminScopePatch).length ? adminScopePatch : firebase.firestore.FieldValue.delete()
    };
    patch[`businessRoles.${BOX_LOMBARDO_BUSINESS_ID}`] = boxRole
      ? { role: boxRole, assignedAt: firestoreServerTimestamp(), assignedBy: currentUser.uid }
      : firebase.firestore.FieldValue.delete();
    if(fs) await updateDoc('usuarios', uid, patch);
    else await db.ref('usuarios/'+uid).update(patch);
    closeModal('modalSetAdmin');
    showToast('Permisos guardados','tg');
    renderUsuariosPanel();
  }catch(e){
    showToast('Error: '+e.message,'tr');
  }
}

// ══════════════════════════════════════════════
//  CAPTAIN MANAGEMENT
// ══════════════════════════════════════════════
function openSetCaptain(uid){
  if(!isOwner){
    showToast('Solo el propietario puede asignar capitanes','tr');
    return;
  }
  const u = C.usuarios[uid]; if(!u) return;
  document.getElementById('sc_uid').value = uid;
  const info = document.getElementById('sc_user_info');
  if(info) info.textContent = (u.nombre||u.email) + ' · ' + (u.email||'');
  // Populate equipo selector
  const sel = document.getElementById('sc_equipo');
  if(sel){
    const equipos = Object.entries(C.equipos||{})
      .map(([k,e]) => [k, normalizeScopedRecord(e)])
      .filter(([,e])=>e.torneo===currentTorneo && e.cat===currentCat && (!isAdmin || isOwner || (canAccessTorneo(e.torneo) && canAccessCat(e.cat, e.torneo))))
      .sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||''));
    sel.innerHTML = '<option value="">— Seleccionar equipo —</option>' +
      equipos.map(([k,e])=>`<option value="${k}" ${u.equipoKey===k?'selected':''}>${e.nombre}</option>`).join('');
  }
  openModal('modalSetCaptain');
}

async function saveCaptain(){
  if(!isOwner){
    showToast('Solo el propietario puede guardar roles','tr');
    return;
  }
  const uid = document.getElementById('sc_uid').value;
  const equipoKey = document.getElementById('sc_equipo').value;
  if(!uid || !equipoKey){ showToast('Selecciona un equipo','ta'); return; }
  const usuario = C.usuarios[uid];
  if(!isOwner && usuario?.role !== 'viewer' && usuario?.role !== 'captain'){
    showToast('Solo puedes asignar capitanes a usuarios normales','tr');
    return;
  }
  const equipo = C.equipos[equipoKey];
  if(!equipo || (isAdmin && !isOwner && (!canAccessTorneo(equipo.torneo) || !canAccessCat(equipo.cat, equipo.torneo)))){
    showToast('No tienes permiso para ese equipo','tr');
    return;
  }
  try{
    const patch = { role:'captain', equipoKey, adminScope:null };
    if(fs) await updateDoc('usuarios', uid, patch);
    else await db.ref('usuarios/'+uid).update(patch);
    showToast('⚽ Capitán asignado','tg');
    closeModal('modalSetCaptain');
    renderUsuariosPanel();
  }catch(e){
    showToast('Error: '+e.message,'tr');
  }
}


// ══════════════════════════════════════════════
//  SOLICITUDES — accept/reject
// ══════════════════════════════════════════════
async function aceptarSolicitud(solId, equipoKey){
  const sol = C.solicitudes[solId]; if(!sol) return;
  const e = C.equipos[equipoKey]; if(!e) return;
  const aline = [...(e.alineacion||[])];
  if(!aline.includes(sol.nombre)) aline.push(sol.nombre);
  try{
    if(fs){
      const batch = fs.batch();
      batch.set(fs.collection('solicitudes').doc(solId), { status:'accepted', actualizadoEn:firestoreServerTimestamp() }, { merge:true });
      batch.set(fs.collection('equipos').doc(equipoKey), { alineacion:aline, actualizadoEn:firestoreServerTimestamp() }, { merge:true });
      if(sol.uid) batch.set(fs.collection('usuarios').doc(sol.uid), { equipoKey, actualizadoEn:firestoreServerTimestamp() }, { merge:true });
      await batch.commit();
    }else{
      const updates = {};
      updates['solicitudes/'+solId+'/status'] = 'accepted';
      updates['equipos/'+equipoKey+'/alineacion'] = aline;
      if(sol.uid) updates['usuarios/'+sol.uid+'/equipoKey'] = equipoKey;
      await db.ref().update(updates);
    }
    showToast(sol.nombre+' agregado al equipo ✅','tg');
  }catch(e){
    showToast('Error: '+e.message,'tr');
  }
}

async function rechazarSolicitud(solId){
  try{
    if(fs) await updateDoc('solicitudes', solId, { status:'rejected' });
    else await db.ref('solicitudes/'+solId+'/status').set('rejected');
    showToast('Solicitud rechazada','ta');
  }catch(e){
    showToast('Error: '+e.message,'tr');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (typeof normalizeStoredState === 'function') normalizeStoredState();
  if (typeof syncFixedSelectors === 'function') syncFixedSelectors();
});
