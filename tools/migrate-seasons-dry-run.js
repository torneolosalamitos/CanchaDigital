#!/usr/bin/env node
/*
 * CanchaDigital season migration helper.
 *
 * Default mode is dry-run. It reads current Firestore collections, groups active
 * football data by tournament/category, and reports the season documents that
 * would be created. It never deletes or mutates source collections.
 *
 * Usage:
 *   node tools/migrate-seasons-dry-run.js --dry-run
 *
 * Optional write mode is intentionally gated:
 *   node tools/migrate-seasons-dry-run.js --write --confirm-football-seasons
 */

const path = require('path');
const { createRequire } = require('module');

function loadFirebaseAdmin() {
  try {
    return require('firebase-admin');
  } catch (_rootError) {
    const functionsRequire = createRequire(path.join(__dirname, '..', 'functions', 'index.js'));
    return functionsRequire('firebase-admin');
  }
}

const admin = loadFirebaseAdmin();

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--write');
const writeEnabled = args.has('--write') && args.has('--confirm-football-seasons');

const TOURNAMENTS = {
  lombardo_toledano: {
    name: 'TORNEO LOMBARDO TOLEDANO',
    categories: ['cat_libre_varonil', 'cat_libre_femenil']
  },
  nuevos_valores: {
    name: 'TORNEO NUEVOS VALORES',
    categories: ['cat_infantil', 'cat_osos', 'cat_juvenil']
  }
};

const TORNEO_MAP = {
  torneo_lombardo_2026: 'lombardo_toledano',
  lombardo_toledano: 'lombardo_toledano',
  villa: 'lombardo_toledano',
  torneo_nuevos_valores_2026: 'nuevos_valores',
  nuevos_valores: 'nuevos_valores'
};

const CAT_MAP = {
  cat_libre_varonil_lombardo: 'cat_libre_varonil',
  cat_libre_varonil: 'cat_libre_varonil',
  liga_alta: 'cat_libre_varonil',
  liga_media: 'cat_libre_varonil',
  liga_baja_a: 'cat_libre_varonil',
  liga_baja_b: 'cat_libre_varonil',
  cat_libre_femenil_lombardo: 'cat_libre_femenil',
  cat_libre_femenil: 'cat_libre_femenil',
  cat_infantil: 'cat_infantil',
  cat_osos: 'cat_osos',
  cat_juvenil_a: 'cat_juvenil',
  cat_juvenil_b: 'cat_juvenil',
  cat_juvenil: 'cat_juvenil'
};

function appTorneoId(value) {
  return TORNEO_MAP[value] || value || 'lombardo_toledano';
}

function appCatId(value) {
  return CAT_MAP[value] || value || 'cat_libre_varonil';
}

function scoped(record = {}) {
  return {
    ...record,
    torneo: appTorneoId(record.torneo || record.torneoId),
    cat: appCatId(record.cat || record.categoriaId)
  };
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function readCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...scoped(doc.data() || {}) }));
}

function groupCounts(items) {
  const out = {};
  items.forEach((item) => {
    if (!TOURNAMENTS[item.torneo]) return;
    const key = `${item.torneo}/${item.cat}`;
    out[key] = (out[key] || 0) + 1;
  });
  return out;
}

async function main() {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  const [equipos, partidos, inscripciones, pagos] = await Promise.all([
    readCollection(db, 'equipos'),
    readCollection(db, 'partidos'),
    readCollection(db, 'inscripciones'),
    readCollection(db, 'pagos')
  ]);

  const year = new Date().getFullYear();
  const proposed = [];

  Object.entries(TOURNAMENTS).forEach(([torneo, cfg]) => {
    cfg.categories.forEach((cat) => {
      const seasonId = `season_${slugify(`${torneo}_${cat}_${year}`)}`;
      proposed.push({
        id: seasonId,
        torneo,
        cat,
        nombre: `${cfg.name} ${year}`,
        estado: 'active',
        counts: {
          equipos: equipos.filter((item) => item.torneo === torneo && item.cat === cat).length,
          partidos: partidos.filter((item) => item.torneo === torneo && item.cat === cat).length,
          inscripciones: inscripciones.filter((item) => item.torneo === torneo && item.cat === cat).length,
          pagos: pagos.filter((item) => item.torneo === torneo && item.cat === cat).length
        }
      });
    });
  });

  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'write',
    safe: dryRun || writeEnabled,
    totals: {
      equipos: equipos.length,
      partidos: partidos.length,
      inscripciones: inscripciones.length,
      pagos: pagos.length
    },
    grouped: {
      equipos: groupCounts(equipos),
      partidos: groupCounts(partidos),
      inscripciones: groupCounts(inscripciones),
      pagos: groupCounts(pagos)
    },
    proposedSeasonDocs: proposed
  }, null, 2));

  if (!writeEnabled) return;

  const batch = db.batch();
  proposed.forEach((season) => {
    const ref = db.collection('temporadas').doc(season.id);
    batch.set(ref, {
      nombre: season.nombre,
      seasonName: season.nombre,
      seasonId: season.id,
      anio: year,
      estado: season.estado,
      torneo: season.torneo,
      cat: season.cat,
      migration: {
        source: 'tools/migrate-seasons-dry-run.js',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        counts: season.counts
      }
    }, { merge: true });
  });
  await batch.commit();
  console.log(`Created/merged ${proposed.length} season docs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
