let currentTorneo = 'lombardo_toledano';
let currentCat = 'cat_libre_varonil';
let fs = null;
let activePartidoKey = null;
let pendingGolSide = null;
let payMethods = { local: null, visita: null };
let cart = [];
const timers = {};
let isOwner = false;
let isCaptain = false;
let captainEquipoKey = null;
let adminScope = {};
let tiendaEnabled = true;
let visualShareState = null;
const visualShareOptions = { showTablaStats: false };
let visualShareBusy = false;
let marketingPostsCache = {};
const marketingAutoSyncState = { timer: null, signatures: {} };
const C = {
  equipos: {},
  partidos: {},
  productos: {},
  ventas: {},
  arbitros: {},
  inscripciones: {},
  pagos: {},
  trabajadores: {},
  gastosTrab: {},
  gastosTienda: {},
  turnos: {},
  usuarios: {},
  solicitudes: {},
  mercadotecnia: {},
  temporadas: {},
  categorias: {},
  usuarios_autorizados: {},
  bot_sessions: {}
};
const CAT_NAMES = { cat_libre_varonil: 'CATEGORIA LIBRE VARONIL', cat_libre_femenil: 'CATEGORIA LIBRE FEMENIL' };
let catOrderKeys = applyTournamentCatalogToCategoryMap(CAT_NAMES);
const CANCHAS = ['Cancha Principal'];
const ORGANIZER_NAME = 'Jesus "Navo"';
const ORGANIZER_PHONE = '667 452 5663';

const FIRESTORE_TORNEO_TO_APP = {
  torneo_lombardo_2026: 'lombardo_toledano',
  lombardo_toledano: 'lombardo_toledano',
  villa: 'lombardo_toledano',
  torneo_nuevos_valores_2026: 'nuevos_valores',
  nuevos_valores: 'nuevos_valores'
};

const APP_TORNEO_TO_FIRESTORE = {
  lombardo_toledano: 'torneo_lombardo_2026',
  villa: 'torneo_lombardo_2026',
  nuevos_valores: 'torneo_nuevos_valores_2026'
};

const FIRESTORE_CAT_TO_APP = {
  cat_libre_varonil_lombardo: 'cat_libre_varonil',
  cat_libre_varonil: 'cat_libre_varonil',
  liga_alta: 'cat_libre_varonil',
  liga_media: 'cat_libre_varonil',
  liga_baja_a: 'cat_libre_varonil',
  liga_baja_b: 'cat_libre_varonil',
  cat_libre_femenil_lombardo: 'cat_libre_femenil',
  cat_libre_femenil: 'cat_libre_femenil',
  cat_infantil: 'cat_infantil',
  cat_osos: 'cat_osos',
  cat_juvenil_a: 'cat_juvenil',
  cat_juvenil_b: 'cat_juvenil',
  cat_juvenil: 'cat_juvenil'
};

const APP_CAT_TO_FIRESTORE = {
  cat_libre_varonil: 'cat_libre_varonil_lombardo',
  liga_alta: 'cat_libre_varonil_lombardo',
  liga_media: 'cat_libre_varonil_lombardo',
  liga_baja_a: 'cat_libre_varonil_lombardo',
  liga_baja_b: 'cat_libre_varonil_lombardo',
  cat_libre_femenil: 'cat_libre_femenil_lombardo',
  cat_infantil: 'cat_infantil',
  cat_osos: 'cat_osos',
  cat_juvenil: 'cat_juvenil'
};

function appTorneoId(id) {
  return FIRESTORE_TORNEO_TO_APP[id] || id || 'lombardo_toledano';
}

function appCatId(id) {
  return FIRESTORE_CAT_TO_APP[id] || id || 'cat_libre_varonil';
}

function firestoreTorneoId(id) {
  return APP_TORNEO_TO_FIRESTORE[id] || id || 'torneo_lombardo_2026';
}

function firestoreCatId(id) {
  return APP_CAT_TO_FIRESTORE[id] || id || 'cat_libre_varonil_lombardo';
}

