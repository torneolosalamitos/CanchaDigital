/* eslint-disable no-console */
const admin = require('../functions/node_modules/firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG_PROJECT_ID || 'torneo-villa-080204';
const BOX_BUSINESS_ID = 'box-lombardo-toledano';

const TEST_USERS = {
  owner: {
    uid: 'test-box-owner',
    email: 'box.owner.local@example.test',
    password: 'BoxOwner123!',
    nombre: 'Dueno Local Box',
    role: 'owner'
  },
  admin: {
    uid: 'test-box-admin',
    email: 'box.admin.local@example.test',
    password: 'BoxAdmin123!',
    nombre: 'Admin Local Box',
    role: 'box_admin'
  },
  trainer: {
    uid: 'test-box-trainer',
    email: 'box.trainer.local@example.test',
    password: 'BoxTrainer123!',
    nombre: 'Entrenador Local Box',
    role: 'trainer'
  },
  viewer: {
    uid: 'test-box-viewer',
    email: 'box.viewer.local@example.test',
    password: 'BoxViewer123!',
    nombre: 'Sin Permiso Box',
    role: null
  }
};

function assertEmulatorOnly() {
  const missing = [
    ['FIRESTORE_EMULATOR_HOST', process.env.FIRESTORE_EMULATOR_HOST],
    ['FIREBASE_AUTH_EMULATOR_HOST', process.env.FIREBASE_AUTH_EMULATOR_HOST],
    ['FIREBASE_DATABASE_EMULATOR_HOST', process.env.FIREBASE_DATABASE_EMULATOR_HOST]
  ].filter(([, value]) => !value);
  if (missing.length) {
    throw new Error(`Seed bloqueado: faltan emuladores (${missing.map(([key]) => key).join(', ')}).`);
  }
}

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${PROJECT_ID}-default-rtdb`
    });
  }
  return {
    auth: admin.auth(),
    firestore: admin.firestore(),
    database: admin.database()
  };
}

async function upsertAuthUser(auth, user) {
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, {
      email: user.email,
      password: user.password,
      displayName: user.nombre,
      emailVerified: true,
      disabled: false
    });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.nombre,
      emailVerified: true,
      disabled: false
    });
  }
}

function businessRolePatch(role) {
  return role ? { [BOX_BUSINESS_ID]: { role, assignedAt: admin.firestore.FieldValue.serverTimestamp(), assignedBy: 'local-seed' } } : {};
}

async function seed() {
  assertEmulatorOnly();
  const { auth, firestore, database } = initAdmin();
  const FieldValue = admin.firestore.FieldValue;
  const root = firestore.collection('businesses').doc(BOX_BUSINESS_ID);

  await Promise.all(Object.values(TEST_USERS).map((user) => upsertAuthUser(auth, user)));
  await Promise.all(Object.values(TEST_USERS).map((user) => firestore.collection('usuarios').doc(user.uid).set({
    uid: user.uid,
    email: user.email,
    nombre: user.nombre,
    role: user.role ? 'viewer' : 'viewer',
    businessRoles: businessRolePatch(user.role),
    creadoAt: Date.now(),
    creadoEn: FieldValue.serverTimestamp(),
    actualizadoEn: FieldValue.serverTimestamp()
  }, { merge: true })));

  await root.set({
    id: BOX_BUSINESS_ID,
    name: 'Shark Boxing Gym',
    displayName: 'SHARK BOXING GYM',
    type: 'boxing_gym',
    status: 'active',
    monthlyFee: 400,
    currency: 'MXN',
    timezone: 'America/Mazatlan',
    paymentMethodsEnabled: ['cash', 'transfer'],
    trialClassesAllowed: 1,
    contactWhatsApp: '6674585275',
    publicInfo: {
      description: 'Seed local para validacion de Shark Boxing Gym.',
      location: 'Unidad Deportiva Lombardo Toledano',
      schedule: 'Lunes a viernes de 5:00 pm a 8:00 pm',
      coaches: ['Orlando Requena'],
      requirements: ['Vendas', 'Agua', 'Tutor responsable'],
      rules: ['Respeto', 'Puntualidad', 'Entrenar con autorizacion'],
      enrollmentStatus: 'Inscripciones abiertas'
    },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const guardians = [
    ['guardian-local-1', 'Maria Tutor Uno', 'Madre', '6671110001'],
    ['guardian-local-2', 'Jose Tutor Dos', 'Padre', '6671110002'],
    ['guardian-local-3', 'Ana Tutor Tres', 'Tutora', '6671110003']
  ];
  const members = [
    ['member-local-1', 'Alumno Local Uno', 'guardian-local-1'],
    ['member-local-2', 'Alumno Local Dos', 'guardian-local-1'],
    ['member-local-3', 'Alumno Local Tres', 'guardian-local-2'],
    ['member-local-4', 'Alumno Local Cuatro', 'guardian-local-3'],
    ['member-local-5', 'Alumno Local Cinco', 'guardian-local-3']
  ];
  const groupId = 'group-local-infantil';
  const period = '2026-06';

  await root.set({
    publicStudents: members.map(([id, fullName], index) => ({
      id,
      publicName: fullName,
      publicGender: index % 2 === 0 ? 'Masculino' : 'Femenino',
      publicStartDate: '2026-06-01',
      status: 'active',
      publicVisible: true
    })),
    publicStudentsUpdatedAt: FieldValue.serverTimestamp(),
    publicStudentsUpdatedBy: 'local-seed'
  }, { merge: true });

  const batch = firestore.batch();
  guardians.forEach(([id, fullName, relationship, phone]) => {
    batch.set(root.collection('guardians').doc(id), {
      businessId: BOX_BUSINESS_ID,
      fullName,
      relationship,
      primaryPhone: phone,
      alternatePhone: '',
      whatsappNumber: `52${phone}`,
      messagingConsent: true,
      address: '',
      notes: 'Seed local',
      memberIds: members.filter(([, , guardianId]) => guardianId === id).map(([memberId]) => memberId),
      createdBy: 'local-seed',
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  batch.set(root.collection('groups').doc(groupId), {
    businessId: BOX_BUSINESS_ID,
    name: 'Grupo infantil vespertino',
    trainerIds: [TEST_USERS.trainer.uid],
    daysOfWeek: ['Lunes', 'Miercoles', 'Viernes'],
    startTime: '17:00',
    endTime: '18:30',
    capacity: 20,
    status: 'active',
    createdBy: 'local-seed',
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  members.forEach(([id, fullName, guardianId], index) => {
    batch.set(root.collection('members').doc(id), {
      businessId: BOX_BUSINESS_ID,
      folio: `BOX-ALU-LOCAL-${index + 1}`,
      fullName,
      photoUrl: '',
      birthDate: `201${index}-01-15`,
      age: 10 + index,
      status: 'active',
      groupId,
      monthlyFee: 400,
      discountAmount: 0,
      scholarshipType: null,
      startDate: '2026-06-01',
      endDate: null,
      guardianIds: [guardianId],
      notes: 'Seed local',
      createdBy: 'local-seed',
      createdAt: FieldValue.serverTimestamp(),
      updatedBy: 'local-seed',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(root.collection('charges').doc(`${period}_${id}`), {
      businessId: BOX_BUSINESS_ID,
      memberId: id,
      billingPeriodId: period,
      periodLabel: 'junio de 2026',
      concept: 'monthly_fee',
      baseAmount: 400,
      discountAmount: 0,
      expectedAmount: 400,
      totalPaid: 0,
      balance: 400,
      dueDate: '2026-06-10',
      status: 'pending',
      modificationReason: '',
      createdBy: 'local-seed',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  batch.set(root.collection('billingPeriods').doc(period), {
    businessId: BOX_BUSINESS_ID,
    period,
    label: 'junio de 2026',
    status: 'open',
    dueDate: '2026-06-10',
    createdBy: 'local-seed',
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(root.collection('sessions').doc('session-local-2026-06-14'), {
    businessId: BOX_BUSINESS_ID,
    groupId,
    date: '2026-06-14',
    status: 'closed',
    notes: 'Sesion seed local',
    capturedBy: TEST_USERS.trainer.uid,
    capturedAt: FieldValue.serverTimestamp(),
    closedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(root.collection('attendance').doc('session-local-2026-06-14_member-local-1'), {
    businessId: BOX_BUSINESS_ID,
    sessionId: 'session-local-2026-06-14',
    groupId,
    memberId: 'member-local-1',
    memberName: 'Alumno Local Uno',
    date: '2026-06-14',
    status: 'present',
    paymentStatusAtAttendance: 'pending',
    capturedBy: TEST_USERS.trainer.uid,
    capturedAt: FieldValue.serverTimestamp(),
    notes: ''
  }, { merge: true });
  batch.set(root.collection('expenses').doc('expense-local-1'), {
    businessId: BOX_BUSINESS_ID,
    folio: 'BOX-GAS-LOCAL-1',
    concept: 'Guantes de prueba',
    category: 'Guantes y material',
    amount: 350,
    date: '2026-06-14',
    spentByUserId: TEST_USERS.admin.uid,
    registeredByUserId: TEST_USERS.admin.uid,
    paymentMethod: 'cash',
    description: 'Seed local',
    status: 'authorized',
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(root.collection('auditLogs').doc('audit-local-seed'), {
    businessId: BOX_BUSINESS_ID,
    actorUserId: 'local-seed',
    action: 'local_seed_created',
    entityType: 'business',
    entityId: BOX_BUSINESS_ID,
    previousValue: null,
    newValue: { members: members.length, guardians: guardians.length },
    reason: 'Validacion local',
    metadata: {},
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();

  await database.ref('emulatorSmoke').set({
    ok: true,
    createdAt: Date.now(),
    note: 'RTDB emulator guard para evitar produccion en pruebas locales'
  });

  return {
    projectId: PROJECT_ID,
    businessId: BOX_BUSINESS_ID,
    users: TEST_USERS,
    groupId,
    period
  };
}

if (require.main === module) {
  seed()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seed, TEST_USERS, BOX_BUSINESS_ID };
