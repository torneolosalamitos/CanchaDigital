const boxState = {
  listenersReady: false,
  privateListenersReady: false,
  unsubscribers: [],
  business: null,
  members: {},
  guardians: {},
  prospects: {},
  groups: {},
  sessions: {},
  attendance: {},
  billingPeriods: {},
  charges: {},
  payments: {},
  cashDeliveries: {},
  expenses: {},
  physicalAudits: {},
  inconsistencies: {},
  notifications: {},
  auditLogs: {},
  activeSecondaryGroup: ''
};

let tournamentNavHtml = '';

const BOX_OWNER_CONTACT_NAME = 'Alfonso García';
const BOX_OWNER_CONTACT_PHONE = '667 458 5275';
const BOX_OWNER_CONTACT_PHONE_DIGITS = '6674585275';
const BOX_PUBLIC_BRAND = 'SHARK BOXING GYM';
const BOX_PUBLIC_LOCATION = 'Unidad Deportiva Lombardo Toledano';
const BOX_PUBLIC_ADDRESS = 'Calle Martiniana Romero y Prof. Antonio Serrano, Rey Melchor, Vicente Lombardo Toledano, 80010 Culiacán Rosales, Sin.';
const BOX_PUBLIC_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${BOX_PUBLIC_LOCATION}, ${BOX_PUBLIC_ADDRESS}`)}`;
const BOX_PUBLIC_SCHEDULE = 'Lunes a viernes de 5:00 pm a 8:00 pm';
const BOX_PUBLIC_SCHEDULE_DAYS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const BOX_PUBLIC_COACH = 'Orlando Requena';
const BOX_PUBLIC_DESCRIPTION = 'Boxeo para todas las edades, enfocado en tecnica, acondicionamiento fisico, disciplina, confianza y constancia.';
const BOX_PUBLIC_REQUIREMENTS = [
  'Nombre completo del alumno y fecha de ingreso para el registro interno.',
  'Datos de contacto del tutor o responsable cuando el alumno sea menor de edad.',
  'Ropa deportiva comoda, tenis limpios, vendas o guantes cuando ya cuente con ellos.',
  'Botella de agua personal y disposicion para seguir indicaciones del entrenador.',
  'Avisar cualquier lesion, condicion medica o situacion que limite el entrenamiento.',
  'Cubrir la mensualidad vigente o acordar el seguimiento administrativo correspondiente.'
];
const BOX_PUBLIC_RULES = [
  'Llegar con puntualidad, saludar al entrenador y esperar indicaciones antes de iniciar.',
  'Mantener respeto hacia companeros, tutores, entrenador y personal del espacio deportivo.',
  'No realizar sparring, ejercicios de contacto o uso de equipo sin autorizacion del entrenador.',
  'Cuidar guantes, costales, cuerdas y material compartido; dejar el area ordenada al terminar.',
  'Entrenar con higiene, vendas limpias y sin objetos que puedan causar lesiones.',
  'Reportar molestias fisicas de inmediato y descansar cuando el entrenador lo indique.',
  'Los tutores deben mantenerse localizables y apoyar la asistencia constante del alumno.',
  'La clase busca formar disciplina y constancia; cualquier conflicto se resuelve hablando con respeto.'
];

function resetBoxListenersForAuthChange() {
  boxState.unsubscribers.forEach((unsubscribe) => {
    try {
      if (typeof unsubscribe === 'function') unsubscribe();
    } catch (error) {
      console.warn('Box unsubscribe', error);
    }
  });
  boxState.listenersReady = false;
  boxState.privateListenersReady = false;
  boxState.unsubscribers = [];
  boxState.business = null;
  BOX_COLLECTIONS.forEach((collectionName) => {
    boxState[collectionName] = {};
  });
}

const BOX_COLLECTIONS = [
  'members',
  'guardians',
  'prospects',
  'groups',
  'sessions',
  'attendance',
  'billingPeriods',
  'charges',
  'payments',
  'cashDeliveries',
  'expenses',
  'physicalAudits',
  'inconsistencies',
  'notifications',
  'auditLogs'
];

const BOX_TRAINER_COLLECTIONS = [
  'members',
  'guardians',
  'groups',
  'sessions',
  'attendance',
  'billingPeriods',
  'charges',
  'payments'
];

const BOX_AUDITOR_COLLECTIONS = [
  'members',
  'groups',
  'sessions',
  'attendance',
  'billingPeriods',
  'charges',
  'payments',
  'expenses',
  'physicalAudits',
  'inconsistencies',
  'auditLogs'
];

const BOX_MEMBER_STATUS_LABELS = {
  prospect: 'Prospecto',
  trial: 'Clase de prueba',
  pending_registration: 'Registro pendiente',
  active: 'Activo',
  active_with_debt: 'Activo con adeudo',
  suspended: 'Suspendido',
  temporary_leave: 'Baja temporal',
  inactive: 'Inactivo',
  permanent_leave: 'Baja definitiva'
};

const BOX_CHARGE_STATUS_LABELS = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
  overdue: 'Vencido',
  scholarship: 'Becado',
  waived: 'Condonado',
  canceled: 'Cancelado'
};

const BOX_ATTENDANCE_LABELS = {
  present: 'Presente',
  absent: 'Ausente',
  justified_absence: 'Falta justificada',
  trial_class: 'Clase de prueba',
  late: 'Llegada tarde',
  early_leave: 'Retiro anticipado'
};

const BOX_PAGES = [
  ['box-public', 'Info publica'],
  ['box-public-students', 'Alumnos publicos'],
  ['box-dashboard', 'Resumen'],
  ['box-students', 'Alumnos'],
  ['box-members', 'Alumnos'],
  ['box-prospects', 'Prospectos'],
  ['box-attendance', 'Asistencia'],
  ['box-attendance-history', 'Historial asistencia'],
  ['box-attendance-trials', 'Clases de prueba'],
  ['box-attendance-audits', 'Auditorias fisicas'],
  ['box-finance', 'Finanzas'],
  ['box-billing', 'Mensualidades'],
  ['box-payments', 'Pagos'],
  ['box-upcoming', 'Proximos pagos'],
  ['box-cash', 'Entregas de efectivo'],
  ['box-expenses', 'Gastos'],
  ['box-reports', 'Resumen'],
  ['box-report-debts', 'Adeudos'],
  ['box-report-attendance', 'Reporte asistencia'],
  ['box-report-money', 'Ingresos y gastos'],
  ['box-report-workers', 'Cobros por trabajador'],
  ['box-inconsistencies', 'Inconsistencias'],
  ['box-receipts', 'Comprobantes'],
  ['box-admin', 'Configuracion'],
  ['box-admin-expenses', 'Categorias de gastos'],
  ['box-admin-folios', 'Folios y parametros'],
  ['box-audit', 'Auditoria'],
  ['box-settings', 'Configuracion']
];

const BOX_ADMIN_MAIN_NAV = [
  ['box-public', 'Inicio'],
  ['box-members', 'Alumnos'],
  ['box-attendance', 'Asistencia'],
  ['box-finance', 'Mensualidades'],
  ['box-reports', 'Resumen'],
  ['box-admin', 'Configuracion']
];

const BOX_TRAINER_MAIN_NAV = [
  ['box-public', 'Inicio'],
  ['box-members', 'Alumnos'],
  ['box-attendance', 'Asistencia'],
  ['box-finance', 'Mensualidades'],
  ['box-upcoming', 'Proximos pagos']
];

const BOX_PUBLIC_NAV = [
  ['box-public', 'Inicio'],
  ['box-public-students', 'Alumnos']
];

const BOX_SECONDARY_NAV = {
  students: [],
  attendance: [
    ['box-attendance', 'Lista'],
    ['box-attendance-history', 'Progreso'],
    ['box-attendance-trials', 'Pruebas']
  ],
  finance: [
    ['box-finance', 'Mensualidades'],
    ['box-upcoming', 'Proximos pagos'],
    ['box-cash', 'Efectivo'],
    ['box-expenses', 'Gastos']
  ],
  reports: [
    ['box-reports', 'General'],
    ['box-report-attendance', 'Asistencia'],
    ['box-report-money', 'Cobranza']
  ],
  admin: [
    ['box-admin', 'Configuracion'],
    ['box-audit', 'Auditoria']
  ]
};

function boxBusinessConfig() {
  return { ...getBusinessConfig(BOX_LOMBARDO_BUSINESS_ID), ...(boxState.business || {}) };
}

