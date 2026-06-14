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
    name: 'Box Lombardo Toledano',
    displayName: 'BOX LOMBARDO TOLEDANO',
    type: 'boxing_gym',
    status: 'active',
    logo: CD_LOGO_SHIELD,
    splashSubtitle: 'BOX · ALUMNOS · MENSUALIDADES',
    monthlyFee: 400,
    currency: 'MXN',
    timezone: 'America/Mazatlan',
    paymentMethodsEnabled: ['cash'],
    trialClassesAllowed: 1,
    contactWhatsApp: '',
    publicInfo: {
      description: 'Escuela de box para alumnos infantiles y juveniles, con control de asistencia, mensualidades y seguimiento de tutores.',
      location: 'Lombardo Toledano',
      schedule: 'Lunes a viernes · horarios por grupo',
      coaches: ['Entrenador por asignar'],
      requirements: ['Guantes o vendas', 'Ropa deportiva', 'Tutor responsable para menores'],
      rules: ['Respeto al entrenador y companeros', 'Llegar a tiempo', 'No entrenar sin autorizacion si hay lesion'],
      enrollmentStatus: 'Inscripciones abiertas'
    },
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
  if (pageKey === 'box-public') return true;
  if (pageKey === 'box-dashboard') return canAccessBusinessAdmin(BOX_LOMBARDO_BUSINESS_ID);
  if (['box-attendance', 'box-members', 'box-groups', 'box-trials', 'box-payments', 'box-cash'].includes(pageKey)) {
    return canWriteBusinessOperations(BOX_LOMBARDO_BUSINESS_ID) || getBusinessRole(BOX_LOMBARDO_BUSINESS_ID) === 'auditor';
  }
  return canManageBusinessMoney(BOX_LOMBARDO_BUSINESS_ID) || getBusinessRole(BOX_LOMBARDO_BUSINESS_ID) === 'auditor';
}

function renderSplashBusinessCard(business) {
  const target = business.type === 'tournament' ? `selectBusiness('${business.id}')` : `selectBusiness('${business.id}')`;
  const logo = business.logo || CD_LOGO_SHIELD;
  const title = business.displayName || business.name;
  return `
    <div onclick="${target}" class="business-splash-card" data-business-id="${business.id}">
      <div class="business-splash-logo"><img src="${logo}" alt="${title}"/></div>
      <div class="business-splash-copy">
        <div class="business-splash-title">${title}</div>
        <div class="business-splash-sub">${business.splashSubtitle || business.type}</div>
      </div>
      <div class="business-splash-arrow">&#8250;</div>
    </div>`;
}

function hydrateBusinessSplashCards() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const label = Array.from(splash.querySelectorAll('div')).find((el) => (el.textContent || '').includes('ELIGE TU TORNEO'));
  if (label) label.textContent = 'ELIGE TU ESPACIO';
  const container = splash.querySelector('[data-business-options]') || Array.from(splash.querySelectorAll('div'))
    .find((el) => el.children?.length >= 2 && Array.from(el.children).some((child) => child.getAttribute?.('onclick')?.includes('selectTorneo')));
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
