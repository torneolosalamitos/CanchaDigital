const CUP_PHASE = 'copa';

function isCupMatch(partido = {}) {
  return partido.competitionPhase === CUP_PHASE || partido.esCopa === true;
}

function getSeasonCupPlan(season, cat = currentCat) {
  const scopedPlan = season?.cupPlans?.[cat];
  if (scopedPlan && Array.isArray(scopedPlan.rounds)) return scopedPlan;
  return season?.cupPlan && Array.isArray(season.cupPlan.rounds) && (!season.cat || season.cat === cat) ? season.cupPlan : null;
}

function getCupFormatForCategory(cat, teamCount, torneo = currentTorneo) {
  const configured = typeof getCompetitionFormat === 'function'
    ? getCompetitionFormat(cat, torneo)
    : { cupFormat: 'automatic_elimination', qualifiedTeams: 0 };
  if (configured.cupFormat === 'top4_semifinals' && teamCount >= 4) {
    return {
      key: 'top4_semifinals',
      label: 'Top 4 · semifinales · gran final',
      seeds: Math.min(teamCount, configured.qualifiedTeams || 4),
      rounds: [
        { key: 'semifinal', label: 'Semifinales', pairs: [[1, 4], [2, 3]] },
        { key: 'final', label: 'Gran final', fromPrevious: true }
      ]
    };
  }

  const qualified = Math.min(Math.max(teamCount, 2), 16);
  const bracketSize = qualified > 8 ? 16 : qualified > 4 ? 8 : qualified > 2 ? 4 : 2;
  const firstLabel = bracketSize === 16 ? 'Octavos de final' : bracketSize === 8 ? 'Cuartos de final' : bracketSize === 4 ? 'Semifinales' : 'Gran final';
  const rounds = [];
  let size = bracketSize;
  while (size >= 2) {
    rounds.push({
      key: size === 2 ? 'final' : size === 4 ? 'semifinal' : size === 8 ? 'cuartos' : 'octavos',
      label: size === 2 ? 'Gran final' : size === 4 ? 'Semifinales' : size === 8 ? 'Cuartos de final' : 'Octavos de final',
      fromPrevious: rounds.length > 0
    });
    size /= 2;
  }
  rounds[0].label = firstLabel;
  return { key: `eliminacion_${bracketSize}`, label: `${firstLabel} · eliminación directa`, seeds: qualified, bracketSize, rounds };
}

function cupSourceSeed(seed) {
  return { type: 'seed', seed: Number(seed) };
}

function cupSourceWinner(matchId) {
  return { type: 'winner', matchId };
}

function buildGenericFirstRoundPairs(bracketSize) {
  const pairs = [];
  for (let index = 0; index < bracketSize / 2; index += 1) {
    pairs.push([index + 1, bracketSize - index]);
  }
  return pairs;
}

function buildCupPlanFromTable(tableData, cat) {
  const format = getCupFormatForCategory(cat, tableData.length, currentTorneo);
  const seeds = tableData.slice(0, format.seeds).map((team, index) => {
    const registered = getEqs().find((equipo) => equipo.torneo === currentTorneo && equipo.cat === cat && equipo.nombre === team.nombre);
    return {
    seed: index + 1,
    equipoId: registered?._key || team._key || team.equipoId || '',
    nombre: team.nombre,
    logo: team.logo || null
    };
  });
  const rounds = [];

  format.rounds.forEach((roundDef, roundIndex) => {
    let sources = [];
    if (Array.isArray(roundDef.pairs)) {
      sources = roundDef.pairs.map(([a, b]) => [
        typeof a === 'number' ? cupSourceSeed(a) : cupSourceWinner(rounds[roundIndex - 1].matches[Number(String(a).replace('W', '')) - 1].id),
        typeof b === 'number' ? cupSourceSeed(b) : cupSourceWinner(rounds[roundIndex - 1].matches[Number(String(b).replace('W', '')) - 1].id)
      ]);
    } else if (roundIndex === 0) {
      sources = buildGenericFirstRoundPairs(format.bracketSize || 2).map(([a, b]) => [cupSourceSeed(a), cupSourceSeed(b)]);
    } else {
      const previous = rounds[roundIndex - 1].matches;
      for (let index = 0; index < previous.length; index += 2) {
        sources.push([cupSourceWinner(previous[index].id), cupSourceWinner(previous[index + 1].id)]);
      }
    }
    rounds.push({
      key: roundDef.key,
      label: roundDef.label,
      order: roundIndex,
      matches: sources.map((pair, matchIndex) => ({
        id: `${roundDef.key}_${matchIndex + 1}`,
        order: matchIndex,
        sourceA: pair[0],
        sourceB: pair[1],
        partidoId: null,
        autoWinnerEquipoId: null
      }))
    });
  });

  return {
    version: 1,
    status: 'in_progress',
    formatKey: format.key,
    formatLabel: format.label,
    createdAtMs: Date.now(),
    seeds,
    rounds
  };
}