function boxMoney(value) {
  return '$' + Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function boxAttr(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function boxNowISO() {
  return todayISO();
}

function boxTs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function boxDateLabel(value) {
  const ts = boxTs(value);
  if (!ts) return '-';
  return new Date(ts).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function boxDateOnly(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return boxNowISO();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function boxMonthsAgoStart(months = 2) {
  const now = new Date();
  return boxDateOnly(new Date(now.getFullYear(), now.getMonth() - months, 1));
}

function boxIsWithinTrainerWindow(value) {
  if (!boxIsTrainerOnly()) return true;
  return String(value || '') >= boxMonthsAgoStart(2);
}

function boxCurrentPeriod() {
  return boxNowISO().slice(0, 7);
}

function boxDateDiffDays(dateISO) {
  if (!dateISO) return null;
  const today = new Date(boxNowISO() + 'T00:00:00');
  const due = new Date(String(dateISO).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function boxMemberCharges(memberId) {
  return Object.values(boxState.charges)
    .filter((c) => c.memberId === memberId && c.status !== 'canceled')
    .sort((a, b) => String(b.billingPeriodId || b.period || '').localeCompare(String(a.billingPeriodId || a.period || '')));
}

function boxLatestCharge(memberId) {
  return boxMemberCharges(memberId)[0] || null;
}

function boxLatestPayment(memberId) {
  return Object.values(boxState.payments)
    .filter((p) => p.memberId === memberId)
    .sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt))[0] || null;
}

function boxCurrentMemberCharge(memberId) {
  const period = boxCurrentPeriod();
  return Object.values(boxState.charges)
    .find((c) => c.memberId === memberId && (c.billingPeriodId === period || c.period === period || String(c.periodLabel || '').includes(period))) || null;
}

function boxPaymentMethodCode(value) {
  const method = String(value || '').toLowerCase();
  if (method.includes('transfer')) return 'transfer';
  return 'cash';
}

function boxPaymentMethodLabel(value) {
  return boxPaymentMethodCode(value) === 'transfer' ? 'Transferencia' : 'Efectivo';
}

function boxEnabledPaymentMethods() {
  const cfg = boxBusinessConfig();
  const enabled = Array.isArray(cfg.paymentMethodsEnabled) && cfg.paymentMethodsEnabled.length
    ? cfg.paymentMethodsEnabled
    : ['cash'];
  return enabled.map(boxPaymentMethodCode).filter((method, index, arr) => arr.indexOf(method) === index);
}

function boxPaymentMethodOptions(selected = 'cash') {
  const current = boxPaymentMethodCode(selected);
  return boxEnabledPaymentMethods()
    .map((method) => `<option value="${method}" ${method === current ? 'selected' : ''}>${boxPaymentMethodLabel(method)}</option>`)
    .join('');
}

function boxMemberStatusPublicLabel(member) {
  return ['inactive', 'permanent_leave', 'temporary_leave', 'suspended'].includes(member.status) ? 'Baja' : 'Activo';
}

function boxMeter(label, value, tone = '') {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  return `<div class="box-meter ${tone}">
    <div class="box-meter-top"><strong>${label}</strong><span>${pct}%</span></div>
    <div class="box-meter-track"><i style="width:${pct}%"></i></div>
  </div>`;
}

function boxMemberPaymentState(member) {
  if (['scholarship', 'becado'].includes(member.scholarshipType) || member.status === 'scholarship') {
    return { label: 'Becado', tone: 'success', charge: null, balance: 0, dueDate: '', days: null };
  }
  if (['inactive', 'permanent_leave', 'temporary_leave'].includes(member.status) || member.exemptPayment) {
    return { label: 'Exento', tone: 'success', charge: null, balance: 0, dueDate: '', days: null };
  }
  const charge = boxLatestCharge(member.id);
  const balance = Number(charge?.balance || 0);
  const paid = Number(charge?.totalPaid || 0);
  const dueDate = charge?.dueDate || member.nextDueDate || '';
  const days = boxDateDiffDays(dueDate);
  if (balance <= 0 && charge) return { label: 'Al corriente', tone: 'success', charge, balance, dueDate, days };
  if (paid > 0 && balance > 0) return { label: 'Abono pendiente', tone: 'warning', charge, balance, dueDate, days };
  if (days === 0) return { label: 'Vence hoy', tone: 'warning', charge, balance, dueDate, days };
  if (days !== null && days < 0 && balance > 0) return { label: 'Vencido', tone: 'danger', charge, balance, dueDate, days };
  if (days !== null && days >= 1 && days <= 5) return { label: 'Proximo a pagar', tone: 'warning', charge, balance, dueDate, days };
  return { label: balance > 0 ? 'Pendiente' : 'Al corriente', tone: balance > 0 ? 'warning' : 'success', charge, balance, dueDate, days };
}

function boxUpcomingPaymentItems() {
  return Object.values(boxState.members)
    .filter((m) => ['active', 'active_with_debt', 'trial'].includes(m.status))
    .map((member) => ({ member, state: boxMemberPaymentState(member) }))
    .filter(({ state }) => ['Proximo a pagar', 'Vence hoy', 'Vencido', 'Abono pendiente'].includes(state.label))
    .sort((a, b) => (a.state.days ?? 999) - (b.state.days ?? 999));
}

function boxPublicStudentName(member) {
  const cfg = boxBusinessConfig();
  const mode = cfg.publicStudentNameMode || 'first';
  if (member.publicName) return String(member.publicName).trim();
  const parts = String(member.publicName || member.fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Alumno';
  if (mode === 'full') return parts.join(' ');
  if (mode === 'abbreviated') return parts.map((part, index) => index === 0 ? part : `${part.charAt(0)}.`).join(' ');
  return parts[0];
}

function boxPublicGender(member) {
  const raw = String(member.publicGender || member.gender || member.genero || member.sex || '').trim().toLowerCase();
  if (['f', 'femenino', 'mujer', 'female'].includes(raw)) return 'Femenino';
  if (['m', 'masculino', 'hombre', 'male'].includes(raw)) return 'Masculino';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'No especificado';
}

function boxPublicAdmissionDate(member) {
  const value = member.publicStartDate || member.startDate || member.admissionDate || member.joinedAt || member.createdAt;
  if (!value) return 'Por confirmar';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = boxTs(value);
  return ts ? boxDateOnly(ts) : 'Por confirmar';
}

function boxPublicStudentSnapshot(members = boxState.members) {
  return Object.values(members)
    .filter((member) => ['active', 'active_with_debt', 'trial'].includes(member.status) && member.publicVisible !== false)
    .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
    .map((member) => ({
      publicName: boxPublicStudentName(member),
      publicGender: boxPublicGender(member),
      publicStartDate: boxPublicAdmissionDate(member),
      status: member.status || 'active',
      publicVisible: true
    }));
}

async function syncBoxPublicStudents(memberOverrides = {}) {
  if (!fs || !canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) return;
  const members = { ...boxState.members, ...memberOverrides };
  await boxPath().set({
    publicStudents: boxPublicStudentSnapshot(members),
    publicStudentsUpdatedAt: boxServerTimestamp(),
    publicStudentsUpdatedBy: currentUser?.uid || ''
  }, { merge: true });
}

function boxPublicWhatsAppLink(message = '') {
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/52${BOX_OWNER_CONTACT_PHONE_DIGITS}${text}`;
}

function boxNormalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function boxPath(collectionName, docId) {
  const root = fs.collection('businesses').doc(BOX_LOMBARDO_BUSINESS_ID);
  if (!collectionName) return root;
  const collection = root.collection(collectionName);
  return docId ? collection.doc(docId) : collection;
}

function boxCollectionSource(collectionName) {
  const collection = boxPath(collectionName);
  if (!boxIsTrainerOnly()) return collection;
  const cutoffDate = boxMonthsAgoStart(2);
  const cutoffPeriod = cutoffDate.slice(0, 7);
  if (['attendance', 'sessions', 'physicalAudits'].includes(collectionName)) return collection.where('date', '>=', cutoffDate);
  if (collectionName === 'payments') return collection.where('receivedByUserId', '==', currentUser?.uid || '__no_user__');
  if (collectionName === 'charges') return collection.where('billingPeriodId', '>=', cutoffPeriod);
  if (collectionName === 'notifications') return collection.where('noticeDate', '>=', cutoffDate);
  return collection;
}

function boxCollectionsForRole() {
  if (canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) return BOX_COLLECTIONS;
  const role = getBusinessRole(BOX_LOMBARDO_BUSINESS_ID);
  if (role === 'trainer') return BOX_TRAINER_COLLECTIONS;
  if (role === 'auditor') return BOX_AUDITOR_COLLECTIONS;
  return [];
}

function boxServerTimestamp() {
  return firestoreServerTimestamp();
}

function boxCurrentUserName() {
  return currentUser?.displayName || currentUser?.email || 'Usuario';
}

function boxCallable(name, payload = {}) {
  if (!firebase?.functions) return Promise.reject(new Error('Firebase Functions no esta disponible'));
  return firebase.functions().httpsCallable(name)({ businessId: BOX_LOMBARDO_BUSINESS_ID, ...payload });
}

async function boxAudit(action, entityType, entityId, previousValue, newValue, reason = '', metadata = {}) {
  if (!fs || !currentUser) return;
  await boxPath('auditLogs').add({
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    actorUserId: currentUser.uid,
    actorName: boxCurrentUserName(),
    action,
    entityType,
    entityId,
    previousValue: previousValue || null,
    newValue: newValue || null,
    reason,
    metadata,
    createdAt: boxServerTimestamp()
  }).catch((error) => console.warn('box audit', error));
}

function createBoxPages() {
  const shell = document.getElementById('appShell');
  if (!shell || document.getElementById('page-box-public')) return;
  const html = BOX_PAGES.map(([key]) => `<div class="page box-page" id="page-${key}"></div>`).join('');
  shell.insertAdjacentHTML('beforeend', html);
}

function boxRoleKey() {
  if (isOwner) return 'owner';
  return getBusinessRole(BOX_LOMBARDO_BUSINESS_ID) || '';
}

function boxIsTrainerOnly() {
  return boxRoleKey() === 'trainer';
}

function boxMainNavItems() {
  const base = boxIsTrainerOnly() ? BOX_TRAINER_MAIN_NAV : BOX_ADMIN_MAIN_NAV;
  return base.filter(([key]) => canAccessBusinessPage(key));
}

function renderBoxNav() {
  const nav = document.querySelector('.nav-tabs');
  if (!nav) return;
  if (!tournamentNavHtml) tournamentNavHtml = nav.innerHTML;
  const items = canAccessBusinessAdmin(BOX_LOMBARDO_BUSINESS_ID) ? boxMainNavItems() : BOX_PUBLIC_NAV;
  nav.innerHTML = items
    .map(([key, label], index) => `<button class="nav-tab ${index === 0 ? 'active' : ''}" data-box-main="${key}" onclick="boxOpenPage('${key}','main',this)">${label}</button>`)
    .join('');
}

function boxOpenPage(key, groupKey = '', btn = null) {
  boxState.activeSecondaryGroup = groupKey || '';
  showPage(key, btn);
}

function restoreTournamentNav() {
  document.body.classList.remove('box-mode');
  const catTabs = document.getElementById('catTabsContainer');
  if (catTabs) catTabs.style.display = '';
  const nav = document.querySelector('.nav-tabs');
  if (nav && tournamentNavHtml) nav.innerHTML = tournamentNavHtml;
  document.querySelectorAll('.box-page').forEach((page) => page.classList.remove('active'));
}

function selectBoxBusiness() {
  document.body.classList.add('box-mode');
  currentBusinessId = BOX_LOMBARDO_BUSINESS_ID;
  localStorage.setItem('ld_business', BOX_LOMBARDO_BUSINESS_ID);
  document.getElementById('splash').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  createBoxPages();
  renderBoxNav();
  const catTabs = document.getElementById('catTabsContainer');
  if (catTabs) catTabs.style.display = 'none';
  const cfg = boxBusinessConfig();
  document.getElementById('hdrName').textContent = BOX_PUBLIC_BRAND;
  document.getElementById('hdrCat').textContent = 'Boxeo para todas las edades';
  const logo = document.getElementById('hdrTorneoLogo');
  if (logo) logo.src = SHARK_BOXING_GYM_LOGO;
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userChip = document.getElementById('userChip');
  if (loginBtn) loginBtn.style.display = currentUser ? 'none' : 'block';
  if (logoutBtn) logoutBtn.style.display = currentUser ? 'block' : 'none';
  if (userChip) userChip.classList.toggle('show', !!currentUser);
  setupBoxListeners();
  const startPage = canAccessBusinessAdmin(BOX_LOMBARDO_BUSINESS_ID) ? (boxMainNavItems()[0]?.[0] || 'box-dashboard') : 'box-public';
  showPage(startPage, document.querySelector(`.nav-tab[onclick="showPage('${startPage}',this)"]`) || document.querySelector('.nav-tab'));
}

function setupBoxListeners() {
  if (!fs) {
    renderBoxPage(document.querySelector('.box-page.active')?.id?.replace('page-', '') || 'box-public');
    return;
  }
  if (!boxState.listenersReady) {
    boxState.listenersReady = true;
    boxState.unsubscribers.push(boxPath().onSnapshot((doc) => {
      boxState.business = doc.exists ? { id: doc.id, ...doc.data() } : null;
      renderActiveBoxPage();
    }));
  }
  if (!canAccessBusinessAdmin(BOX_LOMBARDO_BUSINESS_ID) || boxState.privateListenersReady) {
    renderBoxPage(document.querySelector('.box-page.active')?.id?.replace('page-', '') || 'box-public');
    return;
  }
  boxState.privateListenersReady = true;
  const collections = boxCollectionsForRole();
  collections.forEach((collectionName) => {
    boxState.unsubscribers.push(boxCollectionSource(collectionName).onSnapshot((snapshot) => {
      boxState[collectionName] = {};
      snapshot.forEach((doc) => {
        boxState[collectionName][doc.id] = { id: doc.id, _key: doc.id, ...doc.data() };
      });
      renderActiveBoxPage();
    }, (error) => console.warn(`Box ${collectionName}`, error)));
  });
}

function renderActiveBoxPage() {
  const active = document.querySelector('.box-page.active');
  if (active) renderBoxPage(active.id.replace('page-', ''));
}

function renderBoxPage(pageKey) {
  if (!isBusinessPage(pageKey)) return;
  const renderers = {
    'box-public': renderBoxPublic,
    'box-public-students': renderBoxPublicStudents,
    'box-dashboard': renderBoxDashboard,
    'box-students': renderBoxStudents,
    'box-members': renderBoxMembers,
    'box-prospects': renderBoxProspects,
    'box-attendance': renderBoxAttendance,
    'box-attendance-history': renderBoxAttendanceHistory,
    'box-attendance-trials': renderBoxAttendanceTrials,
    'box-attendance-audits': renderBoxAttendanceAudits,
    'box-finance': renderBoxFinance,
    'box-billing': renderBoxBilling,
    'box-payments': renderBoxPayments,
    'box-upcoming': renderBoxUpcomingPayments,
    'box-cash': renderBoxCash,
    'box-expenses': renderBoxExpenses,
    'box-reports': renderBoxReports,
    'box-report-debts': renderBoxReportDebts,
    'box-report-attendance': renderBoxReportAttendance,
    'box-report-money': renderBoxReportMoney,
    'box-report-workers': renderBoxReportWorkers,
    'box-inconsistencies': renderBoxInconsistencies,
    'box-receipts': renderBoxReceipts,
    'box-admin': renderBoxAdmin,
    'box-admin-expenses': renderBoxAdminExpenses,
    'box-admin-folios': renderBoxAdminFolios,
    'box-audit': renderBoxAudit,
    'box-settings': renderBoxSettings
  };
  (renderers[pageKey] || renderBoxPublic)();
}

function boxSetPage(key, html) {
  const el = document.getElementById('page-' + key);
  if (el) el.innerHTML = html;
}

function boxEmpty(label) {
  return `<div class="empty"><span class="empty-icon">-</span>${label}</div>`;
}

function boxKpi(title, value, tone = '') {
  return `<div class="box-kpi ${tone}"><div class="box-kpi-value">${value}</div><div class="box-kpi-label">${title}</div></div>`;
}

function boxSectionHeader(title, subtitle = '', actions = '') {
  return `<div class="box-section-head">
    <div>
      <div class="box-section-kicker">${BOX_PUBLIC_BRAND}</div>
      <h2>${title}</h2>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    ${actions ? `<div class="box-section-actions">${actions}</div>` : ''}
  </div>`;
}

function boxTabs(groupKey, activeKey) {
  const tabs = BOX_SECONDARY_NAV[groupKey] || [];
  const trainerAllowed = new Set(['box-members', 'box-attendance']);
  const visible = tabs.filter(([key]) => canAccessBusinessPage(key) && (!boxIsTrainerOnly() || trainerAllowed.has(key)));
  if (!visible.length) return '';
  return `<div class="box-subtabs">${visible.map(([key, label]) => `
    <button class="box-subtab ${key === activeKey ? 'active' : ''}" onclick="boxOpenPage('${key}', '${groupKey}', this)">${label}</button>
  `).join('')}</div>`;
}

function boxPageShell(groupKey, activeKey, title, subtitle, body, actions = '') {
  return `${boxSectionHeader(title, subtitle, actions)}${boxTabs(groupKey, activeKey)}${body}`;
}

function boxRecentPayments(limit = 5) {
  const payments = Object.values(boxState.payments)
    .filter((p) => !boxIsTrainerOnly() || boxIsWithinTrainerWindow(p.paymentDate || boxDateOnly(boxTs(p.createdAt))))
    .sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt)).slice(0, limit);
  return payments.length ? payments.map((p) => `<div class="box-row compact">
    <div><strong>${p.folio || p.id}</strong><span>${boxState.members[p.memberId]?.fullName || p.memberId} · ${boxMoney(p.paidAmount)} · ${boxPaymentMethodLabel(p.paymentMethod)} · ${p.cashDeliveryStatus || '-'}</span></div>
    <button class="btn btn-out btn-sm" onclick="sendBoxReceipt('${p.id}')">Comprobante</button>
  </div>`).join('') : boxEmpty('Sin pagos recientes');
}

function boxUpcomingCharges(limit = 6) {
  const charges = Object.values(boxState.charges)
    .filter((c) => Number(c.balance || 0) > 0 && c.status !== 'canceled')
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    .slice(0, limit);
  return charges.length ? charges.map((c) => `<div class="box-row compact">
    <div><strong>${boxState.members[c.memberId]?.fullName || c.memberId}</strong><span>${c.periodLabel || c.billingPeriodId} Â· vence ${c.dueDate || '-'} Â· saldo ${boxMoney(c.balance)}</span></div>
    <span class="box-pill">${BOX_CHARGE_STATUS_LABELS[c.status] || c.status}</span>
  </div>`).join('') : boxEmpty('Sin vencimientos pendientes');
}

function boxUpcomingRows(limit = 20, compact = false) {
  const items = boxUpcomingPaymentItems().slice(0, limit);
  if (!items.length) return boxEmpty('Sin pagos proximos o vencidos');
  return items.map(({ member, state }) => {
    const daysLabel = state.days === 0 ? 'vence hoy' : state.days < 0 ? `${Math.abs(state.days)} dia(s) vencido` : `faltan ${state.days} dia(s)`;
    const phone = boxNormalizePhone(member.phone || '');
    const message = encodeURIComponent(`Hola, te recordamos la mensualidad de ${member.fullName || 'alumno'} en ${BOX_PUBLIC_BRAND}. Saldo pendiente: ${boxMoney(state.balance)}.`);
    return `<div class="box-row ${compact ? 'compact' : ''}">
      <div>
        <strong>${member.fullName || '-'}</strong>
        <span>Tel. ${phone || 'sin telefono'} · ${state.dueDate || 'sin vencimiento'}</span>
        <span>${daysLabel} · pendiente ${boxMoney(state.balance)}</span>
      </div>
      <div class="box-row-actions">
        <span class="box-pill ${state.tone || ''}">${state.label}</span>
        ${phone ? `<a class="btn btn-out btn-sm" href="https://wa.me/52${phone}?text=${message}" target="_blank" rel="noopener" onclick="logBoxPaymentNotice('${member.id}', '${state.charge?.id || ''}')">WhatsApp</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderBoxUpcomingPayments() {
  boxSetPage('box-upcoming', `
    ${boxSectionHeader('Proximos pagos', 'Alumnos por vencer, vencidos o con abono pendiente.')}
    <div class="card box-panel">
      <div class="sh"><div class="st">Seguimiento de cobranza</div><div class="sl"></div></div>
      ${boxUpcomingRows(50)}
    </div>`);
}

async function logBoxPaymentNotice(memberId, chargeId = '') {
  if (!fs || !currentUser) return;
  const member = boxState.members[memberId] || {};
  const payload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    type: 'payment_reminder',
    memberId,
    chargeId,
    to: boxNormalizePhone(member.phone || ''),
    status: 'opened_whatsapp',
    lastMessage: `Recordatorio de mensualidad para ${member.fullName || memberId}`,
    noticeDate: boxNowISO(),
    notifiedBy: currentUser.uid,
    notifiedByName: boxCurrentUserName(),
    notifiedAt: boxServerTimestamp(),
    createdAt: boxServerTimestamp()
  };
  await boxPath('notifications').add(payload).catch((error) => console.warn('box payment notice', error));
  await boxAudit('payment_notice_opened', 'member', memberId, null, payload);
}

function boxActivity(limit = 6) {
  const logs = Object.values(boxState.auditLogs).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt)).slice(0, limit);
  return logs.length ? logs.map((l) => `<div class="box-row compact">
    <div><strong>${l.action}</strong><span>${l.entityType} Â· ${boxDateLabel(l.createdAt)} Â· ${l.actorName || l.actorUserId || '-'}</span></div>
  </div>`).join('') : boxEmpty('Sin actividad reciente');
}

function boxQuickActions() {
  const actions = [];
  if (canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) {
    actions.push(['Registrar pago', 'box-finance']);
    actions.push(['Pasar asistencia', 'box-attendance']);
    actions.push(['Nuevo alumno', 'box-members']);
  }
  if (canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) actions.push(['Registrar gasto', 'box-expenses']);
  if (canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) actions.push(['Confirmar entrega', 'box-cash']);
  if (canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) actions.push(['Notificar proximos pagos', 'box-upcoming']);
  return actions.length ? `<div class="box-action-grid">${actions.map(([label, key]) => `<button class="btn btn-g btn-full" onclick="showPage('${key}', document.querySelector('[data-box-main]'))">${label}</button>`).join('')}</div>` : boxEmpty('Sin acciones disponibles para tu rol');
}

function boxAttendanceStats() {
  const active = Object.values(boxState.members).filter((m) => ['active', 'active_with_debt', 'trial'].includes(m.status));
  const activeCount = Math.max(active.length, 1);
  const today = boxNowISO();
  const now = new Date(today + 'T00:00:00');
  const weekStart = boxDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const monthStart = today.slice(0, 8) + '01';
  const records = Object.values(boxState.attendance).filter((a) => !boxIsTrainerOnly() || boxIsWithinTrainerWindow(a.date));
  const presentLike = (a) => ['present', 'trial_class', 'late'].includes(a.status);
  const todayPresent = records.filter((a) => a.date === today && presentLike(a)).length;
  const weekRecords = records.filter((a) => a.date >= weekStart);
  const monthRecords = records.filter((a) => a.date >= monthStart);
  const uniqueWeekDates = new Set(weekRecords.map((a) => a.date)).size || 1;
  const uniqueMonthDates = new Set(monthRecords.map((a) => a.date)).size || 1;
  const percent = (value, total) => Math.round((Number(value || 0) / Math.max(Number(total || 0), 1)) * 100);
  const byMember = active.map((member) => {
    const memberRecords = monthRecords.filter((a) => a.memberId === member.id);
    const presents = memberRecords.filter(presentLike).length;
    return { member, total: memberRecords.length, presents, pct: percent(presents, memberRecords.length || uniqueMonthDates) };
  });
  return {
    todayPresent,
    todayPct: percent(todayPresent, activeCount),
    weekPct: percent(weekRecords.filter(presentLike).length, activeCount * uniqueWeekDates),
    monthPct: percent(monthRecords.filter(presentLike).length, activeCount * uniqueMonthDates),
    averagePct: byMember.length ? Math.round(byMember.reduce((sum, item) => sum + item.pct, 0) / byMember.length) : 0,
    low: byMember.filter((item) => item.total && item.pct < 60),
    inactiveRecent: active.filter((member) => !records.some((a) => a.memberId === member.id && a.date >= weekStart && presentLike(a))),
    formula: 'presentes / alumnos activos o asistencias posibles del periodo * 100'
  };
}

function boxStats() {
  const members = Object.values(boxState.members);
  const activeMembers = members.filter((m) => ['active', 'active_with_debt', 'trial'].includes(m.status));
  const prospects = Object.values(boxState.prospects).filter((p) => p.status !== 'converted');
  const billableIds = new Set(activeMembers.filter((m) => !m.exemptPayment && !['scholarship', 'becado'].includes(m.scholarshipType)).map((m) => m.id));
  const charges = Object.values(boxState.charges).filter((c) => c.status !== 'canceled' && billableIds.has(c.memberId));
  const payments = Object.values(boxState.payments).filter((p) => p.paymentStatus !== 'reverted' && (!boxIsTrainerOnly() || boxIsWithinTrainerWindow(p.paymentDate || p.createdAtDate || boxDateOnly(boxTs(p.createdAt)))));
  const expenses = Object.values(boxState.expenses).filter((e) => !['canceled', 'rejected'].includes(e.status));
  const pendingCharges = charges.filter((c) => Number(c.balance || 0) > 0);
  const cashPayments = payments.filter((p) => boxPaymentMethodCode(p.paymentMethod) === 'cash');
  const transferPayments = payments.filter((p) => boxPaymentMethodCode(p.paymentMethod) === 'transfer');
  const pendingCash = cashPayments.filter((p) => p.cashDeliveryStatus === 'pending_delivery');
  const confirmedCash = cashPayments.filter((p) => p.cashDeliveryStatus === 'confirmed');
  const expected = charges.reduce((sum, charge) => sum + Number(charge.expectedAmount || 0), 0);
  const income = payments.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const today = boxNowISO();
  const todayAttendance = Object.values(boxState.attendance).filter((a) => a.date === today && a.status !== 'absent').length;
  const states = activeMembers.map((member) => boxMemberPaymentState(member));
  return {
    members,
    activeMembers,
    prospects,
    charges,
    payments,
    cashPayments,
    transferPayments,
    expenses,
    pendingCharges,
    pendingCash,
    confirmedCash,
    expected,
    income,
    expenseTotal,
    todayAttendance,
    net: income - expenseTotal,
    currentMembers: states.filter((s) => s.label === 'Al corriente').length,
    upcomingMembers: states.filter((s) => s.label === 'Proximo a pagar' || s.label === 'Vence hoy').length,
    overdueMembers: states.filter((s) => s.label === 'Vencido').length,
    partialMembers: states.filter((s) => s.label === 'Abono pendiente').length
  };
}

function renderBoxPublic() {
  const cfg = boxBusinessConfig();
  const info = cfg.publicInfo || {};
  const location = info.location || BOX_PUBLIC_LOCATION;
  const schedule = info.schedule || BOX_PUBLIC_SCHEDULE;
  const coaches = Array.isArray(info.coaches) && info.coaches.length ? info.coaches : [BOX_PUBLIC_COACH];
  const description = 'Disciplina, confianza y acondicionamiento para todas las edades.';
  boxSetPage('box-public', `
    <div class="box-hero box-home-hero">
      <div>
        <h1>${BOX_PUBLIC_BRAND}</h1>
        <p>${description}</p>
      </div>
      <div class="box-hero-logo"><img src="${SHARK_BOXING_GYM_LOGO}" alt="${BOX_PUBLIC_BRAND}"/></div>
    </div>
    <div class="box-home-strip">
      <section class="card box-home-card">
        <div class="box-card-symbol">📍</div>
        <div class="sh"><div class="st">Ubicacion</div><div class="sl"></div></div>
        <p class="box-card-main">${location}</p>
        <a class="box-geo-card" href="${BOX_PUBLIC_MAPS_URL}" target="_blank" rel="noopener" aria-label="Abrir ubicacion de ${BOX_PUBLIC_BRAND}">
          <span class="box-geo-road box-geo-road-a"></span>
          <span class="box-geo-road box-geo-road-b"></span>
          <span class="box-geo-road box-geo-road-c"></span>
          <span class="box-geo-pin">⌖</span>
          <span class="box-geo-label">Abrir mapa</span>
        </a>
      </section>
      <section class="card box-home-card">
        <div class="box-card-symbol">⌚</div>
        <div class="sh"><div class="st">Horario</div><div class="sl"></div></div>
        <div class="box-schedule-list">
          ${BOX_PUBLIC_SCHEDULE_DAYS.map((day) => `<div><strong>${day}</strong><span>5:00 PM - 8:00 PM</span></div>`).join('')}
        </div>
      </section>
      <section class="card box-home-card">
        <div class="box-card-symbol">🥊</div>
        <div class="sh"><div class="st">Coach y contacto</div><div class="sl"></div></div>
        <div class="box-contact-stack">
          <div><span>Entrenador</span><strong>${coaches.join(', ')}</strong></div>
          <div><span>Informes</span><strong>${BOX_OWNER_CONTACT_NAME}<br>${BOX_OWNER_CONTACT_PHONE}</strong></div>
        </div>
        <a class="btn btn-g btn-full" href="${boxPublicWhatsAppLink('Hola, quiero informacion sobre horarios e inscripcion del box.')}" target="_blank" rel="noopener">Pedir informacion por WhatsApp</a>
      </section>
    </div>`);
}

async function saveBoxProspect() {
  if (!fs) return showToast('Firestore no disponible', 'tr');
  const fullName = document.getElementById('bp_child')?.value.trim();
  const age = Number(document.getElementById('bp_age')?.value || 0);
  const contactName = document.getElementById('bp_guardian')?.value.trim();
  const phone = boxNormalizePhone(document.getElementById('bp_phone')?.value);
  const interestedSchedule = document.getElementById('bp_schedule')?.value.trim();
  const notes = document.getElementById('bp_notes')?.value.trim();
  const consent = document.getElementById('bp_consent')?.checked;
  if (!fullName || phone.length !== 10 || !consent) return showToast('Completa nombre, telefono y consentimiento', 'ta');
  await boxPath('prospects').add({
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    fullName,
    age,
    guardianName: contactName || '',
    guardianPhone: phone,
    interestedSchedule,
    notes,
    contactConsent: true,
    source: 'public_form',
    status: 'new',
    createdAt: boxServerTimestamp()
  });
  ['bp_child', 'bp_age', 'bp_guardian', 'bp_phone', 'bp_schedule', 'bp_notes'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('bp_consent').checked = false;
  showToast('Preinscripcion registrada', 'tg');
}

function renderBoxDashboard() {
  const s = boxStats();
  const alerts = buildBoxAlerts();
  const pendingCashTotal = s.pendingCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const att = boxAttendanceStats();
  const collectionPct = Math.round((s.income / Math.max(s.expected, 1)) * 100);
  boxSetPage('box-dashboard', `
    ${boxSectionHeader(boxIsTrainerOnly() ? 'Inicio' : 'Inicio', 'Operacion diaria del box sin datos de torneos.', canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) ? '<button class="btn btn-out btn-sm" onclick="boxSeedBusiness()">Inicializar</button>' : '')}
    <div class="box-kpi-grid primary">
      ${boxKpi(boxIsTrainerOnly() ? 'Total de alumnos activos' : 'Total registrados', boxIsTrainerOnly() ? s.activeMembers.length : s.members.length)}
      ${boxKpi(boxIsTrainerOnly() ? 'Asistencias de hoy' : 'Alumnos activos', boxIsTrainerOnly() ? s.todayAttendance : s.activeMembers.length)}
      ${boxKpi('Proximos a pagar', s.upcomingMembers)}
      ${boxKpi('Vencidos', s.overdueMembers, s.overdueMembers ? 'danger' : '')}
    </div>
    <div class="box-kpi-grid secondary">
      ${boxKpi(boxIsTrainerOnly() ? 'Cobrado por entrenador' : 'Ingreso esperado', boxIsTrainerOnly() ? boxMoney(s.income) : boxMoney(s.expected))}
      ${boxKpi(boxIsTrainerOnly() ? 'Efectivo pendiente' : 'Ingreso cobrado', boxIsTrainerOnly() ? boxMoney(pendingCashTotal) : boxMoney(s.income), pendingCashTotal ? 'warning' : '')}
      ${boxKpi(boxIsTrainerOnly() ? 'Al corriente' : 'Saldo pendiente', boxIsTrainerOnly() ? s.currentMembers : boxMoney(s.pendingCharges.reduce((sum, c) => sum + Number(c.balance || 0), 0)))}
      ${boxKpi(boxIsTrainerOnly() ? 'Asistencia mensual' : 'Resultado neto', boxIsTrainerOnly() ? `${att.monthPct}%` : boxMoney(s.net), s.net < 0 ? 'danger' : 'success')}
    </div>
    <div class="box-grid box-grid-2">
      <section class="card box-panel"><div class="sh"><div class="st">Accesos rapidos</div><div class="sl"></div></div>${boxQuickActions()}</section>
      <section class="card box-panel"><div class="sh"><div class="st">Proximos pagos</div><div class="sl"></div></div>${boxUpcomingRows(5, true)}</section>
      ${!boxIsTrainerOnly() ? `<section class="card box-panel"><div class="sh"><div class="st">Asistencia</div><div class="sl"></div></div><div class="box-info-list"><div><strong>Hoy</strong><span>${att.todayPresent}/${s.activeMembers.length} alumnos · ${att.todayPct}%</span></div><div><strong>Semana</strong><span>${att.weekPct}%</span></div><div><strong>Mes</strong><span>${att.monthPct}%</span></div><div><strong>Formula</strong><span>${att.formula}</span></div></div></section>
      <section class="card box-panel"><div class="sh"><div class="st">Mensualidades</div><div class="sl"></div></div><div class="box-info-list"><div><strong>Cobranza</strong><span>${collectionPct}% · ${boxMoney(s.income)} / ${boxMoney(s.expected)}</span></div><div><strong>Al corriente</strong><span>${s.currentMembers}</span></div><div><strong>Abonos pendientes</strong><span>${s.partialMembers}</span></div><div><strong>Formula</strong><span>monto cobrado / monto esperado * 100</span></div></div></section>` : ''}
    </div>`);
}

function renderBoxPublicStudents() {
  boxSetPage('box-public-students', `
    <div class="box-section-head box-section-head-simple">
      <div><h2>Alumnos</h2></div>
    </div>
    <section class="card box-public-restricted">
      <div class="box-public-lock">🔒</div>
      <strong>Listado reservado</strong>
      <span>La informacion completa de alumnos solo esta disponible para entrenador y administracion.</span>
    </section>`);
}

function buildBoxAlerts() {
  const alerts = [];
  const members = Object.values(boxState.members);
  members.filter((m) => ['active', 'active_with_debt'].includes(m.status) && (!m.guardianIds || !m.guardianIds.length)).forEach((m) => {
    alerts.push({ severity: 'warning', label: 'Alumno activo sin tutor', detail: m.fullName });
  });
  Object.values(boxState.charges).filter((c) => Number(c.balance || 0) > 0 && c.status !== 'canceled').forEach((c) => {
    const member = boxState.members[c.memberId];
    alerts.push({ severity: c.status === 'overdue' ? 'critical' : 'warning', label: 'Mensualidad pendiente', detail: `${member?.fullName || c.memberId} Â· ${boxMoney(c.balance)}` });
  });
  Object.values(boxState.payments).filter((p) => p.receiptStatus !== 'sent').forEach((p) => {
    alerts.push({ severity: 'info', label: 'Pago sin comprobante enviado', detail: p.folio || p.id });
  });
  Object.values(boxState.payments).filter((p) => boxPaymentMethodCode(p.paymentMethod) === 'cash' && p.cashDeliveryStatus === 'pending_delivery').forEach((p) => {
    alerts.push({ severity: 'warning', label: 'Pago pendiente de entregar', detail: `${p.folio || p.id} Â· ${boxMoney(p.paidAmount)}` });
  });
  Object.values(boxState.cashDeliveries).filter((d) => Number(d.differenceAmount || 0) !== 0).forEach((d) => {
    alerts.push({ severity: 'critical', label: 'Entrega con diferencia', detail: `${d.folio || d.id} Â· ${boxMoney(d.differenceAmount)}` });
  });
  return alerts.slice(0, 30);
}

function boxWrapExistingPage(targetKey, groupKey, activeKey, title, subtitle, renderFn) {
  renderFn();
  const source = document.getElementById('page-' + targetKey);
  const content = source?.innerHTML || '';
  boxSetPage(targetKey, boxPageShell(groupKey, activeKey, title, subtitle, content));
}

function renderBoxStudents() {
  renderBoxMembers();
  const content = document.getElementById('page-box-members')?.innerHTML || '';
  boxSetPage('box-students', content);
}

function renderBoxMembers() {
  const cfg = boxBusinessConfig();
  const members = Object.values(boxState.members).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  boxSetPage('box-members', `
    ${boxSectionHeader('Alumnos', 'Registro, edicion y control mensual de alumnos.')}
    ${boxTabs('students', 'box-members')}
    <div class="box-action-row box-member-toolbar">
      <button class="btn btn-g" onclick="startNewBoxMember()">Registrar alumno</button>
    </div>
    <section class="card box-member-form" id="boxMemberForm">
        <div class="sh"><div class="st" id="bm_form_title">Registrar alumno</div><div class="sl"></div></div>
        <input type="hidden" id="bm_id"/>
        <div class="form-2">
          <div class="fg"><label class="fl">Nombre y apellido</label><input class="fi" id="bm_name"/></div>
          <div class="fg"><label class="fl">Genero</label><select class="fi" id="bm_gender"><option value="">No especificado</option><option value="masculino">Masculino</option><option value="femenino">Femenino</option><option value="otro">Otro</option></select></div>
          <div class="fg"><label class="fl">Edad</label><input class="fi" id="bm_age" type="number" min="0" max="120"/></div>
          <div class="fg"><label class="fl">Fecha de ingreso</label><input class="fi" id="bm_start" type="date" value="${boxNowISO()}"/></div>
          <div class="fg"><label class="fl">Telefono</label><input class="fi" id="bm_phone" inputmode="tel"/></div>
          <div class="fg"><label class="fl">Estado</label><select class="fi" id="bm_status">${Object.entries(BOX_MEMBER_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${k === 'active' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="fg"><label class="fl">Mensualidad</label><input class="fi" id="bm_fee" type="number" min="0" value="${Number(cfg.monthlyFee || 400)}"/></div>
          <div class="fg"><label class="fl">Descuento</label><input class="fi" id="bm_discount" type="number" min="0" value="0"/></div>
        </div>
        <div class="fg"><label class="fl">Notas</label><textarea class="fi" id="bm_notes"></textarea></div>
        <div class="box-action-row">
          <button class="btn btn-g" onclick="saveBoxMember()">Guardar alumno</button>
          <button class="btn btn-out" onclick="closeBoxMemberForm()">Cancelar</button>
        </div>
      </section>
    <div class="box-grid">
      <section class="card">
        <div class="sh"><div class="st">Alumnos</div><div class="sl"></div></div>
        ${members.length ? members.map(renderBoxMemberCard).join('') : boxEmpty('Sin alumnos registrados')}
      </section>
    </div>`);
}

function renderBoxMemberCard(member) {
  const lastPayment = Object.values(boxState.payments).filter((p) => p.memberId === member.id).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt))[0];
  const pending = Object.values(boxState.charges).filter((c) => c.memberId === member.id && Number(c.balance || 0) > 0);
  const payState = boxMemberPaymentState(member);
  const isInactive = ['inactive', 'permanent_leave', 'temporary_leave'].includes(member.status);
  const canEditMembers = canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID);
  const adminActions = canEditMembers
    ? `<button class="btn btn-out btn-sm" onclick="fillBoxMember('${member.id}')">Editar</button>
      ${isInactive ? `<button class="btn btn-g btn-sm" onclick="reactivateBoxMember('${member.id}')">Reactivar</button>` : `<button class="btn btn-r btn-sm" onclick="deactivateBoxMember('${member.id}')">Eliminar</button>`}`
    : '';
  return `<div class="box-row">
    <div>
      <strong>${member.fullName || '-'}</strong>
      <span>${BOX_MEMBER_STATUS_LABELS[member.status] || member.status} · ${boxPublicGender(member)} · ${member.age ?? '-'} anos</span>
      <span>Ingreso ${member.startDate || '-'} · Tel. ${member.phone || '-'} · mensualidad ${boxMoney(member.monthlyFee)}</span>
      <span>Descuento ${boxMoney(member.discountAmount)} · proximo cobro ${payState.dueDate || '-'} · ultimo pago ${lastPayment ? boxMoney(lastPayment.paidAmount) : '-'}</span>
      ${member.notes ? `<span>Notas: ${boxAttr(member.notes)}</span>` : ''}
    </div>
    <div class="box-row-actions">
      <span class="box-pill ${payState.tone || ''}">${payState.label}</span>
      ${payState.balance ? `<span class="box-pill">Saldo ${boxMoney(payState.balance)}</span>` : ''}
      ${adminActions}
    </div>
  </div>`;
}

async function saveBoxMember() {
  if (!fs || !currentUser) return showToast('Inicia sesion para guardar', 'ta');
  if (!canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso para guardar alumnos', 'tr');
  const memberId = document.getElementById('bm_id')?.value || '';
  const fullName = document.getElementById('bm_name')?.value.trim();
  const phone = boxNormalizePhone(document.getElementById('bm_phone')?.value);
  if (!fullName || phone.length !== 10) return showToast('Nombre, apellido y telefono son obligatorios', 'ta');
  const memberRef = memberId ? boxPath('members', memberId) : boxPath('members').doc();
  const prev = memberId ? boxState.members[memberId] : null;
  const age = Number(document.getElementById('bm_age')?.value || 0) || null;
  const startDate = document.getElementById('bm_start')?.value || prev?.startDate || boxNowISO();
  const payload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    fullName,
    gender: document.getElementById('bm_gender')?.value || '',
    age,
    phone,
    status: document.getElementById('bm_status')?.value || 'active',
    groupId: 'all',
    monthlyFee: Number(document.getElementById('bm_fee')?.value || boxBusinessConfig().monthlyFee || 400),
    discountAmount: Number(document.getElementById('bm_discount')?.value || 0),
    scholarshipType: null,
    startDate,
    billingAnchorDay: Number(String(startDate).slice(-2)) || null,
    nextDueDate: startDate,
    endDate: null,
    guardianIds: prev?.guardianIds || [],
    notes: document.getElementById('bm_notes')?.value.trim() || '',
    updatedBy: currentUser.uid,
    updatedAt: boxServerTimestamp()
  };
  if (!prev) {
    payload.folio = `BOX-ALU-${Date.now()}`;
    payload.createdBy = currentUser.uid;
    payload.createdAt = boxServerTimestamp();
  }
  const batch = fs.batch();
  batch.set(memberRef, payload, { merge: true });
  await batch.commit();
  await boxAudit(prev ? 'member_updated' : 'member_created', 'member', memberRef.id, prev, payload);
  await boxCallable('boxEnsureMemberCurrentCharge', {
    memberId: memberRef.id,
    startDate,
    idempotencyKey: `member_charge_${memberRef.id}_${startDate}`
  }).catch((error) => console.warn('box ensure member charge', error));
  await syncBoxPublicStudents({ [memberRef.id]: { id: memberRef.id, ...prev, ...payload } });
  showToast('Alumno guardado', 'tg');
  renderBoxMembers();
}

function openBoxMemberForm() {
  const form = document.getElementById('boxMemberForm');
  if (!form) return;
  form.classList.add('is-open');
  const title = document.getElementById('bm_form_title');
  if (title) title.textContent = document.getElementById('bm_id')?.value ? 'Editar alumno' : 'Registrar alumno';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function startNewBoxMember() {
  closeBoxMemberForm();
  openBoxMemberForm();
}

function closeBoxMemberForm() {
  const form = document.getElementById('boxMemberForm');
  if (form) form.classList.remove('is-open');
  ['bm_id', 'bm_name', 'bm_phone', 'bm_age', 'bm_notes'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const gender = document.getElementById('bm_gender');
  if (gender) gender.value = '';
  const status = document.getElementById('bm_status');
  if (status) status.value = 'active';
  const start = document.getElementById('bm_start');
  if (start) start.value = boxNowISO();
  const fee = document.getElementById('bm_fee');
  if (fee) fee.value = Number(boxBusinessConfig().monthlyFee || 400);
  const discount = document.getElementById('bm_discount');
  if (discount) discount.value = 0;
  const title = document.getElementById('bm_form_title');
  if (title) title.textContent = 'Registrar alumno';
}

function fillBoxMember(id) {
  const member = boxState.members[id];
  if (!member) return;
  document.getElementById('bm_id').value = id;
  document.getElementById('bm_name').value = member.fullName || '';
  document.getElementById('bm_gender').value = member.gender || member.genero || '';
  document.getElementById('bm_age').value = member.age || '';
  document.getElementById('bm_start').value = member.startDate || boxNowISO();
  document.getElementById('bm_status').value = member.status || 'active';
  document.getElementById('bm_fee').value = Number(member.monthlyFee || boxBusinessConfig().monthlyFee || 400);
  document.getElementById('bm_discount').value = Number(member.discountAmount || 0);
  document.getElementById('bm_notes').value = member.notes || '';
  document.getElementById('bm_phone').value = member.phone || '';
  openBoxMemberForm();
}

async function deactivateBoxMember(id) {
  if (!canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso para eliminar alumnos', 'tr');
  const member = boxState.members[id];
  if (!member) return;
  const reason = prompt('Motivo de baja o cambio de estado');
  if (!reason) return;
  await boxPath('members', id).set({
    status: 'inactive',
    endDate: boxNowISO(),
    bajaReason: reason,
    previousStatus: member.status,
    updatedBy: currentUser?.uid || '',
    updatedAt: boxServerTimestamp()
  }, { merge: true });
  await boxAudit('member_status_changed', 'member', id, { status: member.status }, { status: 'inactive' }, reason);
  await syncBoxPublicStudents({ [id]: { ...member, status: 'inactive', endDate: boxNowISO() } });
  showToast('Alumno eliminado del padron activo sin perder historial', 'tg');
}

async function reactivateBoxMember(id) {
  if (!canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso para reactivar alumnos', 'tr');
  const member = boxState.members[id];
  if (!member) return;
  const nextStatus = member.previousStatus && !['inactive', 'permanent_leave', 'temporary_leave'].includes(member.previousStatus)
    ? member.previousStatus
    : 'active';
  await boxPath('members', id).set({
    status: nextStatus,
    endDate: null,
    reactivatedAt: boxServerTimestamp(),
    updatedBy: currentUser?.uid || '',
    updatedAt: boxServerTimestamp()
  }, { merge: true });
  await boxAudit('member_status_changed', 'member', id, { status: member.status }, { status: nextStatus }, 'Reactivacion administrativa');
  await syncBoxPublicStudents({ [id]: { ...member, status: nextStatus, endDate: null } });
  showToast('Alumno reactivado', 'tg');
}

function renderBoxProspects() {
  const prospects = Object.values(boxState.prospects).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-prospects', `${boxSectionHeader('Prospectos', 'Seguimiento de interesados registrados desde el formulario publico.')}${boxTabs('students', 'box-prospects')}<div class="card"><div class="sh"><div class="st">Prospectos</div><div class="sl"></div></div>${prospects.length ? prospects.map((p) => `
    <div class="box-row"><div><strong>${p.fullName}</strong><span>${p.age || '-'} anos · Contacto: ${p.guardianName || '-'} · ${p.guardianPhone || '-'}</span><span>${p.interestedSchedule || '-'} · ${p.notes || ''}</span></div><button class="btn btn-out btn-sm" onclick="markProspectReviewed('${p.id}')">En revision</button></div>`).join('') : boxEmpty('Sin prospectos')}</div>`);
}

async function markProspectReviewed(id) {
  await boxPath('prospects', id).set({ status: 'reviewing', updatedAt: boxServerTimestamp(), updatedBy: currentUser?.uid || '' }, { merge: true });
  await boxAudit('prospect_reviewing', 'prospect', id, null, { status: 'reviewing' });
}

function renderBoxAttendance() {
  const selectedDate = document.getElementById('ba_date')?.value || boxNowISO();
  const historyDate = document.getElementById('ba_history_date')?.value || selectedDate;
  const sessionId = `all_${selectedDate}`;
  const currentSession = boxState.sessions[sessionId];
  const isClosed = currentSession?.status === 'closed';
  const members = Object.values(boxState.members)
    .filter((m) => !['inactive', 'permanent_leave', 'temporary_leave'].includes(m.status))
    .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  const attendanceByMember = {};
  Object.values(boxState.attendance).filter((a) => a.date === selectedDate).forEach((a) => { attendanceByMember[a.memberId] = a; });
  const historyRecords = Object.values(boxState.attendance)
    .filter((a) => a.date === historyDate)
    .sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''));
  const closedSessions = Object.values(boxState.sessions)
    .filter((s) => s.status === 'closed')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 8);
  boxSetPage('box-attendance', `
    ${boxSectionHeader('Asistencia', 'Lista diaria por alumno y respaldo historico.')}
    <div class="box-grid box-grid-2">
      <section class="card box-panel box-span-2">
        <div class="sh"><div class="st">Tabla del dia</div><div class="sl"></div></div>
        <div class="fg"><label class="fl">Fecha</label><input class="fi" id="ba_date" type="date" value="${selectedDate}" onchange="renderBoxAttendance()"/></div>
        <div class="box-attendance-table">
          ${members.length ? members.map((m) => {
            const record = attendanceByMember[m.id];
            const checked = record ? ['present', 'trial_class', 'late'].includes(record.status) : true;
            return `<label class="box-att-check ${isClosed ? 'closed' : ''}">
              <input type="checkbox" data-att-member="${m.id}" ${checked ? 'checked' : ''} ${isClosed ? 'disabled' : ''}/>
              <span class="box-att-mark"></span>
              <strong>${m.fullName}</strong>
              <em>${boxMemberStatusPublicLabel(m)}</em>
            </label>`;
          }).join('') : boxEmpty('Sin alumnos registrados')}
        </div>
        <div class="fg"><label class="fl">Observaciones de sesion</label><textarea class="fi" id="ba_notes" ${isClosed ? 'disabled' : ''}>${currentSession?.notes || ''}</textarea></div>
        <button class="btn btn-g btn-full" onclick="saveBoxAttendance()" ${isClosed ? 'disabled' : ''}>${isClosed ? 'Dia cerrado' : 'Cerrar asistencia del dia'}</button>
      </section>
      <section class="card box-panel">
        <div class="sh"><div class="st">Buscar asistencia</div><div class="sl"></div></div>
        <div class="fg"><label class="fl">Fecha historica</label><input class="fi" id="ba_history_date" type="date" value="${historyDate}" onchange="renderBoxAttendance()"/></div>
        ${historyRecords.length ? historyRecords.map((a) => `<div class="box-row compact"><div><strong>${a.memberName || boxState.members[a.memberId]?.fullName || a.memberId}</strong><span>${BOX_ATTENDANCE_LABELS[a.status] || a.status}</span></div></div>`).join('') : boxEmpty('Sin registros para esa fecha')}
      </section>
      <section class="card box-panel">
        <div class="sh"><div class="st">Dias cerrados</div><div class="sl"></div></div>
        ${closedSessions.length ? closedSessions.map((s) => `<div class="box-row compact"><div><strong>${s.date || '-'}</strong><span>${s.totalPresent || 0} presentes · ${s.totalAbsent || 0} ausentes</span></div></div>`).join('') : boxEmpty('Sin cierres guardados')}
      </section>
    </div>`);
}

function renderBoxAttendanceHistory() {
  const records = Object.values(boxState.attendance).sort((a, b) => boxTs(b.capturedAt) - boxTs(a.capturedAt)).slice(0, 80);
  boxSetPage('box-attendance-history', `${boxSectionHeader('Historial de asistencia', 'Ultimos registros capturados por fecha y alumno.')}${boxTabs('attendance', 'box-attendance-history')}
    <div class="card">${records.length ? records.map((a) => `<div class="box-row compact"><div><strong>${a.memberName || boxState.members[a.memberId]?.fullName || a.memberId}</strong><span>${a.date || '-'} · ${BOX_ATTENDANCE_LABELS[a.status] || a.status}</span></div></div>`).join('') : boxEmpty('Sin asistencias registradas')}</div>`);
}

function renderBoxAttendanceTrials() {
  const trials = Object.values(boxState.members).filter((m) => m.status === 'trial').sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-attendance-trials', `${boxSectionHeader('Clases de prueba', 'Registro rapido y seguimiento de alumnos en prueba.')}${boxTabs('attendance', 'box-attendance-trials')}
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Registrar clase de prueba</div><div class="sl"></div></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Nombre</label><input class="fi" id="bt_name"/></div>
          <div class="fg"><label class="fl">Telefono</label><input class="fi" id="bt_phone" inputmode="tel"/></div>
        </div>
        <button class="btn btn-g btn-full" onclick="registerTrialClass()">Registrar clase de prueba</button>
      </section>
      <section class="card"><div class="sh"><div class="st">En prueba</div><div class="sl"></div></div>${trials.length ? trials.map((m) => `<div class="box-row compact"><div><strong>${m.fullName}</strong><span>${m.trialPhone || '-'} · inicio ${m.startDate || '-'}</span></div></div>`).join('') : boxEmpty('Sin clases de prueba activas')}</section>
    </div>`);
}

function renderBoxAttendanceAudits() {
  const audits = Object.values(boxState.physicalAudits).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-attendance-audits', `${boxSectionHeader('Auditorias fisicas', 'Conteo fisico contra asistencia capturada.')}${boxTabs('attendance', 'box-attendance-audits')}
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Nueva auditoria fisica</div><div class="sl"></div></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Fecha</label><input class="fi" id="ba_date" type="date" value="${boxNowISO()}"/></div>
          <div class="fg"><label class="fl">Alumnos observados</label><input class="fi" id="bpa_observed" type="number" min="0"/></div>
          <div class="fg"><label class="fl">Foto opcional URL</label><input class="fi" id="bpa_photo" placeholder="https://..."/></div>
        </div>
        <div class="fg"><label class="fl">Observaciones</label><textarea class="fi" id="bpa_notes"></textarea></div>
        <button class="btn btn-g btn-full" onclick="saveBoxPhysicalAudit()">Guardar auditoria fisica</button>
      </section>
      <section class="card"><div class="sh"><div class="st">Auditorias recientes</div><div class="sl"></div></div>${audits.length ? audits.map((a) => `<div class="box-row compact"><div><strong>${a.date || '-'}</strong><span>Observados ${a.observedCount || 0} · diferencia ${a.difference || 0}</span></div><span class="box-pill">${a.result || '-'}</span></div>`).join('') : boxEmpty('Sin auditorias fisicas')}</section>
    </div>`);
}

async function saveBoxAttendance() {
  if (!canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso', 'tr');
  const date = document.getElementById('ba_date')?.value || boxNowISO();
  const groupId = 'all';
  const sessionRef = boxPath('sessions').doc(`${groupId}_${date}`);
  const attendanceInputs = Array.from(document.querySelectorAll('[data-att-member]'));
  const totalPresent = attendanceInputs.filter((input) => input.checked).length;
  const totalAbsent = attendanceInputs.length - totalPresent;
  const sessionPayload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    groupId,
    date,
    status: 'closed',
    totalMembers: attendanceInputs.length,
    totalPresent,
    totalAbsent,
    notes: document.getElementById('ba_notes')?.value.trim() || '',
    capturedBy: currentUser?.uid || '',
    capturedAt: boxServerTimestamp(),
    closedAt: boxServerTimestamp()
  };
  const batch = fs.batch();
  batch.set(sessionRef, sessionPayload, { merge: true });
  attendanceInputs.forEach((input) => {
    const memberId = input.getAttribute('data-att-member');
    const member = boxState.members[memberId] || {};
    const charge = Object.values(boxState.charges).find((c) => c.memberId === memberId && Number(c.balance || 0) > 0);
    batch.set(boxPath('attendance').doc(`${sessionRef.id}_${memberId}`), {
      businessId: BOX_LOMBARDO_BUSINESS_ID,
      sessionId: sessionRef.id,
      groupId,
      memberId,
      memberName: member.fullName || '',
      date,
      status: input.checked ? 'present' : 'absent',
      paymentStatusAtAttendance: charge ? 'pending' : 'paid_or_no_charge',
      capturedBy: currentUser?.uid || '',
      capturedAt: boxServerTimestamp(),
      notes: ''
    }, { merge: true });
  });
  await batch.commit();
  await boxAudit('attendance_session_closed', 'session', sessionRef.id, null, sessionPayload);
  showToast('Asistencia guardada y cerrada', 'tg');
}

async function registerTrialClass() {
  const name = document.getElementById('bt_name')?.value.trim();
  const phone = boxNormalizePhone(document.getElementById('bt_phone')?.value);
  if (!name || phone.length !== 10) return showToast('Nombre y telefono requeridos', 'ta');
  const existingTrials = Object.values(boxState.attendance).filter((a) => a.memberName === name && a.status === 'trial_class').length;
  if (existingTrials >= Number(boxBusinessConfig().trialClassesAllowed || 1)) {
    await boxPath('inconsistencies').add({
      businessId: BOX_LOMBARDO_BUSINESS_ID,
      type: 'trial_limit_exceeded',
      severity: 'warning',
      status: 'pending',
      title: 'Clase de prueba repetida',
      detail: name,
      createdAt: boxServerTimestamp()
    });
    return showToast('Limite de clase de prueba excedido; se creo alerta', 'ta');
  }
  const memberRef = boxPath('members').doc();
  await memberRef.set({
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    folio: `BOX-TRI-${Date.now()}`,
    fullName: name,
    status: 'trial',
    monthlyFee: Number(boxBusinessConfig().monthlyFee || 400),
    guardianIds: [],
    trialPhone: phone,
    startDate: boxNowISO(),
    createdBy: currentUser?.uid || '',
    createdAt: boxServerTimestamp()
  }, { merge: true });
  await boxPath('attendance').add({
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    memberId: memberRef.id,
    memberName: name,
    date: boxNowISO(),
    status: 'trial_class',
    capturedBy: currentUser?.uid || '',
    capturedAt: boxServerTimestamp()
  });
  await boxAudit('trial_class_registered', 'member', memberRef.id, null, { fullName: name });
  showToast('Clase de prueba registrada', 'tg');
}

async function saveBoxPhysicalAudit() {
  if (!canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso para auditoria fisica', 'tr');
  const date = document.getElementById('ba_date')?.value || boxNowISO();
  const groupId = 'all';
  const observedCount = Number(document.getElementById('bpa_observed')?.value || 0);
  const registeredCount = Object.values(boxState.attendance).filter((a) => a.date === date && (!groupId || a.groupId === groupId) && a.status !== 'absent').length;
  const difference = observedCount - registeredCount;
  const payload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    date,
    time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    groupId,
    observedCount,
    registeredAttendanceCount: registeredCount,
    difference,
    photoUrl: document.getElementById('bpa_photo')?.value.trim() || '',
    notes: document.getElementById('bpa_notes')?.value.trim() || '',
    performedByUserId: currentUser?.uid || '',
    result: difference === 0 ? 'matched' : 'difference',
    followUp: difference === 0 ? 'none' : 'pending',
    createdAt: boxServerTimestamp()
  };
  const ref = await boxPath('physicalAudits').add(payload);
  if (difference !== 0) {
    await boxPath('inconsistencies').add({
      businessId: BOX_LOMBARDO_BUSINESS_ID,
      type: 'physical_count_difference',
      severity: 'critical',
      status: 'pending',
      title: 'Diferencia entre conteo fisico y asistencia',
      detail: `${observedCount} observados vs ${registeredCount} registrados`,
      physicalAuditId: ref.id,
      createdAt: boxServerTimestamp()
    });
  }
  await boxAudit('physical_audit_created', 'physicalAudit', ref.id, null, payload);
  showToast(difference === 0 ? 'Auditoria sin diferencias' : 'Auditoria guardada con alerta', difference === 0 ? 'tg' : 'ta');
}

function renderBoxFinance() {
  const s = boxStats();
  const currentPeriod = boxCurrentPeriod();
  const members = Object.values(boxState.members).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  const reminders = boxUpcomingPaymentItems().filter(({ state }) => state.days !== null && state.days <= 5).slice(0, 10);
  const periods = [...new Set(Object.values(boxState.charges).map((c) => c.billingPeriodId || c.period || c.periodLabel).filter(Boolean))]
    .sort((a, b) => String(b).localeCompare(String(a))).slice(0, 12);
  boxSetPage('box-finance', `${boxSectionHeader('Mensualidades', boxIsTrainerOnly() ? 'Control de cobros y proximos pagos.' : 'Control mensual, pagos e historial administrativo.')}
    <div class="box-grid box-grid-2">
      <section class="card box-panel box-span-2">
        <div class="sh"><div class="st">Control por alumno</div><div class="sl"></div></div>
        <div class="box-monthly-table">
          ${members.length ? members.map((member) => {
            const charge = boxCurrentMemberCharge(member.id);
            const lastPayment = boxLatestPayment(member.id);
            const paidThisMonth = charge && Number(charge.balance || 0) <= 0;
            const state = boxMemberPaymentState(member);
            return `<div class="box-monthly-row">
              <div class="box-monthly-main">
                <strong>${member.fullName || '-'}</strong>
                <span>Ingreso: ${member.startDate || '-'} · Estado: ${boxMemberStatusPublicLabel(member)}</span>
              </div>
              <div><small>Mes de pago</small><b>${charge?.periodLabel || charge?.billingPeriodId || currentPeriod}</b></div>
              <div><small>Ultimo pago</small><b>${lastPayment ? `${boxMoney(lastPayment.paidAmount)} · ${lastPayment.paymentDate || boxDateOnly(boxTs(lastPayment.createdAt))}` : 'Sin pago'}</b></div>
              <div><small>Siguiente fecha</small><b>${charge?.dueDate || member.nextDueDate || '-'}</b></div>
              <div><small>Este mes</small><b>${paidThisMonth ? 'Pagado' : (charge ? 'Pendiente' : 'Sin cargo')}</b></div>
              <div class="box-monthly-pay">
                <input class="fi" id="pay_amount_${member.id}" type="number" min="1" placeholder="Monto"/>
                <select class="fi" id="pay_method_${member.id}">${boxPaymentMethodOptions('cash')}</select>
                <button class="btn btn-g btn-sm" onclick="createBoxPaymentForMember('${member.id}')" ${charge?.id ? '' : 'disabled'}>Registrar</button>
              </div>
            </div>`;
          }).join('') : boxEmpty('Sin alumnos registrados')}
        </div>
      </section>
      <section class="card box-panel">
        <div class="sh"><div class="st">Proximos a pagar</div><div class="sl"></div></div>
        ${boxUpcomingRows(8, true)}
      </section>
      <section class="card box-panel">
        <div class="sh"><div class="st">Recordatorio 5 dias</div><div class="sl"></div></div>
        ${reminders.length ? reminders.map(({ member, state }) => `<div class="box-row compact"><div><strong>${member.fullName}</strong><span>${state.dueDate || '-'} · ${state.label}</span></div><span class="box-pill warning">${state.days} dias</span></div>`).join('') : boxEmpty('Sin recordatorios inmediatos')}
      </section>
      ${canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) ? `<section class="card box-panel box-span-2">
        <div class="sh"><div class="st">Historial mensual administrativo</div><div class="sl"></div></div>
        ${periods.length ? periods.map((period) => {
          const charges = Object.values(boxState.charges).filter((c) => [c.billingPeriodId, c.period, c.periodLabel].includes(period));
          const paid = charges.filter((c) => Number(c.balance || 0) <= 0).length;
          const expected = charges.reduce((sum, c) => sum + Number(c.expectedAmount || 0), 0);
          const collected = charges.reduce((sum, c) => sum + Number(c.totalPaid || 0), 0);
          return `<div class="box-row"><div><strong>${period}</strong><span>${paid}/${charges.length} alumnos pagados · ${boxMoney(collected)} / ${boxMoney(expected)}</span></div><span class="box-pill">${Math.round((collected / Math.max(expected, 1)) * 100)}%</span></div>`;
        }).join('') : boxEmpty('Sin historial mensual')}
      </section>` : ''}
    </div>`);
}

function renderBoxBilling() {
  const charges = Object.values(boxState.charges).sort((a, b) => (b.periodLabel || '').localeCompare(a.periodLabel || ''));
  boxSetPage('box-billing', `
    ${boxSectionHeader('Mensualidades', 'Generacion idempotente de cargos y seguimiento de saldos.')}
    ${boxTabs('finance', 'box-billing')}
    <div class="card">
      <div class="sh"><div class="st">Generar cargos</div><div class="sl"></div></div>
      <div class="form-3">
        <div class="fg"><label class="fl">Periodo</label><input class="fi" id="bb_period" type="month" value="${new Date().toISOString().slice(0, 7)}"/></div>
        <div class="fg"><label class="fl">Vencimiento</label><input class="fi" id="bb_due" type="date" value="${new Date().toISOString().slice(0, 8)}10"/></div>
        <div class="fg"><label class="fl">Mensualidad</label><input class="fi" value="${boxMoney(boxBusinessConfig().monthlyFee)}" disabled/></div>
      </div>
      <button class="btn btn-g btn-full" onclick="generateBoxMonthlyCharges()">Generar cargos idempotentes</button>
    </div>
    <div class="card"><div class="sh"><div class="st">Cargos</div><div class="sl"></div></div>${charges.length ? charges.map((c) => `<div class="box-row"><div><strong>${boxState.members[c.memberId]?.fullName || c.memberId}</strong><span>${c.periodLabel || c.billingPeriodId} Â· ${BOX_CHARGE_STATUS_LABELS[c.status] || c.status}</span></div><div class="box-row-actions"><span class="box-pill">${boxMoney(c.totalPaid)} / ${boxMoney(c.expectedAmount)}</span><span class="box-pill">Saldo ${boxMoney(c.balance)}</span></div></div>`).join('') : boxEmpty('Sin cargos')}</div>`);
}

async function generateBoxMonthlyCharges() {
  const period = document.getElementById('bb_period')?.value;
  const dueDate = document.getElementById('bb_due')?.value;
  if (!period || !dueDate) return showToast('Periodo y vencimiento requeridos', 'ta');
  try {
    await boxCallable('boxGenerateMonthlyCharges', { period, dueDate });
    showToast('Cargos generados sin duplicados', 'tg');
  } catch (error) {
    showToast(error.message || 'Error generando cargos', 'tr');
  }
}

function renderBoxPayments() {
  const chargeOptions = Object.values(boxState.charges)
    .filter((c) => Number(c.balance || 0) > 0)
    .map((c) => `<option value="${c.id}">${boxState.members[c.memberId]?.fullName || c.memberId} Â· ${c.periodLabel || c.billingPeriodId} Â· saldo ${boxMoney(c.balance)}</option>`).join('');
  const payments = Object.values(boxState.payments).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-payments', `
    ${boxSectionHeader(boxIsTrainerOnly() ? 'Cobros' : 'Pagos', 'Registro de pagos y comprobantes.')}
    ${boxTabs('finance', 'box-payments')}
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Registrar pago</div><div class="sl"></div></div>
        <div class="fg"><label class="fl">Cargo</label><select class="fi" id="bp_charge">${chargeOptions}</select></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Monto recibido</label><input class="fi" id="bp_amount" type="number" min="1"/></div>
          <div class="fg"><label class="fl">Metodo</label><select class="fi" id="bp_method">${boxPaymentMethodOptions('cash')}</select></div>
        </div>
        <div class="fg"><label class="fl">Notas</label><input class="fi" id="bp_notes2"/></div>
        <button class="btn btn-g btn-full" onclick="createBoxPayment()">Registrar pago</button>
      </section>
      <section class="card">
        <div class="sh"><div class="st">Historial de pagos</div><div class="sl"></div></div>
        ${payments.length ? payments.map((p) => `<div class="box-row"><div><strong>${p.folio || p.id}</strong><span>${boxState.members[p.memberId]?.fullName || p.memberId} · ${boxMoney(p.paidAmount)} · ${boxPaymentMethodLabel(p.paymentMethod)}</span><span>Recibio: ${p.receivedByName || p.receivedByUserId || '-'} · ${p.cashDeliveryStatus || '-'}</span></div><button class="btn btn-out btn-sm" onclick="sendBoxReceipt('${p.id}')">Comprobante</button></div>`).join('') : boxEmpty('Sin pagos')}</section>
    </div>`);
}

async function createBoxPayment() {
  const chargeId = document.getElementById('bp_charge')?.value;
  const paidAmount = Number(document.getElementById('bp_amount')?.value || 0);
  const paymentMethod = boxPaymentMethodCode(document.getElementById('bp_method')?.value || 'cash');
  const notes = document.getElementById('bp_notes2')?.value.trim() || '';
  if (!chargeId || paidAmount <= 0) return showToast('Selecciona cargo y monto', 'ta');
  try {
    await boxCallable('boxCreatePayment', { chargeId, paidAmount, paymentMethod, notes, idempotencyKey: `${chargeId}_${paidAmount}_${paymentMethod}_${Date.now()}` });
    showToast(paymentMethod === 'cash' ? 'Pago registrado y pendiente de entrega' : 'Pago registrado', 'tg');
  } catch (error) {
    showToast(error.message || 'Error registrando pago', 'tr');
  }
}

async function createBoxPaymentForMember(memberId) {
  const charge = boxCurrentMemberCharge(memberId);
  const paidAmount = Number(document.getElementById(`pay_amount_${memberId}`)?.value || 0);
  const paymentMethod = boxPaymentMethodCode(document.getElementById(`pay_method_${memberId}`)?.value || 'cash');
  if (!charge?.id) return showToast('El alumno no tiene cargo vigente', 'ta');
  if (paidAmount <= 0) return showToast('Captura el monto recibido', 'ta');
  try {
    await boxCallable('boxCreatePayment', {
      chargeId: charge.id,
      paidAmount,
      paymentMethod,
      notes: `Metodo: ${boxPaymentMethodLabel(paymentMethod)}`,
      idempotencyKey: `${charge.id}_${paidAmount}_${paymentMethod}_${Date.now()}`
    });
    showToast(paymentMethod === 'cash' ? 'Pago registrado y pendiente de entrega' : 'Pago registrado', 'tg');
  } catch (error) {
    showToast(error.message || 'Error registrando pago', 'tr');
  }
}

async function sendBoxReceipt(paymentId) {
  try {
    await boxCallable('boxSendPaymentReceipt', { paymentId });
    showToast('Comprobante enviado o marcado para reintento', 'tg');
  } catch (error) {
    showToast(error.message || 'No se pudo enviar comprobante', 'tr');
  }
}

function renderBoxCash() {
  const pending = Object.values(boxState.payments).filter((p) => boxPaymentMethodCode(p.paymentMethod) === 'cash' && p.cashDeliveryStatus === 'pending_delivery');
  const deliveries = Object.values(boxState.cashDeliveries).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-cash', `
    ${boxSectionHeader(boxIsTrainerOnly() ? 'Efectivo pendiente' : 'Entregas de efectivo', 'Preparacion, control y confirmacion de efectivo recibido.')}
    ${boxTabs('finance', 'box-cash')}
    <div class="card">
      <div class="sh"><div class="st">Preparar entrega</div><div class="sl"></div></div>
      ${pending.length ? pending.map((p) => `<label class="box-check"><input type="checkbox" data-cash-payment="${p.id}"/> ${p.folio || p.id} Â· ${boxState.members[p.memberId]?.fullName || p.memberId} Â· ${boxMoney(p.paidAmount)} Â· recibio ${p.receivedByName || '-'}</label>`).join('') : boxEmpty('Sin pagos pendientes')}
      <button class="btn btn-g btn-full" onclick="prepareBoxCashDelivery()">Preparar entrega seleccionada</button>
    </div>
    <div class="card">
      <div class="sh"><div class="st">Entregas</div><div class="sl"></div></div>
      ${deliveries.length ? deliveries.map((d) => `<div class="box-row"><div><strong>${d.folio || d.id}</strong><span>${d.status} Â· esperado ${boxMoney(d.expectedAmount)} Â· entregado ${boxMoney(d.deliveredAmount)}</span><span>Diferencia ${boxMoney(d.differenceAmount)}</span></div><div class="box-row-actions">${d.status !== 'confirmed' ? `<input class="fi box-small-input" id="cash_${d.id}" type="number" value="${Number(d.expectedAmount || 0)}"/><button class="btn btn-g btn-sm" onclick="confirmBoxCashDelivery('${d.id}')">Confirmar</button>` : '<span class="box-pill">Confirmada</span>'}</div></div>`).join('') : boxEmpty('Sin entregas')}
    </div>`);
}

async function prepareBoxCashDelivery() {
  const paymentIds = Array.from(document.querySelectorAll('[data-cash-payment]:checked')).map((el) => el.getAttribute('data-cash-payment'));
  if (!paymentIds.length) return showToast('Selecciona pagos', 'ta');
  try {
    await boxCallable('boxPrepareCashDelivery', { paymentIds });
    showToast('Entrega preparada', 'tg');
  } catch (error) {
    showToast(error.message || 'Error preparando entrega', 'tr');
  }
}

async function confirmBoxCashDelivery(deliveryId) {
  const deliveredAmount = Number(document.getElementById(`cash_${deliveryId}`)?.value || 0);
  const notes = prompt('Notas o motivo de diferencia, si aplica') || '';
  try {
    await boxCallable('boxConfirmCashDelivery', { deliveryId, deliveredAmount, notes });
    showToast('Entrega confirmada', 'tg');
  } catch (error) {
    showToast(error.message || 'Error confirmando entrega', 'tr');
  }
}

function renderBoxExpenses() {
  const cfg = boxBusinessConfig();
  const expenses = Object.values(boxState.expenses).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-expenses', `
    ${boxSectionHeader('Gastos', 'Registro y seguimiento de salidas de efectivo.')}
    ${boxTabs('finance', 'box-expenses')}
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Registrar gasto</div><div class="sl"></div></div>
        <input type="hidden" id="be_id"/>
        <div class="form-2">
          <div class="fg"><label class="fl">Concepto</label><input class="fi" id="be_concept"/></div>
          <div class="fg"><label class="fl">Categoria</label><select class="fi" id="be_category">${(cfg.expenseCategories || []).map((c) => `<option value="${c}">${c}</option>`).join('')}</select></div>
          <div class="fg"><label class="fl">Monto</label><input class="fi" id="be_amount" type="number" min="0"/></div>
          <div class="fg"><label class="fl">Fecha</label><input class="fi" id="be_date" type="date" value="${boxNowISO()}"/></div>
        </div>
        <div class="fg"><label class="fl">Descripcion</label><textarea class="fi" id="be_desc"></textarea></div>
        <button class="btn btn-g btn-full" onclick="saveBoxExpense()">Guardar gasto</button>
      </section>
      <section class="card"><div class="sh"><div class="st">Gastos</div><div class="sl"></div></div>${expenses.length ? expenses.map((e) => `<div class="box-row"><div><strong>${e.folio || e.concept}</strong><span>${e.category} · ${boxMoney(e.amount)} · ${e.status}</span><span>${e.description || ''}</span></div><div class="box-row-actions"><button class="btn btn-out btn-sm" onclick="fillBoxExpense('${e.id}')">Editar</button><button class="btn btn-r btn-sm" onclick="deleteBoxExpense('${e.id}')">Eliminar</button></div></div>`).join('') : boxEmpty('Sin gastos')}</section>
    </div>`);
}

async function saveBoxExpense() {
  if (!canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) return showToast('Solo administracion puede guardar gastos', 'tr');
  const expenseId = document.getElementById('be_id')?.value || '';
  const concept = document.getElementById('be_concept')?.value.trim();
  const amount = Number(document.getElementById('be_amount')?.value || 0);
  if (!concept || amount <= 0) return showToast('Concepto y monto requeridos', 'ta');
  const prev = expenseId ? boxState.expenses[expenseId] : null;
  const payload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    folio: prev?.folio || `BOX-GAS-${Date.now()}`,
    concept,
    category: document.getElementById('be_category')?.value || 'Otros',
    amount,
    date: document.getElementById('be_date')?.value || boxNowISO(),
    spentByUserId: currentUser?.uid || '',
    registeredByUserId: currentUser?.uid || '',
    paymentMethod: 'cash',
    description: document.getElementById('be_desc')?.value.trim() || '',
    status: canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) ? 'authorized' : 'requested',
    updatedAt: boxServerTimestamp()
  };
  if (!prev) payload.createdAt = boxServerTimestamp();
  const ref = expenseId ? boxPath('expenses', expenseId) : boxPath('expenses').doc();
  await ref.set(payload, { merge: true });
  await boxAudit(prev ? 'expense_updated' : 'expense_created', 'expense', ref.id, prev, payload);
  showToast(prev ? 'Gasto actualizado' : 'Gasto guardado', 'tg');
  renderBoxExpenses();
}

function fillBoxExpense(id) {
  const expense = boxState.expenses[id];
  if (!expense) return;
  document.getElementById('be_id').value = id;
  document.getElementById('be_concept').value = expense.concept || '';
  document.getElementById('be_category').value = expense.category || 'Otros';
  document.getElementById('be_amount').value = Number(expense.amount || 0);
  document.getElementById('be_date').value = expense.date || boxNowISO();
  document.getElementById('be_desc').value = expense.description || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteBoxExpense(id) {
  if (!canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) return showToast('Solo administracion puede eliminar gastos', 'tr');
  const expense = boxState.expenses[id];
  if (!expense) return;
  const reason = prompt('Motivo para eliminar/cancelar este gasto') || '';
  if (!reason) return;
  await boxPath('expenses', id).set({
    status: 'canceled',
    canceledBy: currentUser?.uid || '',
    canceledAt: boxServerTimestamp(),
    cancelReason: reason,
    updatedAt: boxServerTimestamp()
  }, { merge: true });
  await boxAudit('expense_canceled', 'expense', id, expense, { status: 'canceled', reason });
  showToast('Gasto eliminado del resumen', 'tg');
  renderBoxExpenses();
}

function renderBoxReports() {
  const s = boxStats();
  const att = boxAttendanceStats();
  const collectionPct = Math.round((s.income / Math.max(s.expected, 1)) * 100);
  const presentToday = att.todayPresent;
  const activeTotal = s.activeMembers.length;
  const pendingBalance = s.pendingCharges.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const cashPendingTotal = s.pendingCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const cashConfirmedTotal = s.confirmedCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const previousMethodTotal = s.transferPayments.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const recentPayments = s.payments.sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt)).slice(0, 6);
  const recentExpenses = s.expenses.sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt)).slice(0, 5);
  const topDebts = s.pendingCharges.sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0)).slice(0, 5);
  const deliveries = Object.values(boxState.cashDeliveries);
  const auditCount = Object.keys(boxState.auditLogs).length;
  const inactiveCount = s.members.filter((m) => ['inactive', 'permanent_leave', 'temporary_leave'].includes(m.status)).length;
  boxSetPage('box-reports', `${boxSectionHeader('Resumen', 'Indicadores operativos del negocio en tiempo real.')}
    <div class="box-kpi-grid primary">
      ${boxKpi('Alumnos activos', activeTotal)}
      ${boxKpi('Asistencia hoy', `${presentToday}/${activeTotal}`)}
      ${boxKpi('Cobranza mensual', `${collectionPct}%`)}
      ${boxKpi('Saldo pendiente', boxMoney(pendingBalance), pendingBalance ? 'warning' : '')}
    </div>
    <div class="box-kpi-grid secondary">
      ${boxKpi('Ingresos', boxMoney(s.income), 'success')}
      ${boxKpi('Metodos anteriores', boxMoney(previousMethodTotal))}
      ${boxKpi('Efectivo pendiente', boxMoney(cashPendingTotal), cashPendingTotal ? 'warning' : '')}
      ${boxKpi('Neto', boxMoney(s.net), s.net < 0 ? 'danger' : 'success')}
    </div>
    <div class="box-grid box-grid-2">
      <section class="card box-panel"><div class="sh"><div class="st">Asistencia</div><div class="sl"></div></div>${boxMeter('Hoy', att.todayPct)}${boxMeter('Semana', att.weekPct)}${boxMeter('Mes', att.monthPct)}<div class="box-info-list"><div><strong>Baja asistencia</strong><span>${att.low.map((i) => i.member.fullName).join(', ') || 'Sin alertas'}</span></div></div></section>
      <section class="card box-panel"><div class="sh"><div class="st">Mensualidades</div><div class="sl"></div></div>${boxMeter('Cobrado del mes', collectionPct, collectionPct < 70 ? 'warning' : 'success')}<div class="box-info-list"><div><strong>Al corriente</strong><span>${s.currentMembers}</span></div><div><strong>Proximos a pagar</strong><span>${s.upcomingMembers}</span></div><div><strong>Vencidos</strong><span>${s.overdueMembers}</span></div></div></section>
      <section class="card box-panel"><div class="sh"><div class="st">Ingresos y caja</div><div class="sl"></div></div><div class="box-info-list"><div><strong>Efectivo confirmado</strong><span>${boxMoney(cashConfirmedTotal)}</span></div><div><strong>Efectivo por entregar</strong><span>${boxMoney(cashPendingTotal)}</span></div><div><strong>Metodos anteriores</strong><span>${boxMoney(previousMethodTotal)}</span></div><div><strong>Gastos</strong><span>${boxMoney(s.expenseTotal)}</span></div></div></section>
      <section class="card box-panel"><div class="sh"><div class="st">Alumnos</div><div class="sl"></div></div><div class="box-info-list"><div><strong>Total registrados</strong><span>${s.members.length}</span></div><div><strong>Activos</strong><span>${s.activeMembers.length}</span></div><div><strong>Clases de prueba</strong><span>${s.members.filter((m) => m.status === 'trial').length}</span></div><div><strong>Bajas</strong><span>${inactiveCount}</span></div></div></section>
      <section class="card box-panel"><div class="sh"><div class="st">Adeudos principales</div><div class="sl"></div></div>${topDebts.length ? topDebts.map((c) => `<div class="box-row compact"><div><strong>${boxState.members[c.memberId]?.fullName || c.memberId}</strong><span>${c.periodLabel || c.billingPeriodId} · vence ${c.dueDate || '-'}</span></div><span class="box-pill warning">${boxMoney(c.balance)}</span></div>`).join('') : boxEmpty('Sin adeudos')}</section>
      <section class="card box-panel"><div class="sh"><div class="st">Pagos recientes</div><div class="sl"></div></div>${recentPayments.length ? recentPayments.map((p) => `<div class="box-row compact"><div><strong>${boxState.members[p.memberId]?.fullName || p.memberId}</strong><span>${boxMoney(p.paidAmount)} · ${boxPaymentMethodLabel(p.paymentMethod)} · ${p.paymentDate || boxDateOnly(boxTs(p.createdAt))}</span></div><span class="box-pill">${p.folio || p.id}</span></div>`).join('') : boxEmpty('Sin pagos')}</section>
      <section class="card box-panel"><div class="sh"><div class="st">Entregas y auditoria</div><div class="sl"></div></div><div class="box-info-list"><div><strong>Entregas preparadas</strong><span>${deliveries.filter((d) => d.status === 'prepared').length}</span></div><div><strong>Entregas confirmadas</strong><span>${deliveries.filter((d) => d.status === 'confirmed').length}</span></div><div><strong>Inconsistencias</strong><span>${Object.keys(boxState.inconsistencies).length}</span></div><div><strong>Eventos auditados</strong><span>${auditCount}</span></div></div></section>
      <section class="card box-panel"><div class="sh"><div class="st">Gastos recientes</div><div class="sl"></div></div>${recentExpenses.length ? recentExpenses.map((e) => `<div class="box-row compact"><div><strong>${e.concept}</strong><span>${e.category || '-'} · ${e.date || '-'}</span></div><span class="box-pill">${boxMoney(e.amount)}</span></div>`).join('') : boxEmpty('Sin gastos')}</section>
    </div>`);
}

function renderBoxReportDebts() {
  const debts = Object.values(boxState.charges).filter((c) => Number(c.balance || 0) > 0 && c.status !== 'canceled');
  boxSetPage('box-report-debts', `${boxSectionHeader('Adeudos', 'Saldos abiertos por alumno y periodo.')}${boxTabs('reports', 'box-report-debts')}<div class="card">${debts.length ? debts.map((c) => `<div class="box-row compact"><div><strong>${boxState.members[c.memberId]?.fullName || c.memberId}</strong><span>${c.periodLabel || c.billingPeriodId} · ${BOX_CHARGE_STATUS_LABELS[c.status] || c.status}</span></div><span class="box-pill">${boxMoney(c.balance)}</span></div>`).join('') : boxEmpty('Sin adeudos')}</div>`);
}

function renderBoxReportAttendance() {
  const s = boxStats();
  const rows = Object.values(boxState.attendance).sort((a, b) => boxTs(b.capturedAt) - boxTs(a.capturedAt)).slice(0, 60);
  boxSetPage('box-report-attendance', `${boxSectionHeader('Reporte de asistencia', 'Asistencia capturada por fecha y grupo.')}${boxTabs('reports', 'box-report-attendance')}
    <div class="box-kpi-grid secondary">${boxKpi('Asistencia de hoy', s.todayAttendance)}${boxKpi('Sesiones', Object.keys(boxState.sessions).length)}${boxKpi('Registros', Object.keys(boxState.attendance).length)}${boxKpi('Clases de prueba', Object.values(boxState.attendance).filter((a) => a.status === 'trial_class').length)}</div>
    <div class="card">${rows.length ? rows.map((a) => `<div class="box-row compact"><div><strong>${a.memberName || boxState.members[a.memberId]?.fullName || a.memberId}</strong><span>${a.date || '-'} · ${boxState.groups[a.groupId]?.name || '-'} · ${BOX_ATTENDANCE_LABELS[a.status] || a.status}</span></div></div>`).join('') : boxEmpty('Sin registros')}</div>`);
}

function renderBoxReportMoney() {
  const s = boxStats();
  const previousMethodTotal = s.transferPayments.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const confirmedCashTotal = s.confirmedCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  boxSetPage('box-report-money', `${boxSectionHeader('Ingresos y gastos', 'Comparativo general de entradas, salidas y resultado neto.')}${boxTabs('reports', 'box-report-money')}
    <div class="box-kpi-grid primary">${boxKpi('Ingresos', boxMoney(s.income))}${boxKpi('Gastos', boxMoney(s.expenseTotal))}${boxKpi('Neto', boxMoney(s.net), s.net < 0 ? 'danger' : 'success')}${boxKpi('Efectivo confirmado', boxMoney(confirmedCashTotal))}</div>
    <div class="box-kpi-grid secondary">${boxKpi('Metodos anteriores', boxMoney(previousMethodTotal))}${boxKpi('Efectivo pendiente', boxMoney(s.pendingCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0)), s.pendingCash.length ? 'warning' : '')}${boxKpi('Pagos registrados', s.payments.length)}${boxKpi('Cargos abiertos', s.pendingCharges.length)}</div>
    <div class="box-grid box-grid-2"><section class="card"><div class="sh"><div class="st">Pagos</div><div class="sl"></div></div>${boxRecentPayments(8)}</section><section class="card"><div class="sh"><div class="st">Gastos</div><div class="sl"></div></div>${s.expenses.slice(0, 8).map((e) => `<div class="box-row compact"><div><strong>${e.concept}</strong><span>${e.category || '-'} · ${e.date || '-'}</span></div><span class="box-pill">${boxMoney(e.amount)}</span></div>`).join('') || boxEmpty('Sin gastos')}</section></div>`);
}

function renderBoxReportWorkers() {
  const byUser = {};
  Object.values(boxState.payments).forEach((p) => {
    const key = p.receivedByName || p.receivedByUserId || 'Sin usuario';
    byUser[key] = (byUser[key] || 0) + Number(p.paidAmount || 0);
  });
  boxSetPage('box-report-workers', `${boxSectionHeader('Cobros por trabajador', 'Monto recibido por persona que registro el pago.')}${boxTabs('reports', 'box-report-workers')}<div class="card">${Object.entries(byUser).map(([name, amount]) => `<div class="box-row compact"><div><strong>${name}</strong><span>Cobros registrados</span></div><span class="box-pill">${boxMoney(amount)}</span></div>`).join('') || boxEmpty('Sin cobros registrados')}</div>`);
}

function renderBoxInconsistencies() {
  const saved = Object.values(boxState.inconsistencies);
  const generated = buildBoxAlerts().map((a, index) => ({ id: `generated_${index}`, title: a.label, detail: a.detail, severity: a.severity, status: 'pending' }));
  const items = [...saved, ...generated];
  boxSetPage('box-inconsistencies', `${boxSectionHeader('Inconsistencias', 'Alertas operativas, adeudos e incidencias por resolver.')}${boxTabs(canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) ? 'reports' : 'attendance', 'box-inconsistencies')}<div class="card"><div class="sh"><div class="st">Inconsistencias</div><div class="sl"></div></div>${items.length ? items.map((i) => `<div class="box-alert box-alert-${i.severity || 'info'}"><strong>${i.title || i.label}</strong><span>${i.detail || ''} Â· ${i.status || 'pendiente'}</span>${!String(i.id).startsWith('generated_') ? `<button class="btn btn-out btn-sm" onclick="resolveBoxInconsistency('${i.id}')">Resolver</button>` : ''}</div>`).join('') : boxEmpty('Sin inconsistencias')}</div>`);
}

async function resolveBoxInconsistency(id) {
  const comment = prompt('Comentario de resolucion');
  if (!comment) return;
  await boxPath('inconsistencies', id).set({ status: 'resolved', resolutionComment: comment, resolvedBy: currentUser?.uid || '', resolvedAt: boxServerTimestamp() }, { merge: true });
  await boxAudit('inconsistency_resolved', 'inconsistency', id, null, { comment });
}

function renderBoxReceipts() {
  const notifications = Object.values(boxState.notifications).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-receipts', `${boxSectionHeader('Comprobantes WhatsApp', 'Envios, errores y reintentos de recibos.')}${boxTabs(canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) ? 'admin' : 'finance', 'box-receipts')}<div class="card"><div class="sh"><div class="st">Comprobantes WhatsApp</div><div class="sl"></div></div>${notifications.length ? notifications.map((n) => `<div class="box-row"><div><strong>${n.paymentId || n.id}</strong><span>${n.to || '-'} Â· ${n.status || '-'}</span><span>${n.error || ''}</span></div>${n.paymentId ? `<button class="btn btn-out btn-sm" onclick="sendBoxReceipt('${n.paymentId}')">Reenviar</button>` : ''}</div>`).join('') : boxEmpty('Sin comprobantes')}</div>`);
}

function renderBoxAdmin() {
  const cfg = boxBusinessConfig();
  const info = cfg.publicInfo || {};
  const enabledMethods = boxEnabledPaymentMethods();
  const expenseCategories = Array.isArray(cfg.expenseCategories) && cfg.expenseCategories.length
    ? cfg.expenseCategories
    : ['Equipo deportivo', 'Guantes y material', 'Mantenimiento', 'Limpieza', 'Reparaciones', 'Publicidad', 'Servicios', 'Personal', 'Eventos', 'Otros'];
  boxSetPage('box-admin', boxPageShell('admin', 'box-admin', 'Configuracion', 'Ajustes del box visibles solo para administradores.', `
    <div class="box-config-layout">
      <section class="card box-config-card">
        <div class="sh"><div class="st">Informacion publica</div><div class="sl"></div></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Nombre del box</label><input class="fi" id="badmin_display" value="${boxAttr(cfg.displayName || BOX_PUBLIC_BRAND)}"/></div>
          <div class="fg"><label class="fl">Entrenador</label><input class="fi" id="badmin_coach" value="${boxAttr((info.coaches || [BOX_PUBLIC_COACH])[0] || BOX_PUBLIC_COACH)}"/></div>
          <div class="fg"><label class="fl">Ubicacion</label><input class="fi" id="badmin_location" value="${boxAttr(info.location || BOX_PUBLIC_LOCATION)}"/></div>
          <div class="fg"><label class="fl">WhatsApp informes</label><input class="fi" id="badmin_whatsapp" inputmode="tel" value="${boxAttr(cfg.contactWhatsApp || BOX_OWNER_CONTACT_PHONE)}"/></div>
        </div>
        <div class="fg"><label class="fl">Frase principal</label><input class="fi" id="badmin_description" value="${boxAttr(info.description || BOX_PUBLIC_DESCRIPTION)}"/></div>
      </section>
      <section class="card box-config-card">
        <div class="sh"><div class="st">Cobros</div><div class="sl"></div></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Mensualidad base</label><input class="fi" id="badmin_fee" type="number" min="0" value="${Number(cfg.monthlyFee || 400)}"/></div>
          <div class="fg"><label class="fl">Clases de prueba</label><input class="fi" id="badmin_trials" type="number" min="0" value="${Number(cfg.trialClassesAllowed || 1)}"/></div>
        </div>
        <div class="box-check-grid">
          <label class="box-check"><input type="checkbox" id="badmin_cash" ${enabledMethods.includes('cash') ? 'checked' : ''}/> Efectivo</label>
          <label class="box-check"><input type="checkbox" id="badmin_transfer" ${enabledMethods.includes('transfer') ? 'checked' : ''}/> Transferencia</label>
        </div>
      </section>
      <section class="card box-config-card box-span-2">
        <div class="sh"><div class="st">Categorias de gastos</div><div class="sl"></div></div>
        <div class="fg"><label class="fl">Separalas con coma</label><textarea class="fi" id="badmin_expenses">${boxAttr(expenseCategories.join(', '))}</textarea></div>
      </section>
      <section class="card box-config-card box-span-2">
        <div class="sh"><div class="st">Acciones rapidas</div><div class="sl"></div></div>
        <div class="box-action-grid">
          <button class="btn btn-out btn-full" onclick="boxOpenPage('box-members','students',this)">Alumnos</button>
          <button class="btn btn-out btn-full" onclick="boxOpenPage('box-expenses','finance',this)">Gastos</button>
          <button class="btn btn-out btn-full" onclick="boxOpenPage('box-audit','admin',this)">Auditoria</button>
        </div>
        <button class="btn btn-g btn-full" onclick="saveBoxAdminSettings()">Guardar configuracion</button>
      </section>
    </div>`));
}

async function saveBoxAdminSettings() {
  if (!fs || !currentUser) return showToast('Inicia sesion para guardar', 'ta');
  if (!canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID)) return showToast('Solo administracion puede cambiar configuracion', 'tr');
  try {
    const monthlyFee = Number(document.getElementById('badmin_fee')?.value || 0);
    const trialClassesAllowed = Number(document.getElementById('badmin_trials')?.value || 0);
    const contactWhatsApp = boxNormalizePhone(document.getElementById('badmin_whatsapp')?.value || BOX_OWNER_CONTACT_PHONE);
    const displayName = document.getElementById('badmin_display')?.value.trim() || BOX_PUBLIC_BRAND;
    const paymentMethodsEnabled = [];
    if (document.getElementById('badmin_cash')?.checked) paymentMethodsEnabled.push('cash');
    if (document.getElementById('badmin_transfer')?.checked) paymentMethodsEnabled.push('transfer');
    const expenseCategories = (document.getElementById('badmin_expenses')?.value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const publicInfo = {
      ...(boxBusinessConfig().publicInfo || {}),
      location: document.getElementById('badmin_location')?.value.trim() || BOX_PUBLIC_LOCATION,
      schedule: BOX_PUBLIC_SCHEDULE,
      coaches: [document.getElementById('badmin_coach')?.value.trim() || BOX_PUBLIC_COACH],
      description: document.getElementById('badmin_description')?.value.trim() || BOX_PUBLIC_DESCRIPTION
    };
    if (monthlyFee < 0 || trialClassesAllowed < 0) return showToast('Captura valores validos', 'ta');
    if (!paymentMethodsEnabled.length) return showToast('Activa al menos un metodo de pago', 'ta');
    if (!expenseCategories.length) return showToast('Agrega al menos una categoria de gasto', 'ta');
    const prev = boxBusinessConfig();
    const patch = {
      displayName,
      monthlyFee,
      trialClassesAllowed,
      contactWhatsApp,
      publicInfo,
      expenseCategories,
      paymentMethodsEnabled,
      updatedBy: currentUser.uid,
      updatedAt: boxServerTimestamp()
    };
    await fs.collection('businesses').doc(BOX_LOMBARDO_BUSINESS_ID).set(patch, { merge: true });
    Object.assign(BUSINESS_CATALOG[BOX_LOMBARDO_BUSINESS_ID], patch);
    await boxAudit('business_settings_updated', 'business', BOX_LOMBARDO_BUSINESS_ID, {
      monthlyFee: prev.monthlyFee,
      trialClassesAllowed: prev.trialClassesAllowed,
      contactWhatsApp: prev.contactWhatsApp,
      expenseCategories: prev.expenseCategories || null,
      paymentMethodsEnabled: prev.paymentMethodsEnabled || null,
      publicInfo: prev.publicInfo || null
    }, patch).catch((error) => console.warn('box settings audit', error));
    showToast('Configuracion guardada', 'tg');
    renderBoxAdmin();
  } catch (error) {
    showToast(error.message || 'No se pudo guardar configuracion', 'tr');
  }
}

function renderBoxAudit() {
  const logs = Object.values(boxState.auditLogs).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-audit', `${boxSectionHeader('Auditoria', 'Registro completo de acciones con fecha, hora, usuario y entidad afectada.')}${boxTabs('admin', 'box-audit')}<div class="card"><div class="sh"><div class="st">Auditoria</div><div class="sl"></div></div>${logs.length ? logs.map((l) => `<div class="box-row"><div><strong>${l.action}</strong><span>Fecha y hora: ${boxDateLabel(l.createdAt)}</span><span>Usuario: ${l.actorName || l.actorUserId || '-'} · Entidad: ${l.entityType || '-'} · ${l.entityId || '-'}</span>${l.reason ? `<span>Motivo: ${l.reason}</span>` : ''}</div></div>`).join('') : boxEmpty('Sin auditoria')}</div>`);
}

function renderBoxSettings() {
  const cfg = boxBusinessConfig();
  boxSetPage('box-settings', `${boxSectionHeader('Configuracion del box', 'Parametros administrativos visibles solo para perfiles autorizados.')}${boxTabs('admin', 'box-settings')}<div class="card"><div class="sh"><div class="st">Configuracion</div><div class="sl"></div></div>
    <div class="box-info-list">
      <div><strong>Mensualidad</strong><span>${boxMoney(cfg.monthlyFee)}</span></div>
      <div><strong>Nombre publico de alumnos</strong><span>${cfg.publicStudentNameMode || 'first'} (full, abbreviated o first)</span></div>
      <div><strong>Metodos habilitados</strong><span>Efectivo</span></div>
      <div><strong>Clases de prueba</strong><span>${cfg.trialClassesAllowed}</span></div>
    </div>
    <button class="btn btn-g btn-full" onclick="boxSeedBusiness()">Crear/actualizar configuracion inicial segura</button>
  </div>`);
}

function renderBoxAdminExpenses() {
  const cfg = boxBusinessConfig();
  boxSetPage('box-admin-expenses', `${boxSectionHeader('Categorias de gastos', 'Catalogo operativo utilizado al registrar gastos.')}${boxTabs('admin', 'box-admin-expenses')}
    <div class="card"><div class="sh"><div class="st">Categorias activas</div><div class="sl"></div></div>
      <div class="box-chip-row">${(cfg.expenseCategories || []).map((category) => `<span class="box-chip">${category}</span>`).join('') || boxEmpty('Sin categorias')}</div>
      <p class="box-muted">La actualizacion segura del catalogo se realiza desde la configuracion inicial del box.</p>
    </div>`);
}

function renderBoxAdminFolios() {
  const counters = {
    payments: Object.keys(boxState.payments).length,
    deliveries: Object.keys(boxState.cashDeliveries).length,
    expenses: Object.keys(boxState.expenses).length,
    members: Object.keys(boxState.members).length
  };
  boxSetPage('box-admin-folios', `${boxSectionHeader('Folios y parametros', 'Lectura de secuencias operativas actuales.')}${boxTabs('admin', 'box-admin-folios')}
    <div class="box-kpi-grid secondary">
      ${boxKpi('Pagos registrados', counters.payments)}
      ${boxKpi('Entregas', counters.deliveries)}
      ${boxKpi('Gastos', counters.expenses)}
      ${boxKpi('Alumnos', counters.members)}
    </div>
    <div class="card"><p class="box-muted">Los folios se generan desde los flujos existentes de pagos, entregas, gastos y alumnos. No se exponen identificadores tecnicos al usuario final.</p></div>`);
}

async function boxSeedBusiness() {
  try {
    await boxCallable('boxSeedBusiness', {});
    showToast('Configuracion inicial verificada', 'tg');
  } catch (error) {
    showToast(error.message || 'No se pudo inicializar', 'tr');
  }
}

