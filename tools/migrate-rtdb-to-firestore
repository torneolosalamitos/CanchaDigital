#!/usr/bin/env node

const PROJECT_ID = 'torneo-villa-080204';
const API_KEY = 'AIzaSyAUyYu6E3oCJdeTNV9GbykmIaiT_ZBXro8';
const RTDB_URL = 'https://torneo-villa-080204-default-rtdb.firebaseio.com';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit?key=${API_KEY}`;

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify');
const now = Date.now();

const APP_TOURNAMENTS = new Set(['lombardo_toledano', 'nuevos_valores']);
const APP_CATS = new Set(['cat_libre_varonil', 'cat_libre_femenil', 'cat_infantil', 'cat_osos', 'cat_juvenil']);

const TORNEO_MAP = {
  villa: 'lombardo_toledano',
  lombardo: 'lombardo_toledano',
  lombardo_toledano: 'lombardo_toledano',
  torneo_lombardo_2026: 'lombardo_toledano',
  nuevos_valores: 'nuevos_valores',
  torneo_nuevos_valores_2026: 'nuevos_valores'
};

const CAT_MAP = {
  liga_alta: 'cat_libre_varonil',
  liga_media: 'cat_libre_varonil',
  liga_baja_a: 'cat_libre_varonil',
  liga_baja_b: 'cat_libre_varonil',
  cat_libre_varonil_lombardo: 'cat_libre_varonil',
  cat_libre_varonil: 'cat_libre_varonil',
  cat_libre_femenil_lombardo: 'cat_libre_femenil',
  cat_libre_femenil: 'cat_libre_femenil',
  cat_infantil: 'cat_infantil',
  cat_osos: 'cat_osos',
  cat_juvenil_a: 'cat_juvenil',
  cat_juvenil_b: 'cat_juvenil',
  cat_juvenil: 'cat_juvenil'
};

const FIRESTORE_TORNEO = {
  lombardo_toledano: 'torneo_lombardo_2026',
  nuevos_valores: 'torneo_nuevos_valores_2026'
};

const FIRESTORE_CAT = {
  cat_libre_varonil: 'cat_libre_varonil_lombardo',
  cat_libre_femenil: 'cat_libre_femenil_lombardo',
  cat_infantil: 'cat_infantil',
  cat_osos: 'cat_osos',
  cat_juvenil: 'cat_juvenil'
};

const COLLECTIONS = [
  'equipos',
  'partidos',
  'productos',
  'ventas',
  'gastosTienda',
  'turnos',
  'arbitros',
  'trabajadores',
  'gastosTrab',
  'usuarios',
  'solicitudes',
  'mercadotecnia',
  'inscripciones',
  'pagos'
];

function slugifyId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function docId(id, fallback) {
  return String(id || fallback || `doc_${now}`).replace(/\//g, '_');
}

function appTorneoId(value) {
  return TORNEO_MAP[value] || (APP_TOURNAMENTS.has(value) ? value : 'lombardo_toledano');
}

function appCatId(value) {
  return CAT_MAP[value] || (APP_CATS.has(value) ? value : 'cat_libre_varonil');
}

function scoped(record = {}) {
  const torneo = appTorneoId(record.torneo || record.torneoId);
  const cat = appCatId(record.cat || record.categoriaId);
  return {
    ...record,
    torneo,
    cat,
    torneoId: FIRESTORE_TORNEO[torneo],
    categoriaId: FIRESTORE_CAT[cat]
  };
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasForName(name, existing = []) {
  const clean = normalizeName(name);
  return Array.from(new Set([
    clean,
    clean.replace(/\s+/g, ''),
    clean.split(' ')[0],
    ...existing
  ].filter(Boolean)));
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      if (val === undefined) return;
      if (key === '_legacyRealtimeKey') return;
      out[sanitizeKey(key)] = sanitizeValue(val);
    });
    return out;
  }
  if (typeof value === 'string') {
    return value
      .replace(/Torneo Los Alamitos/gi, 'Torneo Lombardo Toledano')
      .replace(/#TorneoLosAlamitos/gi, '#TorneoLombardoToledano')
      .replace(/Los Alamitos/gi, 'Cancha Principal')
      .replace(/Torneo Villa/gi, 'Torneo Lombardo Toledano')
      .replace(/Liga Alta/gi, 'Categoria Libre Varonil')
      .replace(/CATEGORÍA JUVENIL B/gi, 'CATEGORIA JUVENIL')
      .replace(/CATEGORÍA JUVENIL A/gi, 'CATEGORIA JUVENIL')
      .replace(/CATEGORÍA INFANTIL/gi, 'CATEGORIA INFANTIL');
  }
  return value;
}

function sanitizeKey(key) {
  return String(key || '')
    .replace(/villa/g, 'lombardo_toledano')
    .replace(/liga_alta/g, 'cat_libre_varonil')
    .replace(/liga_media/g, 'cat_libre_varonil')
    .replace(/liga_baja_a/g, 'cat_libre_varonil')
    .replace(/liga_baja_b/g, 'cat_libre_varonil')
    .replace(/cat_juvenil_a/g, 'cat_juvenil')
    .replace(/cat_juvenil_b/g, 'cat_juvenil');
}

function removeLegacySync(record) {
  const copy = { ...record };
  delete copy.makeSync;
  return copy;
}

function normalizeEquipo(id, value) {
  const record = scoped(sanitizeValue(value || {}));
  const nombre = record.nombre || record.equipoNombre || 'Equipo';
  const nombreNormalizado = normalizeName(nombre);
  return {
    ...record,
    _legacyRealtimeKey: id,
    nombre,
    nombreNormalizado,
    alias: aliasForName(nombre, Array.isArray(record.alias) ? record.alias : []),
    tel: record.tel || record.telefonoCapitan || '',
    telefonoCapitan: record.telefonoCapitan || record.tel || '',
    color: record.color || '#1a3a8a',
    logo: record.logo || null,
    alineacion: Array.isArray(record.alineacion) ? record.alineacion : [],
    estado: record.estado || 'activo',
    actualizadoEnMs: record.updatedAt || record.actualizadoEnMs || now,
    creadoAt: record.creadoAt || record.creadoAtMs || now
  };
}

function normalizePartido(id, value) {
  const record = scoped(sanitizeValue(removeLegacySync(value || {})));
  return {
    ...record,
    _legacyRealtimeKey: id,
    cancha: record.cancha || 'Cancha Principal',
    goles: record.goles || {},
    arbPago: record.arbPago || { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } },
    arbPagado: !!record.arbPagado,
    status: record.status || 'pendiente',
    timerRunning: !!record.timerRunning,
    actualizadoEnMs: record.updatedAt || now,
    creadoAt: record.creadoAt || now
  };
}

function normalizeInscripcion(id, value) {
  const record = scoped(sanitizeValue(value || {}));
  const nombre = record.nombre || record.equipoNombre || 'Equipo';
  const montoTotal = Number(record.montoTotal || record.monto || 0);
  const abonos = record.abonos && typeof record.abonos === 'object' ? Object.values(record.abonos) : [];
  const montoPagado = Number(record.montoPagado || abonos.reduce((sum, abono) => sum + Number(abono.monto || 0), 0));
  return {
    ...record,
    _legacyRealtimeKey: id,
    nombre,
    equipoNombre: record.equipoNombre || nombre,
    montoTotal,
    montoPagado,
    saldo: Math.max(0, montoTotal - montoPagado),
    estado: montoTotal > 0 && montoPagado >= montoTotal ? 'liquidado' : montoPagado > 0 ? 'abonado' : montoTotal > 0 ? 'pendiente' : 'sin_costo',
    moneda: record.moneda || 'MXN',
    origen: record.origen || 'migracion_realtime',
    logo: record.logo || null,
    actualizadoEnMs: record.updatedAt || now,
    creadoAt: record.creadoAt || now
  };
}

function normalizePagoFromAbono(inscId, insc, abonoId, abono) {
  const record = scoped({ ...insc, ...(abono || {}) });
  const pagoId = `pago_${docId(inscId)}_${docId(abonoId)}`;
  return [pagoId, {
    torneo: record.torneo,
    cat: record.cat,
    torneoId: record.torneoId,
    categoriaId: record.categoriaId,
    equipoId: insc.equipoId || null,
    equipoNombre: insc.equipoNombre || insc.nombre || '',
    inscripcionId: inscId,
    concepto: 'inscripcion',
    monto: Number(abono.monto || 0),
    metodo: abono.metodo || 'efectivo',
    origen: 'migracion_realtime',
    registradoPor: 'migracion',
    cancelado: false,
    fechaTexto: abono.fecha || '',
    ts: Number(abono.ts || now),
    nota: abono.notas || abono.nota || '',
    creadoAt: Number(abono.ts || now)
  }];
}

function normalizeScopedGeneric(id, value) {
  const record = scoped(sanitizeValue(value || {}));
  return {
    ...record,
    _legacyRealtimeKey: id,
    actualizadoEnMs: record.updatedAt || record.ts || now,
    creadoAt: record.creadoAt || record.ts || now
  };
}

function normalizeUsuario(id, value) {
  const record = sanitizeValue(value || {});
  const email = String(record.email || '').toLowerCase();
  const isOwner = email === 'edanchra@gmail.com' || email === 'admincanchadigital@gmail.com';
  return {
    ...record,
    uid: record.uid || id,
    role: isOwner ? 'admin' : (record.role || 'viewer'),
    adminScope: isOwner ? {
      lombardo_toledano: { cat_libre_varonil: true, cat_libre_femenil: true },
      nuevos_valores: { cat_infantil: true, cat_osos: true, cat_juvenil: true }
    } : normalizeAdminScope(record.adminScope),
    actualizadoEnMs: record.updatedAt || now,
    creadoAt: record.creadoAt || now
  };
}

function normalizeAdminScope(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.entries(raw).forEach(([torneoKey, cats]) => {
    const torneo = appTorneoId(torneoKey);
    const list = Array.isArray(cats) ? cats : Object.keys(cats || {});
    out[torneo] = {};
    list.forEach((catKey) => {
      out[torneo][appCatId(catKey)] = true;
    });
  });
  return out;
}

function normalizeMarketingKey(key) {
  const raw = String(key || '');
  const catKey = Object.keys(CAT_MAP).find((candidate) => raw.includes(candidate)) || 'cat_libre_varonil';
  const cat = appCatId(catKey);
  const torneo = ['cat_infantil', 'cat_osos', 'cat_juvenil'].includes(cat) ? 'nuevos_valores' : 'lombardo_toledano';
  return `${torneo}_${cat}`;
}

function normalizeMercadotecnia(id, value) {
  const normalizedKey = normalizeMarketingKey(id);
  const cat = normalizedKey.replace(/^lombardo_toledano_/, '').replace(/^nuevos_valores_/, '');
  const torneo = normalizedKey.startsWith('nuevos_valores_') ? 'nuevos_valores' : 'lombardo_toledano';
  return {
    ...scoped({
      ...sanitizeValue(value || {}),
      torneo,
      cat
    }),
    actualizadoEnMs: value?.updatedAt || value?.ts || now,
    creadoAt: value?.creadoAt || value?.ts || now
  };
}

function normalizeTemporada(id, value) {
  const record = scoped(sanitizeValue(value || {}));
  return {
    ...record,
    _legacyRealtimeKey: id,
    tablaFinal: record.tablaFinal || record.tabla || [],
    actualizadoEnMs: record.updatedAt || record.ts || now,
    creadoAt: record.creadoAt || record.ts || now
  };
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields = {};
    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) fields[key] = toFirestoreValue(val);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value) {
  if (!value || value.nullValue === null) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) {
    const out = {};
    Object.entries(value.mapValue.fields || {}).forEach(([key, val]) => {
      out[key] = fromFirestoreValue(val);
    });
    return out;
  }
  return null;
}

function toFirestoreFields(data) {
  const fields = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) fields[key] = toFirestoreValue(value);
  });
  return fields;
}

function documentName(collection, id) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId(id)}`;
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function readRealtimeRoot() {
  return readJson(`${RTDB_URL}/.json`);
}