function findCupPlanMatch(plan, matchId) {
  return plan?.rounds?.flatMap((round) => round.matches || []).find((match) => match.id === matchId) || null;
}

function getCupTeamById(plan, equipoId) {
  return plan?.seeds?.find((team) => team.equipoId === equipoId) || null;
}

function getCupMatchWinnerId(planMatch) {
  if (!planMatch) return '';
  if (planMatch.autoWinnerEquipoId) return planMatch.autoWinnerEquipoId;
  const partido = planMatch.partidoId ? C.partidos?.[planMatch.partidoId] : null;
  if (!partido || partido.status !== 'terminado') return '';
  const localGoals = Number(partido.gL || 0);
  const visitorGoals = Number(partido.gV || 0);
  if (localGoals === visitorGoals) return '';
  return localGoals > visitorGoals ? partido.local : partido.visita;
}

function resolveCupSource(plan, source) {
  if (!source) return null;
  if (source.type === 'seed') return plan.seeds.find((team) => team.seed === source.seed) || null;
  if (source.type === 'winner') {
    const sourceMatch = findCupPlanMatch(plan, source.matchId);
    return getCupTeamById(plan, getCupMatchWinnerId(sourceMatch));
  }
  return null;
}

async function persistCupSeason(seasonKey, patch) {
  if (fs) await updateDoc('temporadas', seasonKey, patch);
  else await db.ref(`temporadas/${seasonKey}`).update(patch);
  if (C.temporadas?.[seasonKey]) Object.assign(C.temporadas[seasonKey], patch);
}

async function createCupPartido(season, round, planMatch, teamA, teamB) {
  const partidoId = newDocId('copa', `${season.seasonId || season._key}_${round.key}_${planMatch.order}_${Date.now()}`);
  const expected = Number(season.costos?.arbitrajeEquipo || 250);
  const data = {
    torneo: season.torneo,
    cat: season.cat,
    torneoId: firestoreTorneoId(season.torneo),
    categoriaId: firestoreCatId(season.cat),
    seasonId: season.seasonId || season._key,
    competitionPhase: CUP_PHASE,
    esCopa: true,
    cupStage: round.key,
    cupStageLabel: round.label,
    cupRoundIndex: round.order,
    cupMatchIndex: planMatch.order,
    cupPlanMatchId: planMatch.id,
    cupFormatKey: season.cupPlans?.[season.cat]?.formatKey || null,
    cupSeedLocal: teamA.seed || null,
    cupSeedVisitante: teamB.seed || null,
    local: teamA.equipoId,
    localNombre: teamA.nombre,
    visita: teamB.equipoId,
    visitaNombre: teamB.nombre,
    fecha: '',
    horaIni: '',
    horaFin: null,
    cancha: 'Por definir',
    arbId: null,
    arbitroNombre: null,
    gL: 0,
    gV: 0,
    status: 'pendiente',
    costArb: expected,
    goles: {},
    arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } },
    arbitrajes: {
      equipoLocal: { pagado: false, montoPagado: 0, montoEsperado: expected, montoPendiente: expected },
      equipoVisitante: { pagado: false, montoPagado: 0, montoEsperado: expected, montoPendiente: expected }
    },
    arbPagado: false,
    creadoAt: Date.now(),
    updatedAt: Date.now()
  };
  if (fs) await saveDoc('partidos', partidoId, data);
  else await db.ref(`partidos/${partidoId}`).set(data);
  C.partidos[partidoId] = data;
  return partidoId;
}

