const BOX_LOMBARDO_BUSINESS_ID = 'box-lombardo-toledano';

const BUSINESS_CATALOG = {
  lombardo_toledano: {
    id: 'lombardo_toledano',
    name: 'TORNEO LOMBARDO TOLEDANO',
    type: 'tournament',
    status: 'active',
    logo: LOMBARDO_TOLEDANO_LOGO,
    splashSubtitle: 'LIBRE VARONIL Y FEMENIL',
    legacyTorneoId: 'lombardo_toledano'
  },
  nuevos_valores: {
    id: 'nuevos_valores',
    name: 'TORNEO NUEVOS VALORES',
    type: 'tournament',
    status: 'active',
    logo: NUEVOS_VALORES_LOGO,
    splashSubtitle: 'INFANTIL, OSOS Y JUVENIL',
    legacyTorneoId: 'nuevos_valores'
  },
  [BOX_LOMBARDO_BUSINESS_ID]: {
    id: BOX_LOMBARDO_BUSINESS_ID,
    name: 'Shark Boxing Gym',
    displayName: 'SHARK BOXING GYM',
    type: 'boxing_gym',
    status: 'active',
    logo: SHARK_BOXING_GYM_LOGO,
    splashSubtitle: 'INFORMACION - ALUMNOS',
    monthlyFee: 400,
    currency: 'MXN',
    paymentMethodsEnabled: ['cash', 'transfer'],
    trialClassesAllowed: 1,
    contactWhatsApp: '6674585275',
    publicInfo: {
      description: 'Boxeo para todas las edades, enfocado en tecnica, acondicionamiento fisico, disciplina, confianza y constancia.',
      location: 'Unidad Deportiva Lombardo Toledano',
      schedule: 'Lunes a viernes de 5:00 pm a 8:00 pm',
      coaches: ['Orlando Requena'],
      requirements: [
        'Nombre completo del alumno y fecha de ingreso para el registro interno.',
        'Datos de contacto del tutor o responsable cuando el alumno sea menor de edad.',
        'Ropa deportiva comoda, tenis limpios, vendas o guantes cuando ya cuente con ellos.',
        'Botella de agua personal y disposicion para seguir indicaciones del entrenador.',
        'Avisar cualquier lesion, condicion medica o situacion que limite el entrenamiento.',
        'Cubrir la mensualidad vigente o acordar el seguimiento administrativo correspondiente.'
      ],
      rules: [
        'Llegar con puntualidad, saludar al entrenador y esperar indicaciones antes de iniciar.',
        'Mantener respeto hacia companeros, tutores, entrenador y personal del espacio deportivo.',
        'No realizar sparring, ejercicios de contacto o uso de equipo sin autorizacion del entrenador.',
        'Cuidar guantes, costales, cuerdas y material compartido; dejar el area ordenada al terminar.',
        'Entrenar con higiene, vendas limpias y sin objetos que puedan causar lesiones.',
        'Reportar molestias fisicas de inmediato y descansar cuando el entrenador lo indique.',
        'Los tutores deben mantenerse localizables y apoyar la asistencia constante del alumno.',
        'La clase busca formar disciplina y constancia; cualquier conflicto se resuelve hablando con respeto.'
      ],
      enrollmentStatus: 'Inscripciones abiertas'
    },
    publicStudents: [],
    expenseCategories: [
      'Equipo deportivo',
      'Guantes y material',
      'Mantenimiento',
      'Limpieza',
      'Reparaciones',
      'Publicidad',
      'Servicios',
      'Personal',
      'Eventos',
      'Otros'
    ]
  }
};

const BUSINESS_OPTION_ORDER = ['lombardo_toledano', 'nuevos_valores', BOX_LOMBARDO_BUSINESS_ID];
const TOURNAMENT_BUSINESS_IDS = BUSINESS_OPTION_ORDER.filter((id) => BUSINESS_CATALOG[id]?.type === 'tournament');

let currentBusinessId = localStorage.getItem('ld_business') || localStorage.getItem('ld_torneo') || 'lombardo_toledano';

function getBusinessConfig(id = currentBusinessId) {
  return BUSINESS_CATALOG[id] || BUSINESS_CATALOG.lombardo_toledano;
}

function isBoxBusiness(id = currentBusinessId) {
  return getBusinessConfig(id).type === 'boxing_gym';
}

function getBusinessDisplayName(id = currentBusinessId) {
  const business = getBusinessConfig(id);
  return business.displayName || business.name || id;
}

