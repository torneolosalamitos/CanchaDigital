const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const { FieldValue: FirestoreFieldValue } = require('@google-cloud/firestore');

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue || FirestoreFieldValue;
const DEFAULT_ARBITRAJE_MONTO_EQUIPO = 250;

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsAppTo(phone) {
  let clean = String(phone || "").replace(/\D/g, "");

  // Meta/WhatsApp a veces entrega números mexicanos como 521 + 10 dígitos.
  // Para enviar mensajes por Cloud API debe usarse 52 + 10 dígitos.
  if (clean.startsWith("521") && clean.length === 13) {
    clean = "52" + clean.slice(3);
  }

  return clean;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .trim();
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

function money(value) {
  const amount = Number(value || 0);
  return '$' + amount.toLocaleString('es-MX');
}

function firstAllowed(value) {
  if (Array.isArray(value)) return value[0] || null;
  if (value && typeof value === 'object') return Object.keys(value).find((key) => value[key]) || Object.keys(value)[0] || null;
  return value || null;
}

function allowedList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value).filter((key) => value[key]);
  return value ? [value] : [];
}

async function sendWhatsAppText(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp deshabilitado] Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID.');
    return { ok: false, skipped: true };
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const normalizedTo = normalizeWhatsAppTo(to);
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'text',
    text: { body }
  };
  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('WhatsApp send error', {
      status: error.response?.status,
      data: error.response?.data,
      url,
      payload,
    });
    throw error;
  }
}

async function logBotEvent(data) {
  await db.collection('bot_logs').add({
    telefonoWhatsapp: data.telefonoWhatsapp || '',
    mensaje: data.mensaje || '',
    tipo: data.tipo || 'info',
    resultado: data.resultado || '',
    error: data.error || null,
    creadoEn: FieldValue.serverTimestamp()
  });
}

async function getAuthorizedUser(phone) {
  const directSnap = await db.collection('usuarios_autorizados').doc(phone).get();
  if (directSnap.exists) {
    const user = { _key: directSnap.id, ...directSnap.data() };
    return user.activo === true ? user : null;
  }

  const querySnap = await db.collection('usuarios_autorizados')
    .where('telefonoWhatsapp', '==', phone)
    .limit(1)
    .get();
  if (!querySnap.empty) {
    const doc = querySnap.docs[0];
    const user = { _key: doc.id, ...doc.data() };
    return user.activo === true ? user : null;
  }

  const prefixedSnap = await db.collection('usuarios_autorizados').doc(`user_${phone}`).get();
  if (prefixedSnap.exists) {
    const user = { _key: prefixedSnap.id, ...prefixedSnap.data() };
    return user.activo === true ? user : null;
  }

  return null;
}

async function getSession(phone, user) {
  const torneosPermitidos = allowedList(user.torneosPermitidos);
  const categoriasPermitidas = allowedList(user.categoriasPermitidas);
  const defaultTorneo = firstAllowed(user.torneosPermitidos);
  const defaultCategoria = firstAllowed(user.categoriasPermitidas);
  const ref = db.collection('bot_sessions').doc(phone);
  const snap = await ref.get();

  if (!snap.exists) {
    const session = {
      telefonoWhatsapp: phone,
      torneoActivo: defaultTorneo,
      categoriaActiva: defaultCategoria,
      esperandoConfirmacion: false,
      ultimoComando: 'ninguno',
      ultimoEquipoId: 'ninguno',
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp()
    };
    await ref.set(session, { merge: true });
    return session;
  }

  const session = snap.data() || {};
  const patch = {};
  if (!torneosPermitidos.includes(session.torneoActivo)) {
    patch.torneoActivo = defaultTorneo;
    session.torneoActivo = defaultTorneo;
  }
  if (!categoriasPermitidas.includes(session.categoriaActiva)) {
    patch.categoriaActiva = defaultCategoria;
    session.categoriaActiva = defaultCategoria;
  }
  if (Object.keys(patch).length) {
    patch.actualizadoEn = FieldValue.serverTimestamp();
    await ref.set(patch, { merge: true });
  }
  return { telefonoWhatsapp: phone, ...session };
}

function parseCommand(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const normalized = normalizeText(clean);
  if (normalized === '1') return { type: 'confirm' };
  if (normalized === '2') return { type: 'cancel' };
  if (normalized === '/menu') return { type: 'menu' };
  if (normalized === '/deudores') return { type: 'deudores' };
  if (normalized === '/revertir ultimo') return { type: 'revertir_ultimo' };
  if (normalized === '/arbitrajes' || normalized === '/arbitrajes pendientes') return { type: 'arbitrajes', pendientes: true };
  if (normalized === '/juegos' || normalized.startsWith('/juegos ')) {
    const raw = clean.slice('/juegos'.length).trim();
    const rawNorm = normalizeText(raw);
    const periodos = {
      hoy: 'hoy',
      manana: 'manana',
      'mañana': 'manana',
      ayer: 'ayer',
      semana: 'semana',
      pasados: 'pasados'
    };
    if (!raw) return { type: 'juegos', periodo: 'proximos', equipoTexto: '' };
    if (periodos[rawNorm]) return { type: 'juegos', periodo: periodos[rawNorm], equipoTexto: '' };
    if (rawNorm.endsWith(' semana')) {
      return { type: 'juegos', periodo: 'semana', equipoTexto: raw.replace(/\s+semana$/i, '').trim() };
    }
    return { type: 'juegos', periodo: 'proximos', equipoTexto: raw };
  }

  if (normalized.startsWith('/saldo ')) {
    return { type: 'saldo', equipoTexto: clean.slice('/saldo '.length).trim() };
  }
  if (normalized.startsWith('/historial ')) {
    return { type: 'historial', equipoTexto: clean.slice('/historial '.length).trim() };
  }
  if (normalized.startsWith('/pago ')) {
    const raw = clean.slice('/pago '.length).trim();
    const tokens = raw.split(/\s+/).filter(Boolean);
    const amountIndex = tokens.findIndex((token) => Number.isFinite(Number(token)) && Number(token) > 0);
    if (amountIndex > 0) {
      const details = parsePaymentDetails(tokens.slice(amountIndex + 1), { defaultConcepto: 'inscripcion', allowConcepto: true });
      return {
        type: 'pago',
        equipoTexto: tokens.slice(0, amountIndex).join(' '),
        monto: Number(tokens[amountIndex]),
        ...details
      };
    }
  }
  if (normalized.startsWith('/arbitraje ')) {
    const raw = clean.slice('/arbitraje '.length).trim();
    const tokens = raw.split(/\s+/).filter(Boolean);
    const amountIndex = tokens.findIndex((token) => Number.isFinite(Number(token)) && Number(token) > 0);
    if (amountIndex > 0) {
      const details = parsePaymentDetails(tokens.slice(amountIndex + 1), { defaultConcepto: 'arbitraje', allowConcepto: false });
      return {
        type: 'arbitraje_pago',
        equipoTexto: tokens.slice(0, amountIndex).join(' '),
        monto: Number(tokens[amountIndex]),
        concepto: 'arbitraje',
        ...details
      };
    }
  }
  return { type: 'unknown' };
}

function parsePaymentDetails(tokens, options = {}) {
  const defaultConcepto = options.defaultConcepto || 'inscripcion';
  const allowConcepto = options.allowConcepto !== false;
  const metodoSet = new Set(['efectivo', 'transferencia']);
  let concepto = defaultConcepto;
  let metodoPago = 'no_especificado';
  let recibidoPor = 'no_especificado';
  let nota = '';
  let fechaFiltro = '';
  let partidoNumero = null;
  let i = 0;

  if (allowConcepto && tokens[i] && !metodoSet.has(normalizeText(tokens[i])) && !['recibido', 'nota', 'fecha', 'partido'].includes(normalizeText(tokens[i]))) {
    concepto = tokens[i];
    i += 1;
  }

  while (i < tokens.length) {
    const token = normalizeText(tokens[i]);
    if (metodoSet.has(token)) {
      metodoPago = token;
      i += 1;
      continue;
    }
    if (token === 'recibido' && normalizeText(tokens[i + 1]) === 'por') {
      i += 2;
      const parts = [];
      while (i < tokens.length) {
        const next = normalizeText(tokens[i]);
        if (next === 'nota' || next === 'fecha' || next === 'partido' || metodoSet.has(next)) break;
        parts.push(tokens[i]);
        i += 1;
      }
      recibidoPor = parts.join(' ').trim() || 'no_especificado';
      continue;
    }
    if (token === 'fecha' && tokens[i + 1]) {
      fechaFiltro = tokens[i + 1];
      i += 2;
      continue;
    }
    if (token === 'partido' && tokens[i + 1]) {
      const number = Number(tokens[i + 1]);
      partidoNumero = Number.isFinite(number) && number > 0 ? number : null;
      i += 2;
      continue;
    }
    if (token === 'nota') {
      nota = tokens.slice(i + 1).join(' ').trim();
      break;
    }
    i += 1;
  }

  return { concepto, metodoPago, recibidoPor, nota, fechaFiltro, partidoNumero };
}

async function findTeamByAlias(teamText, torneoId, categoriaId) {
  const query = normalizeText(teamText);
  if (!query) return { status: 'not_found' };

  const snap = await db.collection('equipos')
    .where('torneoId', '==', torneoId)
    .where('categoriaId', '==', categoriaId)
    .get();

  const matches = [];
  snap.forEach((doc) => {
    const team = doc.data() || {};
    const aliasRaw = Array.isArray(team.alias) ? team.alias : String(team.alias || '').split(',');
    const aliases = [
      team.nombreNormalizado,
      team.nombre,
      ...aliasRaw
    ].map(normalizeText).filter(Boolean);

    const found = aliases.some((alias) => (
      alias === query ||
      alias.includes(query) ||
      (alias.length >= 4 && query.includes(alias))
    ));
    if (found) matches.push({ teamId: doc.id, team: { _key: doc.id, ...team } });
  });

  if (!matches.length) return { status: 'not_found' };
  if (matches.length > 1) return { status: 'multiple', matches };
  return { status: 'ok', teamId: matches[0].teamId, team: matches[0].team };
}

async function getInscripcionByEquipo(equipoId, torneoId, categoriaId) {
  let snap = await db.collection('inscripciones')
    .where('equipoId', '==', equipoId)
    .where('torneoId', '==', torneoId)
    .where('categoriaId', '==', categoriaId)
    .limit(1)
    .get();

  if (snap.empty) {
    snap = await db.collection('inscripciones')
      .where('equipoKey', '==', equipoId)
      .where('torneoId', '==', torneoId)
      .where('categoriaId', '==', categoriaId)
      .limit(1)
      .get();
  }

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { inscripcionId: doc.id, inscripcion: { _key: doc.id, ...doc.data() } };
}

function normalizeTeamKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,\-\/\\_()[\]{}:;'"!¡¿?#$%&*+=|<>~`@^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getInscripcionesActivas(session) {
  const torneoActivo = session.torneoActivo || session.torneoId;
  const categoriaActiva = session.categoriaActiva || session.categoriaId;
  const snap = await db.collection('inscripciones')
    .where('torneoId', '==', torneoActivo)
    .where('categoriaId', '==', categoriaActiva)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    _key: doc.id,
    ...doc.data()
  }));
}

async function getEquiposMapForInscripciones(inscripciones) {
  const ids = [...new Set(inscripciones.map((insc) => insc.equipoId || insc.equipoKey).filter(Boolean))];
  const entries = await Promise.all(ids.map(async (equipoId) => {
    try {
      const snap = await db.collection('equipos').doc(equipoId).get();
      return snap.exists ? [equipoId, { id: snap.id, _key: snap.id, ...snap.data() }] : null;
    } catch (_err) {
      return null;
    }
  }));
  return Object.fromEntries(entries.filter(Boolean));
}

function inscripcionSearchValues(inscripcion, equipo) {
  const aliasRaw = inscripcion.alias || equipo?.alias || [];
  const aliasList = Array.isArray(aliasRaw) ? aliasRaw : String(aliasRaw || '').split(',');
  return [
    inscripcion.equipo,
    inscripcion.equipoNombre,
    inscripcion.nombreEquipo,
    inscripcion.nombre,
    inscripcion.nombreCorto,
    equipo?.nombre,
    equipo?.nombreNormalizado,
    equipo?.nombreCorto,
    ...aliasList
  ].map(normalizeTeamKey).filter(Boolean);
}

async function findInscripcionByInput(inputEquipo, session) {
  const inputNormalizado = normalizeTeamKey(inputEquipo);
  const inscripciones = await getInscripcionesActivas(session);
  const equiposMap = await getEquiposMapForInscripciones(inscripciones);
  const withSearch = inscripciones.map((inscripcion) => {
    const equipoId = inscripcion.equipoId || inscripcion.equipoKey;
    const equipo = equipoId ? equiposMap[equipoId] : null;
    return {
      inscripcion,
      equipo,
      values: inscripcionSearchValues(inscripcion, equipo)
    };
  });

  let matches = withSearch.filter((item) => item.values.some((value) => value === inputNormalizado));
  if (!matches.length) {
    matches = withSearch.filter((item) => item.values.some((value) => (
      value.includes(inputNormalizado) ||
      inputNormalizado.includes(value) ||
      value.split(' ').some((part) => part.length >= 4 && part === inputNormalizado)
    )));
  }

  if (!matches.length) {
    console.log('INSCRIPCION_NO_ENCONTRADA', {
      inputEquipo,
      inputNormalizado,
      torneoActivo: session.torneoActivo || session.torneoId,
      categoriaActiva: session.categoriaActiva || session.categoriaId,
      inscripcionesDisponibles: inscripciones.map((i) => ({
        id: i.id || i._key,
        equipo: i.equipo,
        equipoNombre: i.equipoNombre,
        nombreEquipo: i.nombreEquipo,
        saldo: i.saldo,
        montoPagado: i.montoPagado
      }))
    });
    return null;
  }

  const selected = matches[0];
  return {
    inscripcionId: selected.inscripcion.id || selected.inscripcion._key,
    inscripcion: selected.inscripcion,
    equipo: selected.equipo || null
  };
}

function titleCase(value) {
  const clean = String(value || '').replace(/_/g, ' ').trim();
  if (!clean) return 'No especificado';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function formatDateLabel(value) {
  const iso = normalizeDateISO(value);
  if (!iso) return 'Sin fecha';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function addDaysISO(days) {
  const date = new Date(todayISO() + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function normalizeDateISO(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString().split('T')[0];
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
  }
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate().toISOString().split('T')[0];
    if (value.seconds) return new Date(value.seconds * 1000).toISOString().split('T')[0];
  }
  return '';
}

function normalizeUserDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    return `${match[3]}-${month}-${day}`;
  }
  return normalizeDateISO(text);
}

function getPartidoFecha(partido) {
  return normalizeDateISO(partido.fecha || partido.fechaPartido || partido.date || partido.createdAt);
}

function getPartidoHora(partido) {
  const inicio = String(partido.horaIni || partido.horaInicio || partido.hora || partido.horario || '').trim();
  const fin = String(partido.horaFin || partido.horaFinal || partido.horaTermino || '').trim();
  if (inicio && fin) return `${inicio} - ${fin}`;
  return inicio || fin || 'Sin hora';
}

function getPartidoEstado(partido) {
  return String(partido.estado || partido.status || 'pendiente').trim() || 'pendiente';
}

function getPartidoLocalName(partido) {
  return partido.equipoLocalNombre || partido.localNombre || partido.equipoLocal || partido.local || 'Local';
}

function getPartidoVisitanteName(partido) {
  return partido.equipoVisitanteNombre || partido.visitanteNombre || partido.visitaNombre || partido.equipoVisitante || partido.visitante || partido.visita || 'Visitante';
}

function getPartidoLocalId(partido) {
  return partido.equipoLocalId || partido.localId || partido.local || partido.equipoLocal || '';
}

function getPartidoVisitanteId(partido) {
  return partido.equipoVisitanteId || partido.visitanteId || partido.visitaId || partido.visitante || partido.visita || partido.equipoVisitante || '';
}

function isArbitrajePagado(partido, side) {
  const arbitrajes = partido.arbitrajes || {};
  const expected = getMontoEsperadoArbitrajeEquipo(partido, side).montoEsperadoEquipo;
  const paid = getMontoPagadoArbitrajeEquipo(partido, side);
  if (expected > 0 && paid >= expected) return true;
  if (side === 'local') {
    return !!(
      arbitrajes.equipoLocal?.pagado ||
      partido.arbitrajeLocalPagado ||
      partido.localArbitrajePagado ||
      partido.arbPago?.local?.pagado ||
      partido.arbPago?.local?.ef ||
      partido.arbPago?.local?.tr ||
      partido.arbPago?.local?.pp
    );
  }
  return !!(
    arbitrajes.equipoVisitante?.pagado ||
    partido.arbitrajeVisitantePagado ||
    partido.visitanteArbitrajePagado ||
    partido.arbPago?.visita?.pagado ||
    partido.arbPago?.visita?.ef ||
    partido.arbPago?.visita?.tr ||
    partido.arbPago?.visita?.pp
  );
}

function getMontoEsperadoArbitrajeEquipo(partido, equipoRole) {
  const arbitrajes = partido.arbitrajes || {};
  const local = equipoRole === 'local';
  const candidates = local
    ? [
        { value: arbitrajes.equipoLocal?.montoEsperado, fuente: 'arbitrajes.equipoLocal.montoEsperado' },
        { value: partido.arbitrajeLocalMontoEsperado, fuente: 'arbitrajeLocalMontoEsperado' },
        { value: partido.montoArbitrajeEquipo, fuente: 'montoArbitrajeEquipo' },
        { value: partido.montoArbitraje, fuente: 'montoArbitraje' }
      ]
    : [
        { value: arbitrajes.equipoVisitante?.montoEsperado, fuente: 'arbitrajes.equipoVisitante.montoEsperado' },
        { value: partido.arbitrajeVisitanteMontoEsperado, fuente: 'arbitrajeVisitanteMontoEsperado' },
        { value: partido.montoArbitrajeEquipo, fuente: 'montoArbitrajeEquipo' },
        { value: partido.montoArbitraje, fuente: 'montoArbitraje' }
      ];
  const found = candidates.find((item) => Number(item.value || 0) > 0);
  const result = {
    montoEsperadoEquipo: Number(found?.value || DEFAULT_ARBITRAJE_MONTO_EQUIPO),
    fuente: found?.fuente || 'DEFAULT_ARBITRAJE_MONTO_EQUIPO'
  };
  console.log('ARBITRAJE_MONTO_ESPERADO_CALCULADO', {
    partidoId: partido.id || partido._key || '',
    equipoRole,
    montoEsperadoEquipo: result.montoEsperadoEquipo,
    fuente: result.fuente
  });
  return result;
}

function getArbitrajeMonto(partido, side) {
  return getMontoEsperadoArbitrajeEquipo(partido, side).montoEsperadoEquipo;
}

function getLegacyArbitrajePagado(partido, side) {
  const legacy = side === 'local' ? partido.arbPago?.local : partido.arbPago?.visita;
  if (!legacy || typeof legacy !== 'object') return 0;
  return ['ef', 'tr', 'pp', 'monto', 'montoPagado'].reduce((sum, key) => sum + Number(legacy[key] || 0), 0);
}

function getMontoPagadoArbitrajeEquipo(partido, side) {
  const arbitrajes = partido.arbitrajes || {};
  const node = side === 'local' ? arbitrajes.equipoLocal : arbitrajes.equipoVisitante;
  const flat = side === 'local' ? partido.arbitrajeLocalMontoPagado : partido.arbitrajeVisitanteMontoPagado;
  return Number(node?.montoPagado || flat || getLegacyArbitrajePagado(partido, side) || 0);
}

function getMontoPendienteArbitrajeEquipo(partido, side) {
  const expected = getMontoEsperadoArbitrajeEquipo(partido, side).montoEsperadoEquipo;
  const paid = getMontoPagadoArbitrajeEquipo(partido, side);
  return Math.max(expected - paid, 0);
}

function getArbitrajeEstadoEquipo(partido, side) {
  if (isArbitrajePagado(partido, side)) return 'pagado';
  if (getMontoPagadoArbitrajeEquipo(partido, side) > 0) return 'parcial';
  return 'pendiente';
}

function getMontoEsperadoPartidoTotal(partido) {
  return getMontoEsperadoArbitrajeEquipo(partido, 'local').montoEsperadoEquipo +
    getMontoEsperadoArbitrajeEquipo(partido, 'visitante').montoEsperadoEquipo;
}

function getPartidoSortValue(partido) {
  const fecha = getPartidoFecha(partido);
  const hora = getPartidoHora(partido).replace(/\D/g, '').padEnd(4, '0').slice(0, 4);
  return `${fecha || '9999-99-99'}${hora}`;
}

async function getPartidosActivos(session) {
  const torneoActivo = session.torneoActivo || session.torneoId;
  const categoriaActiva = session.categoriaActiva || session.categoriaId;
  const snap = await db.collection('partidos')
    .where('torneoId', '==', torneoActivo)
    .where('categoriaId', '==', categoriaActiva)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, _key: doc.id, ...doc.data() }));
}

