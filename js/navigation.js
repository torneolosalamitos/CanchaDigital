function canAccessPage(page) {
  if (!ADMIN_ONLY_PAGES.has(page)) return true;
  return !!isAdmin;
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

  if (targetBtn?.scrollIntoView) {
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
  if (targetPage === 'tabla') renderTabla();
  if (targetPage === 'equipos') renderEquiposPage();
  if (targetPage === 'calendario') initCalendario();
  if (targetPage === 'historial') renderHistorial();
  if (targetPage === 'mercadotecnia') renderMercadotecnia();
  if (targetPage === 'partidos') {
    populatePartidosTeamFilter();
    renderPartidos();
  }
}
