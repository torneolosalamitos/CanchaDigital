let firestoreCoreListenersReady = false;

function rebuildInscAbonosFromPagos() {
  if (!C.inscripciones || !C.pagos) return;

  Object.values(C.inscripciones).forEach((insc) => {
    insc.abonos = {};
  });

  Object.entries(C.pagos).forEach(([pagoId, pago]) => {
    if (!pago || pago.cancelado) return;
    const inscripcionId = pago.inscripcionId;
    if (!inscripcionId || !C.inscripciones[inscripcionId]) return;

    const fechaTexto = pago.fechaTexto || pago.fecha || todayISO();
    C.inscripciones[inscripcionId].abonos[pagoId] = {
      _key: pagoId,
      pagoId,
      monto: Number(pago.monto || 0),
      fecha: fechaTexto,
      metodo: pago.metodo || 'efectivo',
      notas: pago.nota || pago.notas || '',
      ts: pago.ts || Date.now()
    };
  });
}

function setupFirestoreCoreListeners() {
  if (!fs || firestoreCoreListenersReady) return;
  firestoreCoreListenersReady = true;

  fs.collection('equipos').onSnapshot((snapshot) => {
    clearObj(C.equipos);

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const torneo = appTorneoId(data.torneoId || data.torneo);
      const cat = appCatId(data.categoriaId || data.cat);

      C.equipos[doc.id] = {
        ...data,
        _key: doc.id,
        nombre: data.nombre || data.equipoNombre || '',
        nombreNormalizado: data.nombreNormalizado || slugifyId(data.nombre || data.equipoNombre || '').replace(/_/g, ' '),
        tel: data.tel || data.telefonoCapitan || '',
        telefonoCapitan: data.telefonoCapitan || data.tel || '',
        capitan: data.capitan || '',
        torneo,
        cat,
        torneoId: data.torneoId || firestoreTorneoId(torneo),
        categoriaId: data.categoriaId || firestoreCatId(cat),
        color: data.color || '#1a3a8a',
        logo: data.logo || null,
        portero: data.portero || null,
        alineacion: Array.isArray(data.alineacion) ? data.alineacion : [],
        alias: Array.isArray(data.alias) ? data.alias : [],
        estado: data.estado || 'activo'
      };
    });

    if (typeof renderEquiposPage === 'function' && typeof isPageActive === 'function' && isPageActive('equipos')) renderEquiposPage();
    if (typeof renderTabla === 'function' && typeof isPageActive === 'function' && isPageActive('tabla')) renderTabla();
    if (typeof renderPartidos === 'function' && typeof isPageActive === 'function' && isPageActive('partidos')) renderPartidos();
    if (typeof renderInscripciones === 'function' && typeof isPageActive === 'function' && isPageActive('inscripciones')) renderInscripciones();
  }, (error) => {
    console.warn('Firestore equipos listener:', error);
  });

  fs.collection('inscripciones').onSnapshot((snapshot) => {
    clearObj(C.inscripciones);

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const torneo = appTorneoId(data.torneoId || data.torneo);
      const cat = appCatId(data.categoriaId || data.cat);

      C.inscripciones[doc.id] = {
        ...data,
        _key: doc.id,
        nombre: data.nombre || data.equipoNombre || '',
        equipoNombre: data.equipoNombre || data.nombre || '',
        torneo,
        cat,
        torneoId: data.torneoId || firestoreTorneoId(torneo),
        categoriaId: data.categoriaId || firestoreCatId(cat),
        equipoId: data.equipoId || null,
        montoTotal: Number(data.montoTotal || data.monto || 0),
        montoPagado: Number(data.montoPagado || 0),
        saldo: Number(data.saldo || 0),
        estado: data.estado || 'pendiente',
        fechaLimitePago: data.fechaLimitePago || '',
        moneda: data.moneda || 'MXN',
        abonos: data.abonos || {}
      };
    });

    rebuildInscAbonosFromPagos();

    if (typeof renderInscripciones === 'function' && typeof isPageActive === 'function' && isPageActive('inscripciones')) renderInscripciones();
    if (typeof renderResumen === 'function' && typeof isPageActive === 'function' && isPageActive('resumen')) renderResumen();
    if (typeof renderEquiposPage === 'function' && typeof isPageActive === 'function' && isPageActive('equipos')) renderEquiposPage();
  }, (error) => {
    console.warn('Firestore inscripciones listener:', error);
  });

  fs.collection('pagos').onSnapshot((snapshot) => {
    clearObj(C.pagos);

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const torneo = appTorneoId(data.torneoId || data.torneo);
      const cat = appCatId(data.categoriaId || data.cat);

      C.pagos[doc.id] = {
        ...data,
        _key: doc.id,
        torneo,
        cat,
        torneoId: data.torneoId || firestoreTorneoId(torneo),
        categoriaId: data.categoriaId || firestoreCatId(cat),
        monto: Number(data.monto || 0),
        cancelado: !!data.cancelado
      };
    });

    rebuildInscAbonosFromPagos();

    if (typeof renderInscripciones === 'function' && typeof isPageActive === 'function' && isPageActive('inscripciones')) renderInscripciones();
    if (typeof renderResumen === 'function' && typeof isPageActive === 'function' && isPageActive('resumen')) renderResumen();
    if (typeof renderEquiposPage === 'function' && typeof isPageActive === 'function' && isPageActive('equipos')) renderEquiposPage();
  }, (error) => {
    console.warn('Firestore pagos listener:', error);
  });
}

function setupListeners() {
  const useFirestoreCore = !!fs;
  if (useFirestoreCore) setupFirestoreCoreListeners();

  if (!useFirestoreCore) {
    db.ref('equipos').on('value', (snapshot) => {
      Object.keys(C.equipos).forEach((key) => delete C.equipos[key]);
      if (snapshot.exists()) Object.assign(C.equipos, snapshot.val());
      renderEquiposPage();
      if (isPageActive('tabla')) renderTabla();
      if (isAdmin && isPageActive('mercadotecnia')) renderMercadotecnia();
    });
  }

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

  if (!useFirestoreCore) {
    db.ref('inscripciones').on('value', (snapshot) => {
      Object.keys(C.inscripciones).forEach((key) => delete C.inscripciones[key]);
      if (snapshot.exists()) Object.assign(C.inscripciones, snapshot.val());
      if (isAdmin && isPageActive('inscripciones')) renderInscripciones();
      if (isAdmin && isPageActive('resumen')) renderResumen();
    });
  }

  db.ref('trabajadores').on('value', (snapshot) => {
    Object.keys(C.trabajadores).forEach((key) => delete C.trabajadores[key]);
    if (snapshot.exists()) Object.assign(C.trabajadores, snapshot.val());
    if (isAdmin && isPageActive('arbitros')) renderTrabajadores();
    if (isAdmin && isPageActive('resumen')) renderResumen();
  });

  db.ref('gastosTrab').on('value', (snapshot) => {
    Object.keys(C.gastosTrab).forEach((key) => delete C.gastosTrab[key]);
    if (snapshot.exists()) Object.assign(C.gastosTrab, snapshot.val());
    if (isAdmin && isPageActive('arbitros')) renderTrabajadores();
    if (isAdmin && isPageActive('resumen')) renderResumen();
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