async function syncCupProgression(seasonKey, cat = currentCat) {
  const season = C.temporadas?.[seasonKey];
  const plan = getSeasonCupPlan(season, cat);
  if (!season || !plan || season.estado !== 'cup_active') return false;
  let changed = false;

  for (const round of plan.rounds) {
    for (const match of round.matches) {
      if (match.partidoId || match.autoWinnerEquipoId) continue;
      const teamA = resolveCupSource(plan, match.sourceA);
      const teamB = resolveCupSource(plan, match.sourceB);
      if (!teamA && !teamB) continue;
      if (!teamA || !teamB) {
        match.autoWinnerEquipoId = (teamA || teamB).equipoId;
        changed = true;
        continue;
      }
      match.partidoId = await createCupPartido({ ...season, cat, _key: seasonKey }, round, match, teamA, teamB);
      changed = true;
    }
  }

  const allMatches = plan.rounds.flatMap((round) => round.matches);
  const completed = allMatches.every((match) => !!getCupMatchWinnerId(match));
  if (completed) {
    plan.status = 'completed';
    plan.completedAtMs = Date.now();
    const finalMatch = allMatches[allMatches.length - 1];
    plan.championEquipoId = getCupMatchWinnerId(finalMatch);
    const finalPartido = finalMatch.partidoId ? C.partidos?.[finalMatch.partidoId] : null;
    plan.runnerUpEquipoId = finalPartido
      ? (finalPartido.local === plan.championEquipoId ? finalPartido.visita : finalPartido.local)
      : '';
    changed = true;
  }
  if (changed) await persistCupSeason(seasonKey, {
    cupPlans: { ...(season.cupPlans || {}), [cat]: plan },
    categoryStates: { ...(season.categoryStates || {}), [cat]: completed ? 'cup_completed' : 'cup_active' },
    ...(season.cat === cat && !season.cupPlan ? { cupPlan: plan } : {}),
    updatedAtMs: Date.now()
  });
  return changed;
}

async function syncCupProgressionForMatch(partidoKey, partidoData = {}) {
  if (!isCupMatch(partidoData)) return;
  const seasonEntry = Object.entries(C.temporadas || {}).find(([key, season]) =>
    (season.seasonId || key) === partidoData.seasonId && season.estado === 'cup_active'
  );
  if (!seasonEntry) return;
  C.partidos[partidoKey] = { ...(C.partidos[partidoKey] || {}), ...partidoData };
  await syncCupProgression(seasonEntry[0], partidoData.cat);
}

function getCurrentLifecycleSeason() {
  return getActiveSeason(currentTorneo, currentCat);
}

function isLeagueMatchLocked(partido = {}) {
  if (isCupMatch(partido)) return false;
  const season = Object.values(C.temporadas || {}).find((item) =>
    (item.seasonId || '') === partido.seasonId && ['active', 'cup_active'].includes(item.estado)
  );
  return !!getSeasonCupPlan(season, partido.cat || currentCat);
}

function cupMatchHasDependentPartido(partido = {}) {
  if (!isCupMatch(partido)) return false;
  const season = Object.values(C.temporadas || {}).find((item) => (item.seasonId || '') === partido.seasonId);
  const plan = getSeasonCupPlan(season, partido.cat || currentCat);
  const sourceMatch = plan?.rounds?.flatMap((round) => round.matches || []).find((match) => match.partidoId === partido._key || match.partidoId === activePartidoKey);
  if (!sourceMatch) return false;
  return plan.rounds.flatMap((round) => round.matches || []).some((match) =>
    [match.sourceA, match.sourceB].some((source) => source?.type === 'winner' && source.matchId === sourceMatch.id) && !!match.partidoId
  );
}

