let currentTorneo = 'villa';
let currentCat = 'liga_alta';
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
  trabajadores: {},
  gastosTrab: {},
  gastosTienda: {},
  turnos: {},
  usuarios: {},
  solicitudes: {},
  mercadotecnia: {}
};
const CAT_NAMES = { liga_alta: 'Liga Alta', liga_media: 'Liga Media', liga_baja_a: 'Liga Baja A', liga_baja_b: 'Liga Baja B' };
let catOrderKeys = applyTournamentCatalogToCategoryMap(CAT_NAMES);
const CANCHAS = ['Los Alamitos'];
const ORGANIZER_NAME = 'Jesus "Navo"';
const ORGANIZER_PHONE = '667 452 5663';

function normalizeAdminScope(rawScope) {
  if (!rawScope || typeof rawScope !== 'object') return {};
  const scope = {};
  Object.entries(rawScope).forEach(([torneo, cats]) => {
    const normalizedTorneo = ({ lombardo_toledano: 'villa', lombardo: 'villa' }[torneo]) || torneo;
    if (!TORNEO_NAMES[normalizedTorneo]) return;
    const list = Array.isArray(cats) ? cats : Object.keys(cats || {});
    scope[normalizedTorneo] = list.filter((cat) => typeof cat === 'string');
  });
  return scope;
}

function catsToPermissionMap(cats = []) {
  return Object.fromEntries(cats.filter(Boolean).map((cat) => [cat, true]));
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
  return { [torneo]: catsToPermissionMap(cats) };
}

function hasAdminSession() {
  return typeof isAdmin !== 'undefined' && !!isAdmin;
}

function getAllowedTorneos() {
  if (isOwner || !hasAdminSession()) return [...TOURNAMENT_OPTION_ORDER];
  const allowed = Object.keys(adminScope || {}).filter((key) => TORNEO_NAMES[key]);
  return allowed.length ? allowed : [];
}

function getAllowedCats(torneo = currentTorneo) {
  const cfgCats = (TORNEO_CONFIG[torneo]?.categories || []).map((cat) => cat.key);
  if (isOwner || !hasAdminSession()) return cfgCats;
  const allowed = adminScope?.[torneo] || [];
  return allowed.length ? cfgCats.filter((cat) => allowed.includes(cat)) : [];
}

function canAccessTorneo(torneo) {
  return !hasAdminSession() || isOwner || getAllowedTorneos().includes(torneo);
}

function canAccessCat(cat, torneo = currentTorneo) {
  return !hasAdminSession() || isOwner || getAllowedCats(torneo).includes(cat);
}

function ensureAllowedTournamentAndCat() {
  if (!hasAdminSession() || isOwner) return;
  const allowedTorneos = getAllowedTorneos();
  if (!allowedTorneos.length) return;
  if (!allowedTorneos.includes(currentTorneo)) currentTorneo = allowedTorneos[0];
  const allowedCats = getAllowedCats(currentTorneo);
  if (allowedCats.length && !allowedCats.includes(currentCat)) currentCat = allowedCats[0];
}

const splashMainLogoOnLoad = document.querySelector('#splash > div img');
if (splashMainLogoOnLoad) splashMainLogoOnLoad.src = SPLASH_BIG_LOGO;
const hdrBrandLogoOnLoad = document.querySelector('.hdr-shield img');
if (hdrBrandLogoOnLoad) hdrBrandLogoOnLoad.src = CD_LOGO_SHIELD;
hydrateSplashTournamentCards();

function selectTorneo(t) {
  if (hasAdminSession() && !canAccessTorneo(t)) {
    showToast('No tienes permiso para este torneo', 'tr');
    return;
  }
  currentTorneo = TORNEO_NAMES[t] ? t : 'villa';
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
    el.value = canAccessTorneo(currentTorneo) ? currentTorneo : (getAllowedTorneos()[0] || currentTorneo);
  });

  const catIds = ['gen_cat', 'mp_cat', 'eq_cat', 'ie_cat', 'temp_cat'];
  const catOptions = catOrderKeys
    .filter((key) => CAT_NAMES[key])
    .filter((key) => canAccessCat(key))
    .map((key) => `<option value="${key}">${CAT_NAMES[key]}</option>`)
    .join('');

  catIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = catOptions;
    if (prev && CAT_NAMES[prev] && canAccessCat(prev)) el.value = prev;
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
    currentCat = catOrderKeys[0] || 'liga_alta';
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
  if (hasAdminSession() && !canAccessCat(cat)) {
    showToast('No tienes permiso para esta categoria', 'tr');
    return;
  }
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
  if (hasAdminSession() && !isOwner) {
    const allowed = getAllowedCats(currentTorneo);
    Object.keys(CAT_NAMES).forEach((key) => {
      if (!allowed.includes(key)) delete CAT_NAMES[key];
    });
    catOrderKeys = catOrderKeys.filter((key) => allowed.includes(key));
  }
}