function equipoParticipaEnPartido(partido, insc) {
  const equipoId = insc.inscripcion.equipoId || insc.inscripcion.equipoKey || insc.equipo?.id || '';
  const names = [
    insc.inscripcion.equipoNombre,
    insc.inscripcion.nombreEquipo,
    insc.inscripcion.nombre,
    insc.equipo?.nombre
  ].map(normalizeTeamKey).filter(Boolean);
  const localId = String(getPartidoLocalId(partido) || '');
  const visitanteId = String(getPartidoVisitanteId(partido) || '');
  if (equipoId && (localId === equipoId || visitanteId === equipoId)) return true;
  const localName = normalizeTeamKey(getPartidoLocalName(partido));
  const visitanteName = normalizeTeamKey(getPartidoVisitanteName(partido));
  return names.some((name) => localName === name || visitanteName === name || localName.includes(name) || visitanteName.includes(name) || name.includes(localName) || name.includes(visitanteName));
}

function getEquipoSideInPartido(partido, insc) {
  const equipoId = insc.inscripcion.equipoId || insc.inscripcion.equipoKey || insc.equipo?.id || '';
  if (equipoId && String(getPartidoLocalId(partido) || '') === equipoId) return 'local';
  if (equipoId && String(getPartidoVisitanteId(partido) || '') === equipoId) return 'visitante';
  const names = [
    insc.inscripcion.equipoNombre,
    insc.inscripcion.nombreEquipo,
    insc.inscripcion.nombre,
    insc.equipo?.nombre
  ].map(normalizeTeamKey).filter(Boolean);
  const localName = normalizeTeamKey(getPartidoLocalName(partido));
  const visitanteName = normalizeTeamKey(getPartidoVisitanteName(partido));
  if (names.some((name) => localName === name || localName.includes(name) || name.includes(localName))) return 'local';
  if (names.some((name) => visitanteName === name || visitanteName.includes(name) || name.includes(visitanteName))) return 'visitante';
  return '';
}

function formatPartidoLine(partido, index) {
  const local = getPartidoLocalName(partido);
  const visitante = getPartidoVisitanteName(partido);
  const totalEsperado = getMontoEsperadoPartidoTotal(partido);
  const deudas = [
    formatArbitrajeDeudaPartido(partido, 'local', local),
    formatArbitrajeDeudaPartido(partido, 'visitante', visitante)
  ].filter(Boolean);
  const arbitrajeResumen = deudas.length
    ? ['Deudas de arbitraje:', ...deudas]
    : ['Arbitrajes: sin deudas pendientes'];
  return [
    `${index + 1}. ${local} vs ${visitante}`,
    `Fecha: ${formatDateLabel(getPartidoFecha(partido))}`,
    `Hora: ${getPartidoHora(partido)}`,
    `Estado: ${getPartidoEstado(partido)}`,
    ...arbitrajeResumen,
    `Total esperado partido: ${money(totalEsperado)}`
  ].join('\n');
}

function formatArbitrajeDeudaPartido(partido, side, equipoNombre) {
  const estado = getArbitrajeEstadoEquipo(partido, side);
  if (estado === 'pagado') return '';
  const expected = getMontoEsperadoArbitrajeEquipo(partido, side).montoEsperadoEquipo;
  const paid = getMontoPagadoArbitrajeEquipo(partido, side);
  const pending = Math.max(expected - paid, 0);
  if (estado === 'parcial') {
    return `- ${equipoNombre}: parcial ${money(paid)} / ${money(expected)}; debe ${money(pending)}`;
  }
  return `- ${equipoNombre}: pendiente; debe ${money(pending || expected)}`;
}

async function getPagosByInscripcion(inscripcionId, limit = 5, includeCanceled = false) {
  let docs = [];
  try {
    let query = db.collection('pagos').where('inscripcionId', '==', inscripcionId);
    if (!includeCanceled) query = query.where('cancelado', '==', false);
    const snap = await query.orderBy('ts', 'desc').limit(limit).get();
    docs = snap.docs;
  } catch (_err) {
    const snap = await db.collection('pagos')
      .where('inscripcionId', '==', inscripcionId)
      .get();
    docs = snap.docs
      .filter((doc) => includeCanceled || doc.data()?.cancelado !== true)
      .sort((a, b) => Number(b.data()?.ts || 0) - Number(a.data()?.ts || 0))
      .slice(0, limit);
  }
  return docs.map((doc) => ({ pagoId: doc.id, ...doc.data() }));
}

function buildMenu() {
  return [
    'CanchaDigital Bot',
    '',
    'PAGOS',
    '/pago equipo monto inscripcion',
    '/arbitraje equipo monto',
    '',
    'CONSULTAS',
    '/saldo equipo',
    '/deudores',
    '/historial equipo',
    '',
    'JUEGOS',
    '/juegos',
    '/juegos hoy',
    '/juegos mañana',
    '/juegos ayer',
    '/juegos semana',
    '/juegos pasados',
    '/juegos equipo',
    '/juegos equipo semana',
    '',
    'ARBITRAJES',
    '/arbitrajes',
    '/arbitrajes pendientes',
    '',
    'CONTROL',
    '/revertir ultimo',
    '',
    'En pagos puedes agregar: efectivo, transferencia, recibido por, nota.',
    '',
    'Ejemplo:',
    '/pago inter 500 inscripcion efectivo recibido por Edel nota abonó antes del partido',
    '/arbitraje inter 250 transferencia recibido por Navo'
  ].join('\n');
}

function formatTeamSearchError(result) {
  if (result.status === 'not_found') return 'No encontré ese equipo en el torneo/categoría activos.';
  if (result.status === 'multiple') {
    const names = result.matches.slice(0, 5).map((item) => `- ${item.team.nombre}`).join('\n');
    return `Encontré varios equipos. Escribe el nombre más específico:\n${names}`;
  }
  return 'No pude identificar el equipo.';
}

async function handleSaldo(command, context) {
  const insc = await findInscripcionByInput(command.equipoTexto, context.session);
  if (!insc) return `El equipo ${command.equipoTexto} no tiene inscripción registrada.`;

  const total = Number(insc.inscripcion.montoTotal || insc.inscripcion.monto || 0);
  const pagado = Number(insc.inscripcion.montoPagado || 0);
  const saldo = Number(insc.inscripcion.saldo !== undefined ? insc.inscripcion.saldo : Math.max(0, total - pagado));
  const nombreEquipo = insc.inscripcion.equipoNombre || insc.inscripcion.nombreEquipo || insc.inscripcion.nombre || insc.equipo?.nombre || command.equipoTexto;
  return [
    `Equipo: ${nombreEquipo}`,
    `Total: ${money(total)}`,
    `Pagado: ${money(pagado)}`,
    `Saldo: ${money(saldo)}`,
    `Estado: ${insc.inscripcion.estado || 'pendiente'}`
  ].join('\n');
}

async function handleDeudores(context) {
  const inscripciones = await getInscripcionesActivas(context.session);
  const deudores = [];
  inscripciones.forEach((insc) => {
    const total = Number(insc.montoTotal || insc.monto || 0);
    const pagado = Number(insc.montoPagado || 0);
    const saldo = Number(insc.saldo !== undefined ? insc.saldo : Math.max(0, total - pagado));
    if (saldo > 0) deudores.push({ nombre: insc.equipoNombre || insc.nombreEquipo || insc.nombre || 'Equipo', saldo });
  });

  deudores.sort((a, b) => b.saldo - a.saldo);
  if (!deudores.length) return 'Todos están al corriente.';
  return 'Deudores:\n' + deudores.slice(0, 10).map((item, index) => `${index + 1}. ${item.nombre} — debe ${money(item.saldo)}`).join('\n');
}

function filterPartidosByPeriodo(partidos, periodo) {
  const today = todayISO();
  if (periodo === 'hoy') return partidos.filter((partido) => getPartidoFecha(partido) === today);
  if (periodo === 'manana') return partidos.filter((partido) => getPartidoFecha(partido) === addDaysISO(1));
  if (periodo === 'ayer') return partidos.filter((partido) => getPartidoFecha(partido) === addDaysISO(-1));
  if (periodo === 'semana') {
    const end = addDaysISO(7);
    return partidos.filter((partido) => {
      const fecha = getPartidoFecha(partido);
      return fecha >= today && fecha <= end;
    });
  }
  if (periodo === 'pasados') {
    return partidos.filter((partido) => {
      const fecha = getPartidoFecha(partido);
      return fecha && fecha < today;
    }).sort((a, b) => getPartidoSortValue(b).localeCompare(getPartidoSortValue(a)));
  }
  return partidos.filter((partido) => {
    const fecha = getPartidoFecha(partido);
    return !fecha || fecha >= today;
  });
}

async function handleJuegos(command, context) {
  const partidos = await getPartidosActivos(context.session);
  let filtered = filterPartidosByPeriodo(partidos, command.periodo || 'proximos');

  if (command.equipoTexto) {
    const insc = await findInscripcionByInput(command.equipoTexto, context.session);
    if (!insc) return `No encontré partidos para ${command.equipoTexto}.`;
    filtered = filtered.filter((partido) => equipoParticipaEnPartido(partido, insc));
  }

  filtered = filtered.sort((a, b) => (
    command.periodo === 'pasados'
      ? getPartidoSortValue(b).localeCompare(getPartidoSortValue(a))
      : getPartidoSortValue(a).localeCompare(getPartidoSortValue(b))
  )).slice(0, 10);

  console.log('PARTIDOS_CONSULTA', {
    comando: command.type,
    input: command.equipoTexto || command.periodo || '',
    torneoActivo: context.torneoId,
    categoriaActiva: context.categoriaId,
    total: filtered.length
  });

  if (!filtered.length) {
    console.log('PARTIDOS_NO_ENCONTRADOS', {
      comando: command.type,
      input: command.equipoTexto || command.periodo || '',
      torneoActivo: context.torneoId,
      categoriaActiva: context.categoriaId
    });
    return 'No encontré partidos para esa consulta.';
  }

  return `Partidos (${titleCase(command.periodo || 'proximos')}):\n\n` + filtered.map(formatPartidoLine).join('\n\n');
}

function getArbitrajesPendientesFromPartidos(partidos) {
  const pendientes = [];
  partidos.forEach((partido) => {
    if (getArbitrajeEstadoEquipo(partido, 'local') !== 'pagado') {
      pendientes.push({
        partido,
        partidoId: partido.id || partido._key,
        side: 'local',
        equipoId: getPartidoLocalId(partido),
        equipoNombre: getPartidoLocalName(partido),
        monto: getArbitrajeMonto(partido, 'local'),
        montoPagado: getMontoPagadoArbitrajeEquipo(partido, 'local'),
        montoPendiente: getMontoPendienteArbitrajeEquipo(partido, 'local'),
        estado: getArbitrajeEstadoEquipo(partido, 'local')
      });
    }
    if (getArbitrajeEstadoEquipo(partido, 'visitante') !== 'pagado') {
      pendientes.push({
        partido,
        partidoId: partido.id || partido._key,
        side: 'visitante',
        equipoId: getPartidoVisitanteId(partido),
        equipoNombre: getPartidoVisitanteName(partido),
        monto: getArbitrajeMonto(partido, 'visitante'),
        montoPagado: getMontoPagadoArbitrajeEquipo(partido, 'visitante'),
        montoPendiente: getMontoPendienteArbitrajeEquipo(partido, 'visitante'),
        estado: getArbitrajeEstadoEquipo(partido, 'visitante')
      });
    }
  });
  return pendientes.sort((a, b) => getPartidoSortValue(a.partido).localeCompare(getPartidoSortValue(b.partido)));
}