async function listFirestore(collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${FIRESTORE_BASE}/${collection}?key=${API_KEY}&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const response = await fetch(url);
    if (response.status === 404) return docs;
    if (!response.ok) throw new Error(`${collection}: ${response.status} ${await response.text()}`);
    const payload = await response.json();
    (payload.documents || []).forEach((doc) => {
      docs.push({
        id: doc.name.split('/').pop(),
        data: Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]))
      });
    });
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function commitWrites(writes) {
  if (!writes.length) return;
  for (let i = 0; i < writes.length; i += 450) {
    const chunk = writes.slice(i, i + 450);
    if (DRY_RUN) {
      console.log(`[dry-run] commit ${chunk.length} writes`);
      continue;
    }
    const response = await fetch(COMMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: chunk })
    });
    if (!response.ok) {
      throw new Error(`Firestore commit failed: ${response.status} ${await response.text()}`);
    }
    console.log(`commit ${chunk.length} writes OK`);
  }
}

function setWrite(collection, id, data) {
  return {
    update: {
      name: documentName(collection, id),
      fields: toFirestoreFields({
        ...data,
        migradoDesdeRealtime: true,
        migradoEnMs: now
      })
    }
  };
}

function deleteWrite(collection, id) {
  return { delete: documentName(collection, id) };
}

