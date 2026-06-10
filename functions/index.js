const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsAppTo(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('521') && digits.length === 13) {
    return '52' + digits.slice(3);
  }
  return digits;
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
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeWhatsAppTo(to),
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
      data: error.response?.data ? JSON.stringify(error.response.data) : null,
      url,
      payload
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
      return {
        type: 'pago',
        equipoTexto: tokens.slice(0, amountIndex).join(' '),
        monto: Number(tokens[amountIndex]),
        concepto: tokens.slice(amountIndex + 1).join(' ') || 'inscripcion'
      };
    }
  }
  return { type: 'unknown' };
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

async function getPagosByInscripcion(inscripcionId, limit = 5) {
  let docs = [];
  try {
    const snap = await db.collection('pagos')
      .where('inscripcionId', '==', inscripcionId)
      .where('cancelado', '==', false)
      .orderBy('ts', 'desc')
      .limit(limit)
      .get();
    docs = snap.docs;
  } catch (_err) {
    const snap = await db.collection('pagos')
      .where('inscripcionId', '==', inscripcionId)
      .get();
    docs = snap.docs
      .filter((doc) => doc.data()?.cancelado !== true)
      .sort((a, b) => Number(b.data()?.ts || 0) - Number(a.data()?.ts || 0))
      .slice(0, limit);
  }
  return docs.map((doc) => ({ pagoId: doc.id, ...doc.data() }));
}

function buildMenu() {
  return [
    'CanchaDigital Bot',
    '',
    'Comandos:',
    '/pago equipo monto inscripcion',
    '/saldo equipo',
    '/deudores',
    '/historial equipo',
    '/revertir ultimo',
    '',
    'Ejemplo:',
    '/pago inter 500 inscripcion'
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
  const found = await findTeamByAlias(command.equipoTexto, context.torneoId, context.categoriaId);
  if (found.status !== 'ok') return formatTeamSearchError(found);

  const insc = await getInscripcionByEquipo(found.teamId, context.torneoId, context.categoriaId);
  if (!insc) return `El equipo ${found.team.nombre} no tiene inscripción registrada.`;

  const total = Number(insc.inscripcion.montoTotal || insc.inscripcion.monto || 0);
  const pagado = Number(insc.inscripcion.montoPagado || 0);
  const saldo = Math.max(0, total - pagado);
  return [
    `Equipo: ${found.team.nombre}`,
    `Total: ${money(total)}`,
    `Pagado: ${money(pagado)}`,
    `Saldo: ${money(saldo)}`,
    `Estado: ${insc.inscripcion.estado || 'pendiente'}`
  ].join('\n');
}

async function handleDeudores(context) {
  const snap = await db.collection('inscripciones')
    .where('torneoId', '==', context.torneoId)
    .where('categoriaId', '==', context.categoriaId)
    .get();

  const deudores = [];
  snap.forEach((doc) => {
    const insc = doc.data() || {};
    const total = Number(insc.montoTotal || insc.monto || 0);
    const pagado = Number(insc.montoPagado || 0);
    const saldo = Number(insc.saldo !== undefined ? insc.saldo : Math.max(0, total - pagado));
    if (saldo > 0) deudores.push({ nombre: insc.equipoNombre || insc.nombre || 'Equipo', saldo });
  });

  deudores.sort((a, b) => b.saldo - a.saldo);
  if (!deudores.length) return 'Todos están al corriente.';
  return 'Deudores:\n' + deudores.slice(0, 10).map((item, index) => `${index + 1}. ${item.nombre} — debe ${money(item.saldo)}`).join('\n');
}

async function handleHistorial(command, context) {
  const found = await findTeamByAlias(command.equipoTexto, context.torneoId, context.categoriaId);
  if (found.status !== 'ok') return formatTeamSearchError(found);

  const insc = await getInscripcionByEquipo(found.teamId, context.torneoId, context.categoriaId);
  if (!insc) return `El equipo ${found.team.nombre} no tiene inscripción registrada.`;

  const pagos = await getPagosByInscripcion(insc.inscripcionId, 5);
  if (!pagos.length) return 'Sin pagos registrados.';
  return `Últimos pagos de ${found.team.nombre}:\n` + pagos.map((pago, index) => (
    `${index + 1}. ${pago.fechaTexto || todayISO()} — ${money(pago.monto)} — ${pago.concepto || 'inscripcion'}`
  )).join('\n');
}

async function handlePago(command, context) {
  if (context.user.puedeRegistrarPagos !== true) return 'No tienes permiso para registrar pagos.';
  const found = await findTeamByAlias(command.equipoTexto, context.torneoId, context.categoriaId);
  if (found.status !== 'ok') return formatTeamSearchError(found);

  const insc = await getInscripcionByEquipo(found.teamId, context.torneoId, context.categoriaId);
  if (!insc) return `El equipo ${found.team.nombre} no tiene inscripción registrada.`;

  const total = Number(insc.inscripcion.montoTotal || insc.inscripcion.monto || 0);
  const pagado = Number(insc.inscripcion.montoPagado || 0);
  const saldoActual = Math.max(0, total - pagado);
  const saldoNuevo = Math.max(0, saldoActual - Number(command.monto || 0));

  await db.collection('bot_pending_confirmations').doc(context.phone).set({
    telefonoWhatsapp: context.phone,
    tipo: 'pago',
    torneoId: context.torneoId,
    categoriaId: context.categoriaId,
    equipoId: found.teamId,
    equipoNombre: found.team.nombre,
    inscripcionId: insc.inscripcionId,
    monto: Number(command.monto || 0),
    concepto: command.concepto || 'inscripcion',
    creadoEn: FieldValue.serverTimestamp(),
    expiraEnMs: Date.now() + 5 * 60 * 1000
  }, { merge: true });

  return [
    'Confirma el pago:',
    '',
    `Equipo: ${found.team.nombre}`,
    `Monto: ${money(command.monto)}`,
    `Concepto: ${command.concepto || 'inscripcion'}`,
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

  if (pending.tipo !== 'pago') return 'No hay operación de pago pendiente.';
  const pagoId = `pago_${pending.equipoId}_${Date.now()}`;
  let saldoRestante = 0;

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
      torneoId: pending.torneoId,
      categoriaId: pending.categoriaId,
      equipoId: pending.equipoId,
      equipoNombre: pending.equipoNombre,
      inscripcionId: pending.inscripcionId,
      concepto: pending.concepto || 'inscripcion',
      monto,
      metodo: 'whatsapp',
      origen: 'whatsapp',
      registradoPor: context.phone,
      telefonoWhatsapp: context.phone,
      cancelado: false,
      fechaTexto: todayISO(),
      ts: Date.now(),
      nota: 'Registrado desde WhatsApp',
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

  return [
    'Pago registrado ✅',
    `Equipo: ${pending.equipoNombre}`,
    `Monto: ${money(pending.monto)}`,
    `Saldo restante: ${money(saldoRestante)}`
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
      .where('registradoPor', '==', phone)
      .where('cancelado', '==', false)
      .orderBy('ts', 'desc')
      .limit(1)
      .get();
    docs = snap.docs;
  } catch (_err) {
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
    const command = parseCommand(text);
    let response = '';

    if (command.type === 'menu') response = buildMenu();
    else if (command.type === 'saldo') response = await handleSaldo(command, context);
    else if (command.type === 'deudores') response = await handleDeudores(context);
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
