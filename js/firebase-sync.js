let firestoreCoreListenersReady = false;
let legacyRealtimeCoreListenersReady = false;
const firestoreCoreCache = { equipos: {}, inscripciones: {}, pagos: {} };
const legacyRealtimeCoreCache = { equipos: {}, inscripciones: {} };

function normalizeEquipoRecord(key, data = {}, source = 'firestore') {
  const scoped = normalizeScopedRecord(data);
  const rawAlias = data.alias;
  const alias = Array.isArray(rawAlias)
    ? rawAlias
    : String(rawAlias || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  return {
    ...scoped,
    _key: key,
    _source: source,
    nombre: data.nombre || data.equipoNombre || '',
    nombreNormalizado: data.nombreNormalizado || slugifyId(data.nombre || data.equipoNombre || '').replace(/_/g, ' '),
    tel: data.tel || data.telefonoCapitan || '',
    telefonoCapitan: data.telefonoCapitan || data.tel || '',
    capitan: data.capitan || '',
    color: data.color || '#1a3a8a',
    logo: data.logo || null,
    portero: data.portero || null,
    alineacion: Array.isArray(data.alineacion) ? data.alineacion : [],
    alias,
    estado: data.estado || 'activo'
  };
}

function normalizeInscripcionRecord(key, data = {}, source = 'firestore') {
  const scoped = normalizeScopedRecord(data);
  return {
    ...scoped,
    _key: key,
    _source: source,
    nombre: data.nombre || data.equipoNombre || '',
    equipoNombre: data.equipoNombre || data.nombre || '',
    equipoId: data.equipoId || null,
    montoTotal: Number(data.montoTotal || data.monto || 0),
    montoPagado: Number(data.montoPagado || 0),
    saldo: Number(data.saldo || 0),
    estado: data.estado || 'pendiente',
    fechaLimitePago: data.fechaLimitePago || '',
    moneda: data.moneda || 'MXN',
    abonos: data.abonos || {}
  };
}

function renderCoreDataConsumers() {
  if (typeof renderEquiposPage === 'function' && typeof isPageActive === 'function' && isPageActive('equipos')) renderEquiposPage();
  if (typeof renderTabla === 'function' && typeof isPageActive === 'function' && isPageActive('tabla')) renderTabla();
  if (typeof renderPartidos === 'function' && typeof isPageActive === 'function' && isPageActive('partidos')) renderPartidos();
  if (typeof renderInscripciones === 'function' && typeof isPageActive === 'function' && isPageActive('inscripciones')) renderInscripciones();
  if (typeof renderResumen === 'function' && typeof isPageActive === 'function' && isPageActive('resumen')) renderResumen();
  if (typeof renderAdminArbitrajes === 'function' && typeof isPageActive === 'function' && isPageActive('admin-arbitrajes')) renderAdminArbitrajes();
  if (typeof renderControlCenter === 'function' && typeof isPageActive === 'function' && isPageActive('control-center')) renderControlCenter({ keepAuditCache: true });
  if (typeof refreshOperationsBadge === 'function') refreshOperationsBadge();
}

function rebuildEquiposFromCoreSources() {
  clearObj(C.equipos);
  Object.assign(C.equipos, legacyRealtimeCoreCache.equipos, firestoreCoreCache.equipos);
}

function rebuildInscripcionesFromCoreSources() {
  clearObj(C.inscripciones);
  Object.assign(C.inscripciones, legacyRealtimeCoreCache.inscripciones, firestoreCoreCache.inscripciones);
  rebuildInscAbonosFromPagos();
}

function rebuildInscAbonosFromPagos() {
  if (!C.inscripciones || !C.pagos) return;

  Object.values(C.inscripciones).forEach((insc) => {
    if (insc._source !== 'realtime') insc.abonos = {};
    else insc.abonos = insc.abonos || {};
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
    clearObj(firestoreCoreCache.equipos);

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      firestoreCoreCache.equipos[doc.id] = normalizeEquipoRecord(doc.id, data, 'firestore');
    });

    rebuildEquiposFromCoreSources();
    renderCoreDataConsumers();
  }, (error) => {
    console.warn('Firestore equipos listener:', error);
  });

  fs.collection('inscripciones').onSnapshot((snapshot) => {
    clearObj(firestoreCoreCache.inscripciones);

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      firestoreCoreCache.inscripciones[doc.id] = normalizeInscripcionRecord(doc.id, data, 'firestore');
    });

    rebuildInscripcionesFromCoreSources();
    renderCoreDataConsumers();
  }, (error) => {
    console.warn('Firestore inscripciones listener:', error);
  });

  fs.collection('pagos').onSnapshot((snapshot) => {
    clearObj(firestoreCoreCache.pagos);
    clearObj(C.pagos);

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const scoped = normalizeScopedRecord(data);
      const { torneo, cat, torneoId, categoriaId } = scoped;

      firestoreCoreCache.pagos[doc.id] = {
        ...scoped,
        _key: doc.id,
        torneo,
        cat,
        torneoId,
        categoriaId,
        monto: Number(data.monto || 0),
        cancelado: !!data.cancelado
      };
    });

    Object.assign(C.pagos, firestoreCoreCache.pagos);
    rebuildInscAbonosFromPagos();
    renderCoreDataConsumers();

  }, (error) => {
    console.warn('Firestore pagos listener:', error);
  });
}