async function getArbitrajesPendientes(session) {
  const partidos = await getPartidosActivos(session);
  const pendientes = getArbitrajesPendientesFromPartidos(partidos).map((item) => {
    const fecha = getPartidoFecha(item.partido);
    const hora = getPartidoHora(item.partido);
    const localNombre = getPartidoLocalName(item.partido);
    const visitanteNombre = getPartidoVisitanteName(item.partido);
    return {
      partidoId: item.partidoId,
      partido: item.partido,
      equipoId: item.equipoId,
      equipoNombre: item.equipoNombre,
      equipoRole: item.side,
      side: item.side,
      localNombre,
      visitanteNombre,
      fecha,
      hora,
      montoEsperado: item.monto,
      montoPagado: item.montoPagado,
      montoPendiente: item.montoPendiente,
      estadoArbitraje: item.estado,
      torneoId: item.partido.torneoId || session.torneoActivo || session.torneoId,
      categoriaId: item.partido.categoriaId || session.categoriaActiva || session.categoriaId,
      pagado: false
    };
  }).sort((a, b) => getPartidoSortValue(a.partido).localeCompare(getPartidoSortValue(b.partido)));

  const numbered = pendientes.map((item, index) => ({ ...item, displayIndex: index + 1 }));
  console.log('ARBITRAJES_PENDIENTES_LISTA', {
    total: numbered.length,
    torneoActivo: session.torneoActivo || session.torneoId,
    categoriaActiva: session.categoriaActiva || session.categoriaId
  });
  return numbered;
}

async function handleArbitrajes(context) {
  const pendientes = (await getArbitrajesPendientes(context.session)).slice(0, 10);
  if (!pendientes.length) return 'No hay arbitrajes pendientes.';

  return 'Arbitrajes pendientes\n\n' + pendientes.map((item, index) => {
    const monto = Number(item.montoEsperado || 0) > 0
      ? `\nMonto esperado: ${money(item.montoEsperado)}\nMonto pagado: ${money(item.montoPagado || 0)}\nMonto pendiente: ${money(item.montoPendiente || item.montoEsperado)}`
      : '';
    return [
      `${item.displayIndex || index + 1}. ${item.equipoNombre} - ${titleCase(item.estadoArbitraje || 'pendiente')}`,
      `Partido: ${item.localNombre} vs ${item.visitanteNombre}`,
      `Fecha: ${formatDateLabel(item.fecha)}`,
      `Hora: ${item.hora}${monto}`
    ].join('\n');
  }).join('\n\n');
}

async function findPendingArbitrajeMatches(command, context) {
  const inputNormalizado = normalizeTeamKey(command.equipoTexto);
  const fechaFiltro = normalizeUserDate(command.fechaFiltro);
  const pendientes = await getArbitrajesPendientes(context.session);
  let matches = pendientes.filter((item) => {
    const equipoNormalizado = normalizeTeamKey(item.equipoNombre);
    return equipoNormalizado === inputNormalizado ||
      equipoNormalizado.includes(inputNormalizado) ||
      inputNormalizado.includes(equipoNormalizado) ||
      equipoNormalizado.split(' ').some((part) => part.length >= 4 && part === inputNormalizado);
  });

  if (command.partidoNumero) {
    matches = matches.filter((item) => Number(item.displayIndex) === Number(command.partidoNumero));
  }
  if (fechaFiltro) {
    matches = matches.filter((item) => item.fecha === fechaFiltro);
  }

  console.log('BUSCANDO_ARBITRAJE_PARA_EQUIPO', {
    inputEquipo: command.equipoTexto,
    inputNormalizado,
    candidatos: matches.map((item) => ({
      displayIndex: item.displayIndex,
      equipoNombre: item.equipoNombre,
      partidoId: item.partidoId,
      partido: `${item.localNombre} vs ${item.visitanteNombre}`,
      fecha: item.fecha,
      hora: item.hora
    }))
  });

  return { status: matches.length ? 'ok' : 'empty', matches };
}

