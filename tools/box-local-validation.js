/* eslint-disable no-console */
const admin = require('../functions/node_modules/firebase-admin');
const { seed, TEST_USERS, BOX_BUSINESS_ID } = require('./box-local-seed');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'torneo-villa-080204';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const FUNCTIONS_HOST = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';

const results = [];
const tokenMeta = new Map();

function assertEmulatorOnly() {
  const missing = [
    ['FIRESTORE_EMULATOR_HOST', process.env.FIRESTORE_EMULATOR_HOST],
    ['FIREBASE_AUTH_EMULATOR_HOST', process.env.FIREBASE_AUTH_EMULATOR_HOST],
    ['FIREBASE_DATABASE_EMULATOR_HOST', process.env.FIREBASE_DATABASE_EMULATOR_HOST]
  ].filter(([, value]) => !value);
  if (missing.length) throw new Error(`Validacion bloqueada: faltan ${missing.map(([key]) => key).join(', ')}.`);
}

function pass(name, details = {}) {
  results.push({ name, status: 'passed', details });
  console.log(`PASS ${name}`);
}

function fail(name, error) {
  results.push({ name, status: 'failed', error: error.message || String(error) });
  console.error(`FAIL ${name}: ${error.message || error}`);
  throw error;
}

async function step(name, fn) {
  try {
    const details = await fn();
    pass(name, details || {});
  } catch (error) {
    fail(name, error);
  }
}

async function signIn(user) {
  const url = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password, returnSecureToken: true })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Auth signIn ${user.email}: ${JSON.stringify(body)}`);
  tokenMeta.set(body.idToken, user);
  return body.idToken;
}

function fsValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, val]) => [key, fsValue(val)])) } };
  }
  return { stringValue: String(value) };
}

function fromFsValue(value) {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, val]) => [key, fromFsValue(val)]));
  if ('timestampValue' in value) return value.timestampValue;
  return undefined;
}

function fromFsDoc(doc) {
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, fromFsValue(value)]));
}

async function fsSet(path, data, token) {
  const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, fsValue(value)])) })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Firestore set ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function fsGet(path, token, expectedStatus = 200) {
  const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) throw new Error(`Firestore get ${path}: esperado ${expectedStatus}, recibio ${response.status} ${JSON.stringify(body)}`);
  return expectedStatus === 200 ? fromFsDoc(body) : body;
}

async function callFunction(name, token, data, expectedOk = true) {
  const url = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/us-central1/${name}`;
  const meta = tokenMeta.get(token) || {};
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-cd-test-uid': meta.uid || '',
      'x-cd-test-email': meta.email || '',
      'x-cd-test-name': meta.nombre || ''
    },
    body: JSON.stringify({
      data: {
        businessId: BOX_BUSINESS_ID,
        ...data,
        testAuthUid: meta.uid || '',
        testAuthEmail: meta.email || '',
        testAuthName: meta.nombre || ''
      }
    })
  });
  const body = await response.json().catch(() => ({}));
  if (expectedOk && !response.ok) throw new Error(`${name}: ${response.status} ${JSON.stringify(body)}`);
  if (!expectedOk && response.ok && !body.error) throw new Error(`${name}: se esperaba rechazo y respondio OK ${JSON.stringify(body)}`);
  return body.result || body;
}

async function adminDoc(path) {
  const db = admin.firestore();
  const snap = await db.doc(path).get();
  if (!snap.exists) throw new Error(`No existe ${path}`);
  return { id: snap.id, ...snap.data() };
}