function setupLegacyRealtimeCoreFallbackListeners() {
  if (legacyRealtimeCoreListenersReady) return;
  legacyRealtimeCoreListenersReady = true;

  db.ref('equipos').on('value', (snapshot) => {
    clearObj(legacyRealtimeCoreCache.equipos);
    if (snapshot.exists()) {
      Object.entries(snapshot.val() || {}).forEach(([key, data]) => {
        legacyRealtimeCoreCache.equipos[key] = normalizeEquipoRecord(key, data, 'realtime');
      });
    }
    rebuildEquiposFromCoreSources();
    renderCoreDataConsumers();
  });

  db.ref('inscripciones').on('value', (snapshot) => {
    clearObj(legacyRealtimeCoreCache.inscripciones);
    if (snapshot.exists()) {
      Object.entries(snapshot.val() || {}).forEach(([key, data]) => {
        legacyRealtimeCoreCache.inscripciones[key] = normalizeInscripcionRecord(key, data, 'realtime');
      });
    }
    rebuildInscripcionesFromCoreSources();
    renderCoreDataConsumers();
  });
}

function normalizeFirestoreDoc(collectionName, id, data = {}) {
  const plainCollections = new Set([
    'categorias',
    'usuarios_autorizados',
    'bot_sessions'
  ]);
  const scopedCollections = new Set([
    'partidos',
    'ventas',
    'gastosTienda',
    'gastosTrab',
    'solicitudes',
    'mercadotecnia',
    'temporadas'
  ]);
  if (collectionName === 'equipos') return normalizeEquipoRecord(id, data, 'firestore');
  if (collectionName === 'inscripciones') return normalizeInscripcionRecord(id, data, 'firestore');
  if (collectionName === 'pagos') {
    return {
      ...normalizeScopedRecord(data),
      _key: id,
      monto: Number(data.monto || 0),
      cancelado: !!data.cancelado
    };
  }
  if (plainCollections.has(collectionName)) return { ...data, _key: id };
  const base = scopedCollections.has(collectionName) || data.torneo || data.cat || data.torneoId || data.categoriaId
    ? normalizeScopedRecord(data)
    : data;
  return { ...base, _key: id };
}

function renderAfterFirestoreCollection(collectionName) {
  if (typeof renderControlCenter === 'function' && typeof isPageActive === 'function' && isPageActive('control-center')) {
    renderControlCenter({ keepAuditCache: true });
  } else if (typeof refreshOperationsBadge === 'function' && (isAdmin || isOwner)) {
    refreshOperationsBadge();
  }
  if (collectionName === 'equipos') {
    rebuildEquiposFromCoreSources();
    renderCoreDataConsumers();
    return;
  }
  if (collectionName === 'inscripciones') {
    rebuildInscripcionesFromCoreSources();
    renderCoreDataConsumers();
    return;
  }
  if (collectionName === 'pagos') {
    rebuildInscAbonosFromPagos();
    renderCoreDataConsumers();
    if (typeof renderAdminArbitrajes === 'function' && isAdmin && isPageActive('admin-arbitrajes')) renderAdminArbitrajes();
    return;
  }
  if (collectionName === 'partidos') {
    if (typeof renderPartidos === 'function') renderPartidos();
    if (typeof renderTabla === 'function') renderTabla();
    if (typeof renderAdminArbitrajes === 'function' && isAdmin && isPageActive('admin-arbitrajes')) renderAdminArbitrajes();
    if (typeof renderArbitros === 'function' && isAdmin && isPageActive('arbitros')) renderArbitros();
    if (typeof renderResumen === 'function' && isAdmin && isPageActive('resumen')) renderResumen();
    if (typeof renderMercadotecnia === 'function' && isAdmin && isPageActive('mercadotecnia')) renderMercadotecnia();
    if (isAdmin && typeof scheduleMarketingAutoSync === 'function') scheduleMarketingAutoSync('partidos');
    if (activePartidoKey && document.getElementById('modalPartidoDetail')?.classList.contains('open')) renderPartidoDetail();
    return;
  }
  if (collectionName === 'productos') {
    if (typeof canSeedProducts === 'function' && canSeedProducts() && !Object.keys(C.productos || {}).length && typeof seedProducts === 'function') seedProducts();
    if (isAdmin && isPageActive('tienda')) renderTienda();
    return;
  }
  if (collectionName === 'ventas') {
    if (isAdmin && isPageActive('tienda')) renderHistorialVentas();
    if (typeof renderTiendaStats === 'function') renderTiendaStats();
    if (isAdmin && isPageActive('resumen')) renderResumen();
    return;
  }
  if (collectionName === 'gastosTienda') {
    if (isAdmin && isPageActive('tienda')) renderGastosTienda();
    if (isAdmin && isPageActive('resumen')) renderResumen();
    return;
  }
  if (collectionName === 'turnos') {
    if (isAdmin && isPageActive('tienda')) renderTurnoUI();
    return;
  }
  if (collectionName === 'arbitros') {
    if (isAdmin && isPageActive('arbitros')) renderArbitros();
    return;
  }
  if (collectionName === 'trabajadores' || collectionName === 'gastosTrab') {
    if (isAdmin && isPageActive('arbitros')) renderTrabajadores();
    if (isAdmin && isPageActive('resumen')) renderResumen();
    return;
  }
  if (collectionName === 'usuarios') {
    const modal = document.getElementById('modalUsuarios');
    if (modal && modal.classList.contains('open')) renderUsuariosPanel();
    return;
  }
  if (collectionName === 'solicitudes') {
    const viewerProfile = document.getElementById('viewerProfileOverlay');
    if (viewerProfile && viewerProfile.style.display !== 'none') renderViewerProfile();
    if (isCaptain && captainEquipoKey) renderEquiposPage();
    return;
  }
  if (collectionName === 'mercadotecnia') {
    if (isAdmin && isPageActive('mercadotecnia')) renderMercadotecnia();
    return;
  }
  if (collectionName === 'temporadas') {
    if (typeof renderHistorial === 'function' && isPageActive('historial')) renderHistorial();
    if (typeof updateContextBar === 'function') updateContextBar();
  }
}