function canModifyCupResult(partido = {}) {
  if (!cupMatchHasDependentPartido(partido)) return true;
  showToast('El resultado está bloqueado porque la siguiente ronda ya fue creada', 'ta');
  return false;
}

function renderSeasonLifecyclePanel() {
  const root = document.getElementById('seasonLifecycleContent');
  if (!root) return;
  const season = getCurrentLifecycleSeason();
  if (!season) {
    root.innerHTML = '<div class="season-flow-empty"><strong>Sin temporada activa</strong><span>Crea una temporada antes de iniciar el cierre deportivo.</span></div>';
    return;
  }
  const plan = getSeasonCupPlan(season, currentCat);
  const cupEnabled = season.competition?.cupEnabled !== false;
  const table = buildTablaData();
  const completedCupMatches = plan?.rounds?.flatMap((round) => round.matches).filter((match) => !!getCupMatchWinnerId(match)).length || 0;
  const totalCupMatches = plan?.rounds?.flatMap((round) => round.matches).filter((match) => match.partidoId).length || 0;
  const phase = !plan ? 'Fase regular activa' : plan.status === 'completed' ? 'Copa terminada' : 'Copa en curso';
  root.innerHTML = `
    <div class="season-flow-status">
      <span class="season-flow-kicker">${escapeHtml(TORNEO_NAMES[currentTorneo] || currentTorneo)}</span>
      <h3>${escapeHtml(CAT_NAMES[currentCat] || currentCat)}</h3>
      <span class="season-flow-chip">${escapeHtml(phase)}</span>
    </div>
    <div class="season-flow-steps">
      <div class="season-flow-step is-done"><b>1</b><span><strong>Fase regular</strong><small>${table.length} equipos en tabla</small></span></div>
      <div class="season-flow-step ${season.estado === 'cup_active' ? 'is-active' : ''}"><b>2</b><span><strong>Copa</strong><small>${plan ? `${completedCupMatches} de ${totalCupMatches} partidos resueltos` : 'Se crea desde la tabla final'}</small></span></div>
      <div class="season-flow-step ${plan?.status === 'completed' ? 'is-active' : ''}"><b>3</b><span><strong>Historial</strong><small>Tabla, copa, goleadores y campeón</small></span></div>
    </div>
    ${!plan
      ? `<div class="season-flow-callout"><strong>Cerrar la fase regular</strong><span>La tabla quedará congelada y se crearán los primeros partidos de ${escapeHtml(getCupFormatForCategory(currentCat, table.length).label)}.</span></div>
         <button class="btn btn-g btn-full" onclick="${cupEnabled ? 'startCupFromLeague()' : 'closeLeagueWithoutCup()'}">${cupEnabled ? 'Cerrar liga e iniciar copa' : 'Cerrar liga y preparar historial'}</button>`
      : plan?.status === 'completed'
        ? `<div class="season-flow-callout is-success"><strong>Copa completada</strong><span>Ya puedes agregar la foto del campeón y enviar la temporada al historial.</span></div>
           <button class="btn btn-g btn-full" onclick="prepareSeasonArchiveFromCup()">Finalizar copa y archivar temporada</button>`
        : `<div class="season-flow-callout"><strong>${escapeHtml(plan?.formatLabel || 'Copa en curso')}</strong><span>Completa los partidos pendientes desde Últimos partidos. Los siguientes cruces aparecerán automáticamente.</span></div>
           <button class="btn btn-out btn-full" onclick="goToCupMatches()">Ver partidos de copa</button>`}
  `;
}

function goToCupMatches() {
  closeModal('modalSeasonLifecycle');
  const button = document.querySelector('.nav-tabs [onclick*="showPage(\'partidos\'"]');
  showPage('partidos', button);
}

function openSeasonLifecycle() {
  if (!isAdmin || !canAccessTorneo(currentTorneo) || !canAccessCat(currentCat, currentTorneo)) {
    showToast('No tienes permiso para cerrar esta categoría', 'tr');
    return;
  }
  renderSeasonLifecyclePanel();
  openModal('modalSeasonLifecycle');
}

