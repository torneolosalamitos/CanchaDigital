const boxState = {
  listenersReady: false,
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
  auditLogs: {}
};

let boxLegacyNavHtml = '';

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
  ['box-dashboard', 'Resumen'],
  ['box-members', 'Alumnos'],
  ['box-prospects', 'Prospectos'],
  ['box-guardians', 'Tutores'],
  ['box-groups', 'Grupos y horarios'],
  ['box-attendance', 'Asistencia'],
  ['box-billing', 'Mensualidades'],
  ['box-payments', 'Pagos'],
  ['box-cash', 'Entregas de efectivo'],
  ['box-expenses', 'Gastos'],
  ['box-reports', 'Cortes y reportes'],
  ['box-inconsistencies', 'Inconsistencias'],
  ['box-receipts', 'Comprobantes'],
  ['box-permissions', 'Personal y permisos'],
  ['box-audit', 'Auditoria'],
  ['box-settings', 'Configuracion']
];

function boxBusinessConfig() {
  return { ...getBusinessConfig(BOX_LOMBARDO_BUSINESS_ID), ...(boxState.business || {}) };
}

function boxMoney(value) {
  return '$' + Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function boxNormalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function boxPath(collectionName, docId) {
  const root = fs.collection('businesses').doc(BOX_LOMBARDO_BUSINESS_ID);
  if (!collectionName) return root;
  const collection = root.collection(collectionName);
  return docId ? collection.doc(docId) : collection;
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

function renderBoxNav() {
  const nav = document.querySelector('.nav-tabs');
  if (!nav) return;
  if (!boxLegacyNavHtml) boxLegacyNavHtml = nav.innerHTML;
  nav.innerHTML = BOX_PAGES
    .filter(([key]) => key === 'box-public' || canAccessBusinessPage(key))
    .map(([key, label], index) => `<button class="nav-tab ${index === 0 ? 'active' : ''}" onclick="showPage('${key}',this)">${label}</button>`)
    .join('');
}

function restoreTournamentNav() {
  const catTabs = document.getElementById('catTabsContainer');
  if (catTabs) catTabs.style.display = '';
  const nav = document.querySelector('.nav-tabs');
  if (nav && boxLegacyNavHtml) nav.innerHTML = boxLegacyNavHtml;
  document.querySelectorAll('.box-page').forEach((page) => page.classList.remove('active'));
}

function selectBoxBusiness() {
  currentBusinessId = BOX_LOMBARDO_BUSINESS_ID;
  localStorage.setItem('ld_business', BOX_LOMBARDO_BUSINESS_ID);
  document.getElementById('splash').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  createBoxPages();
  renderBoxNav();
  const catTabs = document.getElementById('catTabsContainer');
  if (catTabs) catTabs.style.display = 'none';
  const cfg = boxBusinessConfig();
  document.getElementById('hdrName').textContent = cfg.displayName || cfg.name;
  document.getElementById('hdrCat').textContent = `Mensualidad ${boxMoney(cfg.monthlyFee)} · ${cfg.timezone}`;
  const logo = document.getElementById('hdrTorneoLogo');
  if (logo) logo.src = cfg.logo || CD_LOGO_SHIELD;
  setupBoxListeners();
  const startPage = canAccessBusinessAdmin(BOX_LOMBARDO_BUSINESS_ID) ? 'box-dashboard' : 'box-public';
  showPage(startPage, document.querySelector(`.nav-tab[onclick="showPage('${startPage}',this)"]`) || document.querySelector('.nav-tab'));
}

function setupBoxListeners() {
  if (!fs || boxState.listenersReady) {
    renderBoxPage(document.querySelector('.box-page.active')?.id?.replace('page-', '') || 'box-public');
    return;
  }
  boxState.listenersReady = true;
  boxState.unsubscribers.push(boxPath().onSnapshot((doc) => {
    boxState.business = doc.exists ? { id: doc.id, ...doc.data() } : null;
    renderActiveBoxPage();
  }));
  BOX_COLLECTIONS.forEach((collectionName) => {
    boxState.unsubscribers.push(boxPath(collectionName).onSnapshot((snapshot) => {
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
    'box-dashboard': renderBoxDashboard,
    'box-members': renderBoxMembers,
    'box-prospects': renderBoxProspects,
    'box-guardians': renderBoxGuardians,
    'box-groups': renderBoxGroups,
    'box-attendance': renderBoxAttendance,
    'box-billing': renderBoxBilling,
    'box-payments': renderBoxPayments,
    'box-cash': renderBoxCash,
    'box-expenses': renderBoxExpenses,
    'box-reports': renderBoxReports,
    'box-inconsistencies': renderBoxInconsistencies,
    'box-receipts': renderBoxReceipts,
    'box-permissions': renderBoxPermissions,
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
  return `<div class="stat-box ${tone}"><div class="sn">${value}</div><div class="sl2">${title}</div></div>`;
}

function boxStats() {
  const members = Object.values(boxState.members);
  const activeMembers = members.filter((m) => ['active', 'active_with_debt', 'trial'].includes(m.status));
  const prospects = Object.values(boxState.prospects).filter((p) => p.status !== 'converted');
  const charges = Object.values(boxState.charges).filter((c) => c.status !== 'canceled');
  const payments = Object.values(boxState.payments).filter((p) => p.paymentStatus !== 'reverted');
  const expenses = Object.values(boxState.expenses).filter((e) => !['canceled', 'rejected'].includes(e.status));
  const pendingCharges = charges.filter((c) => Number(c.balance || 0) > 0);
  const pendingCash = payments.filter((p) => p.cashDeliveryStatus === 'pending_delivery');
  const confirmedCash = payments.filter((p) => p.cashDeliveryStatus === 'confirmed');
  const expected = charges.reduce((sum, charge) => sum + Number(charge.expectedAmount || 0), 0);
  const income = payments.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const today = boxNowISO();
  const todayAttendance = Object.values(boxState.attendance).filter((a) => a.date === today && a.status !== 'absent').length;
  return {
    members,
    activeMembers,
    prospects,
    charges,
    payments,
    expenses,
    pendingCharges,
    pendingCash,
    confirmedCash,
    expected,
    income,
    expenseTotal,
    todayAttendance,
    net: income - expenseTotal
  };
}

function renderBoxPublic() {
  const cfg = boxBusinessConfig();
  const info = cfg.publicInfo || {};
  boxSetPage('box-public', `
    <div class="box-hero">
      <div>
        <div class="box-kicker">CanchaDigital · Box</div>
        <h1>${cfg.displayName || cfg.name}</h1>
        <p>${info.description || ''}</p>
        <div class="box-chip-row">
          <span class="box-chip">Mensualidad ${boxMoney(cfg.monthlyFee)}</span>
          <span class="box-chip">${info.enrollmentStatus || 'Inscripciones abiertas'}</span>
          <span class="box-chip">${cfg.timezone}</span>
        </div>
      </div>
      <div class="box-hero-logo"><img src="${cfg.logo || CD_LOGO_SHIELD}" alt="${cfg.displayName || cfg.name}"/></div>
    </div>
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Informacion</div><div class="sl"></div></div>
        <div class="box-info-list">
          <div><strong>Ubicacion</strong><span>${info.location || '-'}</span></div>
          <div><strong>Dias y horarios</strong><span>${info.schedule || '-'}</span></div>
          <div><strong>Entrenador</strong><span>${(info.coaches || []).join(', ') || '-'}</span></div>
          <div><strong>Contacto</strong><span>${cfg.contactWhatsApp || 'WhatsApp por configurar'}</span></div>
        </div>
        ${cfg.contactWhatsApp ? `<a class="btn btn-g btn-full" href="https://wa.me/${boxNormalizePhone(cfg.contactWhatsApp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      </section>
      <section class="card">
        <div class="sh"><div class="st">Preinscripcion</div><div class="sl"></div></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Nombre del nino</label><input class="fi" id="bp_child" placeholder="Nombre completo"/></div>
          <div class="fg"><label class="fl">Edad</label><input class="fi" id="bp_age" type="number" min="3" max="99"/></div>
          <div class="fg"><label class="fl">Tutor</label><input class="fi" id="bp_guardian" placeholder="Nombre del tutor"/></div>
          <div class="fg"><label class="fl">Telefono</label><input class="fi" id="bp_phone" inputmode="tel" placeholder="10 digitos"/></div>
        </div>
        <div class="fg"><label class="fl">Horario de interes</label><input class="fi" id="bp_schedule" placeholder="Ej: vespertino"/></div>
        <div class="fg"><label class="fl">Observaciones</label><textarea class="fi" id="bp_notes"></textarea></div>
        <label class="box-check"><input type="checkbox" id="bp_consent"/> Autorizo que me contacten para dar seguimiento.</label>
        <button class="btn btn-g btn-full" onclick="saveBoxProspect()">Enviar preinscripcion</button>
      </section>
    </div>
    <div class="box-grid box-grid-2">
      <section class="card"><div class="sh"><div class="st">Requisitos</div><div class="sl"></div></div>${(info.requirements || []).map((item) => `<div class="box-list-item">${item}</div>`).join('')}</section>
      <section class="card"><div class="sh"><div class="st">Reglamento basico</div><div class="sl"></div></div>${(info.rules || []).map((item) => `<div class="box-list-item">${item}</div>`).join('')}</section>
    </div>`);
}

async function saveBoxProspect() {
  if (!fs) return showToast('Firestore no disponible', 'tr');
  const fullName = document.getElementById('bp_child')?.value.trim();
  const age = Number(document.getElementById('bp_age')?.value || 0);
  const guardianName = document.getElementById('bp_guardian')?.value.trim();
  const phone = boxNormalizePhone(document.getElementById('bp_phone')?.value);
  const interestedSchedule = document.getElementById('bp_schedule')?.value.trim();
  const notes = document.getElementById('bp_notes')?.value.trim();
  const consent = document.getElementById('bp_consent')?.checked;
  if (!fullName || !guardianName || phone.length !== 10 || !consent) return showToast('Completa nombre, tutor, telefono y consentimiento', 'ta');
  await boxPath('prospects').add({
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    fullName,
    age,
    guardianName,
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
  boxSetPage('box-dashboard', `
    <div class="sh"><div class="st">Resumen Box</div><div class="sl"></div><button class="btn btn-out btn-sm" onclick="boxSeedBusiness()">Inicializar</button></div>
    <div class="stats-row box-kpi-grid">
      ${boxKpi('Alumnos activos', s.activeMembers.length)}
      ${boxKpi('Prospectos', s.prospects.length)}
      ${boxKpi('Clase prueba', s.members.filter((m) => m.status === 'trial').length)}
      ${boxKpi('Pagados', s.charges.filter((c) => c.status === 'paid').length)}
      ${boxKpi('Pendientes', s.pendingCharges.length)}
      ${boxKpi('Vencidos', s.charges.filter((c) => c.status === 'overdue').length)}
      ${boxKpi('Ingreso esperado', boxMoney(s.expected))}
      ${boxKpi('Ingreso registrado', boxMoney(s.income))}
      ${boxKpi('Pendiente entregar', boxMoney(s.pendingCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0)))}
      ${boxKpi('Efectivo confirmado', boxMoney(s.confirmedCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0)))}
      ${boxKpi('Gastos', boxMoney(s.expenseTotal))}
      ${boxKpi('Resultado neto', boxMoney(s.net))}
      ${boxKpi('Asistencias hoy', s.todayAttendance)}
      ${boxKpi('Diferencias', Object.values(boxState.cashDeliveries).filter((d) => Number(d.differenceAmount || 0) !== 0).length)}
      ${boxKpi('Alertas', alerts.length)}
    </div>
    <div class="card">
      <div class="sh"><div class="st">Alertas activas</div><div class="sl"></div></div>
      ${alerts.length ? alerts.map((a) => `<div class="box-alert box-alert-${a.severity}"><strong>${a.label}</strong><span>${a.detail}</span></div>`).join('') : boxEmpty('Sin alertas activas')}
    </div>`);
}

function buildBoxAlerts() {
  const alerts = [];
  const members = Object.values(boxState.members);
  members.filter((m) => ['active', 'active_with_debt'].includes(m.status) && (!m.guardianIds || !m.guardianIds.length)).forEach((m) => {
    alerts.push({ severity: 'warning', label: 'Alumno activo sin tutor', detail: m.fullName });
  });
  Object.values(boxState.charges).filter((c) => Number(c.balance || 0) > 0 && c.status !== 'canceled').forEach((c) => {
    const member = boxState.members[c.memberId];
    alerts.push({ severity: c.status === 'overdue' ? 'critical' : 'warning', label: 'Mensualidad pendiente', detail: `${member?.fullName || c.memberId} · ${boxMoney(c.balance)}` });
  });
  Object.values(boxState.payments).filter((p) => p.receiptStatus !== 'sent').forEach((p) => {
    alerts.push({ severity: 'info', label: 'Pago sin comprobante enviado', detail: p.folio || p.id });
  });
  Object.values(boxState.payments).filter((p) => p.cashDeliveryStatus === 'pending_delivery').forEach((p) => {
    alerts.push({ severity: 'warning', label: 'Pago pendiente de entregar', detail: `${p.folio || p.id} · ${boxMoney(p.paidAmount)}` });
  });
  Object.values(boxState.cashDeliveries).filter((d) => Number(d.differenceAmount || 0) !== 0).forEach((d) => {
    alerts.push({ severity: 'critical', label: 'Entrega con diferencia', detail: `${d.folio || d.id} · ${boxMoney(d.differenceAmount)}` });
  });
  return alerts.slice(0, 30);
}

function renderBoxMembers() {
  const cfg = boxBusinessConfig();
  const members = Object.values(boxState.members).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  const groupOptions = Object.values(boxState.groups).map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
  boxSetPage('box-members', `
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Alta de alumno</div><div class="sl"></div></div>
        <input type="hidden" id="bm_id"/>
        <div class="form-2">
          <div class="fg"><label class="fl">Alumno</label><input class="fi" id="bm_name"/></div>
          <div class="fg"><label class="fl">Fecha nacimiento</label><input class="fi" id="bm_birth" type="date"/></div>
          <div class="fg"><label class="fl">Estado</label><select class="fi" id="bm_status">${Object.entries(BOX_MEMBER_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${k === 'active' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="fg"><label class="fl">Grupo</label><select class="fi" id="bm_group"><option value="">Sin grupo</option>${groupOptions}</select></div>
          <div class="fg"><label class="fl">Mensualidad</label><input class="fi" id="bm_fee" type="number" min="0" value="${Number(cfg.monthlyFee || 400)}"/></div>
          <div class="fg"><label class="fl">Descuento</label><input class="fi" id="bm_discount" type="number" min="0" value="0"/></div>
        </div>
        <div class="fg"><label class="fl">Notas</label><textarea class="fi" id="bm_notes"></textarea></div>
        <hr class="divider"/>
        <div class="form-2">
          <div class="fg"><label class="fl">Tutor</label><input class="fi" id="bm_guardian"/></div>
          <div class="fg"><label class="fl">Relacion</label><input class="fi" id="bm_relation" placeholder="Mama, papa, tutor"/></div>
          <div class="fg"><label class="fl">Telefono</label><input class="fi" id="bm_phone" inputmode="tel"/></div>
          <div class="fg"><label class="fl">WhatsApp</label><input class="fi" id="bm_whatsapp" inputmode="tel"/></div>
        </div>
        <button class="btn btn-g btn-full" onclick="saveBoxMember()">Guardar alumno y tutor</button>
      </section>
      <section class="card">
        <div class="sh"><div class="st">Alumnos</div><div class="sl"></div></div>
        ${members.length ? members.map(renderBoxMemberCard).join('') : boxEmpty('Sin alumnos registrados')}
      </section>
    </div>`);
}

function renderBoxMemberCard(member) {
  const guardians = (member.guardianIds || []).map((id) => boxState.guardians[id]?.fullName).filter(Boolean).join(', ') || 'Sin tutor';
  const group = boxState.groups[member.groupId]?.name || 'Sin grupo';
  const lastPayment = Object.values(boxState.payments).filter((p) => p.memberId === member.id).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt))[0];
  const pending = Object.values(boxState.charges).filter((c) => c.memberId === member.id && Number(c.balance || 0) > 0);
  return `<div class="box-row">
    <div>
      <strong>${member.fullName || '-'}</strong>
      <span>${BOX_MEMBER_STATUS_LABELS[member.status] || member.status} · ${group} · Tutor: ${guardians}</span>
      <span>Mensualidad ${boxMoney(member.monthlyFee)} · Ultimo pago: ${lastPayment ? boxMoney(lastPayment.paidAmount) : '-'}</span>
    </div>
    <div class="box-row-actions">
      <span class="box-pill">${pending.length ? `${pending.length} pendiente(s)` : 'Al corriente'}</span>
      <button class="btn btn-out btn-sm" onclick="fillBoxMember('${member.id}')">Editar</button>
      <button class="btn btn-r btn-sm" onclick="deactivateBoxMember('${member.id}')">Baja</button>
    </div>
  </div>`;
}

async function saveBoxMember() {
  if (!fs || !currentUser) return showToast('Inicia sesion para guardar', 'ta');
  if (!canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso para guardar alumnos', 'tr');
  const memberId = document.getElementById('bm_id')?.value || '';
  const fullName = document.getElementById('bm_name')?.value.trim();
  const guardianName = document.getElementById('bm_guardian')?.value.trim();
  const phone = boxNormalizePhone(document.getElementById('bm_phone')?.value);
  if (!fullName || !guardianName || phone.length !== 10) return showToast('Alumno, tutor y telefono son obligatorios', 'ta');
  const guardianExisting = Object.values(boxState.guardians).find((g) => boxNormalizePhone(g.primaryPhone) === phone);
  const guardianRef = guardianExisting ? boxPath('guardians', guardianExisting.id) : boxPath('guardians').doc();
  const memberRef = memberId ? boxPath('members', memberId) : boxPath('members').doc();
  const guardianId = guardianRef.id;
  const prev = memberId ? boxState.members[memberId] : null;
  const birthDate = document.getElementById('bm_birth')?.value || null;
  const payload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    fullName,
    birthDate,
    age: birthDate ? Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000)) : null,
    status: document.getElementById('bm_status')?.value || 'active',
    groupId: document.getElementById('bm_group')?.value || '',
    monthlyFee: Number(document.getElementById('bm_fee')?.value || boxBusinessConfig().monthlyFee || 400),
    discountAmount: Number(document.getElementById('bm_discount')?.value || 0),
    scholarshipType: null,
    startDate: prev?.startDate || boxNowISO(),
    endDate: null,
    guardianIds: [...new Set([...(prev?.guardianIds || []), guardianId])],
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
  batch.set(guardianRef, {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    fullName: guardianName,
    relationship: document.getElementById('bm_relation')?.value.trim() || 'Tutor',
    primaryPhone: phone,
    alternatePhone: '',
    whatsappNumber: boxNormalizePhone(document.getElementById('bm_whatsapp')?.value) || phone,
    messagingConsent: true,
    address: '',
    notes: '',
    memberIds: firebase.firestore.FieldValue.arrayUnion(memberRef.id),
    createdBy: guardianExisting?.createdBy || currentUser.uid,
    createdAt: guardianExisting?.createdAt || boxServerTimestamp(),
    updatedAt: boxServerTimestamp()
  }, { merge: true });
  batch.set(memberRef, payload, { merge: true });
  await batch.commit();
  await boxAudit(prev ? 'member_updated' : 'member_created', 'member', memberRef.id, prev, payload);
  showToast('Alumno guardado', 'tg');
  renderBoxMembers();
}

function fillBoxMember(id) {
  const member = boxState.members[id];
  if (!member) return;
  const guardian = boxState.guardians[(member.guardianIds || [])[0]] || {};
  document.getElementById('bm_id').value = id;
  document.getElementById('bm_name').value = member.fullName || '';
  document.getElementById('bm_birth').value = member.birthDate || '';
  document.getElementById('bm_status').value = member.status || 'active';
  document.getElementById('bm_group').value = member.groupId || '';
  document.getElementById('bm_fee').value = Number(member.monthlyFee || boxBusinessConfig().monthlyFee || 400);
  document.getElementById('bm_discount').value = Number(member.discountAmount || 0);
  document.getElementById('bm_notes').value = member.notes || '';
  document.getElementById('bm_guardian').value = guardian.fullName || '';
  document.getElementById('bm_relation').value = guardian.relationship || '';
  document.getElementById('bm_phone').value = guardian.primaryPhone || '';
  document.getElementById('bm_whatsapp').value = guardian.whatsappNumber || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deactivateBoxMember(id) {
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
  showToast('Alumno dado de baja sin eliminar historial', 'tg');
}

function renderBoxProspects() {
  const prospects = Object.values(boxState.prospects).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-prospects', `<div class="card"><div class="sh"><div class="st">Prospectos</div><div class="sl"></div></div>${prospects.length ? prospects.map((p) => `
    <div class="box-row"><div><strong>${p.fullName}</strong><span>${p.age || '-'} anos · Tutor: ${p.guardianName || '-'} · ${p.guardianPhone || '-'}</span><span>${p.interestedSchedule || '-'} · ${p.notes || ''}</span></div><button class="btn btn-out btn-sm" onclick="markProspectReviewed('${p.id}')">En revision</button></div>`).join('') : boxEmpty('Sin prospectos')}</div>`);
}

async function markProspectReviewed(id) {
  await boxPath('prospects', id).set({ status: 'reviewing', updatedAt: boxServerTimestamp(), updatedBy: currentUser?.uid || '' }, { merge: true });
  await boxAudit('prospect_reviewing', 'prospect', id, null, { status: 'reviewing' });
}

function renderBoxGuardians() {
  const guardians = Object.values(boxState.guardians).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  boxSetPage('box-guardians', `<div class="card"><div class="sh"><div class="st">Tutores</div><div class="sl"></div></div>${guardians.length ? guardians.map((g) => `
    <div class="box-row"><div><strong>${g.fullName}</strong><span>${g.relationship || 'Tutor'} · ${g.primaryPhone || '-'} · WhatsApp ${g.whatsappNumber || '-'}</span><span>Alumnos: ${(g.memberIds || []).map((id) => boxState.members[id]?.fullName).filter(Boolean).join(', ') || '-'}</span></div></div>`).join('') : boxEmpty('Sin tutores')}</div>`);
}

function renderBoxGroups() {
  const groups = Object.values(boxState.groups).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  boxSetPage('box-groups', `
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Grupo</div><div class="sl"></div></div>
        <div class="fg"><label class="fl">Nombre</label><input class="fi" id="bg_name" placeholder="Grupo infantil vespertino"/></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Dias</label><input class="fi" id="bg_days" placeholder="Lun, Mie, Vie"/></div>
          <div class="fg"><label class="fl">Capacidad</label><input class="fi" id="bg_capacity" type="number" min="0"/></div>
          <div class="fg"><label class="fl">Inicio</label><input class="fi" id="bg_start" type="time"/></div>
          <div class="fg"><label class="fl">Fin</label><input class="fi" id="bg_end" type="time"/></div>
        </div>
        <button class="btn btn-g btn-full" onclick="saveBoxGroup()">Guardar grupo</button>
      </section>
      <section class="card">
        <div class="sh"><div class="st">Grupos activos</div><div class="sl"></div></div>
        ${groups.length ? groups.map((g) => `<div class="box-row"><div><strong>${g.name}</strong><span>${(g.daysOfWeek || []).join(', ')} · ${g.startTime || '-'}-${g.endTime || '-'} · Capacidad ${g.capacity || '-'}</span></div><button class="btn btn-out btn-sm" onclick="disableBoxGroup('${g.id}')">Desactivar</button></div>`).join('') : boxEmpty('Sin grupos')}
      </section>
    </div>`);
}

async function saveBoxGroup() {
  if (!canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso', 'tr');
  const name = document.getElementById('bg_name')?.value.trim();
  if (!name) return showToast('Nombre del grupo requerido', 'ta');
  const payload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    name,
    trainerIds: [],
    daysOfWeek: String(document.getElementById('bg_days')?.value || '').split(',').map((d) => d.trim()).filter(Boolean),
    startTime: document.getElementById('bg_start')?.value || '',
    endTime: document.getElementById('bg_end')?.value || '',
    capacity: Number(document.getElementById('bg_capacity')?.value || 0) || null,
    status: 'active',
    createdBy: currentUser?.uid || '',
    createdAt: boxServerTimestamp(),
    updatedAt: boxServerTimestamp()
  };
  const ref = await boxPath('groups').add(payload);
  await boxAudit('group_created', 'group', ref.id, null, payload);
  showToast('Grupo guardado', 'tg');
}

async function disableBoxGroup(id) {
  await boxPath('groups', id).set({ status: 'inactive', updatedAt: boxServerTimestamp(), updatedBy: currentUser?.uid || '' }, { merge: true });
  await boxAudit('group_disabled', 'group', id, null, { status: 'inactive' });
}

function renderBoxAttendance() {
  const groups = Object.values(boxState.groups).filter((g) => g.status !== 'inactive');
  const selectedGroup = document.getElementById('ba_group')?.value || groups[0]?.id || '';
  const members = Object.values(boxState.members).filter((m) => !selectedGroup || m.groupId === selectedGroup);
  boxSetPage('box-attendance', `
    <div class="card box-mobile-card">
      <div class="sh"><div class="st">Pasar asistencia</div><div class="sl"></div></div>
      <div class="form-2">
        <div class="fg"><label class="fl">Fecha</label><input class="fi" id="ba_date" type="date" value="${document.getElementById('ba_date')?.value || boxNowISO()}"/></div>
        <div class="fg"><label class="fl">Grupo</label><select class="fi" id="ba_group" onchange="renderBoxAttendance()">${groups.map((g) => `<option value="${g.id}" ${g.id === selectedGroup ? 'selected' : ''}>${g.name}</option>`).join('')}</select></div>
      </div>
      <div id="boxAttendanceList">${members.length ? members.map((m) => `
        <div class="box-att-row">
          <div><strong>${m.fullName}</strong><span>${BOX_MEMBER_STATUS_LABELS[m.status] || m.status}</span></div>
          <select class="fi" data-att-member="${m.id}">
            ${Object.entries(BOX_ATTENDANCE_LABELS).map(([k, v]) => `<option value="${k}" ${k === 'present' ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>`).join('') : boxEmpty('Sin alumnos esperados')}
      </div>
      <div class="fg"><label class="fl">Observaciones de sesion</label><textarea class="fi" id="ba_notes"></textarea></div>
      <button class="btn btn-g btn-full" onclick="saveBoxAttendance()">Cerrar lista de asistencia</button>
    </div>
    <div class="card">
      <div class="sh"><div class="st">Clase de prueba rapida</div><div class="sl"></div></div>
      <div class="form-2">
        <div class="fg"><label class="fl">Nombre</label><input class="fi" id="bt_name"/></div>
        <div class="fg"><label class="fl">Tutor telefono</label><input class="fi" id="bt_phone" inputmode="tel"/></div>
      </div>
      <button class="btn btn-out btn-full" onclick="registerTrialClass()">Registrar clase de prueba</button>
    </div>
    <div class="card">
      <div class="sh"><div class="st">Auditoria fisica</div><div class="sl"></div></div>
      <div class="form-2">
        <div class="fg"><label class="fl">Ninos observados</label><input class="fi" id="bpa_observed" type="number" min="0"/></div>
        <div class="fg"><label class="fl">Foto opcional URL</label><input class="fi" id="bpa_photo" placeholder="https://..."/></div>
      </div>
      <div class="fg"><label class="fl">Observaciones</label><textarea class="fi" id="bpa_notes"></textarea></div>
      <button class="btn btn-out btn-full" onclick="saveBoxPhysicalAudit()">Guardar auditoria fisica</button>
    </div>`);
}

async function saveBoxAttendance() {
  if (!canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID)) return showToast('No tienes permiso', 'tr');
  const date = document.getElementById('ba_date')?.value || boxNowISO();
  const groupId = document.getElementById('ba_group')?.value || '';
  if (!groupId) return showToast('Selecciona grupo', 'ta');
  const sessionRef = boxPath('sessions').doc(`${groupId}_${date}`);
  const sessionPayload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    groupId,
    date,
    status: 'closed',
    notes: document.getElementById('ba_notes')?.value.trim() || '',
    capturedBy: currentUser?.uid || '',
    capturedAt: boxServerTimestamp(),
    closedAt: boxServerTimestamp()
  };
  const batch = fs.batch();
  batch.set(sessionRef, sessionPayload, { merge: true });
  document.querySelectorAll('[data-att-member]').forEach((select) => {
    const memberId = select.getAttribute('data-att-member');
    const member = boxState.members[memberId] || {};
    const charge = Object.values(boxState.charges).find((c) => c.memberId === memberId && Number(c.balance || 0) > 0);
    batch.set(boxPath('attendance').doc(`${sessionRef.id}_${memberId}`), {
      businessId: BOX_LOMBARDO_BUSINESS_ID,
      sessionId: sessionRef.id,
      groupId,
      memberId,
      memberName: member.fullName || '',
      date,
      status: select.value,
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
  const groupId = document.getElementById('ba_group')?.value || '';
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

function renderBoxBilling() {
  const charges = Object.values(boxState.charges).sort((a, b) => (b.periodLabel || '').localeCompare(a.periodLabel || ''));
  boxSetPage('box-billing', `
    <div class="card">
      <div class="sh"><div class="st">Generar cargos</div><div class="sl"></div></div>
      <div class="form-3">
        <div class="fg"><label class="fl">Periodo</label><input class="fi" id="bb_period" type="month" value="${new Date().toISOString().slice(0, 7)}"/></div>
        <div class="fg"><label class="fl">Vencimiento</label><input class="fi" id="bb_due" type="date" value="${new Date().toISOString().slice(0, 8)}10"/></div>
        <div class="fg"><label class="fl">Mensualidad</label><input class="fi" value="${boxMoney(boxBusinessConfig().monthlyFee)}" disabled/></div>
      </div>
      <button class="btn btn-g btn-full" onclick="generateBoxMonthlyCharges()">Generar cargos idempotentes</button>
    </div>
    <div class="card"><div class="sh"><div class="st">Cargos</div><div class="sl"></div></div>${charges.length ? charges.map((c) => `<div class="box-row"><div><strong>${boxState.members[c.memberId]?.fullName || c.memberId}</strong><span>${c.periodLabel || c.billingPeriodId} · ${BOX_CHARGE_STATUS_LABELS[c.status] || c.status}</span></div><div class="box-row-actions"><span class="box-pill">${boxMoney(c.totalPaid)} / ${boxMoney(c.expectedAmount)}</span><span class="box-pill">Saldo ${boxMoney(c.balance)}</span></div></div>`).join('') : boxEmpty('Sin cargos')}</div>`);
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
    .map((c) => `<option value="${c.id}">${boxState.members[c.memberId]?.fullName || c.memberId} · ${c.periodLabel || c.billingPeriodId} · saldo ${boxMoney(c.balance)}</option>`).join('');
  const payments = Object.values(boxState.payments).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-payments', `
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Pago en efectivo</div><div class="sl"></div></div>
        <div class="fg"><label class="fl">Cargo</label><select class="fi" id="bp_charge">${chargeOptions}</select></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Monto recibido</label><input class="fi" id="bp_amount" type="number" min="1"/></div>
          <div class="fg"><label class="fl">Metodo</label><input class="fi" value="Efectivo" disabled/></div>
        </div>
        <div class="fg"><label class="fl">Notas</label><input class="fi" id="bp_notes2"/></div>
        <button class="btn btn-g btn-full" onclick="createBoxPayment()">Registrar pago</button>
      </section>
      <section class="card">
        <div class="sh"><div class="st">Historial de pagos</div><div class="sl"></div></div>
        ${payments.length ? payments.map((p) => `<div class="box-row"><div><strong>${p.folio || p.id}</strong><span>${boxState.members[p.memberId]?.fullName || p.memberId} · ${boxMoney(p.paidAmount)} · efectivo</span><span>Recibio: ${p.receivedByName || p.receivedByUserId || '-'} · ${p.cashDeliveryStatus || '-'}</span></div><button class="btn btn-out btn-sm" onclick="sendBoxReceipt('${p.id}')">Comprobante</button></div>`).join('') : boxEmpty('Sin pagos')}</section>
    </div>`);
}

async function createBoxPayment() {
  const chargeId = document.getElementById('bp_charge')?.value;
  const paidAmount = Number(document.getElementById('bp_amount')?.value || 0);
  const notes = document.getElementById('bp_notes2')?.value.trim() || '';
  if (!chargeId || paidAmount <= 0) return showToast('Selecciona cargo y monto', 'ta');
  try {
    await boxCallable('boxCreatePayment', { chargeId, paidAmount, notes, idempotencyKey: `${chargeId}_${paidAmount}_${Date.now()}` });
    showToast('Pago registrado y pendiente de entrega', 'tg');
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
  const pending = Object.values(boxState.payments).filter((p) => p.cashDeliveryStatus === 'pending_delivery');
  const deliveries = Object.values(boxState.cashDeliveries).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-cash', `
    <div class="card">
      <div class="sh"><div class="st">Preparar entrega</div><div class="sl"></div></div>
      ${pending.length ? pending.map((p) => `<label class="box-check"><input type="checkbox" data-cash-payment="${p.id}"/> ${p.folio || p.id} · ${boxState.members[p.memberId]?.fullName || p.memberId} · ${boxMoney(p.paidAmount)} · recibio ${p.receivedByName || '-'}</label>`).join('') : boxEmpty('Sin pagos pendientes')}
      <button class="btn btn-g btn-full" onclick="prepareBoxCashDelivery()">Preparar entrega seleccionada</button>
    </div>
    <div class="card">
      <div class="sh"><div class="st">Entregas</div><div class="sl"></div></div>
      ${deliveries.length ? deliveries.map((d) => `<div class="box-row"><div><strong>${d.folio || d.id}</strong><span>${d.status} · esperado ${boxMoney(d.expectedAmount)} · entregado ${boxMoney(d.deliveredAmount)}</span><span>Diferencia ${boxMoney(d.differenceAmount)}</span></div><div class="box-row-actions">${d.status !== 'confirmed' ? `<input class="fi box-small-input" id="cash_${d.id}" type="number" value="${Number(d.expectedAmount || 0)}"/><button class="btn btn-g btn-sm" onclick="confirmBoxCashDelivery('${d.id}')">Confirmar</button>` : '<span class="box-pill">Confirmada</span>'}</div></div>`).join('') : boxEmpty('Sin entregas')}
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
    <div class="box-grid box-grid-2">
      <section class="card">
        <div class="sh"><div class="st">Registrar gasto</div><div class="sl"></div></div>
        <div class="form-2">
          <div class="fg"><label class="fl">Concepto</label><input class="fi" id="be_concept"/></div>
          <div class="fg"><label class="fl">Categoria</label><select class="fi" id="be_category">${(cfg.expenseCategories || []).map((c) => `<option value="${c}">${c}</option>`).join('')}</select></div>
          <div class="fg"><label class="fl">Monto</label><input class="fi" id="be_amount" type="number" min="0"/></div>
          <div class="fg"><label class="fl">Fecha</label><input class="fi" id="be_date" type="date" value="${boxNowISO()}"/></div>
        </div>
        <div class="fg"><label class="fl">Descripcion</label><textarea class="fi" id="be_desc"></textarea></div>
        <button class="btn btn-g btn-full" onclick="saveBoxExpense()">Guardar gasto</button>
      </section>
      <section class="card"><div class="sh"><div class="st">Gastos</div><div class="sl"></div></div>${expenses.length ? expenses.map((e) => `<div class="box-row"><div><strong>${e.folio || e.concept}</strong><span>${e.category} · ${boxMoney(e.amount)} · ${e.status}</span><span>${e.description || ''}</span></div></div>`).join('') : boxEmpty('Sin gastos')}</section>
    </div>`);
}

async function saveBoxExpense() {
  const concept = document.getElementById('be_concept')?.value.trim();
  const amount = Number(document.getElementById('be_amount')?.value || 0);
  if (!concept || amount <= 0) return showToast('Concepto y monto requeridos', 'ta');
  const payload = {
    businessId: BOX_LOMBARDO_BUSINESS_ID,
    folio: `BOX-GAS-${Date.now()}`,
    concept,
    category: document.getElementById('be_category')?.value || 'Otros',
    amount,
    date: document.getElementById('be_date')?.value || boxNowISO(),
    spentByUserId: currentUser?.uid || '',
    registeredByUserId: currentUser?.uid || '',
    paymentMethod: 'cash',
    description: document.getElementById('be_desc')?.value.trim() || '',
    status: canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) ? 'authorized' : 'requested',
    createdAt: boxServerTimestamp()
  };
  const ref = await boxPath('expenses').add(payload);
  await boxAudit('expense_created', 'expense', ref.id, null, payload);
  showToast('Gasto guardado', 'tg');
}

function renderBoxReports() {
  const s = boxStats();
  boxSetPage('box-reports', `<div class="card"><div class="sh"><div class="st">Cortes y reportes</div><div class="sl"></div></div>
    <div class="box-report-grid">
      <div><strong>Corte diario</strong><span>Ingresos ${boxMoney(s.income)} · Gastos ${boxMoney(s.expenseTotal)} · Neto ${boxMoney(s.net)}</span></div>
      <div><strong>Corte semanal</strong><span>Nuevos alumnos ${s.members.filter((m) => boxTs(m.createdAt) > Date.now() - 7 * 86400000).length} · Asistencias ${Object.keys(boxState.attendance).length}</span></div>
      <div><strong>Corte mensual</strong><span>Alumnos activos ${s.activeMembers.length} · Esperado ${boxMoney(s.expected)} · Confirmado ${boxMoney(s.confirmedCash.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0))}</span></div>
      <div><strong>Rango personalizado</strong><span>Filtra por fechas desde Firestore en la siguiente iteracion de reportes avanzados.</span></div>
    </div></div>`);
}

function renderBoxInconsistencies() {
  const saved = Object.values(boxState.inconsistencies);
  const generated = buildBoxAlerts().map((a, index) => ({ id: `generated_${index}`, title: a.label, detail: a.detail, severity: a.severity, status: 'pending' }));
  const items = [...saved, ...generated];
  boxSetPage('box-inconsistencies', `<div class="card"><div class="sh"><div class="st">Inconsistencias</div><div class="sl"></div></div>${items.length ? items.map((i) => `<div class="box-alert box-alert-${i.severity || 'info'}"><strong>${i.title || i.label}</strong><span>${i.detail || ''} · ${i.status || 'pendiente'}</span>${!String(i.id).startsWith('generated_') ? `<button class="btn btn-out btn-sm" onclick="resolveBoxInconsistency('${i.id}')">Resolver</button>` : ''}</div>`).join('') : boxEmpty('Sin inconsistencias')}</div>`);
}

async function resolveBoxInconsistency(id) {
  const comment = prompt('Comentario de resolucion');
  if (!comment) return;
  await boxPath('inconsistencies', id).set({ status: 'resolved', resolutionComment: comment, resolvedBy: currentUser?.uid || '', resolvedAt: boxServerTimestamp() }, { merge: true });
  await boxAudit('inconsistency_resolved', 'inconsistency', id, null, { comment });
}

function renderBoxReceipts() {
  const notifications = Object.values(boxState.notifications).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt));
  boxSetPage('box-receipts', `<div class="card"><div class="sh"><div class="st">Comprobantes WhatsApp</div><div class="sl"></div></div>${notifications.length ? notifications.map((n) => `<div class="box-row"><div><strong>${n.paymentId || n.id}</strong><span>${n.to || '-'} · ${n.status || '-'}</span><span>${n.error || ''}</span></div>${n.paymentId ? `<button class="btn btn-out btn-sm" onclick="sendBoxReceipt('${n.paymentId}')">Reenviar</button>` : ''}</div>`).join('') : boxEmpty('Sin comprobantes')}</div>`);
}

function renderBoxPermissions() {
  const users = Object.values(C.usuarios || {}).sort((a, b) => (a.nombre || a.email || '').localeCompare(b.nombre || b.email || ''));
  boxSetPage('box-permissions', `<div class="card"><div class="sh"><div class="st">Personal y permisos</div><div class="sl"></div></div>${users.length ? users.map((u) => {
    const role = u.businessRoles?.[BOX_LOMBARDO_BUSINESS_ID]?.role || '';
    return `<div class="box-row"><div><strong>${u.nombre || u.email}</strong><span>${u.email || ''} · rol box: ${role || 'sin acceso'}</span></div>${isOwner ? `<select class="fi box-role-select" id="role_${u.uid}"><option value="">Sin acceso</option><option value="owner" ${role === 'owner' ? 'selected' : ''}>Dueno</option><option value="box_admin" ${role === 'box_admin' ? 'selected' : ''}>Admin box</option><option value="trainer" ${role === 'trainer' ? 'selected' : ''}>Entrenador</option><option value="auditor" ${role === 'auditor' ? 'selected' : ''}>Auditor</option></select><button class="btn btn-g btn-sm" onclick="saveBoxUserRole('${u.uid}')">Guardar</button>` : ''}</div>`;
  }).join('') : boxEmpty('Sin usuarios')}</div>`);
}

async function saveBoxUserRole(uid) {
  if (!isOwner) return showToast('Solo propietario', 'tr');
  const role = document.getElementById(`role_${uid}`)?.value || null;
  const patch = {};
  patch[`businessRoles.${BOX_LOMBARDO_BUSINESS_ID}`] = role ? { role, assignedAt: boxServerTimestamp(), assignedBy: currentUser.uid } : firebase.firestore.FieldValue.delete();
  await fs.collection('usuarios').doc(uid).set(patch, { merge: true });
  await boxAudit('business_role_changed', 'user', uid, null, { role });
  showToast('Rol actualizado', 'tg');
}

function renderBoxAudit() {
  const logs = Object.values(boxState.auditLogs).sort((a, b) => boxTs(b.createdAt) - boxTs(a.createdAt)).slice(0, 80);
  boxSetPage('box-audit', `<div class="card"><div class="sh"><div class="st">Auditoria</div><div class="sl"></div></div>${logs.length ? logs.map((l) => `<div class="box-row"><div><strong>${l.action}</strong><span>${l.entityType} · ${l.entityId || '-'} · ${boxDateLabel(l.createdAt)}</span><span>${l.actorName || l.actorUserId || ''} ${l.reason ? '· ' + l.reason : ''}</span></div></div>`).join('') : boxEmpty('Sin auditoria')}</div>`);
}

function renderBoxSettings() {
  const cfg = boxBusinessConfig();
  boxSetPage('box-settings', `<div class="card"><div class="sh"><div class="st">Configuracion</div><div class="sl"></div></div>
    <div class="box-info-list">
      <div><strong>ID</strong><span>${cfg.id}</span></div>
      <div><strong>Tipo</strong><span>${cfg.type}</span></div>
      <div><strong>Mensualidad</strong><span>${boxMoney(cfg.monthlyFee)}</span></div>
      <div><strong>Metodo habilitado</strong><span>Efectivo</span></div>
      <div><strong>Clases de prueba</strong><span>${cfg.trialClassesAllowed}</span></div>
    </div>
    <button class="btn btn-g btn-full" onclick="boxSeedBusiness()">Crear/actualizar configuracion inicial segura</button>
  </div>`);
}

async function boxSeedBusiness() {
  try {
    await boxCallable('boxSeedBusiness', {});
    showToast('Configuracion inicial verificada', 'tg');
  } catch (error) {
    showToast(error.message || 'No se pudo inicializar', 'tr');
  }
}