const PUBLIC_FIRESTORE_COLLECTIONS = new Set(['equipos', 'partidos', 'temporadas', 'categorias']);
const firestoreListenerUnsubscribers = {};
const pendingFirestoreCollections = new Set();

function updateFirestoreLoadingUi() {
  document.body.classList.toggle('data-loading', pendingFirestoreCollections.size > 0);
  if (typeof updateContextBar === 'function') updateContextBar();
}

function stopFirestorePrivateListeners() {
  Object.entries(firestoreListenerUnsubscribers).forEach(([collectionName, unsubscribe]) => {
    if (PUBLIC_FIRESTORE_COLLECTIONS.has(collectionName)) return;
    if (typeof unsubscribe === 'function') unsubscribe();
    delete firestoreListenerUnsubscribers[collectionName];
    pendingFirestoreCollections.delete(collectionName);
    if (C[collectionName]) clearObj(C[collectionName]);
  });
  clearObj(firestoreCoreCache.inscripciones);
  clearObj(firestoreCoreCache.pagos);
  updateFirestoreLoadingUi();
}

function setupFirestoreAllListeners() {
  if (!fs) return;
  const firestoreCollections = [
    'equipos',
    'partidos',
    'temporadas',
    'categorias',
    ...((currentUser && (isCaptain || isAdmin || isOwner)) ? ['inscripciones', 'pagos', 'solicitudes'] : []),
    ...((isAdmin || isOwner) ? [
      'productos',
      'ventas',
      'gastosTienda',
      'turnos',
      'arbitros',
      'trabajadores',
      'gastosTrab',
      'mercadotecnia',
      'usuarios',
      'usuarios_autorizados',
      'bot_sessions'
    ] : [])
  ];

  firestoreCollections.forEach((collectionName) => {
    if (firestoreListenerUnsubscribers[collectionName]) return;
    if (!C[collectionName]) C[collectionName] = {};
    pendingFirestoreCollections.add(collectionName);
    updateFirestoreLoadingUi();

    firestoreListenerUnsubscribers[collectionName] = fs.collection(collectionName).onSnapshot((snapshot) => {
      if (collectionName === 'equipos') clearObj(firestoreCoreCache.equipos);
      else if (collectionName === 'inscripciones') clearObj(firestoreCoreCache.inscripciones);
      else if (collectionName === 'pagos') clearObj(firestoreCoreCache.pagos);
      else {
        if (!C[collectionName]) C[collectionName] = {};
        clearObj(C[collectionName]);
      }

      snapshot.forEach((doc) => {
        const data = doc.data() || {};
        const record = normalizeFirestoreDoc(collectionName, doc.id, data);
        if (collectionName === 'equipos') firestoreCoreCache.equipos[doc.id] = record;
        else if (collectionName === 'inscripciones') firestoreCoreCache.inscripciones[doc.id] = record;
        else if (collectionName === 'pagos') firestoreCoreCache.pagos[doc.id] = record;
        else {
          if (!C[collectionName]) C[collectionName] = {};
          C[collectionName][doc.id] = record;
        }
      });

      if (collectionName === 'pagos') {
        clearObj(C.pagos);
        Object.assign(C.pagos, firestoreCoreCache.pagos);
      }
      pendingFirestoreCollections.delete(collectionName);
      updateFirestoreLoadingUi();
      renderAfterFirestoreCollection(collectionName);
    }, (error) => {
      pendingFirestoreCollections.delete(collectionName);
      updateFirestoreLoadingUi();
      console.warn(`Firestore ${collectionName} listener:`, error);
    });
  });
}

function setupListeners() {
  const useFirestore = !!fs;
  if (useFirestore) {
    setupFirestoreAllListeners();
    return;
  }

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
    else if (typeof canSeedProducts === 'function' && canSeedProducts()) seedProducts();
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