async function adminCollection(path) {
  const snap = await admin.firestore().collection(path).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function validate() {
  assertEmulatorOnly();
  const seedInfo = await seed();
  const ownerToken = await signIn(TEST_USERS.owner);
  const adminToken = await signIn(TEST_USERS.admin);
  const trainerToken = await signIn(TEST_USERS.trainer);
  const viewerToken = await signIn(TEST_USERS.viewer);
  const rootPath = `businesses/${BOX_BUSINESS_ID}`;

  await step('Entrada a Torneo Lombardo Toledano', async () => {
    const cfg = require('fs').readFileSync('js/business-context.js', 'utf8');
    if (!cfg.includes('lombardo_toledano') || !cfg.includes('TORNEO LOMBARDO TOLEDANO')) throw new Error('Catalogo sin Lombardo');
    return { catalog: 'lombardo_toledano' };
  });

  await step('Entrada a Torneo Nuevos Valores', async () => {
    const cfg = require('fs').readFileSync('js/business-context.js', 'utf8');
    if (!cfg.includes('nuevos_valores') || !cfg.includes('TORNEO NUEVOS VALORES')) throw new Error('Catalogo sin Nuevos Valores');
    return { catalog: 'nuevos_valores' };
  });

  await step('Entrada publica a Box Lombardo Toledano', async () => {
    const publicDoc = await fsGet(rootPath, viewerToken, 200);
    if (publicDoc.monthlyFee !== 400) throw new Error('Mensualidad publica incorrecta');
    return { monthlyFee: publicDoc.monthlyFee };
  });

  await step('Entrada administrativa al box', async () => {
    const member = await fsGet(`${rootPath}/members/member-local-1`, adminToken, 200);
    if (member.businessId !== BOX_BUSINESS_ID) throw new Error('Admin no lee alumno box');
    return { member: member.fullName };
  });

  await step('Alta de tutor via reglas Firestore', async () => {
    await fsSet(`${rootPath}/guardians/guardian-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      fullName: 'Tutor Validacion',
      relationship: 'Madre',
      primaryPhone: '6672220001',
      whatsappNumber: '526672220001',
      messagingConsent: true,
      memberIds: [],
      createdBy: TEST_USERS.admin.uid
    }, adminToken);
    return { id: 'guardian-validation-1' };
  });

  await step('Alta de alumno via reglas Firestore', async () => {
    await fsSet(`${rootPath}/members/member-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      folio: 'BOX-ALU-VALID-1',
      fullName: 'Alumno Validacion',
      status: 'active',
      groupId: '',
      monthlyFee: 400,
      discountAmount: 0,
      guardianIds: ['guardian-validation-1'],
      startDate: '2026-06-14',
      createdBy: TEST_USERS.admin.uid,
      updatedBy: TEST_USERS.admin.uid
    }, adminToken);
    return { id: 'member-validation-1' };
  });

  await step('Creacion de grupo via reglas Firestore', async () => {
    await fsSet(`${rootPath}/groups/group-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      name: 'Grupo validacion',
      trainerIds: [TEST_USERS.trainer.uid],
      daysOfWeek: ['Martes'],
      startTime: '18:00',
      endTime: '19:00',
      capacity: 12,
      status: 'active'
    }, adminToken);
    return { id: 'group-validation-1' };
  });

  await step('Registro de asistencia via reglas Firestore', async () => {
    await fsSet(`${rootPath}/sessions/session-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      groupId: 'group-validation-1',
      date: '2026-06-14',
      status: 'closed',
      capturedBy: TEST_USERS.trainer.uid
    }, trainerToken);
    await fsSet(`${rootPath}/attendance/session-validation-1_member-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      sessionId: 'session-validation-1',
      groupId: 'group-validation-1',
      memberId: 'member-validation-1',
      memberName: 'Alumno Validacion',
      date: '2026-06-14',
      status: 'present',
      paymentStatusAtAttendance: 'pending',
      capturedBy: TEST_USERS.trainer.uid
    }, trainerToken);
    return { status: 'present' };
  });

  await step('Clase de prueba via reglas Firestore', async () => {
    await fsSet(`${rootPath}/members/member-trial-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      folio: 'BOX-TRI-VALID-1',
      fullName: 'Alumno Prueba Validacion',
      status: 'trial',
      monthlyFee: 400,
      guardianIds: [],
      trialPhone: '6672220002',
      startDate: '2026-06-14',
      createdBy: TEST_USERS.trainer.uid
    }, trainerToken);
    await fsSet(`${rootPath}/attendance/trial-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      memberId: 'member-trial-validation-1',
      memberName: 'Alumno Prueba Validacion',
      date: '2026-06-14',
      status: 'trial_class',
      capturedBy: TEST_USERS.trainer.uid
    }, trainerToken);
    return { status: 'trial_class' };
  });

  await step('Generacion del cargo mensual de $400', async () => {
    const result = await callFunction('boxGenerateMonthlyCharges', adminToken, { period: '2026-07', dueDate: '2026-07-10' });
    const charge = await adminDoc(`${rootPath}/charges/2026-07_member-local-1`);
    if (charge.expectedAmount !== 400 || charge.balance !== 400) throw new Error('Cargo mensual incorrecto');
    return { created: result.created, expectedAmount: charge.expectedAmount };
  });

  await step('Registro de pago en efectivo y actualizacion de saldo', async () => {
    const result = await callFunction('boxCreatePayment', trainerToken, {
      chargeId: '2026-07_member-local-1',
      paidAmount: 400,
      notes: 'Pago validacion entrenador'
    });
    const charge = await adminDoc(`${rootPath}/charges/2026-07_member-local-1`);
    const payment = await adminDoc(`${rootPath}/payments/${result.paymentId}`);
    if (charge.balance !== 0 || charge.status !== 'paid') throw new Error(`Saldo incorrecto: ${JSON.stringify(charge)}`);
    if (payment.cashDeliveryStatus !== 'pending_delivery') throw new Error('Pago no quedo pendiente de entrega');
    return { paymentId: result.paymentId, folio: result.folio, balance: charge.balance, cashDeliveryStatus: payment.cashDeliveryStatus };
  });

  let trainerPaymentId = '';
  let deliveryId = '';
  await step('Pago pendiente y preparacion de entrega', async () => {
    const paymentResult = await callFunction('boxCreatePayment', trainerToken, {
      chargeId: '2026-07_member-local-2',
      paidAmount: 400,
      notes: 'Pago para entrega'
    });
    trainerPaymentId = paymentResult.paymentId;
    const deliveryResult = await callFunction('boxPrepareCashDelivery', trainerToken, { paymentIds: [trainerPaymentId] });
    deliveryId = deliveryResult.deliveryId;
    const delivery = await adminDoc(`${rootPath}/cashDeliveries/${deliveryId}`);
    if (delivery.expectedAmount !== 400 || delivery.status !== 'prepared') throw new Error('Entrega preparada incorrecta');
    return { trainerPaymentId, deliveryId, expectedAmount: delivery.expectedAmount };
  });

  await step('Entrenador no puede confirmar su propia entrega', async () => {
    const rejected = await callFunction('boxConfirmCashDelivery', trainerToken, {
      deliveryId,
      deliveredAmount: 400,
      notes: 'Debe fallar'
    }, false);
    return { rejected: rejected.error?.status || rejected.error?.message || 'rejected' };
  });

  await step('Confirmacion por administrador', async () => {
    await callFunction('boxConfirmCashDelivery', adminToken, { deliveryId, deliveredAmount: 400, notes: 'Confirmada por admin' });
    const delivery = await adminDoc(`${rootPath}/cashDeliveries/${deliveryId}`);
    const payment = await adminDoc(`${rootPath}/payments/${trainerPaymentId}`);
    if (delivery.status !== 'confirmed' || payment.cashDeliveryStatus !== 'confirmed') throw new Error('Confirmacion no actualizo estados');
    return { deliveryStatus: delivery.status, paymentStatus: payment.cashDeliveryStatus };
  });

  await step('Registro de gasto via reglas Firestore', async () => {
    await fsSet(`${rootPath}/expenses/expense-validation-1`, {
      businessId: BOX_BUSINESS_ID,
      folio: 'BOX-GAS-VALID-1',
      concept: 'Gasto validacion',
      category: 'Equipo deportivo',
      amount: 125,
      date: '2026-06-14',
      spentByUserId: TEST_USERS.admin.uid,
      registeredByUserId: TEST_USERS.admin.uid,
      paymentMethod: 'cash',
      description: 'Validacion local',
      status: 'authorized'
    }, adminToken);
    return { amount: 125 };
  });

  await step('Dashboard actualizado con datos reales', async () => {
    const [members, charges, payments, expenses] = await Promise.all([
      adminCollection(`${rootPath}/members`),
      adminCollection(`${rootPath}/charges`),
      adminCollection(`${rootPath}/payments`),
      adminCollection(`${rootPath}/expenses`)
    ]);
    const income = payments.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    if (members.length < 5 || charges.length < 5 || income < 800 || expenseTotal < 125) throw new Error('Datos insuficientes para dashboard');
    return { members: members.length, charges: charges.length, income, expenseTotal };
  });

  await step('Auditoria creada', async () => {
    const logs = await adminCollection(`${rootPath}/auditLogs`);
    if (!logs.some((log) => ['payment_created', 'cash_delivery_confirmed', 'local_seed_created'].includes(log.action))) {
      throw new Error('No se encontraron auditorias esperadas');
    }
    return { auditLogs: logs.length };
  });

  await step('Aislamiento de datos entre negocios', async () => {
    const invalid = await callFunction('boxCreatePayment', adminToken, {
      businessId: 'lombardo_toledano',
      chargeId: '2026-07_member-local-3',
      paidAmount: 100
    }, false);
    return { rejected: invalid.error?.message || 'invalid business rejected' };
  });

  await step('Intento de acceso sin permiso', async () => {
    await fsGet(`${rootPath}/members/member-local-1`, viewerToken, 403);
    return { viewerDenied: true };
  });

  await step('Fallo simulado de WhatsApp sin perdida del pago', async () => {
    const paymentResult = await callFunction('boxCreatePayment', adminToken, {
      chargeId: '2026-07_member-local-3',
      paidAmount: 400,
      notes: 'Pago para comprobante fallido'
    });
    await admin.firestore().doc(`${rootPath}/guardians/guardian-local-2`).set({
      whatsappNumber: '',
      primaryPhone: ''
    }, { merge: true });
    const receipt = await callFunction('boxSendPaymentReceipt', adminToken, { paymentId: paymentResult.paymentId });
    const payment = await adminDoc(`${rootPath}/payments/${paymentResult.paymentId}`);
    if (!payment || payment.paymentStatus !== 'registered') throw new Error('Pago se perdio o cambio indebidamente');
    if (payment.receiptStatus !== 'failed') throw new Error(`Comprobante no fallo como se esperaba: ${payment.receiptStatus}`);
    return { receiptStatus: receipt.status, paymentStillExists: true };
  });

  return { seedInfo, results };
}

if (require.main === module) {
  validate()
    .then((summary) => {
      const failed = summary.results.filter((item) => item.status !== 'passed');
      console.log('\nVALIDATION_SUMMARY');
      console.log(JSON.stringify(summary, null, 2));
      if (failed.length) process.exit(1);
    })
    .catch((error) => {
      console.error('\nVALIDATION_FAILED');
      console.error(error);
      console.log(JSON.stringify({ results }, null, 2));
      process.exit(1);
    });
}

module.exports = { validate };