function getBusinessRole(businessId = currentBusinessId) {
  if (!currentUser) return null;
  if (isOwner) return 'superadmin';
  const userData = C?.usuarios?.[currentUser.uid] || {};
  const roleEntry = userData.businessRoles?.[businessId] || userData.businessAccess?.[businessId] || null;
  if (typeof roleEntry === 'string') return roleEntry;
  return roleEntry?.role || null;
}

function canAccessBusinessAdmin(businessId = currentBusinessId) {
  if (!isBoxBusiness(businessId)) return true;
  const role = getBusinessRole(businessId);
  return isOwner || ['superadmin', 'owner', 'box_admin', 'trainer', 'auditor'].includes(role);
}

function canManageBusinessMoney(businessId = currentBusinessId) {
  const role = getBusinessRole(businessId);
  return isOwner || ['superadmin', 'owner', 'box_admin'].includes(role);
}

function canWriteBusinessOperations(businessId = currentBusinessId) {
  const role = getBusinessRole(businessId);
  return isOwner || ['superadmin', 'owner', 'box_admin', 'trainer'].includes(role);
}

function isBusinessPage(pageKey = '') {
  return String(pageKey || '').startsWith('box-');
}

function canAccessBusinessPage(pageKey) {
  if (!isBusinessPage(pageKey)) return true;
  if (['box-public', 'box-public-students'].includes(pageKey)) return true;
  const role = getBusinessRole(BOX_LOMBARDO_BUSINESS_ID);
  const managerPages = [
    'box-dashboard', 'box-students', 'box-members', 'box-prospects',
    'box-attendance', 'box-attendance-history', 'box-attendance-trials', 'box-attendance-audits',
    'box-finance', 'box-upcoming', 'box-billing', 'box-payments', 'box-cash', 'box-expenses',
    'box-reports', 'box-report-debts', 'box-report-attendance', 'box-report-money',
    'box-report-workers', 'box-inconsistencies', 'box-receipts'
  ];
  const trainerPages = ['box-members', 'box-attendance', 'box-finance', 'box-upcoming'];
  const auditorPages = [
    'box-attendance', 'box-attendance-history', 'box-reports',
    'box-report-debts', 'box-report-attendance', 'box-report-money', 'box-inconsistencies'
  ];
  if (managerPages.includes(pageKey)) {
    return canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) ||
      (role === 'trainer' && trainerPages.includes(pageKey)) ||
      (role === 'auditor' && auditorPages.includes(pageKey));
  }
  if (pageKey === 'box-audit') {
    return canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID);
  }
  return false;
}

function renderSplashBusinessCard(business) {
  const target = business.type === 'tournament' ? `selectBusiness('${business.id}')` : `selectBusiness('${business.id}')`;
  const logo = business.logo || CD_LOGO_SHIELD;
  const title = business.displayName || business.name;
  const typeClass = business.type === 'tournament' ? 'cd-business-card--tournament' : 'cd-business-card--boxing';
  return `
    <button type="button" onclick="${target}" class="cd-business-card ${typeClass}" data-business-id="${business.id}" aria-label="Entrar a ${title}">
      <span class="cd-business-card__logo"><img src="${logo}" alt="${title}"/></span>
      <span class="cd-business-card__copy">
        <span class="cd-business-card__title">${title}</span>
        <span class="cd-business-card__sub">${business.splashSubtitle || business.type}</span>
      </span>
      <span class="cd-business-card__arrow" aria-hidden="true">&#8250;</span>
    </button>`;
}

function hydrateBusinessSplashCards() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const label = Array.from(splash.querySelectorAll('div')).find((el) => (el.textContent || '').includes('ELIGE TU TORNEO'));
  if (label) label.textContent = 'ELIGE TU ESPACIO';
  const container = splash.querySelector('[data-business-options]');
  if (!container) return;
  container.setAttribute('data-business-options', '1');
  container.innerHTML = BUSINESS_OPTION_ORDER
    .map((id) => BUSINESS_CATALOG[id])
    .filter((business) => business && business.status === 'active')
    .map(renderSplashBusinessCard)
    .join('');
}

function selectBusiness(id) {
  const business = getBusinessConfig(id);
  currentBusinessId = business.id;
  localStorage.setItem('ld_business', currentBusinessId);

  if (business.type === 'tournament') {
    localStorage.setItem('ld_torneo', business.legacyTorneoId || business.id);
    selectTorneo(business.legacyTorneoId || business.id);
    return;
  }

  if (typeof selectBoxBusiness === 'function') {
    selectBoxBusiness(business.id);
  }
}