function normalizeScopedRecord(record = {}) {
  const torneo = appTorneoId(record.torneo || record.torneoId || currentTorneo || 'lombardo_toledano');
  const cat = appCatId(record.cat || record.categoriaId || currentCat || 'cat_libre_varonil');
  return {
    ...record,
    torneo,
    cat,
    torneoId: record.torneoId || firestoreTorneoId(torneo),
    categoriaId: record.categoriaId || firestoreCatId(cat),
    seasonId: record.seasonId || record.temporadaId || ''
  };
}

function normalizeStoredState() {
  const storedTorneo = localStorage.getItem('ld_torneo');
  const normalizedTorneo = appTorneoId(storedTorneo);
  if (storedTorneo && normalizedTorneo !== storedTorneo) {
    localStorage.setItem('ld_torneo', normalizedTorneo);
  }

  const legacyCatMap = {
    liga_alta: 'cat_libre_varonil',
    liga_media: 'cat_libre_varonil',
    liga_baja_a: 'cat_libre_varonil',
    liga_baja_b: 'cat_libre_varonil',
    cat_juvenil_a: 'cat_juvenil',
    cat_juvenil_b: 'cat_juvenil'
  };
  const storedCat = localStorage.getItem('ld_cat');
  if (storedCat && legacyCatMap[storedCat]) {
    localStorage.setItem('ld_cat', legacyCatMap[storedCat]);
  }

  const keyMigrations = [
    ['ld_copa_public_villa_liga_alta', 'ld_copa_public_lombardo_toledano_cat_libre_varonil'],
    ['ld_goleadores_public_villa_liga_alta', 'ld_goleadores_public_lombardo_toledano_cat_libre_varonil'],
    ['ld_porteros_public_villa_liga_alta', 'ld_porteros_public_lombardo_toledano_cat_libre_varonil'],
    ['ld_cats_villa', 'ld_cats_lombardo_toledano'],
    ['ld_cats_order_villa', 'ld_cats_order_lombardo_toledano']
  ];
  keyMigrations.forEach(([oldKey, newKey]) => {
    const value = localStorage.getItem(oldKey);
    if (value !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
    if (value !== null) localStorage.removeItem(oldKey);
  });

  const legacyCatKeys = new Set(['liga_alta', 'liga_media', 'liga_baja_a', 'liga_baja_b', 'cat_juvenil_a', 'cat_juvenil_b']);
  ['lombardo_toledano', 'nuevos_valores'].forEach((torneo) => {
    try {
      const catsKey = 'ld_cats_' + torneo;
      const cats = JSON.parse(localStorage.getItem(catsKey) || 'null');
      if (cats && typeof cats === 'object') {
        legacyCatKeys.forEach((key) => delete cats[key]);
        localStorage.setItem(catsKey, JSON.stringify(cats));
      }
      const orderKey = 'ld_cats_order_' + torneo;
      const order = JSON.parse(localStorage.getItem(orderKey) || 'null');
      if (Array.isArray(order)) {
        localStorage.setItem(orderKey, JSON.stringify(order
          .map((key) => legacyCatMap[key] || key)
          .filter((key, index, arr) => !legacyCatKeys.has(key) && arr.indexOf(key) === index)));
      }
    } catch (_err) {}
  });
}

function slugifyId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function clearObj(obj) {
  Object.keys(obj || {}).forEach((key) => delete obj[key]);
}

function firestoreServerTimestamp() {
  return firebase?.firestore?.FieldValue?.serverTimestamp
    ? firebase.firestore.FieldValue.serverTimestamp()
    : Date.now();
}

function collectionRef(name) {
  if (!fs) return null;
  return fs.collection(name);
}

function newDocId(prefix, base) {
  const clean = slugifyId(base || '');
  return `${prefix}_${clean || Date.now()}`;
}

async function saveDoc(collection, id, data) {
  if (!fs) throw new Error('Firestore no disponible');
  const payload = {
    ...data,
    actualizadoEn: firestoreServerTimestamp()
  };
  if (!id) {
    const ref = await fs.collection(collection).add({
      ...payload,
      creadoEn: firestoreServerTimestamp()
    });
    return ref.id;
  }
  const ref = fs.collection(collection).doc(id);
  const snap = await ref.get();
  await ref.set({
    ...payload,
    ...(snap.exists ? {} : { creadoEn: firestoreServerTimestamp() })
  }, { merge: true });
  return id;
}

async function deleteDoc(collection, id) {
  if (!fs) throw new Error('Firestore no disponible');
  await fs.collection(collection).doc(id).delete();
}

async function updateDoc(collection, id, data) {
  if (!fs) throw new Error('Firestore no disponible');
  await fs.collection(collection).doc(id).update({
    ...data,
    actualizadoEn: firestoreServerTimestamp()
  });
}

function scopedPayload(data = {}) {
  const scoped = normalizeScopedRecord(data);
  const activeSeason = getActiveSeason(scoped.torneo, scoped.cat);
  const seasonId = data.seasonId || data.temporadaId || activeSeason?.seasonId || activeSeason?._key || '';
  return {
    ...data,
    torneo: scoped.torneo,
    cat: scoped.cat,
    torneoId: scoped.torneoId,
    categoriaId: scoped.categoriaId,
    ...(seasonId ? { seasonId } : {})
  };
}

function getActiveSeason(torneo = currentTorneo, cat = currentCat) {
  const normalizedTorneo = appTorneoId(torneo);
  const normalizedCat = appCatId(cat);
  return Object.entries(C.temporadas || {})
    .map(([key, value]) => normalizeScopedRecord({ ...value, _key: key }))
    .filter((season) => {
      if (season.estado !== 'active') return false;
      if (season.torneo !== normalizedTorneo) return false;
      const cats = Array.isArray(season.categorias) ? season.categorias.map(appCatId) : [season.cat].filter(Boolean);
      return !cats.length || cats.includes(normalizedCat);
    })
    .sort((a, b) => (b.createdAtMs || b.ts || b.inicioMs || 0) - (a.createdAtMs || a.ts || a.inicioMs || 0))[0] || null;
}

function getActiveSeasonId(torneo = currentTorneo, cat = currentCat) {
  const season = getActiveSeason(torneo, cat);
  return season ? (season.seasonId || season._key) : '';
}

function recordMatchesActiveSeason(record = {}, torneo = currentTorneo, cat = currentCat) {
  const activeSeasonId = getActiveSeasonId(torneo, cat);
  if (!activeSeasonId) return true;
  const recordSeasonId = record.seasonId || record.temporadaId || '';
  return recordSeasonId === activeSeasonId;
}

function normalizeLookupText(value) {
  return slugifyId(value || '');
}

function getTournamentCatKeys(torneo = currentTorneo) {
  const configCats = TORNEO_CONFIG?.[appTorneoId(torneo)]?.categories || [];
  if (configCats.length) return configCats.map((cat) => cat.key);
  return (catOrderKeys || []).filter((key) => CAT_NAMES[key]);
}

function findEquipoForInscripcion(inscripcion = {}) {
  const equipoKey = inscripcion.equipoId || inscripcion.equipoKey;
  if (equipoKey && C.equipos?.[equipoKey]) return { key: equipoKey, data: C.equipos[equipoKey] };

  const torneo = appTorneoId(inscripcion.torneo || inscripcion.torneoId || currentTorneo);
  const cat = appCatId(inscripcion.cat || inscripcion.categoriaId || currentCat);
  const name = normalizeLookupText(inscripcion.equipoNombre || inscripcion.nombre);
  if (!name) return null;

  const found = Object.entries(C.equipos || {}).find(([, equipo]) => (
    appTorneoId(equipo.torneo || equipo.torneoId || currentTorneo) === torneo &&
    appCatId(equipo.cat || equipo.categoriaId || currentCat) === cat &&
    normalizeLookupText(equipo.nombre) === name
  ));
  return found ? { key: found[0], data: found[1] } : null;
}

function findInscripcionForEquipo(equipoKey, equipo = {}, torneoArg, catArg) {
  const torneo = appTorneoId(torneoArg || equipo.torneo || equipo.torneoId || currentTorneo);
  const cat = appCatId(catArg || equipo.cat || equipo.categoriaId || currentCat);
  const name = normalizeLookupText(equipo.nombre);
  const found = Object.entries(C.inscripciones || {}).find(([, inscripcion]) => {
    const inscTorneo = appTorneoId(inscripcion.torneo || inscripcion.torneoId || currentTorneo);
    const inscCat = appCatId(inscripcion.cat || inscripcion.categoriaId || currentCat);
    if (inscTorneo !== torneo || inscCat !== cat) return false;
    if (equipoKey && (inscripcion.equipoId === equipoKey || inscripcion.equipoKey === equipoKey)) return true;
    return name && normalizeLookupText(inscripcion.equipoNombre || inscripcion.nombre) === name;
  });
  return found ? { key: found[0], data: found[1] } : null;
}

function normalizeAdminScope(rawScope) {
  if (!rawScope || typeof rawScope !== 'object') return {};
  const scope = {};
  Object.entries(rawScope).forEach(([torneo, cats]) => {
    const normalizedTorneo = appTorneoId(({ lombardo: 'lombardo_toledano' }[torneo]) || torneo);
    if (!TORNEO_NAMES[normalizedTorneo]) return;
    const list = Array.isArray(cats) ? cats : Object.keys(cats || {});
    scope[normalizedTorneo] = list
      .map((cat) => appCatId(cat))
      .filter((cat) => typeof cat === 'string');
  });
  return scope;
}

function catsToPermissionMap(cats = []) {
  return Object.fromEntries(cats.filter(Boolean).map((cat) => [appCatId(cat), true]));
}

function buildFullAdminScope() {
  return Object.fromEntries(
    TOURNAMENT_OPTION_ORDER.map((torneo) => [
      torneo,
      catsToPermissionMap((TORNEO_CONFIG[torneo]?.categories || []).map((cat) => cat.key))
    ])
  );
}

function buildSingleAdminScope(torneo, cats = []) {
  return { [appTorneoId(torneo)]: catsToPermissionMap(cats) };
}

function hasAdminSession() {
  return typeof isAdmin !== 'undefined' && !!isAdmin;
}

function getAllowedTorneos() {
  return [...TOURNAMENT_OPTION_ORDER];
}

function getManagedTorneos() {
  if (isOwner || !hasAdminSession()) return [...TOURNAMENT_OPTION_ORDER];
  const allowed = Object.keys(adminScope || {}).filter((key) => TORNEO_NAMES[key]);
  return allowed.length ? allowed : [];
}

function getAllowedCats(torneo = currentTorneo) {
  const normalizedTorneo = appTorneoId(torneo);
  const cfgCats = (TORNEO_CONFIG[normalizedTorneo]?.categories || []).map((cat) => cat.key);
  return cfgCats;
}

function getManagedCats(torneo = currentTorneo) {
  const normalizedTorneo = appTorneoId(torneo);
  const cfgCats = (TORNEO_CONFIG[normalizedTorneo]?.categories || []).map((cat) => cat.key);
  if (isOwner || !hasAdminSession()) return cfgCats;
  const allowed = adminScope?.[normalizedTorneo] || [];
  return allowed.length ? cfgCats.filter((cat) => allowed.includes(cat)) : [];
}

function canAccessTorneo(torneo) {
  const normalizedTorneo = appTorneoId(torneo);
  return !hasAdminSession() || isOwner || getManagedTorneos().includes(normalizedTorneo);
}

function canAccessCat(cat, torneo = currentTorneo) {
  const normalizedTorneo = appTorneoId(torneo);
  const normalizedCat = appCatId(cat);
  return !hasAdminSession() || isOwner || getManagedCats(normalizedTorneo).includes(normalizedCat);
}

function ensureAllowedTournamentAndCat() {
  if (!TORNEO_NAMES[currentTorneo]) currentTorneo = TOURNAMENT_OPTION_ORDER[0] || 'lombardo_toledano';
  const visibleCats = getAllowedCats(currentTorneo);
  if (visibleCats.length && !visibleCats.includes(currentCat)) currentCat = visibleCats[0];
}

const splashMainLogoOnLoad = document.querySelector('#splash > div img');
if (splashMainLogoOnLoad) splashMainLogoOnLoad.src = SPLASH_BIG_LOGO;
const hdrBrandLogoOnLoad = document.querySelector('.hdr-shield img');
if (hdrBrandLogoOnLoad) hdrBrandLogoOnLoad.src = CD_LOGO_SHIELD;
normalizeStoredState();
ensureSplashTournamentCardsReady();

function selectTorneo(t) {
  t = appTorneoId(t);
  if (typeof restoreTournamentNav === 'function') restoreTournamentNav();
  currentTorneo = TORNEO_NAMES[t] ? t : 'lombardo_toledano';
  localStorage.setItem('ld_torneo', currentTorneo);
  loadCustomCats();
  ensureAllowedTournamentAndCat();
  if (!CAT_NAMES[currentCat]) currentCat = catOrderKeys[0] || currentCat;
  document.getElementById('splash').style.display = 'none';
  launchApp();
}

function syncFixedSelectors() {
  const torneoIds = ['gen_torneo', 'mp_torneo', 'eq_torneo', 'ie_torneo', 'temp_torneo', 'rc_torneo'];
  const torneoOptions = getAllowedTorneos()
    .filter((key) => TORNEO_NAMES[key])
    .map((key) => `<option value="${key}">${TORNEO_NAMES[key]}</option>`)
    .join('');

  torneoIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = torneoOptions;
    el.value = TORNEO_NAMES[currentTorneo] ? currentTorneo : (getAllowedTorneos()[0] || currentTorneo);
  });

  const catIds = ['gen_cat', 'mp_cat', 'eq_cat', 'ie_cat', 'rc_cat'];
  const catOptions = catOrderKeys
    .filter((key) => CAT_NAMES[key])
    .map((key) => `<option value="${key}">${CAT_NAMES[key]}</option>`)
    .join('');

  catIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = catOptions;
    if (prev && CAT_NAMES[prev]) el.value = prev;
    else el.value = currentCat;
  });
}

