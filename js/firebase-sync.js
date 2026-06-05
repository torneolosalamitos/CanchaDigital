function setupListeners() {
  db.ref('equipos').on('value', (snapshot) => {
    Object.keys(C.equipos).forEach((key) => delete C.equipos[key]);
    if (snapshot.exists()) Object.assign(C.equipos, snapshot.val());
    renderEquiposPage();
    if (isPageActive('tabla')) renderTabla();
    if (isAdmin && isPageActive('mercadotecnia')) renderMercadotecnia();
  });

  db.ref('partidos').on('value', (snapshot) => {
    Object.keys(C.partidos).forEach((key) => delete C.partidos[key]);
    if (snapshot.exists()) Object.assign(C.partidos, snapshot.val());
    renderPartidos();
    renderTabla();
    if (isAdmin && isPageActive('arbitros')) renderArbitros();
    if (isAdmin && isPageActive('resumen')) renderResumen();
    if (isAdmin && isPageActive('mercadotecnia')) renderMercadotecnia();
    if (isAdmin) scheduleMarketingAutoSync('partidos');
    if (activePartidoKey && document.getElementById('modalPartidoDetail').classList.contains('open')) {
      renderPartidoDetail();
    }
  });

  db.ref('productos').on('value', (snapshot) => {
    Object.keys(C.productos).forEach((key) => delete C.productos[key]);
    if (snapshot.exists()) Object.assign(C.productos, snapshot.val());
    else seedProducts();
    if (isAdmin && isPageActive('tienda')) renderTienda();
  });

  db.ref('ventas').on('value', (snapshot) => {
    Object.keys(C.ventas).forEach((key) => delete C.ventas[key]);
    if (snapshot.exists()) Object.assign(C.ventas, snapshot.val());
    if (isAdmin && isPageActive('tienda')) renderHistorialVentas();
    renderTiendaStats();
    if (isAdmin && isPageActive('resumen')) renderResumen();
  });

  db.ref('gastosTienda').on('value', (snapshot) => {
    Object.keys(C.gastosTienda).forEach((key) => delete C.gastosTienda[key]);
    if (snapshot.exists()) Object.assign(C.gastosTienda, snapshot.val());
    if (isAdmin && isPageActive('tienda')) renderGastosTienda();
    if (isAdmin && isPageActive('resumen')) renderResumen();
  });

  db.ref('usuarios').on('value', (snapshot) => {
    Object.keys(C.usuarios).forEach((key) => delete C.usuarios[key]);
    if (snapshot.exists()) Object.assign(C.usuarios, snapshot.val());
    const modal = document.getElementById('modalUsuarios');
    if (modal && modal.classList.contains('open')) renderUsuariosPanel();
  });

  db.ref('turnos').on('value', (snapshot) => {
    Object.keys(C.turnos).forEach((key) => delete C.turnos[key]);
    if (snapshot.exists()) Object.assign(C.turnos, snapshot.val());
    if (isAdmin && isPageActive('tienda')) renderTurnoUI();
  });

  db.ref('arbitros').on('value', (snapshot) => {
    Object.keys(C.arbitros).forEach((key) => delete C.arbitros[key]);
    if (snapshot.exists()) Object.assign(C.arbitros, snapshot.val());
    if (isAdmin && isPageActive('arbitros')) renderArbitros();
  });

  db.ref('inscripciones').on('value', (snapshot) => {
    Object.keys(C.inscripciones).forEach((key) => delete C.inscripciones[key]);
    if (snapshot.exists()) Object.assign(C.inscripciones, snapshot.val());
    if (isAdmin && isPageActive('inscripciones')) renderInscripciones();
    if (isAdmin && isPageActive('resumen')) renderResumen();
  });

  db.ref('trabajadores').on('value', (snapshot) => {
    Object.keys(C.trabajadores).forEach((key) => delete C.trabajadores[key]);
    if (snapshot.exists()) Object.assign(C.trabajadores, snapshot.val());
    if (isAdmin && isPageActive('arbitros')) renderTrabajadores();
  });

  db.ref('gastosTrab').on('value', (snapshot) => {
    Object.keys(C.gastosTrab).forEach((key) => delete C.gastosTrab[key]);
    if (snapshot.exists()) Object.assign(C.gastosTrab, snapshot.val());
    if (isAdmin && isPageActive('arbitros')) renderTrabajadores();
  });

  C.solicitudes = {};
  db.ref('solicitudes').on('value', (snapshot) => {
    Object.keys(C.solicitudes).forEach((key) => delete C.solicitudes[key]);
    if (snapshot.exists()) Object.assign(C.solicitudes, snapshot.val());
    const viewerProfile = document.getElementById('viewerProfileOverlay');
    if (viewerProfile && viewerProfile.style.display !== 'none') renderViewerProfile();
    if (isCaptain && captainEquipoKey) renderEquiposPage();
  });

  db.ref('mercadotecnia').on('value', (snapshot) => {
    Object.keys(C.mercadotecnia).forEach((key) => delete C.mercadotecnia[key]);
    if (snapshot.exists()) Object.assign(C.mercadotecnia, snapshot.val());
    if (isAdmin && isPageActive('mercadotecnia')) renderMercadotecnia();
  });
}