async function startCupFromLeague() {
  const season = getCurrentLifecycleSeason();
  if (!season || !['active', 'cup_active'].includes(season.estado) || getSeasonCupPlan(season, currentCat)) return;
  const table = buildTablaData();
  const configuredFormat = typeof getCompetitionFormat === 'function'
    ? getCompetitionFormat(currentCat, currentTorneo)
    : { cupFormat: 'automatic_elimination', qualifiedTeams: 0 };
  if (configuredFormat.cupFormat === 'top4_semifinals' && table.length < 4) {
    showToast('El formato de Lombardo requiere cuatro equipos clasificados', 'ta');
    return;
  }
  if (table.length < 2) {
    showToast('Se necesitan al menos dos equipos en la tabla', 'ta');
    return;
  }
  const pendingLeague = filteredParts().filter((partido) => !isCupMatch(partido) && partido.status !== 'terminado');
  if (pendingLeague.length) {
    showToast(`Aún hay ${pendingLeague.length} partido(s) de fase regular sin terminar`, 'ta');
    return;
  }
  const format = getCupFormatForCategory(currentCat, table.length);
  if (!confirm(`La tabla general quedará congelada y comenzará ${format.label}. ¿Continuar?`)) return;
  const seasonKey = season._key || season.seasonId;
  const now = Date.now();
  const cupPlan = buildCupPlanFromTable(table, currentCat);
  const leagueSnapshot = typeof buildSeasonCategorySnapshot === 'function'
    ? buildSeasonCategorySnapshot(currentTorneo, currentCat)
    : { tablaFinal: table };
  await persistCupSeason(seasonKey, {
    estado: 'cup_active',
    leagueClosedAtMs: now,
    leagueSnapshot,
    leagueSnapshots: { ...(season.leagueSnapshots || {}), [currentCat]: leagueSnapshot },
    cupPlans: { ...(season.cupPlans || {}), [currentCat]: cupPlan },
    categoryStates: { ...(season.categoryStates || {}), [currentCat]: 'cup_active' },
    audit: [...(season.audit || []), { action: 'close_league_start_cup', at: now, uid: currentUser?.uid || '', email: currentUser?.email || '' }]
  });
  await syncCupProgression(seasonKey, currentCat);
  renderSeasonLifecyclePanel();
  renderTabla();
  renderPartidos();
  showToast('Fase regular cerrada. Partidos de copa creados', 'tg');
}

async function closeLeagueWithoutCup() {
  const season = getCurrentLifecycleSeason();
  if (!season || getSeasonCupPlan(season, currentCat)) return;
  const pendingLeague = filteredParts().filter((partido) => !isCupMatch(partido) && partido.status !== 'terminado');
  if (pendingLeague.length) {
    showToast(`Aún hay ${pendingLeague.length} partido(s) de fase regular sin terminar`, 'ta');
    return;
  }
  if (!confirm('La tabla quedará congelada y la categoría pasará al cierre histórico. ¿Continuar?')) return;
  const seasonKey = season._key || season.seasonId;
  const now = Date.now();
  const completedPlan = { version: 1, status: 'completed', formatKey: 'sin_copa', formatLabel: 'Sin fase de copa', seeds: [], rounds: [], createdAtMs: now, completedAtMs: now };
  await persistCupSeason(seasonKey, {
    estado: 'cup_active',
    leagueClosedAtMs: now,
    leagueSnapshot: buildSeasonCategorySnapshot(currentTorneo, currentCat),
    leagueSnapshots: { ...(season.leagueSnapshots || {}), [currentCat]: buildSeasonCategorySnapshot(currentTorneo, currentCat) },
    cupPlans: { ...(season.cupPlans || {}), [currentCat]: completedPlan },
    categoryStates: { ...(season.categoryStates || {}), [currentCat]: 'cup_completed' }
  });
  renderSeasonLifecyclePanel();
}