function getTiendaToggleKey() {
  return 'ld_tienda_enabled_' + currentTorneo;
}

function applyTiendaVisibility() {
  const nav = document.getElementById('navTienda');
  const page = document.getElementById('page-tienda');
  if (nav) nav.style.display = tiendaEnabled ? '' : 'none';
  if (page) page.style.display = tiendaEnabled ? '' : 'none';
  const tg = document.getElementById('adminTiendaToggle');
  if (tg) tg.checked = !!tiendaEnabled;
}

function loadTiendaToggle() {
  const raw = localStorage.getItem(getTiendaToggleKey());
  tiendaEnabled = raw === null ? true : raw === '1';
  applyTiendaVisibility();
}

function toggleTiendaSection(enabled) {
  tiendaEnabled = !!enabled;
  localStorage.setItem(getTiendaToggleKey(), tiendaEnabled ? '1' : '0');
  applyTiendaVisibility();
  if (!tiendaEnabled && isPageActive('tienda')) {
    const tablaBtn = document.querySelector('.nav-tab');
    showPage('tabla', tablaBtn || null);
  }
  if (isPageActive('resumen')) renderResumen();
}

function updateCatTabs() {
  const bajaB = document.getElementById('catTab_baja_b');
  const bajaA = document.getElementById('catTab_baja_a');
  if (bajaB) bajaB.style.display = 'none';
  if (bajaA) bajaA.style.display = 'none';
  if (!CAT_NAMES[currentCat]) {
    currentCat = catOrderKeys[0] || 'cat_libre_varonil';
    const firstTab = document.querySelector('.cat-tab');
    if (firstTab) firstTab.classList.add('active');
  }
  ensureAllowedTournamentAndCat();
}