async function savePendingArbitraje(command, context, match) {
  const equipoId = match.equipoId || `${match.partidoId}_${match.equipoRole || match.side || 'equipo'}`;
  const equipoNombre = match.equipoNombre || command.equipoTexto;
  const montoEsperadoEquipo = Number(match.montoEsperado || getMontoEsperadoArbitrajeEquipo(match.partido, match.equipoRole || match.side).montoEsperadoEquipo || DEFAULT_ARBITRAJE_MONTO_EQUIPO);
  const montoPagado = Number(command.monto || 0);
  const montoPendienteDespues = Math.max(montoEsperadoEquipo - montoPagado, 0);

  await db.collection('bot_pending_confirmations').doc(context.phone).set({
    telefonoWhatsapp: context.phone,
    tipo: 'arbitraje',
    torneoId: context.torneoId,
    categoriaId: context.categoriaId,
    equipoId,
    equipoNombre,
    partidoId: match.partidoId,
    side: match.equipoRole || match.side,
    partidoTexto: `${match.localNombre || getPartidoLocalName(match.partido)} vs ${match.visitanteNombre || getPartidoVisitanteName(match.partido)}`,
    fecha: match.fecha || getPartidoFecha(match.partido),
    hora: match.hora || getPartidoHora(match.partido),
    monto: montoPagado,
    montoPagado,
    montoEsperado: montoEsperadoEquipo,
    montoPendienteDespues,
    concepto: 'arbitraje',
    metodoPago: command.metodoPago || 'no_especificado',
    recibidoPor: command.recibidoPor || 'no_especificado',
    nota: command.nota || '',
    creadoEn: FieldValue.serverTimestamp(),
    expiraEnMs: Date.now() + 5 * 60 * 1000
  }, { merge: true });

  await db.collection('bot_sessions').doc(context.phone).set({
    ultimoComando: 'arbitraje_pendiente_confirmacion',
    ultimoEquipoId: equipoId,
    esperandoSeleccionArbitraje: false,
    arbitrajePendienteOpciones: [],
    pagoArbitrajePendiente: null,
    actualizadoEn: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log('PAGO_ARBITRAJE_PENDIENTE_CONFIRMACION', {
    telefonoWhatsapp: context.phone,
    torneoId: context.torneoId,
    categoriaId: context.categoriaId,
    equipoId,
    partidoId: match.partidoId,
    side: match.equipoRole || match.side,
    monto: montoPagado
  });

  return [
    'Confirma pago de arbitraje:',
    '',
    `Equipo: ${equipoNombre}`,
    `Monto pagado: ${money(montoPagado)}`,
    `Monto esperado: ${money(montoEsperadoEquipo)}`,
    `Monto pendiente: ${money(montoPendienteDespues)}`,
    `Método: ${titleCase(command.metodoPago)}`,
    `Recibió: ${titleCase(command.recibidoPor)}`,
    command.nota ? `Nota: ${command.nota}` : 'Nota: Sin nota',
    `Partido: ${match.localNombre || getPartidoLocalName(match.partido)} vs ${match.visitanteNombre || getPartidoVisitanteName(match.partido)}`,
    `Fecha: ${formatDateLabel(match.fecha || getPartidoFecha(match.partido))}`,
    `Hora: ${match.hora || getPartidoHora(match.partido)}`,
    '',
    'Responde:',
    '1 para confirmar',
    '2 para cancelar'
  ].join('\n');
}

async function handleArbitrajePago(command, context) {
  if (context.user.puedeRegistrarPagos !== true) return 'No tienes permiso para registrar pagos.';
  const result = await findPendingArbitrajeMatches(command, context);
  if (!result.matches.length) return `No encontré arbitraje pendiente para ${command.equipoTexto}.`;

  if (result.matches.length > 1) {
    const opciones = result.matches.slice(0, 5).map((match) => ({
      partidoId: match.partidoId,
      equipoId: match.equipoId,
      equipoNombre: match.equipoNombre,
      equipoRole: match.equipoRole,
      side: match.equipoRole || match.side,
      localNombre: match.localNombre,
      visitanteNombre: match.visitanteNombre,
      partidoTexto: `${match.localNombre} vs ${match.visitanteNombre}`,
      fecha: match.fecha,
      hora: match.hora,
      montoEsperado: match.montoEsperado,
      displayIndex: match.displayIndex
    }));

    await db.collection('bot_sessions').doc(context.phone).set({
      ultimoComando: 'seleccionar_arbitraje',
      esperandoSeleccionArbitraje: true,
      arbitrajePendienteOpciones: opciones,
      pagoArbitrajePendiente: {
        equipoTexto: command.equipoTexto,
        monto: Number(command.monto || 0),
        metodoPago: command.metodoPago || 'no_especificado',
        recibidoPor: command.recibidoPor || 'no_especificado',
        nota: command.nota || ''
      },
      actualizadoEn: FieldValue.serverTimestamp()
    }, { merge: true });

    return `Encontré varios arbitrajes pendientes para ${opciones[0]?.equipoNombre || command.equipoTexto}:\n\n` + opciones.map((opcion, index) => (
      `${index + 1}. ${opcion.partidoTexto} - ${formatDateLabel(opcion.fecha)} ${opcion.hora} - ${money(opcion.montoEsperado || command.monto)}`
    )).join('\n\n');
  }

  return savePendingArbitraje(command, context, result.matches[0]);
}

async function handleSeleccionArbitraje(command, context) {
  const opciones = Array.isArray(context.session.arbitrajePendienteOpciones)
    ? context.session.arbitrajePendienteOpciones
    : (Array.isArray(context.session.opcionesArbitraje) ? context.session.opcionesArbitraje : []);
  const opcion = opciones[command.optionIndex];
  const commandData = context.session.pagoArbitrajePendiente || context.session.comandoArbitrajePendiente || {};
  if (!opcion || !commandData.monto) return 'No encontré esa opción. Vuelve a intentar con /arbitraje equipo monto.';

  const partidoSnap = await db.collection('partidos').doc(opcion.partidoId).get();
  if (!partidoSnap.exists) return 'Ese partido ya no existe. Vuelve a intentar.';
  const fakeInsc = {
    inscripcionId: opcion.equipoId,
    inscripcion: {
      equipoId: opcion.equipoId,
      equipoNombre: opcion.equipoNombre
    },
    equipo: null
  };
  const match = {
    partido: { id: partidoSnap.id, _key: partidoSnap.id, ...partidoSnap.data() },
    partidoId: partidoSnap.id,
    side: opcion.equipoRole || opcion.side,
    equipoRole: opcion.equipoRole || opcion.side,
    equipoId: opcion.equipoId,
    equipoNombre: opcion.equipoNombre,
    localNombre: opcion.localNombre || getPartidoLocalName({ id: partidoSnap.id, _key: partidoSnap.id, ...partidoSnap.data() }),
    visitanteNombre: opcion.visitanteNombre || getPartidoVisitanteName({ id: partidoSnap.id, _key: partidoSnap.id, ...partidoSnap.data() }),
    fecha: opcion.fecha || getPartidoFecha({ id: partidoSnap.id, _key: partidoSnap.id, ...partidoSnap.data() }),
    hora: opcion.hora || getPartidoHora({ id: partidoSnap.id, _key: partidoSnap.id, ...partidoSnap.data() }),
    montoEsperado: opcion.montoEsperado
  };
  return savePendingArbitraje({
    equipoTexto: commandData.equipoTexto || opcion.equipoNombre,
    monto: Number(commandData.monto || 0),
    metodoPago: commandData.metodoPago || 'no_especificado',
    recibidoPor: commandData.recibidoPor || 'no_especificado',
    nota: commandData.nota || ''
  }, context, match, fakeInsc);
}

async function handleHistorial(command, context) {
  const insc = await findInscripcionByInput(command.equipoTexto, context.session);
  if (!insc) return `El equipo ${command.equipoTexto} no tiene inscripción registrada.`;

  const pagosInscripcion = await getPagosByInscripcion(insc.inscripcionId, 10, true);
  const equipoId = insc.inscripcion.equipoId || insc.inscripcion.equipoKey || insc.equipo?.id || '';
  let pagosArbitraje = [];
  if (equipoId) {
    const snap = await db.collection('pagos')
      .where('equipoId', '==', equipoId)
      .where('tipo', '==', 'arbitraje')
      .get();
    pagosArbitraje = snap.docs
      .map((doc) => ({ pagoId: doc.id, ...doc.data() }))
      .filter((pago) => pago.torneoId === context.torneoId && pago.categoriaId === context.categoriaId)
      .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
      .slice(0, 10);
  }
  const pagos = [...pagosInscripcion, ...pagosArbitraje]
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
    .slice(0, 10);
  if (!pagos.length) return 'Sin pagos registrados.';
  const nombreEquipo = insc.inscripcion.equipoNombre || insc.inscripcion.nombreEquipo || insc.inscripcion.nombre || insc.equipo?.nombre || command.equipoTexto;
  return `Historial ${nombreEquipo}\n\n` + pagos.map((pago, index) => {
    const estado = pago.cancelado ? 'Cancelado' : 'Activo';
    const lines = [
      `${index + 1}. ${money(pago.monto)} - ${titleCase(pago.tipo || pago.concepto || 'inscripcion')}`,
      `Método: ${titleCase(pago.metodoPago || pago.metodo || 'no_especificado')}`,
      `Recibió: ${titleCase(pago.recibidoPor || 'no_especificado')}`,
      pago.nota ? `Nota: ${pago.nota}` : 'Nota: Sin nota',
      pago.partidoTexto ? `Partido: ${pago.partidoTexto}` : '',
      `Fecha: ${pago.fechaTexto || todayISO()}`,
      `Estado: ${estado}`
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');
}

async function handlePago(command, context) {
  if (context.user.puedeRegistrarPagos !== true) return 'No tienes permiso para registrar pagos.';
  const insc = await findInscripcionByInput(command.equipoTexto, context.session);
  if (!insc) return `El equipo ${command.equipoTexto} no tiene inscripción registrada.`;

  const total = Number(insc.inscripcion.montoTotal || insc.inscripcion.monto || 0);
  const pagado = Number(insc.inscripcion.montoPagado || 0);
  const saldoActual = Number(insc.inscripcion.saldo !== undefined ? insc.inscripcion.saldo : Math.max(0, total - pagado));
  const saldoNuevo = Math.max(0, saldoActual - Number(command.monto || 0));
  const equipoId = insc.inscripcion.equipoId || insc.inscripcion.equipoKey || insc.equipo?.id || insc.inscripcionId;
  const nombreEquipo = insc.inscripcion.equipoNombre || insc.inscripcion.nombreEquipo || insc.inscripcion.nombre || insc.equipo?.nombre || command.equipoTexto;

  await db.collection('bot_pending_confirmations').doc(context.phone).set({
    telefonoWhatsapp: context.phone,
    tipo: 'pago',
    torneoId: context.torneoId,
    categoriaId: context.categoriaId,
    equipoId,
    equipoNombre: nombreEquipo,
    inscripcionId: insc.inscripcionId,
    monto: Number(command.monto || 0),
    concepto: command.concepto || 'inscripcion',
    metodoPago: command.metodoPago || 'no_especificado',
    recibidoPor: command.recibidoPor || 'no_especificado',
    nota: command.nota || '',
    creadoEn: FieldValue.serverTimestamp(),
    expiraEnMs: Date.now() + 5 * 60 * 1000
  }, { merge: true });

  return [
    'Confirma pago de inscripción:',
    '',
    `Equipo: ${nombreEquipo}`,
    `Monto: ${money(command.monto)}`,
    `Concepto: ${command.concepto || 'inscripcion'}`,
    `Método: ${titleCase(command.metodoPago)}`,
    `Recibió: ${titleCase(command.recibidoPor)}`,
    command.nota ? `Nota: ${command.nota}` : 'Nota: Sin nota',
    `Saldo actual: ${money(saldoActual)}`,
    `Saldo nuevo: ${money(saldoNuevo)}`,
    '',
    'Responde:',
    '1 para confirmar',
    '2 para cancelar'
  ].join('\n');
}

async function confirmPendingOperation(context) {
  const pendingRef = db.collection('bot_pending_confirmations').doc(context.phone);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) return 'No hay operación pendiente.';
  const pending = pendingSnap.data() || {};
  if (Number(pending.expiraEnMs || 0) < Date.now()) {
    await pendingRef.delete();
    return 'La confirmación expiró.';
  }

  if (pending.tipo !== 'pago' && pending.tipo !== 'arbitraje') return 'No hay operación de pago pendiente.';
  const pagoId = `pago_${pending.equipoId}_${Date.now()}`;
  let saldoRestante = 0;

  if (pending.tipo === 'pago') {
    await db.runTransaction(async (transaction) => {
      const inscRef = db.collection('inscripciones').doc(pending.inscripcionId);
      const inscSnap = await transaction.get(inscRef);
      if (!inscSnap.exists) throw new Error('Inscripción no encontrada');
      const insc = inscSnap.data() || {};
      const monto = Number(pending.monto || 0);
      const montoTotal = Number(insc.montoTotal || insc.monto || 0);
      const montoPagado = Number(insc.montoPagado || 0) + monto;
      saldoRestante = Math.max(0, montoTotal - montoPagado);
      const estado = saldoRestante === 0 ? 'liquidado' : montoPagado > 0 ? 'abonado' : 'pendiente';
      const pagoRef = db.collection('pagos').doc(pagoId);

      transaction.set(pagoRef, {
        tipo: 'inscripcion',
        torneoId: pending.torneoId,
        categoriaId: pending.categoriaId,
        equipoId: pending.equipoId,
        equipoNombre: pending.equipoNombre,
        inscripcionId: pending.inscripcionId,
        concepto: pending.concepto || 'inscripcion',
        monto,
        metodo: 'whatsapp',
        metodoPago: pending.metodoPago || 'no_especificado',
        recibidoPor: pending.recibidoPor || 'no_especificado',
        nota: pending.nota || '',
        origen: 'whatsapp',
        createdByPhone: context.phone,
        registradoPor: context.phone,
        telefonoWhatsapp: context.phone,
        cancelado: false,
        fechaTexto: todayISO(),
        ts: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
        creadoEn: FieldValue.serverTimestamp()
      });
      transaction.update(inscRef, {
        montoPagado,
        saldo: saldoRestante,
        estado,
        actualizadoEn: FieldValue.serverTimestamp()
      });
      transaction.delete(pendingRef);
      transaction.set(db.collection('bot_sessions').doc(context.phone), {
        ultimoComando: 'pago_confirmado',
        ultimoEquipoId: pending.equipoId,
        actualizadoEn: FieldValue.serverTimestamp()
      }, { merge: true });
    });

    console.log('PAGO_INSCRIPCION_REGISTRADO', {
      telefonoWhatsapp: context.phone,
      torneoId: pending.torneoId,
      categoriaId: pending.categoriaId,
      equipoId: pending.equipoId,
      inscripcionId: pending.inscripcionId,
      monto: Number(pending.monto || 0)
    });

    return [
      'Pago registrado ✅',
      `Equipo: ${pending.equipoNombre}`,
      `Monto: ${money(pending.monto)}`,
      `Saldo restante: ${money(saldoRestante)}`
    ].join('\n');
  }

  let montoEsperadoRegistrado = 0;
  let montoPendienteRegistrado = 0;
  await db.runTransaction(async (transaction) => {
    const partidoRef = db.collection('partidos').doc(pending.partidoId);
    const partidoSnap = await transaction.get(partidoRef);
    if (!partidoSnap.exists) throw new Error('Partido no encontrado');
    const partido = { id: partidoSnap.id, _key: partidoSnap.id, ...partidoSnap.data() };
    const montoPagado = Number(pending.montoPagado || pending.monto || 0);
    const expected = getMontoEsperadoArbitrajeEquipo(partido, pending.side);
    const montoEsperadoEquipo = Number(pending.montoEsperado || expected.montoEsperadoEquipo || DEFAULT_ARBITRAJE_MONTO_EQUIPO);
    const montoPendienteDespues = Math.max(montoEsperadoEquipo - montoPagado, 0);
    const pagadoCompleto = montoPagado >= montoEsperadoEquipo;
    montoEsperadoRegistrado = montoEsperadoEquipo;
    montoPendienteRegistrado = montoPendienteDespues;
    const pagoRef = db.collection('pagos').doc(pagoId);
    const local = pending.side === 'local';
    const prefix = local ? 'arbitrajes.equipoLocal' : 'arbitrajes.equipoVisitante';

    transaction.set(pagoRef, {
      tipo: 'arbitraje',
      torneoId: pending.torneoId,
      categoriaId: pending.categoriaId,
      equipoId: pending.equipoId,
      equipoNombre: pending.equipoNombre,
      partidoId: pending.partidoId,
      partidoTexto: pending.partidoTexto || '',
      side: pending.side,
      monto: montoPagado,
      montoPagado,
      montoEsperado: montoEsperadoEquipo,
      montoPendienteDespues,
      metodo: 'whatsapp',
      metodoPago: pending.metodoPago || 'no_especificado',
      recibidoPor: pending.recibidoPor || 'no_especificado',
      nota: pending.nota || '',
      origen: 'whatsapp',
      createdByPhone: context.phone,
      registradoPor: context.phone,
      telefonoWhatsapp: context.phone,
      cancelado: false,
      fechaTexto: todayISO(),
      ts: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      creadoEn: FieldValue.serverTimestamp()
    });
    transaction.update(partidoRef, {
      [`${prefix}.pagado`]: pagadoCompleto,
      [`${prefix}.monto`]: montoEsperadoEquipo,
      [`${prefix}.montoPagado`]: montoPagado,
      [`${prefix}.montoEsperado`]: montoEsperadoEquipo,
      [`${prefix}.montoPendiente`]: montoPendienteDespues,
      [`${prefix}.pagoId`]: pagoId,
      [`${prefix}.metodoPago`]: pending.metodoPago || 'no_especificado',
      [`${prefix}.recibidoPor`]: pending.recibidoPor || 'no_especificado',
      [`${prefix}.nota`]: pending.nota || '',
      [local ? 'arbitrajeLocalPagado' : 'arbitrajeVisitantePagado']: pagadoCompleto,
      [local ? 'arbitrajeLocalMonto' : 'arbitrajeVisitanteMonto']: montoEsperadoEquipo,
      [local ? 'arbitrajeLocalMontoPagado' : 'arbitrajeVisitanteMontoPagado']: montoPagado,
      [local ? 'arbitrajeLocalMontoEsperado' : 'arbitrajeVisitanteMontoEsperado']: montoEsperadoEquipo,
      [local ? 'arbitrajeLocalMontoPendiente' : 'arbitrajeVisitanteMontoPendiente']: montoPendienteDespues,
      actualizadoEn: FieldValue.serverTimestamp()
    });
    transaction.delete(pendingRef);
    transaction.set(db.collection('bot_sessions').doc(context.phone), {
      ultimoComando: 'arbitraje_confirmado',
      ultimoEquipoId: pending.equipoId,
      actualizadoEn: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  console.log('PAGO_ARBITRAJE_REGISTRADO', {
    telefonoWhatsapp: context.phone,
    torneoId: pending.torneoId,
    categoriaId: pending.categoriaId,
    equipoId: pending.equipoId,
    equipoNombre: pending.equipoNombre,
    partidoId: pending.partidoId,
    side: pending.side,
    monto: Number(pending.monto || 0),
    montoEsperado: montoEsperadoRegistrado,
    montoPendienteDespues: montoPendienteRegistrado,
    metodoPago: pending.metodoPago || 'no_especificado',
    recibidoPor: pending.recibidoPor || 'no_especificado'
  });

  return [
    'Pago de arbitraje registrado ✅',
    `Equipo: ${pending.equipoNombre}`,
    `Monto pagado: ${money(pending.monto)}`,
    `Monto esperado: ${money(montoEsperadoRegistrado)}`,
    `Monto pendiente: ${money(montoPendienteRegistrado)}`,
    `Partido: ${pending.partidoTexto || pending.partidoId}`
  ].join('\n');
}

async function cancelPendingOperation(context) {
  await db.collection('bot_pending_confirmations').doc(context.phone).delete();
  return 'Operación cancelada.';
}

async function getLastWhatsappPayment(phone) {
  let docs = [];
  try {
    const snap = await db.collection('pagos')
      .where('origen', '==', 'whatsapp')
      .where('createdByPhone', '==', phone)
      .where('cancelado', '==', false)
      .orderBy('ts', 'desc')
      .limit(1)
      .get();
    docs = snap.docs;
  } catch (_err) {
    docs = [];
  }
  if (!docs.length) {
    const snap = await db.collection('pagos')
      .where('origen', '==', 'whatsapp')
      .where('registradoPor', '==', phone)
      .where('cancelado', '==', false)
      .get();
    docs = snap.docs.sort((a, b) => Number(b.data()?.ts || 0) - Number(a.data()?.ts || 0)).slice(0, 1);
  }
  if (!docs.length) return null;
  const doc = docs[0];
  return { pagoId: doc.id, pago: doc.data() || {} };
}

async function handleRevertirUltimo(context) {
  if (context.user.puedeRevertirPagos !== true) return 'No tienes permiso para revertir pagos.';
  const last = await getLastWhatsappPayment(context.phone);
  if (!last) return 'No encontré pagos de WhatsApp para revertir.';

  if (last.pago.tipo === 'arbitraje' || (last.pago.partidoId && !last.pago.inscripcionId)) {
    await db.runTransaction(async (transaction) => {
      const pagoRef = db.collection('pagos').doc(last.pagoId);
      const partidoRef = db.collection('partidos').doc(last.pago.partidoId);
      const partidoSnap = await transaction.get(partidoRef);
      if (!partidoSnap.exists) throw new Error('Partido no encontrado');
      const partido = { id: partidoSnap.id, _key: partidoSnap.id, ...partidoSnap.data() };
      let side = last.pago.side || '';
      if (!side) {
        const equipoId = String(last.pago.equipoId || '');
        if (equipoId && String(getPartidoLocalId(partido) || '') === equipoId) side = 'local';
        if (equipoId && String(getPartidoVisitanteId(partido) || '') === equipoId) side = 'visitante';
      }
      if (side !== 'local' && side !== 'visitante') throw new Error('No pude identificar el lado del arbitraje');
      const local = side === 'local';
      const prefix = local ? 'arbitrajes.equipoLocal' : 'arbitrajes.equipoVisitante';
      const expected = getMontoEsperadoArbitrajeEquipo(partido, side);
      const montoEsperadoEquipo = Number(last.pago.montoEsperado || expected.montoEsperadoEquipo || DEFAULT_ARBITRAJE_MONTO_EQUIPO);

      transaction.update(pagoRef, {
        cancelado: true,
        canceladoEn: FieldValue.serverTimestamp(),
        canceladoPor: context.phone
      });
      transaction.update(partidoRef, {
        [`${prefix}.pagado`]: false,
        [`${prefix}.monto`]: montoEsperadoEquipo,
        [`${prefix}.montoPagado`]: 0,
        [`${prefix}.montoEsperado`]: montoEsperadoEquipo,
        [`${prefix}.montoPendiente`]: montoEsperadoEquipo,
        [`${prefix}.pagoId`]: null,
        [`${prefix}.metodoPago`]: null,
        [`${prefix}.recibidoPor`]: null,
        [`${prefix}.nota`]: null,
        [local ? 'arbitrajeLocalPagado' : 'arbitrajeVisitantePagado']: false,
        [local ? 'arbitrajeLocalMonto' : 'arbitrajeVisitanteMonto']: montoEsperadoEquipo,
        [local ? 'arbitrajeLocalMontoPagado' : 'arbitrajeVisitanteMontoPagado']: 0,
        [local ? 'arbitrajeLocalMontoEsperado' : 'arbitrajeVisitanteMontoEsperado']: montoEsperadoEquipo,
        [local ? 'arbitrajeLocalMontoPendiente' : 'arbitrajeVisitanteMontoPendiente']: montoEsperadoEquipo,
        actualizadoEn: FieldValue.serverTimestamp()
      });

      console.log('ARBITRAJE_REVERTIDO', {
        partidoId: last.pago.partidoId,
        equipoNombre: last.pago.equipoNombre || 'Equipo',
        montoPagadoRevertido: Number(last.pago.montoPagado || last.pago.monto || 0),
        montoEsperadoRestaurado: montoEsperadoEquipo
      });
    });

    return [
      'Último pago de arbitraje revertido ✅',
      `Equipo: ${last.pago.equipoNombre || 'Equipo'}`,
      `Monto cancelado: ${money(last.pago.monto)}`
    ].join('\n');
  }

  let nuevoSaldo = 0;

  await db.runTransaction(async (transaction) => {
    const pagoRef = db.collection('pagos').doc(last.pagoId);
    const inscRef = db.collection('inscripciones').doc(last.pago.inscripcionId);
    const inscSnap = await transaction.get(inscRef);
    if (!inscSnap.exists) throw new Error('Inscripción no encontrada');
    const insc = inscSnap.data() || {};
    const monto = Number(last.pago.monto || 0);
    const montoTotal = Number(insc.montoTotal || insc.monto || 0);
    const montoPagado = Math.max(0, Number(insc.montoPagado || 0) - monto);
    nuevoSaldo = Math.max(0, montoTotal - montoPagado);
    const estado = nuevoSaldo === 0 ? 'liquidado' : montoPagado > 0 ? 'abonado' : 'pendiente';

    transaction.update(pagoRef, {
      cancelado: true,
      canceladoEn: FieldValue.serverTimestamp(),
      canceladoPor: context.phone
    });
    transaction.update(inscRef, {
      montoPagado,
      saldo: nuevoSaldo,
      estado,
      actualizadoEn: FieldValue.serverTimestamp()
    });
  });

  return [
    'Último pago revertido ✅',
    `Equipo: ${last.pago.equipoNombre || 'Equipo'}`,
    `Monto cancelado: ${money(last.pago.monto)}`,
    `Nuevo saldo: ${money(nuevoSaldo)}`
  ].join('\n');
}

async function handleIncomingText(phone, text, messageId) {
  try {
    const user = await getAuthorizedUser(phone);
    if (!user) {
      await sendWhatsAppText(phone, 'No tienes permiso para usar este bot.');
      await logBotEvent({ telefonoWhatsapp: phone, mensaje: text, tipo: 'unauthorized', resultado: 'denied' });
      return;
    }

    const session = await getSession(phone, user);
    const context = {
      phone,
      user,
      session,
      torneoId: session.torneoActivo,
      categoriaId: session.categoriaActiva,
      text,
      messageId
    };
    const normalizedText = normalizeText(text);
    const waitingArbitrajeSelection = session.esperandoSeleccionArbitraje === true || session.ultimoComando === 'seleccionar_arbitraje';
    const command = waitingArbitrajeSelection && /^\d+$/.test(normalizedText)
      ? { type: 'seleccionar_arbitraje', optionIndex: Number(normalizedText) - 1 }
      : parseCommand(text);
    let response = '';

    if (command.type === 'menu') response = buildMenu();
    else if (command.type === 'saldo') response = await handleSaldo(command, context);
    else if (command.type === 'deudores') response = await handleDeudores(context);
    else if (command.type === 'juegos') response = await handleJuegos(command, context);
    else if (command.type === 'arbitrajes') response = await handleArbitrajes(context);
    else if (command.type === 'arbitraje_pago') response = await handleArbitrajePago(command, context);
    else if (command.type === 'seleccionar_arbitraje') response = await handleSeleccionArbitraje(command, context);
    else if (command.type === 'historial') response = await handleHistorial(command, context);
    else if (command.type === 'pago') response = await handlePago(command, context);
    else if (command.type === 'confirm') response = await confirmPendingOperation(context);
    else if (command.type === 'cancel') response = await cancelPendingOperation(context);
    else if (command.type === 'revertir_ultimo') response = await handleRevertirUltimo(context);
    else response = buildMenu();

    await sendWhatsAppText(phone, response);
    await logBotEvent({ telefonoWhatsapp: phone, mensaje: text, tipo: command.type, resultado: 'ok' });
  } catch (error) {
    console.error('AgentBot error:', error);
    await logBotEvent({
      telefonoWhatsapp: phone,
      mensaje: text,
      tipo: 'error',
      resultado: 'failed',
      error: error.message || String(error)
    }).catch(() => {});
    await sendWhatsAppText(phone, 'Ocurrió un error procesando tu solicitud. Intenta de nuevo.').catch(() => {});
  }
}

function extractTextMessages(body) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const messages = [];
  entries.forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      const value = change.value || {};
      (value.messages || []).forEach((message) => {
        if (message.type !== 'text' || !message.text?.body) return;
        messages.push({
          from: normalizePhone(message.from),
          messageId: message.id || '',
          text: message.text.body
        });
      });
    });
  });
  return messages;
}

async function processWebhookPost(body) {
  const messages = extractTextMessages(body);
  await Promise.all(messages.map(async (message) => {
    if (!message.from || !message.text) return;
    await logBotEvent({
      telefonoWhatsapp: message.from,
      mensaje: message.text,
      tipo: 'incoming',
      resultado: message.messageId || 'received'
    }).catch(() => {});
    await handleIncomingText(message.from, message.text, message.messageId);
  }));
}

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    void mode;

    if (token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(String(challenge || ''));
      return;
    }
    res.status(403).send('Forbidden');
    return;
  }

  if (req.method === 'POST') {
    res.status(200).send('EVENT_RECEIVED');
    processWebhookPost(req.body || {}).catch((error) => {
      console.error('Webhook POST processing error:', error);
    });
    return;
  }

  res.status(405).send('Method Not Allowed');
});