function prepareSeasonArchiveFromCup() {
  const season = getCurrentLifecycleSeason();
  const plan = getSeasonCupPlan(season, currentCat);
  if (!season || plan?.status !== 'completed') {
    showToast('Termina todos los partidos de copa antes de archivar', 'ta');
    return;
  }
  const champion = getCupTeamById(plan, plan.championEquipoId);
  const runnerUp = getCupTeamById(plan, plan.runnerUpEquipoId);
  closeModal('modalSeasonLifecycle');
  const name = document.getElementById('temp_nombre');
  const torneo = document.getElementById('temp_torneo');
  const championInput = document.getElementById('temp_campeon_copa');
  const runnerInput = document.getElementById('temp_subcampeon_copa');
  if (name) name.value = season.nombre || season.seasonName || `${TORNEO_NAMES[currentTorneo]} ${new Date().getFullYear()}`;
  if (torneo) torneo.value = currentTorneo;
  renderTempCategoryChecks();
  document.querySelectorAll('#temp_cat_checks input').forEach((input) => { input.checked = input.value === currentCat; input.disabled = input.value !== currentCat; });
  if (championInput) championInput.value = champion?.nombre || '';
  if (runnerInput) runnerInput.value = runnerUp?.nombre || '';
  document.getElementById('temp_confirm').value = '';
  document.getElementById('temp_champ_data').value = '';
  document.getElementById('temp_champ_file').value = '';
  renderSeasonCloseWarnings();
  openModal('modalGuardarTemporada');
}

async function prepareSeasonChampionImage(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    showToast('Usa una imagen JPG, PNG o WEBP', 'ta');
    return;
  }
  const image = new Image();
  const source = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = source;
    });
    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    if (dataUrl.length > 850000) {
      showToast('La foto sigue siendo demasiado pesada. Usa una imagen menor', 'ta');
      return;
    }
    document.getElementById('temp_champ_data').value = dataUrl;
    const preview = document.getElementById('temp_champ_preview');
    preview.style.display = '';
    preview.innerHTML = `<img src="${dataUrl}" alt="Vista previa del equipo campeón" class="season-photo-preview"/>`;
    showToast('Foto optimizada y lista', 'tg');
  } catch (error) {
    console.error(error);
    showToast('No se pudo procesar la foto', 'tr');
  } finally {
    URL.revokeObjectURL(source);
  }
}

function getCupHistorySnapshot(season, cat = currentCat) {
  const plan = getSeasonCupPlan(season, cat);
  if (!plan) return null;
  return {
    formatKey: plan.formatKey,
    formatLabel: plan.formatLabel,
    champion: getCupTeamById(plan, plan.championEquipoId),
    runnerUp: getCupTeamById(plan, plan.runnerUpEquipoId),
    rounds: plan.rounds.map((round) => ({
      key: round.key,
      label: round.label,
      matches: round.matches.map((match) => {
        const partido = match.partidoId ? C.partidos?.[match.partidoId] : null;
        return partido ? {
          partidoId: match.partidoId,
          local: partido.localNombre || partido.local,
          visita: partido.visitaNombre || partido.visita,
          gL: Number(partido.gL || 0),
          gV: Number(partido.gV || 0),
          fecha: partido.fecha || '',
          arbitroNombre: partido.arbitroNombre || ''
        } : null;
      }).filter(Boolean)
    }))
  };
}

function renderHistoricCup(cupSnapshot) {
  if (!cupSnapshot?.rounds?.length) return '';
  return `<section class="history-cup">
    <div class="history-section-title"><span>🏆</span><strong>Camino al campeonato</strong></div>
    <div class="history-cup-rounds">${cupSnapshot.rounds.map((round) => `
      <div class="history-cup-round">
        <span>${escapeHtml(round.label)}</span>
        ${(round.matches || []).map((match) => `<div class="history-cup-match">
          <div>${escapeHtml(match.local)} <b>${match.gL}</b></div>
          <small>${match.fecha ? fmtDate(match.fecha) : 'Resultado final'}</small>
          <div>${escapeHtml(match.visita)} <b>${match.gV}</b></div>
        </div>`).join('')}
      </div>`).join('')}</div>
  </section>`;
}