function launchApp() {
  document.getElementById('splash').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  loadCustomCats();
  ensureAllowedTournamentAndCat();
  if (!CAT_NAMES[currentCat]) currentCat = catOrderKeys[0] || currentCat;
  document.getElementById('hdrName').textContent = TORNEO_NAMES[currentTorneo];
  document.getElementById('hdrCat').textContent = `${ORGANIZER_NAME} · ${ORGANIZER_PHONE}`;
  const hdrLogoEl = document.getElementById('hdrTorneoLogo');
  if (hdrLogoEl) hdrLogoEl.src = TORNEO_LOGOS[currentTorneo];
  syncFixedSelectors();
  rebuildCatTabs();
  updateCatTabs();
  loadTiendaToggle();
  document.getElementById('mp_torneo').value = currentTorneo;
  document.getElementById('mp_cat').value = currentCat;
  setupListeners();
  applyTheme();
  const vpLogo = document.getElementById('vpLogo');
  const vpName = document.getElementById('vpTorneoName');
  if (vpLogo) vpLogo.src = TORNEO_LOGOS[currentTorneo] || '';
  if (vpName) vpName.textContent = TORNEO_NAMES[currentTorneo] || '';
  const preferredPage = localStorage.getItem(LS_LAST_PAGE);
  if (preferredPage && preferredPage !== 'tabla' && canAccessPage(preferredPage)) {
    const pageEl = document.getElementById('page-' + preferredPage);
    if (pageEl) {
      const navBtn = Array.from(document.querySelectorAll('.nav-tab')).find(
        (b) => b.getAttribute('onclick') === `showPage('${preferredPage}',this)`
      );
      showPage(preferredPage, navBtn || null);
    }
  } else if (preferredPage && !canAccessPage(preferredPage)) {
    localStorage.setItem(LS_LAST_PAGE, 'tabla');
  }
  if ((typeof currentUser !== 'undefined' && currentUser) && !hasAdminSession() && !isCaptain) {
    const vp = document.getElementById('viewerProfileOverlay');
    if (vp) {
      vp.style.display = 'flex';
      renderViewerProfile();
    }
  }
}