const BOX_BUSINESS_ID = 'box-lombardo-toledano';
const BOX_OWNER_EMAILS = new Set(['edanchra@gmail.com', 'admincanchadigital@gmail.com']);

function callableAuth(context, data = {}) {
  if (context.auth) return context.auth;
  const localFunctionRuntime = process.env.FUNCTIONS_EMULATOR === 'true' ||
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const emulatorUid = context.rawRequest?.headers?.['x-cd-test-uid'];
  if (localFunctionRuntime && emulatorUid) {
    return {
      uid: String(emulatorUid),
      token: {
        email: String(context.rawRequest?.headers?.['x-cd-test-email'] || ''),
        name: String(context.rawRequest?.headers?.['x-cd-test-name'] || '')
      }
    };
  }
  if (localFunctionRuntime && (data.testAuthUid || data.__testAuthUid)) {
    return {
      uid: String(data.testAuthUid || data.__testAuthUid),
      token: {
        email: String(data.testAuthEmail || data.__testAuthEmail || ''),
        name: String(data.testAuthName || data.__testAuthName || '')
      }
    };
  }
  throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesion.');
}

async function getPlatformUser(uid) {
  const snap = await db.collection('usuarios').doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : { id: uid };
}

function isBoxSuperAdmin(auth) {
  return BOX_OWNER_EMAILS.has(String(auth.token.email || '').toLowerCase());
}

