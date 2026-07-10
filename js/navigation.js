function canAccessPage(page) {
  if (!ADMIN_ONLY_PAGES.has(page)) return true;
  return !!(isOwner || isAdmin);
}

const PAGE_LABELS = {
  tabla: 'Tabla',
  partidos: 'Últimos partidos',
  equipos: 'Equipos',
  reglamento: 'Reglamento',
  historial: 'Historial',
  tienda: 'Tienda',
  inscripciones: 'Inscripciones',
  arbitros: 'Capital humano',
  resumen: 'Resumen',
  'control-center': 'Centro de control',
  'admin-arbitrajes': 'Arbitrajes',
  mercadotecnia: 'Mercadotecnia'
};

const ADMIN_MANAGEMENT_PAGES = new Set([
  'tienda',
  'inscripciones',
  'arbitros',
  'resumen',
  'admin-arbitrajes',
  'mercadotecnia'
]);

function closeAdminNavMenu() {
  const menu = document.getElementById('adminNavMenu');
  const button = document.getElementById('navManageBtn');
  if (menu) {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
  }
  if (button) button.setAttribute('aria-expanded', 'false');
}

function toggleAdminNavMenu(event) {
  if (event?.stopPropagation) event.stopPropagation();
  const menu = document.getElementById('adminNavMenu');
  const button = document.getElementById('navManageBtn');
  if (!menu || !button) return;
  const nextOpen = !menu.classList.contains('open');
  closeAdminNavMenu();
  if (nextOpen) {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
  }
}

function updateContextBar(pageKey) {
  const activePage = pageKey || document.querySelector('.page.active')?.id?.replace('page-', '') || 'tabla';
  const torneo = document.getElementById('contextTorneo');
  const category = document.getElementById('contextCat');
  const page = document.getElementById('contextPage');
  const season = document.getElementById('contextSeason');
  const status = document.getElementById('contextStatusText');
  const manage = document.getElementById('navManageBtn');
  if (torneo) torneo.textContent = TORNEO_NAMES[currentTorneo] || 'Torneo';
  if (category) category.textContent = CAT_NAMES[currentCat] || 'Categoría';
  if (page) page.textContent = PAGE_LABELS[activePage] || 'Sección';
  if (season) {
    const activeSeason = getActiveSeason(currentTorneo, currentCat);
    season.textContent = activeSeason?.nombre || activeSeason?.seasonName || 'Sin temporada activa';
    season.classList.toggle('is-warning', !activeSeason);
  }
  if (status) {
    status.textContent = document.body.classList.contains('data-loading')
      ? 'Sincronizando datos'
      : (navigator.onLine ? 'Sistema en línea' : 'Trabajando sin conexión');
  }
  document.body.classList.toggle('is-online', navigator.onLine);
  if (manage) manage.classList.toggle('active', ADMIN_MANAGEMENT_PAGES.has(activePage));
}

function showPage(pageKey, btn) {
  let targetPage = pageKey;
  let targetBtn = btn;

  if (!canAccessPage(targetPage)) {
    showToast('No tienes permiso para esta seccion', 'tr');
    targetPage = 'tabla';
    targetBtn = document.querySelector('.nav-tab');
  }

  if (targetPage === 'tienda' && !tiendaEnabled) {
    showToast('La sección TIENDA está deshabilitada', 'ta');
    return;
  }

  document.querySelectorAll('.page').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((el) => el.classList.remove('active'));

  const pageEl = document.getElementById('page-' + targetPage);
  if (pageEl) pageEl.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  closeAdminNavMenu();
  updateContextBar(targetPage);

  if (targetBtn?.scrollIntoView && !targetBtn.closest('.admin-nav-menu')) {
    targetBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  localStorage.setItem(LS_LAST_PAGE, targetPage);

  if (targetPage === 'tienda') renderTienda();
  if (targetPage === 'inscripciones') renderInscripciones();
  if (targetPage === 'arbitros') {
    renderArbitros();
    renderTrabajadores();
  }
  if (targetPage === 'resumen') renderResumen();
  if (targetPage === 'control-center') renderControlCenter();
  if (targetPage === 'admin-arbitrajes') renderAdminArbitrajes();
  if (targetPage === 'tabla') renderTabla();
  if (targetPage === 'equipos') renderEquiposPage();
  if (targetPage === 'historial') renderHistorial();
  if (targetPage === 'mercadotecnia') renderMercadotecnia();
  if (targetPage === 'partidos') {
    populatePartidosTeamFilter();
    renderPartidos();
  }
}

document.addEventListener('click', (event) => {
  const menu = document.getElementById('adminNavMenu');
  const button = document.getElementById('navManageBtn');
  if (!menu?.classList.contains('open')) return;
  if (menu.contains(event.target) || button?.contains(event.target)) return;
  closeAdminNavMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAdminNavMenu();
});

window.addEventListener('online', () => updateContextBar());
window.addEventListener('offline', () => updateContextBar());