function addObjectCollection(writes, collection, obj, normalizer = normalizeScopedGeneric) {
  Object.entries(obj || {}).forEach(([id, value]) => {
    writes.push(setWrite(collection, id, normalizer(id, value)));
  });
}

async function main() {
  if (VERIFY_ONLY) {
    await verifyFirestore();
    return;
  }
  console.log(DRY_RUN ? 'MIGRACION EN SIMULACION' : 'MIGRACION REAL');
  const root = await readRealtimeRoot();
  const writes = [];

  addObjectCollection(writes, 'equipos', root.equipos, normalizeEquipo);
  addObjectCollection(writes, 'partidos', root.partidos, normalizePartido);
  addObjectCollection(writes, 'productos', root.productos, (id, value) => sanitizeValue({ ...(value || {}), _legacyRealtimeKey: id, actualizadoEnMs: value?.updatedAt || now }));
  addObjectCollection(writes, 'ventas', root.ventas, normalizeScopedGeneric);
  addObjectCollection(writes, 'gastosTienda', root.gastosTienda, normalizeScopedGeneric);
  addObjectCollection(writes, 'turnos', root.turnos, normalizeScopedGeneric);
  addObjectCollection(writes, 'arbitros', root.arbitros, normalizeScopedGeneric);
  addObjectCollection(writes, 'trabajadores', root.trabajadores, normalizeScopedGeneric);
  addObjectCollection(writes, 'gastosTrab', root.gastosTrab, normalizeScopedGeneric);
  addObjectCollection(writes, 'usuarios', root.usuarios, normalizeUsuario);
  addObjectCollection(writes, 'solicitudes', root.solicitudes, normalizeScopedGeneric);
  addObjectCollection(writes, 'inscripciones', root.inscripciones, normalizeInscripcion);
  addObjectCollection(writes, 'pagos', root.pagos, normalizeScopedGeneric);

  Object.entries(root.inscripciones || {}).forEach(([inscId, raw]) => {
    const insc = normalizeInscripcion(inscId, raw);
    Object.entries(raw?.abonos || {}).forEach(([abonoId, abono]) => {
      const [pagoId, pago] = normalizePagoFromAbono(inscId, insc, abonoId, abono);
      writes.push(setWrite('pagos', pagoId, pago));
    });
  });

  Object.entries(root.mercadotecnia || {}).forEach(([id, value]) => {
    writes.push(setWrite('mercadotecnia', normalizeMarketingKey(id), normalizeMercadotecnia(id, value)));
  });

  const validMarketingIds = new Set(['lombardo_toledano_cat_libre_varonil', 'lombardo_toledano_cat_libre_femenil', 'nuevos_valores_cat_infantil', 'nuevos_valores_cat_osos', 'nuevos_valores_cat_juvenil']);
  const existingMarketing = await listFirestore('mercadotecnia');
  existingMarketing.forEach((doc) => {
    if (!validMarketingIds.has(doc.id)) {
      writes.push(deleteWrite('mercadotecnia', doc.id));
      console.log(`legacy marketing cleanup: ${doc.id}`);
    }
  });

  Object.entries(root.historial || root.temporadas || {}).forEach(([id, value]) => {
    writes.push(setWrite('temporadas', id, normalizeTemporada(id, value)));
  });

  const migratedEquipoNames = new Map(Object.entries(root.equipos || {}).map(([id, value]) => {
    const e = normalizeEquipo(id, value);
    return [`${e.torneo}|${e.cat}|${e.nombreNormalizado}`, id];
  }));
  const existingEquipos = await listFirestore('equipos');
  existingEquipos.forEach((doc) => {
    const e = scoped(doc.data || {});
    const key = `${e.torneo}|${e.cat}|${normalizeName(e.nombre)}`;
    const migratedId = migratedEquipoNames.get(key);
    if (migratedId && migratedId !== doc.id) {
      writes.push(deleteWrite('equipos', doc.id));
      console.log(`duplicate equipo cleanup: ${doc.id} -> ${migratedId}`);
    }
  });

  const counts = {};
  writes.forEach((write) => {
    const name = write.update?.name || write.delete || '';
    const parts = name.split('/documents/')[1]?.split('/') || [];
    const col = parts[0] || 'unknown';
    const type = write.delete ? 'delete' : 'upsert';
    counts[`${col}:${type}`] = (counts[`${col}:${type}`] || 0) + 1;
  });

  console.log('writes:', counts);
  await commitWrites(writes);
  console.log('Migracion terminada.');
}

async function verifyFirestore() {
  const collections = ['equipos', 'partidos', 'productos', 'turnos', 'arbitros', 'usuarios', 'inscripciones', 'pagos', 'mercadotecnia', 'temporadas'];
  const legacyNeedles = ['villa', 'liga_alta', 'liga_media', 'liga_baja_a', 'liga_baja_b', 'cat_juvenil_a', 'cat_juvenil_b', 'Torneo Los Alamitos', 'Los Alamitos'];
  const report = {};
  const legacyHits = [];
  for (const collection of collections) {
    const docs = await listFirestore(collection);
    report[collection] = docs.length;
    docs.forEach((doc) => {
      const text = JSON.stringify(doc.data || {});
      legacyNeedles.forEach((needle) => {
        if (text.includes(needle)) legacyHits.push(`${collection}/${doc.id}: ${needle}`);
      });
    });
  }
  console.log('firestore counts:', report);
  if (legacyHits.length) {
    console.log('legacy hits:');
    legacyHits.forEach((hit) => console.log(`- ${hit}`));
    process.exitCode = 2;
    return;
  }
  console.log('Sin IDs/textos viejos detectados en Firestore.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