function getBoxUserRole(user, businessId) {
  const entry = user?.businessRoles?.[businessId] || user?.businessAccess?.[businessId] || null;
  if (typeof entry === 'string') return entry;
  return entry?.role || null;
}

async function assertBoxPermission(context, allowedRoles, data = {}) {
  const auth = callableAuth(context, data);
  const user = await getPlatformUser(auth.uid);
  if (isBoxSuperAdmin(auth)) return { auth, user, role: 'superadmin' };
  const role = getBoxUserRole(user, BOX_BUSINESS_ID);
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permiso para esta operacion del box.');
  }
  return { auth, user, role };
}

function normalizeCallableArgs(data, context) {
  if (data && typeof data === 'object' && data.rawRequest && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return { payload: data.data || {}, context: data };
  }
  if (context && typeof context === 'object' && context.rawRequest && Object.prototype.hasOwnProperty.call(context, 'data')) {
    return { payload: context.data || data || {}, context };
  }
  return { payload: data || {}, context: context || {} };
}

function assertBoxBusinessId(data) {
  const businessId = data?.businessId || BOX_BUSINESS_ID;
  if (businessId !== BOX_BUSINESS_ID) {
    throw new functions.https.HttpsError('invalid-argument', 'Negocio invalido.');
  }
  return businessId;
}

function boxRootRef() {
  return db.collection('businesses').doc(BOX_BUSINESS_ID);
}

async function boxAuditBackend(transaction, data) {
  const ref = boxRootRef().collection('auditLogs').doc();
  transaction.set(ref, {
    businessId: BOX_BUSINESS_ID,
    actorUserId: data.actorUserId || '',
    actorName: data.actorName || '',
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId || '',
    previousValue: data.previousValue || null,
    newValue: data.newValue || null,
    reason: data.reason || '',
    metadata: data.metadata || {},
    createdAt: FieldValue.serverTimestamp()
  });
}

