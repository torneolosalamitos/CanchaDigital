const AUDITABLE_COLLECTIONS = new Set([
  'equipos',
  'partidos',
  'inscripciones',
  'pagos',
  'productos',
  'ventas',
  'gastosTienda',
  'turnos',
  'arbitros',
  'trabajadores',
  'gastosTrab',
  'usuarios',
  'solicitudes',
  'temporadas',
  'categorias'
]);

const AUDIT_IGNORED_FIELDS = new Set([
  'actualizadoEn',
  'updatedAt',
  'lastLogin',
  'timerRunning',
  'elapsed'
]);

const AUDIT_PRIVATE_FIELDS = new Set([
  'password',
  'pass',
  'token',
  'authorization',
  'logo',
  'foto',
  'imagen',
  'adminScope'
]);

const AUDIT_ENTITY_LABELS = {
  equipos: 'Equipo',
  partidos: 'Partido',
  inscripciones: 'Inscripcion',
  pagos: 'Pago',
  productos: 'Producto',
  ventas: 'Venta',
  gastosTienda: 'Gasto de tienda',
  turnos: 'Turno',
  arbitros: 'Arbitro',
  trabajadores: 'Colaborador',
  gastosTrab: 'Pago de capital humano',
  usuarios: 'Usuario',
  solicitudes: 'Solicitud',
  temporadas: 'Temporada',
  categorias: 'Categoria'
};

let auditLoadPromise = null;
let auditLoadedAt = 0;

function auditTimestampMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function auditSafeValue(value) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  if (Array.isArray(value)) return `[${value.length} elementos]`;
  if (typeof value === 'object') return '{datos actualizados}';
  return String(value);
}

function auditChangedFields(data = {}) {
  return Object.entries(data)
    .filter(([key]) => !AUDIT_IGNORED_FIELDS.has(key) && !AUDIT_PRIVATE_FIELDS.has(key))
    .slice(0, 18)
    .reduce((result, [key, value]) => {
      result[key] = auditSafeValue(value);
      return result;
    }, {});
}

function auditEntityName(collection, id, data = {}) {
  return data.nombre || data.equipoNombre || data.nombreEquipo || data.concepto ||
    data.email || data.seasonName || data.fecha || id || 'Registro';
}

function recordAuditMutation(action, collection, id, data = {}) {
  if (!fs || !AUDITABLE_COLLECTIONS.has(collection)) return;
  if (!currentUser || !(isAdmin || isOwner)) return;

  const changed = auditChangedFields(data);
  if (action === 'update' && !Object.keys(changed).length) return;

  const scoped = normalizeScopedRecord(data || {});
  const entry = {
    action,
    collection,
    entityId: id || '',
    entityLabel: AUDIT_ENTITY_LABELS[collection] || collection,
    entityName: auditEntityName(collection, id, data),
    torneo: scoped.torneo,
    cat: scoped.cat,
    torneoId: scoped.torneoId,
    categoriaId: scoped.categoriaId,
    scopeKey: `${scoped.torneo}__${scoped.cat}`,
    changed,
    actorUid: currentUser.uid || '',
    actorEmail: currentUser.email || '',
    actorName: currentUser.displayName || currentUser.email || 'Usuario',
    actorRole: isOwner ? 'owner' : (isAdmin ? 'admin' : 'captain'),
    createdAtMs: Date.now(),
    createdAt: firestoreServerTimestamp()
  };

  fs.collection('audit_logs').add(entry).then((ref) => {
    C.auditLogs[ref.id] = { ...entry, _key: ref.id };
    if (typeof renderControlCenter === 'function' && isPageActive('control-center')) {
      renderControlCenter({ keepAuditCache: true });
    }
  }).catch((error) => console.warn('No se pudo guardar la auditoria:', error));
}

function normalizeAuditDoc(doc) {
  const data = doc.data ? (doc.data() || {}) : (doc || {});
  return {
    ...data,
    _key: doc.id || data._key || '',
    createdAtMs: Number(data.createdAtMs || auditTimestampMs(data.createdAt) || 0)
  };
}

async function loadAuditLogs(force = false) {
  if (!fs || !currentUser || !(isAdmin || isOwner)) return Object.values(C.auditLogs || {});
  if (!force && Date.now() - auditLoadedAt < 30000) return Object.values(C.auditLogs || {});
  if (auditLoadPromise) return auditLoadPromise;

  auditLoadPromise = (async () => {
    const docs = [];
    if (isOwner) {
      const snapshot = await fs.collection('audit_logs').limit(180).get();
      snapshot.forEach((doc) => docs.push(normalizeAuditDoc(doc)));
    } else {
      const scopes = [];
      getManagedTorneos().forEach((torneo) => {
        getManagedCats(torneo).forEach((cat) => scopes.push({ torneo, cat }));
      });
      const snapshots = await Promise.all(scopes.map(({ torneo, cat }) => (
        fs.collection('audit_logs')
          .where('scopeKey', '==', `${torneo}__${cat}`)
          .limit(50)
          .get()
          .catch((error) => {
            console.warn(`Auditoria ${torneo}/${cat}:`, error);
            return null;
          })
      )));
      snapshots.filter(Boolean).forEach((snapshot) => {
        snapshot.forEach((doc) => docs.push(normalizeAuditDoc(doc)));
      });
    }

    clearObj(C.auditLogs);
    docs
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 180)
      .forEach((entry) => { C.auditLogs[entry._key] = entry; });
    auditLoadedAt = Date.now();
    return Object.values(C.auditLogs);
  })().finally(() => { auditLoadPromise = null; });

  return auditLoadPromise;
}

function auditActionLabel(action) {
  return ({ create: 'Creo', update: 'Actualizo', delete: 'Elimino' })[action] || 'Modifico';
}