function selectCat(cat, btn) {
  cat = appCatId(cat);
  currentCat = cat;
  document.querySelectorAll('.cat-tab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  if (btn?.scrollIntoView) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  currentVuelta = 'general';
  document.querySelectorAll('#vueltaTabs .cat-tab').forEach((b) => b.classList.remove('active'));
  const vtabGeneral = document.getElementById('vtab-general');
  if (vtabGeneral) vtabGeneral.classList.add('active');
  renderTabla();
  renderGoleadores();
  renderPorteros();
  populatePartidosTeamFilter();
  renderPartidos();
  renderEquiposPage();
  if (isPageActive('admin-arbitrajes') && typeof renderAdminArbitrajes === 'function') renderAdminArbitrajes();
  updatePorterosPublicUI();
  updateCuadroCopaUI();
  updateGoleadoresPublicUI();
  if (hasAdminSession()) scheduleMarketingAutoSync('categoria');
  updateReglamentoVisibility();
}

function saveCatOrder() {
  localStorage.setItem('ld_cats_' + currentTorneo, JSON.stringify(CAT_NAMES));
  localStorage.setItem('ld_cats_order_' + currentTorneo, JSON.stringify(catOrderKeys));
}

function loadCustomCats() {
  const cfg = getTournamentConfig(currentTorneo);
  const baseCats = Object.fromEntries(cfg.categories.map((cat) => [cat.key, cat.label]));
  Object.keys(CAT_NAMES).forEach((key) => delete CAT_NAMES[key]);
  Object.assign(CAT_NAMES, baseCats);
  catOrderKeys = cfg.categories.map((cat) => cat.key);
  try {
    const storedCats = JSON.parse(localStorage.getItem('ld_cats_' + currentTorneo) || 'null');
    if (storedCats && typeof storedCats === 'object') {
      Object.entries(storedCats).forEach(([key, value]) => {
        if (typeof value !== 'string' || !value.trim()) return;
        if (CAT_NAMES[key]) return;
        if (TOURNAMENT_SYSTEM_CAT_KEYS.has(key)) return;
        CAT_NAMES[key] = value;
      });
    }
    const storedOrder = JSON.parse(localStorage.getItem('ld_cats_order_' + currentTorneo) || 'null');
    if (Array.isArray(storedOrder)) {
      const ordered = storedOrder.filter((key) => CAT_NAMES[key]);
      Object.keys(CAT_NAMES).forEach((key) => {
        if (!ordered.includes(key)) ordered.push(key);
      });
      catOrderKeys = ordered;
    }
  } catch (_err) {}
}