function boxPeriodLabel(period) {
  const [year, month] = String(period || '').split('-').map(Number);
  if (!year || !month) return String(period || '');
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function boxReceiptText({ business, payment, member, guardian, charge }) {
  return [
    String(business.displayName || business.name || 'BOX LOMBARDO TOLEDANO').toUpperCase(),
    'COMPROBANTE DE PAGO',
    '',
    `Folio: ${payment.folio}`,
    `Alumno: ${member.fullName || payment.memberId}`,
    `Tutor: ${guardian?.fullName || 'No especificado'}`,
    `Concepto: ${titleCase(payment.concept || 'monthly_fee')}`,
    `Periodo: ${charge.periodLabel || payment.billingPeriodId || '-'}`,
    `Monto recibido: ${money(payment.paidAmount)}`,
    'Metodo: Efectivo',
    `Fecha: ${payment.paymentDate || todayISO()}`,
    `Recibido por: ${payment.receivedByName || payment.receivedByUserId || '-'}`,
    `Saldo pendiente: ${money(payment.remainingBalance)}`,
    '',
    'Conserve este comprobante para cualquier aclaracion.'
  ].join('\n');
}

exports.boxSeedBusiness = functions.https.onCall(async (data, context) => {
  const call = normalizeCallableArgs(data, context);
  const payload = call.payload;
  assertBoxBusinessId(payload);
  const { auth } = await assertBoxPermission(call.context, ['owner', 'box_admin'], payload);
  const business = {
    id: BOX_BUSINESS_ID,
    name: 'Box Lombardo Toledano',
    displayName: 'BOX LOMBARDO TOLEDANO',
    type: 'boxing_gym',
    status: 'active',
    monthlyFee: 400,
    currency: 'MXN',
    timezone: 'America/Mazatlan',
    paymentMethodsEnabled: ['cash'],
    trialClassesAllowed: 1,
    updatedAt: FieldValue.serverTimestamp()
  };
  await db.runTransaction(async (transaction) => {
    const root = boxRootRef();
    transaction.set(root, {
      ...business,
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(root.collection('settings').doc('expenseCategories'), {
      values: ['Equipo deportivo', 'Guantes y material', 'Mantenimiento', 'Limpieza', 'Reparaciones', 'Publicidad', 'Servicios', 'Personal', 'Eventos', 'Otros'],
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(root.collection('settings').doc('paymentMethods'), {
      enabled: ['cash'],
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await boxAuditBackend(transaction, {
      actorUserId: auth.uid,
      actorName: auth.token.email || '',
      action: 'business_seeded',
      entityType: 'business',
      entityId: BOX_BUSINESS_ID,
      newValue: business
    });
  });
  return { ok: true };
});

exports.boxGenerateMonthlyCharges = functions.https.onCall(async (data, context) => {
  const call = normalizeCallableArgs(data, context);
  const payload = call.payload;
  assertBoxBusinessId(payload);
  const { auth } = await assertBoxPermission(call.context, ['owner', 'box_admin'], payload);
  const period = String(payload.period || '').trim();
  const dueDate = normalizeDateISO(payload.dueDate);
  if (!/^\d{4}-\d{2}$/.test(period) || !dueDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Periodo o vencimiento invalido.');
  }
  const root = boxRootRef();
  const businessSnap = await root.get();
  const business = businessSnap.exists ? businessSnap.data() || {} : {};
  const membersSnap = await root.collection('members')
    .where('status', 'in', ['active', 'active_with_debt', 'trial'])
    .get();
  let created = 0;
  await db.runTransaction(async (transaction) => {
    const chargeItems = [];
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data() || {};
      const chargeRef = root.collection('charges').doc(`${period}_${memberDoc.id}`);
      const chargeSnap = await transaction.get(chargeRef);
      chargeItems.push({ memberDoc, member, chargeRef, exists: chargeSnap.exists });
    }
    transaction.set(root.collection('billingPeriods').doc(period), {
      businessId: BOX_BUSINESS_ID,
      period,
      label: boxPeriodLabel(period),
      status: 'open',
      dueDate,
      createdBy: auth.uid,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    for (const item of chargeItems) {
      if (item.exists) continue;
      const member = item.member;
      const memberDoc = item.memberDoc;
      const baseAmount = Number(member.monthlyFee || business.monthlyFee || 400);
      const discountAmount = Number(member.discountAmount || 0);
      const expectedAmount = Math.max(0, baseAmount - discountAmount);
      transaction.set(item.chargeRef, {
        businessId: BOX_BUSINESS_ID,
        memberId: memberDoc.id,
        billingPeriodId: period,
        periodLabel: boxPeriodLabel(period),
        concept: 'monthly_fee',
        baseAmount,
        discountAmount,
        expectedAmount,
        totalPaid: 0,
        balance: expectedAmount,
        dueDate,
        status: expectedAmount === 0 ? 'scholarship' : 'pending',
        modificationReason: '',
        createdBy: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      created += 1;
    }
    await boxAuditBackend(transaction, {
      actorUserId: auth.uid,
      actorName: auth.token.email || '',
      action: 'monthly_charges_generated',
      entityType: 'billingPeriod',
      entityId: period,
      newValue: { period, dueDate, created }
    });
  });
  return { ok: true, created };
});

exports.boxCreatePayment = functions.https.onCall(async (data, context) => {
  const call = normalizeCallableArgs(data, context);
  const payload = call.payload;
  assertBoxBusinessId(payload);
  const { auth } = await assertBoxPermission(call.context, ['owner', 'box_admin', 'trainer'], payload);
  const chargeId = String(payload.chargeId || '').trim();
  const paidAmount = Number(payload.paidAmount || 0);
  if (!chargeId || paidAmount <= 0) throw new functions.https.HttpsError('invalid-argument', 'Cargo y monto requeridos.');
  const root = boxRootRef();
  let paymentId = '';
  let folio = '';
  await db.runTransaction(async (transaction) => {
    const businessSnap = await transaction.get(root);
    const business = businessSnap.exists ? businessSnap.data() || {} : {};
    const chargeRef = root.collection('charges').doc(chargeId);
    const chargeSnap = await transaction.get(chargeRef);
    if (!chargeSnap.exists) throw new functions.https.HttpsError('not-found', 'Cargo no encontrado.');
    const charge = chargeSnap.data() || {};
    if (charge.status === 'canceled') throw new functions.https.HttpsError('failed-precondition', 'Cargo cancelado.');
    const balance = Number(charge.balance || 0);
    if (balance <= 0) throw new functions.https.HttpsError('failed-precondition', 'El cargo ya esta pagado.');
    if (paidAmount > balance) throw new functions.https.HttpsError('invalid-argument', 'El pago no puede exceder el saldo.');

    const counterRef = root.collection('settings').doc('counters');
    const counterSnap = await transaction.get(counterRef);
    const next = Number(counterSnap.data()?.payments || 0) + 1;
    folio = `BOX-PAG-${String(next).padStart(6, '0')}`;
    paymentId = `payment_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const memberRef = root.collection('members').doc(charge.memberId);
    const memberSnap = await transaction.get(memberRef);
    const member = memberSnap.exists ? memberSnap.data() || {} : {};
    const guardianId = Array.isArray(member.guardianIds) ? member.guardianIds[0] || '' : '';

    const newPaid = Number(charge.totalPaid || 0) + paidAmount;
    const remainingBalance = Math.max(0, balance - paidAmount);
    const status = remainingBalance === 0 ? 'paid' : 'partial';
    transaction.set(root.collection('payments').doc(paymentId), {
      id: paymentId,
      folio,
      businessId: BOX_BUSINESS_ID,
      memberId: charge.memberId,
      guardianId,
      chargeId,
      billingPeriodId: charge.billingPeriodId,
      concept: charge.concept || 'monthly_fee',
      expectedAmount: Number(charge.expectedAmount || business.monthlyFee || 400),
      paidAmount,
      remainingBalance,
      paymentMethod: 'cash',
      paymentStatus: 'registered',
      cashDeliveryStatus: 'pending_delivery',
      receivedByUserId: auth.uid,
      receivedByName: auth.token.name || auth.token.email || auth.uid,
      registeredByUserId: auth.uid,
      paymentDate: todayISO(),
      createdAt: FieldValue.serverTimestamp(),
      receiptStatus: 'pending',
      notes: String(payload.notes || '')
    });
    transaction.update(chargeRef, {
      totalPaid: newPaid,
      balance: remainingBalance,
      status,
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.set(counterRef, { payments: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await boxAuditBackend(transaction, {
      actorUserId: auth.uid,
      actorName: auth.token.email || '',
      action: 'payment_created',
      entityType: 'payment',
      entityId: paymentId,
      newValue: { folio, chargeId, paidAmount, remainingBalance }
    });
  });
  return { ok: true, paymentId, folio };
});

exports.boxPrepareCashDelivery = functions.https.onCall(async (data, context) => {
  const call = normalizeCallableArgs(data, context);
  const payload = call.payload;
  assertBoxBusinessId(payload);
  const { auth, role } = await assertBoxPermission(call.context, ['owner', 'box_admin', 'trainer'], payload);
  const paymentIds = Array.isArray(payload.paymentIds) ? payload.paymentIds.filter(Boolean) : [];
  if (!paymentIds.length) throw new functions.https.HttpsError('invalid-argument', 'Selecciona pagos.');
  const unique = [...new Set(paymentIds)];
  if (unique.length !== paymentIds.length) throw new functions.https.HttpsError('invalid-argument', 'Hay pagos duplicados.');
  const root = boxRootRef();
  let deliveryId = '';
  let folio = '';
  await db.runTransaction(async (transaction) => {
    const payments = [];
    for (const id of unique) {
      const ref = root.collection('payments').doc(id);
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', `Pago ${id} no encontrado.`);
      const payment = snap.data() || {};
      if (payment.cashDeliveryStatus !== 'pending_delivery') throw new functions.https.HttpsError('failed-precondition', `Pago ${payment.folio || id} no esta pendiente.`);
      if (role === 'trainer' && payment.receivedByUserId !== auth.uid) throw new functions.https.HttpsError('permission-denied', 'El entrenador solo puede entregar pagos que recibio.');
      payments.push({ id, ref, data: payment });
    }
    const expectedAmount = payments.reduce((sum, item) => sum + Number(item.data.paidAmount || 0), 0);
    const counterRef = root.collection('settings').doc('counters');
    const counterSnap = await transaction.get(counterRef);
    const next = Number(counterSnap.data()?.cashDeliveries || 0) + 1;
    folio = `BOX-ENT-${String(next).padStart(6, '0')}`;
    deliveryId = `delivery_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const deliveryRef = root.collection('cashDeliveries').doc(deliveryId);
    transaction.set(deliveryRef, {
      id: deliveryId,
      folio,
      businessId: BOX_BUSINESS_ID,
      deliveredByUserId: auth.uid,
      deliveredByName: auth.token.name || auth.token.email || auth.uid,
      receivedByUserId: '',
      paymentIds: unique,
      expectedAmount,
      deliveredAmount: 0,
      differenceAmount: 0,
      status: 'prepared',
      notes: String(payload.notes || ''),
      preparedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: auth.uid
    });
    payments.forEach((item) => transaction.update(item.ref, { cashDeliveryStatus: 'prepared', cashDeliveryId: deliveryId, updatedAt: FieldValue.serverTimestamp() }));
    transaction.set(counterRef, { cashDeliveries: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await boxAuditBackend(transaction, {
      actorUserId: auth.uid,
      actorName: auth.token.email || '',
      action: 'cash_delivery_prepared',
      entityType: 'cashDelivery',
      entityId: deliveryId,
      newValue: { folio, paymentIds: unique, expectedAmount }
    });
  });
  return { ok: true, deliveryId, folio };
});

exports.boxConfirmCashDelivery = functions.https.onCall(async (data, context) => {
  const call = normalizeCallableArgs(data, context);
  const payload = call.payload;
  assertBoxBusinessId(payload);
  const { auth } = await assertBoxPermission(call.context, ['owner', 'box_admin'], payload);
  const deliveryId = String(payload.deliveryId || '').trim();
  const deliveredAmount = Number(payload.deliveredAmount || 0);
  if (!deliveryId || deliveredAmount < 0) throw new functions.https.HttpsError('invalid-argument', 'Entrega invalida.');
  const root = boxRootRef();
  await db.runTransaction(async (transaction) => {
    const deliveryRef = root.collection('cashDeliveries').doc(deliveryId);
    const deliverySnap = await transaction.get(deliveryRef);
    if (!deliverySnap.exists) throw new functions.https.HttpsError('not-found', 'Entrega no encontrada.');
    const delivery = deliverySnap.data() || {};
    if (delivery.deliveredByUserId === auth.uid) throw new functions.https.HttpsError('failed-precondition', 'No puedes confirmar tu propia entrega.');
    if (delivery.status === 'confirmed') throw new functions.https.HttpsError('failed-precondition', 'Entrega ya confirmada.');
    const expectedAmount = Number(delivery.expectedAmount || 0);
    const differenceAmount = deliveredAmount - expectedAmount;
    const status = differenceAmount === 0 ? 'confirmed' : 'with_difference';
    transaction.update(deliveryRef, {
      receivedByUserId: auth.uid,
      receivedByName: auth.token.name || auth.token.email || auth.uid,
      deliveredAmount,
      differenceAmount,
      status,
      notes: String(payload.notes || delivery.notes || ''),
      deliveredAt: FieldValue.serverTimestamp(),
      confirmedAt: FieldValue.serverTimestamp()
    });
    for (const paymentId of delivery.paymentIds || []) {
      transaction.update(root.collection('payments').doc(paymentId), {
        cashDeliveryStatus: 'confirmed',
        paymentStatus: 'confirmed',
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    if (differenceAmount !== 0) {
      transaction.set(root.collection('inconsistencies').doc(), {
        businessId: BOX_BUSINESS_ID,
        type: 'cash_delivery_difference',
        severity: 'critical',
        status: 'pending',
        title: 'Entrega de efectivo con diferencia',
        detail: `${delivery.folio || deliveryId}: ${money(differenceAmount)}`,
        deliveryId,
        createdAt: FieldValue.serverTimestamp()
      });
    }
    await boxAuditBackend(transaction, {
      actorUserId: auth.uid,
      actorName: auth.token.email || '',
      action: 'cash_delivery_confirmed',
      entityType: 'cashDelivery',
      entityId: deliveryId,
      previousValue: { status: delivery.status },
      newValue: { deliveredAmount, differenceAmount, status },
      reason: String(payload.notes || '')
    });
  });
  return { ok: true };
});

exports.boxSendPaymentReceipt = functions.https.onCall(async (data, context) => {
  const call = normalizeCallableArgs(data, context);
  const payload = call.payload;
  assertBoxBusinessId(payload);
  const { auth } = await assertBoxPermission(call.context, ['owner', 'box_admin', 'trainer'], payload);
  const paymentId = String(payload.paymentId || '').trim();
  if (!paymentId) throw new functions.https.HttpsError('invalid-argument', 'Pago requerido.');
  const root = boxRootRef();
  const [businessSnap, paymentSnap] = await Promise.all([
    root.get(),
    root.collection('payments').doc(paymentId).get()
  ]);
  if (!paymentSnap.exists) throw new functions.https.HttpsError('not-found', 'Pago no encontrado.');
  const business = businessSnap.exists ? businessSnap.data() || {} : {};
  const payment = paymentSnap.data() || {};
  const [memberSnap, chargeSnap] = await Promise.all([
    root.collection('members').doc(payment.memberId).get(),
    root.collection('charges').doc(payment.chargeId).get()
  ]);
  const member = memberSnap.exists ? memberSnap.data() || {} : {};
  const charge = chargeSnap.exists ? chargeSnap.data() || {} : {};
  const guardianId = payment.guardianId || (Array.isArray(member.guardianIds) ? member.guardianIds[0] : '');
  const guardianSnap = guardianId ? await root.collection('guardians').doc(guardianId).get() : null;
  const guardian = guardianSnap?.exists ? guardianSnap.data() || {} : null;
  const to = normalizeWhatsAppTo(guardian?.whatsappNumber || guardian?.primaryPhone || '');
  const body = boxReceiptText({ business, payment, member, guardian, charge });
  let status = 'pending';
  let messageId = '';
  let errorText = '';
  try {
    if (!to) throw new Error('Tutor sin telefono WhatsApp.');
    const result = await sendWhatsAppText(to, body);
    status = result?.skipped ? 'pending' : 'sent';
    messageId = result?.messages?.[0]?.id || '';
  } catch (error) {
    status = 'failed';
    errorText = error.message || String(error);
  }
  await root.collection('notifications').add({
    businessId: BOX_BUSINESS_ID,
    type: 'payment_receipt',
    paymentId,
    to,
    body,
    messageId,
    status,
    error: errorText,
    attempts: FieldValue.increment(1),
    requestedByUserId: auth.uid,
    createdAt: FieldValue.serverTimestamp()
  });
  await root.collection('payments').doc(paymentId).set({
    receiptStatus: status,
    receiptLastAttemptAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: status !== 'failed', status };
});
