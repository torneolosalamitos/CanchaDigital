const CD_LOGO = '/CanchaDigital/img/logo-cancha-shield.png';
const CD_LOGO_SHIELD = '/CanchaDigital/img/logo-cancha-shield.png';
const SPLASH_BIG_LOGO = '/CanchaDigital/img/logo-cancha-splash.png';
const LOMBARDO_TOLEDANO_LOGO = 'img/logo-lombardo-toledano.png';
const NUEVOS_VALORES_LOGO = 'img/logo-nuevos-valores.png';

const TORNEO_CONFIG = {
  lombardo_toledano: {
    name: 'TORNEO LOMBARDO TOLEDANO',
    logo: LOMBARDO_TOLEDANO_LOGO,
    splashSubtitle: 'LIBRE VARONIL Y FEMENIL',
    footerTag: 'Lombardo Toledano',
    primaryHashtag: '#TorneoLombardoToledano',
    categories: [
      { key: 'cat_libre_varonil', label: 'CATEGORIA LIBRE VARONIL' },
      { key: 'cat_libre_femenil', label: 'CATEGORIA LIBRE FEMENIL' }
    ]
  },
  nuevos_valores: {
    name: 'TORNEO NUEVOS VALORES',
    logo: NUEVOS_VALORES_LOGO,
    splashSubtitle: 'INFANTIL, OSOS Y JUVENIL',
    footerTag: 'Nuevos Valores',
    primaryHashtag: '#TorneoNuevosValores',
    categories: [
      { key: 'cat_infantil', label: 'CATEGORIA INFANTIL' },
      { key: 'cat_osos', label: 'CATEGORIA OSOS' },
      { key: 'cat_juvenil', label: 'CATEGORIA JUVENIL' }
    ]
  }
};

const TOURNAMENT_OPTION_ORDER = ['lombardo_toledano', 'nuevos_valores'];
const TOURNAMENT_SYSTEM_CAT_KEYS = new Set([
  'cat_libre_varonil',
  'cat_libre_femenil',
  'cat_infantil',
  'cat_osos',
  'cat_juvenil'
]);

const DEFAULT_TOURNAMENT_CATEGORY_LABELS = {
  cat_libre_varonil: 'CATEGORIA LIBRE VARONIL',
  cat_libre_femenil: 'CATEGORIA LIBRE FEMENIL',
  cat_infantil: 'CATEGORIA INFANTIL',
  cat_osos: 'CATEGORIA OSOS',
  cat_juvenil: 'CATEGORIA JUVENIL'
};

const DEFAULT_TOURNAMENT_CAT_ORDER = [
  'cat_libre_varonil',
  'cat_libre_femenil',
  'cat_infantil',
  'cat_osos',
  'cat_juvenil'
];

const TORNEO_NAMES = Object.fromEntries(
  Object.entries(TORNEO_CONFIG).map(([key, cfg]) => [key, cfg.name])
);

const TORNEO_LOGOS = Object.fromEntries(
  Object.entries(TORNEO_CONFIG).map(([key, cfg]) => [key, cfg.logo])
);

function getTournamentConfig(t = currentTorneo) {
  return TORNEO_CONFIG[t] || TORNEO_CONFIG.lombardo_toledano;
}

function getTournamentFooterTag(t = currentTorneo) {
  return getTournamentConfig(t).footerTag;
}

function getTournamentPrimaryHashtag(t = currentTorneo) {
  return getTournamentConfig(t).primaryHashtag;
}

function getTournamentHashtagLine(extraTags = []) {
  return [getTournamentPrimaryHashtag(), ...extraTags].filter(Boolean).join(' ');
}

function applyTournamentCatalogToCategoryMap(catMap) {
  Object.entries(DEFAULT_TOURNAMENT_CATEGORY_LABELS).forEach(([key, label]) => {
    catMap[key] = label;
  });

  return [...DEFAULT_TOURNAMENT_CAT_ORDER];
}

function hydrateSplashTournamentCards() {
  const container = document.querySelector('#splash [data-business-options]');
  const visibleOrder = [...TOURNAMENT_OPTION_ORDER];
  if (container) {
    container.innerHTML = TOURNAMENT_OPTION_ORDER
      .filter((key) => visibleOrder.includes(key))
      .map((key) => {
        const cfg = getTournamentConfig(key);
        return `<button type="button" onclick="selectTorneo('${key}')" class="cd-business-card cd-business-card--tournament" aria-label="Entrar a ${cfg.name}">
          <span class="cd-business-card__logo"><img src="${cfg.logo}" alt="${cfg.name}"/></span>
          <span class="cd-business-card__copy">
            <span class="cd-business-card__title">${cfg.name}</span>
            <span class="cd-business-card__sub">${cfg.splashSubtitle}</span>
          </span>
          <span class="cd-business-card__arrow" aria-hidden="true">&#8250;</span>
        </button>`;
      })
      .join('');
    return;
  }

  const cards = Array.from(document.querySelectorAll('#splash [onclick^="selectTorneo"]'));
  TOURNAMENT_OPTION_ORDER.forEach((key, idx) => {
    const card = cards[idx];
    if (!card) return;

    const cfg = getTournamentConfig(key);
    card.style.display = visibleOrder.includes(key) ? 'flex' : 'none';
    card.setAttribute('onclick', `selectTorneo('${key}')`);

    const logoEl = card.querySelector('img');
    if (logoEl) {
      logoEl.src = cfg.logo;
      logoEl.alt = cfg.name;
    }

    const copyWrap = logoEl?.closest('div')?.nextElementSibling;
    if (copyWrap) {
      const titleEl = copyWrap.children[0];
      const subEl = copyWrap.children[1];
      if (titleEl) titleEl.textContent = cfg.name;
      if (subEl) subEl.textContent = cfg.splashSubtitle;
    }
  });

  cards.slice(TOURNAMENT_OPTION_ORDER.length).forEach(card => card.remove());
}

function ensureSplashTournamentCardsReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateSplashTournamentCards, { once: true });
    return;
  }
  hydrateSplashTournamentCards();
}
