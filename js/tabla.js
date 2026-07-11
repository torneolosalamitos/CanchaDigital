// ══════════════════════════════════════
//  TABLA DE POSICIONES
// ══════════════════════════════════════
// ══ VUELTAS CONFIG ══
// 7 equipos, 6 jornadas por vuelta, 2 vueltas = 12 jornadas totales
const JORNADAS_POR_VUELTA = 6;
const TOTAL_VUELTAS = 2;

function buildTablaDataFromParts(partsArray){
  const teams = {};
  getEqs().filter(e=>e.torneo===currentTorneo&&e.cat===currentCat&&e.nombre).forEach(e=>{
    if(!teams[e.nombre]) teams[e.nombre]={nombre:e.nombre,logo:e.logo||null,pj:0,g:0,e:0,pe:0,gf:0,gc:0,pts:0,forma:[]};
  });
  partsArray.forEach(p=>{
    [p.localNombre||p.local, p.visitaNombre||p.visita].forEach(t=>{
      if(t && !teams[t]) teams[t]={nombre:t,logo:null,pj:0,g:0,e:0,pe:0,gf:0,gc:0,pts:0,forma:[]};
    });
    const ln=p.localNombre||p.local, vn=p.visitaNombre||p.visita;
    if(!ln||!vn)return;
    const tl=teams[ln],tv=teams[vn];
    const gL=p.gL||0,gV=p.gV||0;
    tl.pj++;tv.pj++;tl.gf+=gL;tl.gc+=gV;tv.gf+=gV;tv.gc+=gL;
    const eqL=getEqs().find(e=>e.nombre===ln&&e.torneo===currentTorneo&&e.cat===currentCat);
    const eqV=getEqs().find(e=>e.nombre===vn&&e.torneo===currentTorneo&&e.cat===currentCat);
    if(eqL?.logo) tl.logo=eqL.logo;
    if(eqV?.logo) tv.logo=eqV.logo;
    if(gL>gV){tl.g++;tl.pts+=3;tv.pe++;tl.forma.push('W');tv.forma.push('L');}
    else if(gL<gV){tv.g++;tv.pts+=3;tl.pe++;tv.forma.push('W');tl.forma.push('L');}
    else{tl.e++;tv.e++;tl.pts++;tv.pts++;tl.forma.push('D');tv.forma.push('D');}
  });
  return Object.values(teams).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf);
}

function buildTablaData(){ // general — todas las jornadas
  const activeSeason = getActiveSeason(currentTorneo, currentCat);
  const frozen = activeSeason?.leagueSnapshots?.[currentCat] || activeSeason?.leagueSnapshot;
  if (activeSeason?.estado === 'cup_active' && Array.isArray(frozen?.tablaFinal)) {
    return frozen.tablaFinal.map((team) => ({
      nombre: team.equipo || team.nombre || '',
      logo: team.escudo || team.logo || null,
      pj: Number(team.pj || 0),
      g: Number(team.g || 0),
      e: Number(team.e || 0),
      pe: Number(team.p ?? team.pe ?? 0),
      gf: Number(team.gf || 0),
      gc: Number(team.gc || 0),
      pts: Number(team.pts || 0),
      forma: Array.isArray(team.forma) ? team.forma.slice() : []
    }));
  }
  const parts = filteredParts().filter(p=>p.status==='terminado' && !(typeof isCupMatch === 'function' && isCupMatch(p)));
  return buildTablaDataFromParts(parts);
}

function buildTablaVuelta(vuelta){ // vuelta: 1 o 2
  // Una "vuelta" = JORNADAS_POR_VUELTA jornadas seguidas
  // Detectamos la jornada de cada partido por su campo jornada o posición cronológica
  const allParts = filteredParts().filter(p=>p.status==='terminado' && !(typeof isCupMatch === 'function' && isCupMatch(p)));
  // Ordenar por fecha, luego hora si hay
  const sorted = allParts.slice().sort((a,b)=>{
    const da=a.fecha||'', db=b.fecha||''; return da<db?-1:da>db?1:0;
  });
  const start = (vuelta-1)*JORNADAS_POR_VUELTA; // índice de jornada base-0
  const end   = vuelta*JORNADAS_POR_VUELTA;
  // Agrupamos partidos por jornada (campo jornada numérico, o por orden cronológico)
  // Si los partidos tienen campo "jornada" usarlo, si no, inferirlo por orden
  const jornadaOf = (p) => {
    if(p.jornada && !isNaN(parseInt(p.jornada))) return parseInt(p.jornada);
    return null;
  };
  let filtered;
  const hasJornadas = allParts.some(p=>jornadaOf(p)!==null);
  if(hasJornadas){
    filtered = allParts.filter(p=>{ const j=jornadaOf(p); return j!=null && j>=(start+1) && j<=end; });
  } else {
    // Sin campo jornada: inferir por orden cronológico agrupando por fecha
    // Cada jornada = un día de partidos
    const fechas = [...new Set(sorted.map(p=>p.fecha||'sin-fecha'))];
    const jorFechas = fechas.slice(start, end);
    filtered = sorted.filter(p=>jorFechas.includes(p.fecha||'sin-fecha'));
  }
  return buildTablaDataFromParts(filtered);
}

function getISODateFromLocal(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function getWeekRangeISO(referenceISO=todayISO()){
  const base = new Date(`${referenceISO}T12:00:00`);
  const mondayOffset = (base.getDay()+6)%7;
  const start = new Date(base);
  start.setDate(base.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start:getISODateFromLocal(start),
    end:getISODateFromLocal(end)
  };
}

function createCupSlot(team, seed=null, fallbackLabel='Por definirse', opts={}){
  const isBye = !!opts.isBye;
  const teamSeed = team?.seed || seed || null;
  const subtitle = team
    ? `${team.pts||0} pts · seed ${teamSeed}`
    : isBye
      ? `Seed ${seed || '—'} sin rival`
      : (opts.subtitle || 'Se define en la ronda previa');
  return {
    team: team || null,
    seed: teamSeed,
    displayName: team?.nombre || fallbackLabel,
    subtitle,
    isBye,
    isPlaceholder: !team && !isBye
  };
}

function buildCupProjectionDataTop4(dataOverride=null){
  // Formato Lombardo Toledano: clasifican cuatro equipos.
  // Semifinales 1° vs 4° y 2° vs 3°; los ganadores avanzan a la final.
  const tabla = Array.isArray(dataOverride) && dataOverride.length ? dataOverride.slice() : buildTablaData();
  if(tabla.length < 2) return null;
  const seededTeams = tabla.slice(0, Math.min(tabla.length, 4)).map((t,i)=>({...t, seed:i+1}));
  const s = (n) => seededTeams.find(t=>t.seed===n) || null;
  const activeSeason = getActiveSeason(currentTorneo, currentCat);
  const activePlan = typeof getSeasonCupPlan === 'function' ? getSeasonCupPlan(activeSeason, currentCat) : null;
  const winnerFromPlan = (matchId) => {
    if (!activePlan || typeof findCupPlanMatch !== 'function' || typeof getCupMatchWinnerId !== 'function') return null;
    const planMatch = findCupPlanMatch(activePlan, matchId);
    const winnerId = getCupMatchWinnerId(planMatch);
    const planTeam = activePlan.seeds?.find((team) => team.equipoId === winnerId);
    return planTeam ? { ...planTeam, seed: planTeam.seed, pts: s(planTeam.seed)?.pts || 0 } : null;
  };

  const sf1 = {
    id:'sf1',
    slotA: createCupSlot(s(1),1,s(1)?s(1).nombre:'1°',{subtitle:'Llega como líder'}),
    slotB: createCupSlot(s(4),4,s(4)?s(4).nombre:'4°',{subtitle:s(4)?'Va por la sorpresa':'4° Lugar'}),
    winner: winnerFromPlan('semifinal_1'),
    winnerLabel: 'Ganador SF1',
    note: `${s(1)?.nombre||'1°'} vs ${s(4)?.nombre||'4°'}`
  };
  const sf2 = {
    id:'sf2',
    slotA: createCupSlot(s(2),2,s(2)?s(2).nombre:'2°',{subtitle:'Quiere la gran final'}),
    slotB: createCupSlot(s(3),3,s(3)?s(3).nombre:'3°',{subtitle:s(3)?'Busca dar el golpe':'3° Lugar'}),
    winner: winnerFromPlan('semifinal_2'),
    winnerLabel: 'Ganador SF2',
    note: `${s(2)?.nombre||'2°'} vs ${s(3)?.nombre||'3°'}`
  };
  const rSemi = { name:'Semifinales', short:'SF', matches:[sf1, sf2] };

  const fin = {
    id:'final',
    slotA: createCupSlot(sf1.winner,sf1.winner?.seed||null,sf1.winnerLabel,{subtitle:'Ganador de Semifinal 1'}),
    slotB: createCupSlot(sf2.winner,sf2.winner?.seed||null,sf2.winnerLabel,{subtitle:'Ganador de Semifinal 2'}),
    winner: winnerFromPlan('final_1'),
    winnerLabel: 'Campeón',
    note: 'Gran Final'
  };
  const rFinal = { name:'Gran Final', short:'GF', matches:[fin] };

  return {
    bracketSize: 4,
    qualifiedTeams: seededTeams.length,
    hasByes: false,
    stageLabel: 'Semifinales',
    leader: seededTeams[0]||null,
    rounds: [rSemi, rFinal],
    seeds: seededTeams,
    eliminated: tabla.slice(4).map((t,i)=>({...t, seed:4+i+1})),
    isTop4Format: true,
    isFemenilFormat: currentCat === 'cat_libre_femenil'
  };
}

function buildAutomaticCupProjectionData(dataOverride=null) {
  const tabla = Array.isArray(dataOverride) && dataOverride.length ? dataOverride.slice() : buildTablaData();
  if (tabla.length < 2) return null;
  const format = getCupFormatForCategory(currentCat, tabla.length, currentTorneo);
  const seededTeams = tabla.slice(0, format.seeds).map((team, index) => ({ ...team, seed: index + 1 }));
  const roundSizes = [];
  let size = format.bracketSize || (seededTeams.length > 8 ? 16 : seededTeams.length > 4 ? 8 : seededTeams.length > 2 ? 4 : 2);
  while (size >= 2) {
    roundSizes.push(size);
    size /= 2;
  }
  const roundName = (roundSize) => roundSize === 16 ? 'Octavos de final' : roundSize === 8 ? 'Cuartos de final' : roundSize === 4 ? 'Semifinales' : 'Gran final';
  const rounds = roundSizes.map((roundSize, roundIndex) => ({
    name: roundName(roundSize),
    short: roundSize === 16 ? 'OF' : roundSize === 8 ? 'CF' : roundSize === 4 ? 'SF' : 'GF',
    matches: Array.from({ length: roundSize / 2 }, (_, matchIndex) => {
      const seedA = matchIndex + 1;
      const seedB = roundSize - matchIndex;
      const teamA = roundIndex === 0 ? seededTeams.find((team) => team.seed === seedA) : null;
      const teamB = roundIndex === 0 ? seededTeams.find((team) => team.seed === seedB) : null;
      return {
        id: `${roundIndex}_${matchIndex}`,
        slotA: createCupSlot(teamA, roundIndex === 0 ? seedA : null, roundIndex === 0 ? `${seedA}°` : 'Ganador ronda anterior'),
        slotB: createCupSlot(teamB, roundIndex === 0 ? seedB : null, roundIndex === 0 ? `${seedB}°` : 'Ganador ronda anterior'),
        winner: null,
        winnerLabel: 'Por definirse',
        note: roundName(roundSize)
      };
    })
  }));
  return {
    formatKey: format.key,
    bracketSize: roundSizes[0],
    qualifiedTeams: seededTeams.length,
    hasByes: seededTeams.length < roundSizes[0],
    stageLabel: rounds[0]?.name || 'Copa',
    leader: seededTeams[0] || null,
    rounds,
    seeds: seededTeams,
    eliminated: tabla.slice(format.seeds)
  };
}

function buildCupProjectionData(dataOverride=null){
  if(getCompetitionFormat(currentCat, currentTorneo).cupFormat === 'top4_semifinals') {
    return buildCupProjectionDataTop4(dataOverride);
  }
  return buildAutomaticCupProjectionData(dataOverride);
}
function renderBracketSlot(slot, adminMode=false){
  const logo = slot.team?.logo
    ? `<img class="bracket-logo" src="${escapeHtml(slot.team.logo)}" alt="${escapeHtml(slot.displayName)}"/>`
    : `<div class="bracket-logo-ph">${slot.isBye?'⬛':'⚽'}</div>`;
  const seedClass = slot.seed===1 ? 'bracket-seed seed-1' : 'bracket-seed';
  const slotClass = `bracket-slot${slot.isBye?' is-bye':''}${slot.isPlaceholder?' is-tbd':''}`;
  const seedLabel = slot.seed ? `#${slot.seed}` : '?';
  const adminSub = adminMode && slot.team
    ? `<div class="bracket-team-sub">${slot.team.pts||0}pts · ${slot.team.g||0}G ${slot.team.e||0}E ${slot.team.pe||0}P</div>`
    : '';
  return `<div class="${slotClass}">
    <div class="${seedClass}">${seedLabel}</div>
    ${logo}
    <div class="bracket-team-info">
      <div class="bracket-team-name">${escapeHtml(slot.displayName || 'Por definirse')}</div>
      ${adminSub}
    </div>
  </div>`;
}

function buildTop4FinalsHtml(cupData, adminMode=false){
  const feminine = !!cupData.isFemenilFormat;
  const championLabel = feminine ? 'CAMPEONAS' : 'CAMPEONES';
  const finalistLabel = feminine ? 'Ganadoras de semifinales' : 'Ganadores de semifinales';
  const semifinales = cupData.rounds[0]?.matches || [];
  const sf1 = semifinales[0] || null;
  const sf2 = semifinales[1] || null;
  const finalMatch = cupData.rounds[cupData.rounds.length - 1]?.matches[0] || null;
  const campeon = finalMatch?.winner || null;
  const f1 = finalMatch?.slotA || null;
  const f2 = finalMatch?.slotB || null;
  function slotCard(s, side){
    if(!s) return `<div class="gff-slot"><span class="gff-seed">?</span><div class="gff-logo-ph">⚽</div><div class="gff-name">Por definirse</div></div>`;
    const logo = s.team?.logo
      ? `<img class="gff-logo" src="${escapeHtml(s.team.logo)}" />`
      : `<div class="gff-logo-ph">${side===1?'🥇':'🥈'}</div>`;
    const seedCls = s.seed===1 ? 'gff-seed gff-seed-gold' : 'gff-seed gff-seed-silver';
    return `<div class="gff-slot${s.seed===1?' gff-slot-1':''}">
      <span class="${seedCls}">#${s.seed||'?'}</span>
      ${logo}
      <div class="gff-name">${escapeHtml(s.displayName||'Por definirse')}</div>
    </div>`;
  }

  function semiCard(match, title, note){
    return `<div class="gff-semi-card">
      <div class="gff-semi-top">
        <div class="gff-semi-title">${title}</div>
        <div class="gff-semi-note">${note}</div>
      </div>
      <div class="gff-semi-match">
        ${slotCard(match?.slotA||null, 1)}
        <div class="gff-vs-col"><div class="gff-vs">VS</div></div>
        ${slotCard(match?.slotB||null, 2)}
      </div>
    </div>`;
  }

  const campLogoHtml = campeon?.logo
    ? `<img src="${escapeHtml(campeon.logo)}" class="gff-camp-logo"/>`
    : `<div class="gff-camp-logo-ph">🏆</div>`;

  const winnerBadge = finalMatch?.winner
    ? `<span class="gff-winner-badge">✓ ${escapeHtml(finalMatch.winner.nombre)}</span>` : '';

  return `
  <div class="gff-wrap">
    <div class="gff-card">
      ${campeon ? `<div class="gff-trophy-zone">
        <div class="gff-camp-wrap">
          ${campLogoHtml}
          <div class="gff-camp-name">${escapeHtml(campeon.nombre)}</div>
          <div class="gff-camp-tag">${championLabel}</div>
        </div>
      </div>` : ''}
      <div class="gff-semifinals">
        ${semiCard(sf1, 'Semifinal 1', '1° vs 4°')}
        ${semiCard(sf2, 'Semifinal 2', '2° vs 3°')}
      </div>
      <div class="gff-grand-final">
        <div class="gff-grand-copy">
          <div class="gff-grand-kicker">Partido único</div>
          <div class="gff-grand-title">GRAN FINAL</div>
          <div class="gff-grand-sub">${finalistLabel}</div>
        </div>
        <div class="gff-grand-duel">
          ${slotCard(f1, 1)}
          <div class="gff-vs-col">
            <div class="gff-vs">VS</div>
            ${winnerBadge}
          </div>
          ${slotCard(f2, 2)}
        </div>
      </div>
      <div class="gff-footer">
        <div class="gff-footer-item"><span class="gff-footer-icon">⚽</span>Empate en eliminación = penales</div>
      </div>
    </div>
  </div>`;
}

function buildCupBracketHtml(cupData, opts={}){
  if(!cupData?.rounds?.length) return '';
  const adminMode = !!opts.adminMode;
  const shareMode = !!opts.shareMode;

  // Formato Top 4: semifinales 1° vs 4° y 2° vs 3°, seguido de gran final.
  if(cupData.isTop4Format){
    return buildTop4FinalsHtml(cupData, adminMode);
  }

  // Copa visual: si hay exactamente 3 rondas (8 equipos), usar layout estilo torneo
  // Izquierda: ronda 0 (mitad A) + ronda 1 mitad A, Centro: Final, Derecha: ronda 0 (mitad B) + ronda 1 mitad B
  const rounds = cupData.rounds;
  // Fallback: layout lineal (share mode o pocas rondas)
  const wrapClass = `bracket-board${shareMode?' bracket-board-share':''}`;
  return `<div class="${wrapClass}" style="${shareMode?`--cup-rounds:${cupData.rounds.length};`:''}">
    ${cupData.rounds.map((round)=>{
      return `<div class="bracket-round" style="min-width:160px;">
        <div class="bracket-round-hdr">
          <div class="bracket-round-name">${escapeHtml(round.name)}</div>
          <span class="bracket-round-sub">${round.matches.length} llave${round.matches.length===1?'':'s'}</span>
        </div>
        ${round.matches.map((match,mi)=>{
          const note = adminMode ? `<div style="padding:5px 10px 7px;font-size:9px;color:#64748b;font-weight:700;border-top:1px solid #edf2f7;">${escapeHtml(match.note||'')}</div>` : '';
          return `<div class="cup-match bracket-match">
            ${renderBracketSlot(match.slotA, adminMode)}
            <div class="bracket-vs-bar"><span class="bracket-vs-text">VS</span></div>
            ${renderBracketSlot(match.slotB, adminMode)}
            ${note}
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;
}


let currentVuelta = 'general';

function getTablaForVuelta(){
  if(currentVuelta === 'v1') return buildTablaVuelta(1);
  if(currentVuelta === 'v2') return buildTablaVuelta(2);
  return buildTablaData(); // general
}

function getVueltaLabel(){
  if(currentVuelta === 'v1') return 'Vuelta 1 (Jornadas 1–6)';
  if(currentVuelta === 'v2') return 'Vuelta 2 (Jornadas 7–12)';
  return null;
}

function renderTabla(){
  const body=document.getElementById('tablaBody'); if(!body)return;
  // Usar tabla filtrada por vuelta si corresponde
  const data = getTablaForVuelta ? getTablaForVuelta() : buildTablaData();
  // Banner de vuelta
  const vueltaBanner = document.getElementById('vueltaInfoBanner');
  const vueltaLabel = getVueltaLabel ? getVueltaLabel() : null;
  if(vueltaBanner){
    if(vueltaLabel){
      vueltaBanner.style.display='';
      vueltaBanner.innerHTML=`📅 Mostrando: <strong>${vueltaLabel}</strong> — ${data.length ? data[0].nombre+' lidera con '+data[0].pts+' pts' : 'Sin partidos registrados aún'}`;
    } else {
      vueltaBanner.style.display='none';
    }
  }
  const cupData=buildCupProjectionData(buildTablaData()); // copa siempre usa tabla general
  const fbBanner=document.getElementById('finalissimaBanner');
  const finalissimaSection=document.getElementById('finalissimaSection');
  if(fbBanner && cupData){
    // Si no es admin y la copa está oculta, esconder la sección
    if(!isAdmin && !isCuadroCopaPublic()){
      if(finalissimaSection) finalissimaSection.style.display = 'none';
      fbBanner.innerHTML='';
    } else {
      if(finalissimaSection) finalissimaSection.style.display = '';
      updateCuadroCopaUI();
      const adminCls = isAdmin ? ' bracket-admin' : '';
    const adminChipsHtml = isAdmin ? `
      <div class="bracket-chips">
        <span class="bracket-chip gold">${escapeHtml(cupData.leader?.nombre||'—')} #1</span>
        <span class="bracket-chip">${cupData.qualifiedTeams} equipos</span>
        <span class="bracket-chip">${escapeHtml(cupData.stageLabel)}</span>
        ${cupData.hasByes?'<span class="bracket-chip">BYE activos</span>':''}
      </div>` : `
      <div class="bracket-chips">
        <span class="bracket-chip">${cupData.qualifiedTeams} equipos</span>
        <span class="bracket-chip">${escapeHtml(cupData.stageLabel)}</span>
      </div>`;
    const isTop4 = !!cupData.isTop4Format;
    const copaHeaderHtml = isTop4 ? `
        <div class="bracket-header bracket-header-top4">
          <div>
            <div class="bracket-title">CAMINO AL CAMPEONATO</div>
            <div class="bracket-subtitle">Top 4 · Semifinales 1° vs 4° y 2° vs 3° · Gran final</div>
          </div>
          ${adminChipsHtml}
        </div>` : `
        <div class="bracket-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;">🏆</span>
            <div>
              <div class="bracket-title">CUADRO DE COPA</div>
              <div class="bracket-subtitle">${escapeHtml(cupData.stageLabel)} · Eliminación directa</div>
            </div>
          </div>
          ${adminChipsHtml}
        </div>`;
    fbBanner.innerHTML=`
      <div class="bracket-wrap${adminCls}">
        ${copaHeaderHtml}
        <div class="bracket-scroll">${buildCupBracketHtml(cupData,{adminMode:isAdmin})}</div>
      </div>`;
    } // end else (copa visible)
  } else if(fbBanner) {
    fbBanner.innerHTML='';
    if(finalissimaSection) finalissimaSection.style.display = 'none';
  }
  renderAdminFinalissimaPanel(data, cupData);

  if(!data.length){
    body.innerHTML='<tr><td colspan="11" class="tabla-empty">Sin equipos registrados en esta categoría</td></tr>';
    const mobElEmpty = document.getElementById('tablaBodyMobile');
    if(mobElEmpty){ mobElEmpty.style.display='none'; body.closest('table').style.display=''; }
    return;
  }

  const rows = data.map((t,i)=>{
    const pos=i+1;
    const cls=pos===1?'p1':'pr';
    const dg=(t.gf||0)-(t.gc||0);
    const dgCls=dg>0?'dp':dg<0?'dn':'dz';
    const fLbl={'W':'G','D':'E','L':'P'};
    const forma=(t.forma||[]).slice(-5).map(f=>`<div class="fp-${f.toLowerCase()}" title="${f==='W'?'Ganado':f==='L'?'Perdido':'Empate'}">${fLbl[f]||f}</div>`).join('');
    const logo=t.logo?`<img class="tc-logo" src="${t.logo}" alt="${escapeHtml(t.nombre)}"/>`:`<div class="tc-ph">⚽</div>`;
    const logoMob=t.logo?`<img class="tm-logo" src="${t.logo}" alt="${escapeHtml(t.nombre)}"/>`:`<div class="tm-ph">⚽</div>`;
    return {t, pos, cls, dg, dgCls, forma, logo, logoMob};
  });

  body.innerHTML=rows.map(({t,pos,cls,dg,dgCls,forma,logo})=>`<tr class="${pos===1?'pos-zone-champ':''}">
      <td><span class="pos-num ${cls}">${pos}</span></td>
      <td class="tal"><div class="tc">${logo}<div class="tc-copy"><span class="tc-name">${escapeHtml(t.nombre)}</span>${pos===1?'<span class="tc-tag champ">Líder</span>':''}</div></div></td>
      <td>${t.pj||0}</td><td>${t.g||0}</td><td>${t.e||0}</td><td>${t.pe||0}</td>
      <td>${t.gf||0}</td><td>${t.gc||0}</td>
      <td class="${dgCls}">${dg>0?'+':''}${dg}</td>
      <td class="pts-c">${t.pts||0}</td>
      <td><div class="fp">${forma}</div></td>
    </tr>`).join('');

  // Vista móvil en tarjetas
  const mobEl = document.getElementById('tablaBodyMobile');
  if(mobEl){
    const isMobile = window.innerWidth <= 640;
    mobEl.style.display = isMobile ? 'flex' : 'none';
    body.closest('table').style.display = isMobile ? 'none' : '';
    mobEl.innerHTML = rows.map(({t,pos,logoMob})=>{
      const isLeader = pos===1;
      const dg2=(t.gf||0)-(t.gc||0);
      return `<div class="tm-row${isLeader?' tm-leader':''}">
        <div class="tm-pos"><span class="tm-pos-num${isLeader?' gold':''}">${isLeader?'🥇':pos}</span></div>
        ${logoMob}
        <div class="tm-info">
          <div class="tm-name">${escapeHtml(t.nombre)}</div>
          <div class="tm-sub">
            <span>PJ <strong style="color:var(--text)">${t.pj||0}</strong></span>
            <span>G <strong style="color:#16a34a">${t.g||0}</strong></span>
            <span>E <strong style="color:#64748b">${t.e||0}</strong></span>
            <span>P <strong style="color:#dc2626">${t.pe||0}</strong></span>
            <span>DG <strong style="color:${dg2>0?'var(--acc)':dg2<0?'var(--red)':'var(--muted)'}">${dg2>0?'+':''}${dg2}</strong></span>
            ${isLeader?'<span class="tm-badge">⭐ Líder</span>':''}
          </div>
        </div>
        <div class="tm-pts">
          <div class="tm-pts-num">${t.pts||0}</div>
          <div class="tm-pts-lbl">pts</div>
        </div>
      </div>`;
    }).join('');
  }
  renderGoleadores();
}


// ══════════════════════════════════════
//  HISTORIAL DE TEMPORADAS
// ══════════════════════════════════════
const SEASON_STATES = ['draft', 'active', 'paused', 'finished', 'archived'];

function withSeasonScope(torneo, cat, fn) {
  const prevTorneo = currentTorneo;
  const prevCat = currentCat;
  currentTorneo = appTorneoId(torneo);
  currentCat = appCatId(cat);
  try {
    return fn();
  } finally {
    currentTorneo = prevTorneo;
    currentCat = prevCat;
  }
}

function detectStreamPlatform(url) {
  const value = String(url || '').toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'YouTube';
  if (value.includes('facebook.com') || value.includes('fb.watch')) return 'Facebook';
  if (value.includes('twitch.tv')) return 'Twitch';
  if (value.includes('instagram.com')) return 'Instagram';
  return value ? 'Otra plataforma' : '';
}

function sanitizeSeasonUrl(rawUrl, opts = {}) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (opts.image && !/\.(jpe?g|png|webp)(\?.*)?$/i.test(parsed.pathname + parsed.search)) return '';
    return parsed.href;
  } catch (_err) {
    return '';
  }
}

function getSeasonCategoryOptions(torneo = currentTorneo) {
  return (TORNEO_CONFIG[appTorneoId(torneo)]?.categories || []).map((cat) => ({
    key: cat.key,
    label: cat.label || CAT_NAMES[cat.key] || cat.key
  }));
}

function renderTempCategoryChecks() {
  const wrap = document.getElementById('temp_cat_checks');
  if (!wrap) return;
  const torneo = appTorneoId(document.getElementById('temp_torneo')?.value || currentTorneo);
  const options = getSeasonCategoryOptions(torneo);
  wrap.innerHTML = options.map((cat) => `
    <label class="resumen-cat-check">
      <input type="checkbox" value="${cat.key}" ${cat.key === currentCat ? 'checked' : ''} onchange="renderSeasonCloseWarnings()"/>
      <span>${escapeHtml(cat.label)}</span>
    </label>`).join('');
  renderSeasonCloseWarnings();
}

function getSelectedTempCats() {
  const checked = Array.from(document.querySelectorAll('#temp_cat_checks input:checked')).map((input) => appCatId(input.value));
  if (checked.length) return checked;
  return [currentCat];
}

function buildSeasonWarningsForCategory(torneo, cat, tableData, scorers) {
  const parts = getParts().filter((p) => p.torneo === torneo && p.cat === cat);
  const inscs = getInsc().filter((i) => i.torneo === torneo && i.cat === cat);
  const pendingMatches = parts.filter((p) => p.status !== 'terminado').length;
  const incompleteResults = parts.filter((p) => p.status === 'terminado' && (p.gL === undefined || p.gV === undefined)).length;
  const pendingInscriptions = inscs.filter((i) => Number(i.saldo || 0) > 0 || i.estado === 'pendiente').length;
  const pendingArbs = parts.reduce((acc, p) => {
    if (typeof getArbitrajeEstado !== 'function') return acc;
    return acc + (getArbitrajeEstado(p, 'local') === 'pagado' ? 0 : 1) + (getArbitrajeEstado(p, 'visitante') === 'pagado' ? 0 : 1);
  }, 0);
  const warnings = [];
  if (pendingMatches) warnings.push(`${pendingMatches} partido(s) pendientes`);
  if (incompleteResults) warnings.push(`${incompleteResults} resultado(s) incompletos`);
  if (pendingInscriptions) warnings.push(`${pendingInscriptions} inscripcion(es) con saldo/estado pendiente`);
  if (pendingArbs) warnings.push(`${pendingArbs} arbitraje(s) pendientes`);
  if (!tableData.length) warnings.push('Tabla general sin posiciones finales');
  if (!scorers.length) warnings.push('Goleadores sin datos finales');
  return warnings;
}

function buildSeasonCategorySnapshot(torneo, cat) {
  return withSeasonScope(torneo, cat, () => {
    const tableData = buildTablaData().map((t, index) => ({
      posicion: index + 1,
      equipo: t.nombre,
      escudo: t.logo || '',
      pj: Number(t.pj || 0),
      g: Number(t.g || 0),
      e: Number(t.e || 0),
      p: Number(t.pe || 0),
      gf: Number(t.gf || 0),
      gc: Number(t.gc || 0),
      dg: Number((t.gf || 0) - (t.gc || 0)),
      pts: Number(t.pts || 0),
      forma: Array.isArray(t.forma) ? t.forma.slice(-8) : [],
      desempate: 'Puntos, diferencia de goles, goles a favor'
    }));
    const scorers = getTopScorersData(50).map((g, index) => ({
      posicion: index + 1,
      jugador: g.jugador || '',
      equipo: g.equipo || '',
      foto: g.foto || '',
      goles: Number(g.goles || 0)
    }));
    const teams = getEqs()
      .filter((e) => e.torneo === torneo && e.cat === cat)
      .map((e) => ({
        id: e._key || '',
        nombre: e.nombre || '',
        escudo: e.logo || '',
        capitan: e.capitan || '',
        color: e.color || '',
        portero: e.portero || '',
        telefonoCapitan: e.telefonoCapitan || e.tel || '',
        plantillaFinal: Array.isArray(e.alineacion) ? e.alineacion.slice() : []
      }));
    const parts = getParts().filter((p) => p.torneo === torneo && p.cat === cat);
    const matches = parts.map((p) => ({
      id: p._key || '',
      fecha: p.fecha || '',
      horaIni: p.horaIni || '',
      cancha: p.cancha || '',
      local: p.localNombre || p.local || '',
      visitante: p.visitaNombre || p.visita || '',
      gL: Number(p.gL || 0),
      gV: Number(p.gV || 0),
      status: p.status || '',
      porDefault: !!p.porDefault
    }));
    const inscs = getInsc().filter((i) => i.torneo === torneo && i.cat === cat);
    const financialPrivate = {
      inscripcionesTotal: inscs.reduce((sum, i) => sum + Number(i.montoTotal || i.monto || 0), 0),
      inscripcionesPagado: inscs.reduce((sum, i) => sum + Number(i.montoPagado || 0), 0),
      inscripcionesPendiente: inscs.reduce((sum, i) => sum + Math.max(Number(i.saldo || 0), 0), 0),
      arbitrajesPendientes: parts.reduce((acc, p) => {
        if (typeof getArbitrajeEstado !== 'function') return acc;
        return acc + (getArbitrajeEstado(p, 'local') === 'pagado' ? 0 : 1) + (getArbitrajeEstado(p, 'visitante') === 'pagado' ? 0 : 1);
      }, 0)
    };
    return {
      cat,
      catNombre: CAT_NAMES[cat] || DEFAULT_TOURNAMENT_CATEGORY_LABELS[cat] || cat,
      equiposCount: teams.length,
      partidosCount: parts.length,
      tablaFinal: tableData,
      goleadoresFinal: scorers,
      equiposParticipantes: teams,
      partidosJugados: matches,
      financialPrivate,
      warnings: buildSeasonWarningsForCategory(torneo, cat, tableData, scorers)
    };
  });
}

function buildSeasonCloseDraft() {
  const torneo = appTorneoId(document.getElementById('temp_torneo')?.value || currentTorneo);
  const cats = getSelectedTempCats();
  const categoriasSnapshot = Object.fromEntries(cats.map((cat) => [cat, buildSeasonCategorySnapshot(torneo, cat)]));
  const allWarnings = Object.values(categoriasSnapshot).flatMap((snap) => snap.warnings.map((warning) => `${snap.catNombre}: ${warning}`));
  return { torneo, cats, categoriasSnapshot, warnings: allWarnings };
}

function renderSeasonCloseWarnings() {
  const box = document.getElementById('temp_warnings');
  if (!box) return;
  const draft = buildSeasonCloseDraft();
  if (!draft.warnings.length) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = '';
  box.innerHTML = `<div style="font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--amber);margin-bottom:7px">Advertencias antes de cerrar</div>
    <ul style="margin:0;padding-left:18px;font-size:12px;font-weight:700;line-height:1.7;color:var(--text2)">
      ${draft.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}
    </ul>`;
}

function previewSeasonChampionImage() {
  const wrap = document.getElementById('temp_champ_preview');
  const url = sanitizeSeasonUrl(document.getElementById('temp_champ_img')?.value, { image: true });
  if (!wrap) return;
  if (!url) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  wrap.style.display = '';
  wrap.innerHTML = `<img src="${escapeHtml(url)}" alt="Vista previa campeones" style="width:100%;max-height:220px;object-fit:cover;border-radius:14px;border:1px solid var(--border)"/>`;
}

function openFinalizarTemporada() {
  if (typeof openSeasonLifecycle === 'function') {
    openSeasonLifecycle();
    return;
  }
  if (!isAdmin) {
    showToast('Solo administradores pueden finalizar temporadas', 'tr');
    return;
  }
  const torneoInput = document.getElementById('temp_torneo');
  const yearInput = document.getElementById('temp_anio');
  const nameInput = document.getElementById('temp_nombre');
  if (torneoInput) torneoInput.value = currentTorneo;
  if (yearInput && !yearInput.value) yearInput.value = new Date().getFullYear();
  if (nameInput && !nameInput.value) nameInput.value = `${TORNEO_NAMES[currentTorneo] || 'Torneo'} ${new Date().getFullYear()}`;
  ['temp_confirm','temp_stream_url','temp_stream_label','temp_champ_img','temp_champ_caption','temp_champ_alt'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'temp_stream_label' ? 'Ver transmisión de la final' : '';
  });
  renderTempCategoryChecks();
  renderSeasonCloseWarnings();
  openModal('modalGuardarTemporada');
}

function renderNewSeasonCategoryChecks() {
  const wrap = document.getElementById('new_temp_cat_checks');
  if (!wrap) return;
  const torneo = appTorneoId(document.getElementById('new_temp_torneo')?.value || currentTorneo);
  wrap.innerHTML = getSeasonCategoryOptions(torneo).map((cat) => `
    <label class="resumen-cat-check">
      <input type="checkbox" value="${cat.key}" ${cat.key === currentCat ? 'checked' : ''}/>
      <span>${escapeHtml(cat.label)}</span>
    </label>`).join('');
}

function openCrearTemporada() {
  if (!isAdmin) {
    showToast('Solo administradores pueden crear temporadas', 'tr');
    return;
  }
  const torneoSel = document.getElementById('new_temp_torneo');
  if (torneoSel) {
    torneoSel.innerHTML = TOURNAMENT_OPTION_ORDER
      .filter((torneo) => canAccessTorneo(torneo))
      .map((torneo) => `<option value="${torneo}">${TORNEO_NAMES[torneo]}</option>`)
      .join('');
    torneoSel.value = currentTorneo;
  }
  const name = document.getElementById('new_temp_nombre');
  const start = document.getElementById('new_temp_inicio');
  const arb = document.getElementById('new_temp_arb');
  const confirmInput = document.getElementById('new_temp_confirm');
  if (name && !name.value) name.value = `${TORNEO_NAMES[currentTorneo] || 'Torneo'} ${new Date().getFullYear()}`;
  if (start && !start.value) start.value = todayISO();
  if (arb && !arb.value) arb.value = 250;
  if (confirmInput) confirmInput.value = '';
  renderNewSeasonCategoryChecks();
  openModal('modalCrearTemporada');
}

function getSelectedNewSeasonCats() {
  return Array.from(document.querySelectorAll('#new_temp_cat_checks input:checked')).map((input) => appCatId(input.value));
}

async function crearNuevaTemporada() {
  if (!isAdmin) {
    showToast('Solo administradores pueden crear temporadas', 'tr');
    return;
  }
  const confirmInput = document.getElementById('new_temp_confirm')?.value.trim().toUpperCase();
  if (confirmInput !== 'CREAR') {
    showToast('Escribe CREAR para confirmar', 'ta');
    return;
  }
  const torneo = appTorneoId(document.getElementById('new_temp_torneo')?.value || currentTorneo);
  const cats = getSelectedNewSeasonCats();
  if (!cats.length) {
    showToast('Selecciona al menos una categoría', 'ta');
    return;
  }
  if (!isOwner && (!canAccessTorneo(torneo) || cats.some((cat) => !canAccessCat(cat, torneo)))) {
    showToast('No tienes permiso para una o más categorías', 'tr');
    return;
  }
  const activeConflicts = cats
    .map((cat) => getActiveSeason(torneo, cat))
    .filter(Boolean);
  if (activeConflicts.length) {
    const names = [...new Set(activeConflicts.map((season) => season.nombre || season.seasonName || 'Temporada activa'))].join(', ');
    showToast(`Finaliza primero la temporada activa: ${names}`, 'ta');
    return;
  }
  const nombre = document.getElementById('new_temp_nombre')?.value.trim();
  if (!nombre) {
    showToast('Ingresa nombre de temporada', 'ta');
    return;
  }
  const now = Date.now();
  const seasonId = newDocId('season', `${torneo}_${nombre}_${now}`);
  const data = {
    seasonId,
    nombre,
    seasonName: nombre,
    torneo,
    cat: cats[0],
    torneoId: firestoreTorneoId(torneo),
    categoriaId: firestoreCatId(cats[0]),
    categorias: cats,
    estado: 'active',
    visibility: document.getElementById('new_temp_public')?.checked ? 'public' : 'private',
    fechaInicio: document.getElementById('new_temp_inicio')?.value || todayISO(),
    inicioMs: now,
    createdAtMs: now,
    costos: {
      inscripcion: Number(document.getElementById('new_temp_insc')?.value || 0),
      arbitrajeEquipo: Number(document.getElementById('new_temp_arb')?.value || 250)
    },
    competition: {
      cupEnabled: document.getElementById('new_temp_copa')?.checked !== false,
      categoryFormats: Object.fromEntries(cats.map((cat) => [cat, getCompetitionFormat(cat, torneo)]))
    },
    equiposIniciales: 0,
    audit: [{
      action: 'create_season',
      at: now,
      uid: currentUser?.uid || '',
      email: currentUser?.email || ''
    }],
    ts: now
  };
  if (fs) await saveDoc('temporadas', seasonId, data);
  else await db.ref(`temporadas/${seasonId}`).set(data);
  C.temporadas[seasonId] = data;
  closeModal('modalCrearTemporada');
  currentTorneo = torneo;
  currentCat = cats[0];
  showToast('Temporada limpia creada. Ahora registra equipos nuevos o reutiliza históricos.', 'tg');
  renderHistorial();
  renderTabla();
  renderEquiposPage();
  renderPartidos();
  renderGoleadores();
}

function getHistoricTeamCandidates() {
  const activeId = getActiveSeasonId(document.getElementById('reuse_torneo')?.value || currentTorneo, document.getElementById('reuse_cat')?.value || currentCat);
  return getAllEqs()
    .filter((equipo) => !activeId || (equipo.seasonId || '') !== activeId)
    .filter((equipo) => equipo.nombre)
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

function openReutilizarEquipo() {
  if (!isAdmin) {
    showToast('Solo administradores pueden reutilizar equipos', 'tr');
    return;
  }
  const torneoSel = document.getElementById('reuse_torneo');
  const catSel = document.getElementById('reuse_cat');
  if (torneoSel) {
    torneoSel.innerHTML = TOURNAMENT_OPTION_ORDER
      .filter((torneo) => canAccessTorneo(torneo))
      .map((torneo) => `<option value="${torneo}">${TORNEO_NAMES[torneo]}</option>`)
      .join('');
    torneoSel.value = currentTorneo;
  }
  if (catSel) {
    catSel.innerHTML = getSeasonCategoryOptions(currentTorneo)
      .filter((cat) => canAccessCat(cat.key, currentTorneo))
      .map((cat) => `<option value="${cat.key}">${escapeHtml(cat.label)}</option>`)
      .join('');
    catSel.value = currentCat;
  }
  renderReuseEquipoOptions();
  openModal('modalReutilizarEquipo');
}

function renderReuseEquipoOptions() {
  const catSel = document.getElementById('reuse_cat');
  const torneo = appTorneoId(document.getElementById('reuse_torneo')?.value || currentTorneo);
  if (catSel) {
    const prev = catSel.value;
    catSel.innerHTML = getSeasonCategoryOptions(torneo)
      .filter((cat) => canAccessCat(cat.key, torneo))
      .map((cat) => `<option value="${cat.key}">${escapeHtml(cat.label)}</option>`)
      .join('');
    if (prev && Array.from(catSel.options).some((option) => option.value === prev)) catSel.value = prev;
  }
  const select = document.getElementById('reuse_equipo');
  if (!select) return;
  const candidates = getHistoricTeamCandidates();
  select.innerHTML = '<option value="">Selecciona equipo anterior</option>' +
    candidates.map((equipo) => `<option value="${equipo._key}">${escapeHtml(equipo.nombre)} · ${escapeHtml(TORNEO_NAMES[equipo.torneo] || equipo.torneo)} · ${escapeHtml(CAT_NAMES[equipo.cat] || equipo.cat)}</option>`).join('');
  renderReuseEquipoPreview();
}

function renderReuseEquipoPreview() {
  const wrap = document.getElementById('reuse_preview');
  const key = document.getElementById('reuse_equipo')?.value;
  const equipo = key ? C.equipos[key] : null;
  if (!wrap || !equipo) {
    if (wrap) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
    }
    return;
  }
  const normalized = normalizeScopedRecord({ ...equipo, _key: key });
  const appearances = getAllEqs().filter((e) => e.nombre === normalized.nombre).length;
  const historicParts = getAllParts().filter((p) => p.local === key || p.visita === key || p.localNombre === normalized.nombre || p.visitaNombre === normalized.nombre);
  wrap.style.display = '';
  wrap.innerHTML = `<div style="display:flex;gap:12px;align-items:center">
    ${normalized.logo ? `<img src="${escapeHtml(normalized.logo)}" class="logo-integrated" style="width:58px;height:58px;object-fit:contain"/>` : '<div class="eq-ph">⚽</div>'}
    <div>
      <div style="font-size:15px;font-weight:900;color:var(--text)">${escapeHtml(normalized.nombre)}</div>
      <div style="font-size:11px;font-weight:700;color:var(--muted)">${escapeHtml(TORNEO_NAMES[normalized.torneo] || normalized.torneo)} · ${escapeHtml(CAT_NAMES[normalized.cat] || normalized.cat)}</div>
      <div style="font-size:11px;font-weight:700;color:var(--muted)">Participaciones detectadas: ${appearances} · Partidos históricos: ${historicParts.length}</div>
      <div style="font-size:11px;font-weight:700;color:var(--muted)">Plantilla: ${(normalized.alineacion || []).length} jugador(es)</div>
    </div>
  </div>`;
}

async function crearEquipoDesdeHistorial() {
  const sourceKey = document.getElementById('reuse_equipo')?.value;
  const source = sourceKey ? normalizeScopedRecord({ ...(C.equipos[sourceKey] || {}), _key: sourceKey }) : null;
  if (!source) {
    showToast('Selecciona un equipo histórico', 'ta');
    return;
  }
  const torneo = appTorneoId(document.getElementById('reuse_torneo')?.value || currentTorneo);
  const cat = appCatId(document.getElementById('reuse_cat')?.value || currentCat);
  const seasonId = getActiveSeasonId(torneo, cat);
  if (!seasonId) {
    showToast('Primero crea una temporada activa para esa categoría', 'ta');
    return;
  }
  if (!isOwner && (!canAccessTorneo(torneo) || !canAccessCat(cat, torneo))) {
    showToast('No tienes permiso para esa categoría', 'tr');
    return;
  }
  const copyNombre = document.getElementById('reuse_nombre')?.checked;
  const copyLogo = document.getElementById('reuse_logo')?.checked;
  const copyColor = document.getElementById('reuse_color')?.checked;
  const copyContacto = document.getElementById('reuse_contacto')?.checked;
  const copyPlantilla = document.getElementById('reuse_plantilla')?.checked;
  const nombre = copyNombre ? source.nombre : `${source.nombre || 'Equipo'} nuevo`;
  const equipoId = `equipo_${slugifyId(`${seasonId}_${cat}_${nombre}`)}`;
  const activeSeason = getActiveSeason(torneo, cat) || {};
  const precioInscripcion = Number(activeSeason.costos?.inscripcion || 0);
  const equipoData = {
    nombre,
    nombreNormalizado: String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\./g, '').trim(),
    torneo,
    cat,
    torneoId: firestoreTorneoId(torneo),
    categoriaId: firestoreCatId(cat),
    seasonId,
    logo: copyLogo ? (source.logo || null) : null,
    color: copyColor ? (source.color || '#1a3a8a') : '#1a3a8a',
    tel: copyContacto ? (source.tel || source.telefonoCapitan || '') : '',
    telefonoCapitan: copyContacto ? (source.telefonoCapitan || source.tel || '') : '',
    portero: copyPlantilla ? (source.portero || null) : null,
    alineacion: copyPlantilla && Array.isArray(source.alineacion) ? source.alineacion.slice() : [],
    reusedFromEquipoId: sourceKey,
    reusedFromSeasonId: source.seasonId || '',
    estado: 'activo',
    actualizadoEn: firestoreServerTimestamp()
  };
  const inscId = `inscripcion_${slugifyId(equipoId)}`;
  if (fs) {
    const batch = fs.batch();
    batch.set(fs.collection('equipos').doc(equipoId), { ...equipoData, creadoEn: firestoreServerTimestamp() }, { merge: true });
    batch.set(fs.collection('inscripciones').doc(inscId), {
      torneo,
      cat,
      torneoId: firestoreTorneoId(torneo),
      categoriaId: firestoreCatId(cat),
      seasonId,
      equipoId,
      equipoKey: equipoId,
      equipoNombre: nombre,
      nombre,
      logo: equipoData.logo,
      montoTotal: precioInscripcion,
      montoPagado: 0,
      saldo: precioInscripcion,
      estado: precioInscripcion > 0 ? 'pendiente' : 'sin_costo',
      origen: 'reutilizado',
      creadoEn: firestoreServerTimestamp(),
      actualizadoEn: firestoreServerTimestamp()
    }, { merge: true });
    await batch.commit();
  } else {
    await db.ref().update({
      [`equipos/${equipoId}`]: equipoData,
      [`inscripciones/${inscId}`]: {
        torneo, cat, seasonId, equipoId, equipoKey: equipoId, equipoNombre: nombre, nombre,
        montoTotal: precioInscripcion, montoPagado: 0, saldo: precioInscripcion,
        estado: precioInscripcion > 0 ? 'pendiente' : 'sin_costo', origen: 'reutilizado'
      }
    });
  }
  closeModal('modalReutilizarEquipo');
  showToast('Equipo reutilizado en temporada activa sin copiar estadísticas', 'tg');
  renderEquiposPage();
  renderTabla();
}

function getFinishedSeasonDocs() {
  return Object.entries(C.temporadas || {})
    .map(([k, v]) => ({ ...v, _key: k }))
    .filter((t) => ['finished', undefined, null, ''].includes(t.estado))
    .sort((a, b) => (b.finishedAtMs || b.ts || 0) - (a.finishedAtMs || a.ts || 0));
}

function getAllSeasonDocs() {
  return Object.entries(C.temporadas || {})
    .map(([k, v]) => ({ ...v, _key: k }))
    .sort((a, b) => (b.createdAtMs || b.finishedAtMs || b.ts || 0) - (a.createdAtMs || a.finishedAtMs || a.ts || 0));
}

function renderSeasonAdminStatePanel(torneo) {
  if (!isAdmin) return '';
  const seasons = getAllSeasonDocs().filter((t) => appTorneoId(t.torneo || t.torneoId) === appTorneoId(torneo));
  const active = seasons.filter((t) => t.estado === 'active');
  const archived = seasons.filter((t) => t.estado === 'archived');
  const line = (t, status) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border);border-radius:12px;padding:10px;margin-top:8px;background:rgba(255,255,255,.78)">
      <div>
        <div style="font-size:12px;font-weight:900;color:var(--text)">${escapeHtml(t.nombre || t.seasonName || 'Temporada')}</div>
        <div style="font-size:10px;font-weight:700;color:var(--muted)">${escapeHtml((t.categorias || [t.cat]).map((cat) => CAT_NAMES[cat] || cat).join(' · ') || 'Sin categorías')} · ${escapeHtml(status)}</div>
      </div>
      ${isOwner && t.estado === 'archived' ? `<button class="btn btn-out btn-sm" onclick="reabrirTemporada('${t._key}')">Reabrir</button>` : ''}
    </div>`;
  return `
    <div class="card card-g" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:var(--text)">Control de temporadas</div>
          <div style="font-size:10px;font-weight:800;color:var(--muted)">Activas: ${active.length} · Archivadas: ${archived.length}</div>
        </div>
        <span style="font-size:22px">🗂️</span>
      </div>
      ${active.length ? active.map((t) => line(t, 'activa')).join('') : '<div style="font-size:11px;color:var(--muted);font-weight:700;margin-top:10px">No hay temporada activa registrada para este torneo.</div>'}
      ${archived.length ? `<div style="font-size:10px;color:var(--muted);font-weight:900;margin-top:12px">ARCHIVADAS</div>${archived.map((t) => line(t, 'archivada')).join('')}` : ''}
    </div>`;
}

function renderHistorial(){
  // Show save button only for admins
  const saveBtn=document.getElementById('adminAddTemporada');
  if(saveBtn) saveBtn.style.display=isAdmin?'block':'none';

  const el=document.getElementById('historialList'); if(!el)return;
  const allTemps = getFinishedSeasonDocs();
  const torneoSel = document.getElementById('hist_torneo');
  const seasonSel = document.getElementById('hist_temporada');
  const catSel = document.getElementById('hist_cat');
  if (torneoSel) {
    const prev = torneoSel.value || currentTorneo;
    torneoSel.innerHTML = TOURNAMENT_OPTION_ORDER.map((key) => `<option value="${key}">${TORNEO_NAMES[key]}</option>`).join('');
    torneoSel.value = TORNEO_NAMES[prev] ? prev : currentTorneo;
  }
  const selectedTorneo = appTorneoId(torneoSel?.value || currentTorneo);
  const torneoTemps = allTemps.filter((t) => appTorneoId(t.torneo || t.torneoId) === selectedTorneo);
  if (seasonSel) {
    const prev = seasonSel.value;
    seasonSel.innerHTML = `<option value="">Todas las temporadas</option>` + torneoTemps.map((t) => `<option value="${t._key}">${escapeHtml(t.nombre || t.seasonName || 'Temporada')}</option>`).join('');
    seasonSel.value = prev && torneoTemps.some((t) => t._key === prev) ? prev : '';
  }
  const selectedSeason = seasonSel?.value || '';
  const seasonForCats = selectedSeason ? torneoTemps.find((t) => t._key === selectedSeason) : torneoTemps[0];
  if (catSel) {
    const prev = catSel.value;
    const cats = seasonForCats?.categoriasSnapshot
      ? Object.values(seasonForCats.categoriasSnapshot).map((snap) => ({ key: snap.cat, label: snap.catNombre }))
      : getSeasonCategoryOptions(selectedTorneo);
    catSel.innerHTML = `<option value="">Todas las categorías</option>` + cats.map((cat) => `<option value="${cat.key}">${escapeHtml(cat.label)}</option>`).join('');
    catSel.value = prev && cats.some((cat) => cat.key === prev) ? prev : '';
  }
  const selectedCat = catSel?.value || '';
  const filteredTemps = torneoTemps.filter((t) => (!selectedSeason || t._key === selectedSeason));
  const adminStatePanel = renderSeasonAdminStatePanel(selectedTorneo);
  const renderTemps = (temps=[]) => {
    if(!temps.length){el.innerHTML=adminStatePanel + '<div class="empty"><span class="empty-icon">🏆</span>Sin temporadas finalizadas aún.<br/><span style="font-size:11px;color:var(--muted)">Finaliza una temporada para guardar su historial público.</span></div>';return;}
    el.innerHTML=adminStatePanel + temps.map(t=>`
      <article class="history-season-card">
        <div class="history-season-head">
          <div>
            <span class="history-season-kicker">Memoria del torneo</span>
            <h2>${escapeHtml(t.nombre||'Temporada')}</h2>
            <p>${escapeHtml(TORNEO_NAMES[t.torneo]||t.torneo)} · ${escapeHtml(t.fechaInicio || 'Inicio')} — ${escapeHtml(t.fechaFinalizacion || t.fecha || 'Cierre')}</p>
          </div>
          ${isOwner && t.estado === 'finished' ? `<button class="btn btn-out btn-sm" onclick="reabrirTemporada('${t._key}')">Reabrir</button>` : ''}
        </div>
        ${renderSeasonPublicBody(t, selectedCat)}
      </article>`).join('');
  };
  renderTemps(filteredTemps);
}

function renderSeasonPublicBody(t, selectedCat = '') {
  const cats = t.categoriasSnapshot
    ? Object.values(t.categoriasSnapshot).filter((snap) => !selectedCat || snap.cat === selectedCat)
    : [{ cat: t.cat, catNombre: CAT_NAMES[t.cat] || t.cat, tablaFinal: t.tablaFinal || t.tabla || [], goleadoresFinal: [], equiposParticipantes: [] }];
  const champImage = t.championImage?.url
    ? `<figure class="history-champion-photo"><img src="${escapeHtml(t.championImage.url)}" alt="${escapeHtml(t.championImage.alt || 'Foto de campeones')}"/><figcaption>${escapeHtml(t.championImage.caption || 'El equipo que dejó su nombre en la historia')}</figcaption></figure>`
    : '';
  const streamBtn = t.final?.stream?.url
    ? `<a class="btn btn-g btn-full" href="${escapeHtml(t.final.stream.url)}" target="_blank" rel="noopener" style="text-decoration:none;margin-bottom:10px">${escapeHtml(t.final.stream.buttonText || 'Ver transmisión de la final')}</a>`
    : '';
  const awards = t.awards || {};
  const awardsHtml = `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px">
    ${[
      ['🥇','Campeón',awards.ligaCampeon || t.campeon],
      ['🥈','Subcampeón',awards.ligaSubcampeon || t.subcampeon],
      ['🏆','Campeón Copa',awards.copaCampeon],
      ['⚽','Goleador',awards.maximoGoleador || t.goleador],
      ['🧤','Mejor portero',awards.mejorPortero]
    ].filter(([, , value]) => value).map(([icon, label, value]) => `<div style="background:rgba(202,138,4,.07);border:1px solid rgba(202,138,4,.22);border-radius:10px;padding:9px;text-align:center"><div>${icon}</div><div style="font-size:9px;font-weight:900;color:var(--muted);letter-spacing:1px;text-transform:uppercase">${label}</div><div style="font-size:12px;font-weight:900;color:var(--text)">${escapeHtml(value)}</div></div>`).join('')}
  </div>`;
  return `${champImage}${streamBtn}${awardsHtml}
    ${t.final?.score || t.final?.rival ? `<div style="font-size:12px;font-weight:800;margin-bottom:10px;padding:9px;border:1px solid var(--border);border-radius:10px">Final: ${escapeHtml(t.final.rival || '')} ${t.final.score ? ' · ' + escapeHtml(t.final.score) : ''}</div>` : ''}
    ${cats.map((snap) => `<section style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;color:var(--acc);text-transform:uppercase;margin-bottom:8px">${escapeHtml(snap.catNombre || snap.cat)}</div>
      ${renderSeasonTableSnapshot(snap.tablaFinal || [])}
      ${typeof renderHistoricCup === 'function' ? renderHistoricCup(snap.copaFinal) : ''}
      ${renderSeasonScorersSnapshot(snap.goleadoresFinal || [])}
      ${snap.equiposParticipantes?.length ? `<div style="font-size:10px;color:var(--muted);font-weight:800;margin-top:8px">Equipos participantes: ${snap.equiposParticipantes.map((e) => escapeHtml(e.nombre)).join(', ')}</div>` : ''}
    </section>`).join('')}
    ${t.notas ? `<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">📝 ${escapeHtml(t.notas)}</div>` : ''}`;
}

function renderSeasonTableSnapshot(tabla = []) {
  if (!tabla.length) return '<div class="empty" style="min-height:80px">Sin tabla final capturada</div>';
  return `<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Tabla final</div>
    ${tabla.map((eq) => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:${eq.posicion===1?'var(--gold)':eq.posicion===2?'#94a3b8':eq.posicion===3?'#b45309':'var(--muted)'};width:18px;text-align:center">${eq.posicion}</span>
      <span style="flex:1;font-weight:700">${escapeHtml(eq.equipo || eq.nombre)}</span>
      <span style="color:var(--muted)">${eq.pj}J</span>
      <span style="font-weight:800;color:var(--acc)">${eq.pts}pts</span>
    </div>`).join('')}`;
}

function renderSeasonScorersSnapshot(scorers = []) {
  if (!scorers.length) return '';
  return `<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin:10px 0 6px">Goleadores</div>
    ${scorers.slice(0, 10).map((g) => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--muted);width:18px;text-align:center">${g.posicion}</span>
      <span style="flex:1;font-weight:700">${escapeHtml(g.jugador)} · ${escapeHtml(g.equipo)}</span>
      <span style="font-weight:900;color:var(--acc)">${g.goles}</span>
    </div>`).join('')}`;
}

async function guardarTemporada(){
  const nombre=document.getElementById('temp_nombre').value.trim();
  if(!nombre){showToast('Ingresa un nombre para la temporada','ta');return;}
  if (document.getElementById('temp_confirm')?.value.trim().toUpperCase() !== 'FINALIZAR') {
    showToast('Escribe FINALIZAR para confirmar', 'ta');
    return;
  }
  const draft = buildSeasonCloseDraft();
  const torneo = draft.torneo;
  if (!isOwner && (!canAccessTorneo(torneo) || draft.cats.some((cat) => !canAccessCat(cat, torneo)))) {
    showToast('No tienes permiso para cerrar una o más categorías seleccionadas', 'tr');
    return;
  }
  const anio = Number(document.getElementById('temp_anio')?.value || new Date().getFullYear());
  const streamUrl = sanitizeSeasonUrl(document.getElementById('temp_stream_url')?.value);
  const uploadedChampImg = document.getElementById('temp_champ_data')?.value || '';
  const champImg = uploadedChampImg || sanitizeSeasonUrl(document.getElementById('temp_champ_img')?.value, { image: true });
  if (document.getElementById('temp_stream_url')?.value && !streamUrl) {
    showToast('URL de transmisión inválida', 'tr');
    return;
  }
  if (!uploadedChampImg && document.getElementById('temp_champ_img')?.value && !champImg) {
    showToast('URL de imagen inválida. Usa JPG, PNG o WEBP', 'tr');
    return;
  }
  const summary = [
    `Torneo: ${TORNEO_NAMES[torneo] || torneo}`,
    `Categorías: ${draft.cats.map((cat) => CAT_NAMES[cat] || cat).join(', ')}`,
    `Advertencias: ${draft.warnings.length || 0}`,
    '',
    'Esto creará un snapshot histórico y marcará la temporada como finalizada. No se borrarán datos activos.'
  ].join('\n');
  if (!confirm(summary)) return;
  const now = Date.now();
  const mainCat = draft.cats[0] || currentCat;
  const activeSeason = getActiveSeason(torneo, mainCat);
  const finalSeasonId = activeSeason?.seasonId || activeSeason?._key || newDocId('season', `${torneo}_${anio}_${nombre}`);
  const data={
    nombre,
    seasonName:nombre,
    anio,
    estado:'finished',
    immutable:true,
    version:1,
    seasonId:finalSeasonId,
    torneo,
    cat:mainCat,
    torneoId:firestoreTorneoId(torneo),
    categoriaId:firestoreCatId(mainCat),
    categorias:draft.cats,
    categoriasSnapshot:Object.fromEntries(Object.entries(draft.categoriasSnapshot).map(([cat, snapshot]) => [cat, {
      ...snapshot,
      copaFinal: typeof getCupHistorySnapshot === 'function' ? getCupHistorySnapshot(getActiveSeason(torneo, cat), cat) : null
    }])),
    fechaInicio:'',
    fechaFinalizacion:new Date(now).toISOString(),
    finishedAtMs:now,
    closedBy:{
      uid:currentUser?.uid || '',
      email:currentUser?.email || '',
      nombre:currentUser?.displayName || currentUser?.email || ''
    },
    warnings:draft.warnings,
    awards:{
      ligaCampeon:document.getElementById('temp_campeon').value.trim(),
      ligaSubcampeon:document.getElementById('temp_subcampeon').value.trim(),
      copaCampeon:document.getElementById('temp_campeon_copa').value.trim(),
      copaSubcampeon:document.getElementById('temp_subcampeon_copa').value.trim(),
      maximoGoleador:document.getElementById('temp_goleador').value.trim(),
      mejorPortero:document.getElementById('temp_portero').value.trim(),
      otros:[]
    },
    final:{
      score:document.getElementById('temp_final_score').value.trim(),
      rival:document.getElementById('temp_final_rival').value.trim(),
      fecha:document.getElementById('temp_final_fecha').value,
      stream:streamUrl ? {
        url:streamUrl,
        platform:detectStreamPlatform(streamUrl),
        title:'',
        buttonText:document.getElementById('temp_stream_label').value.trim() || 'Ver transmisión de la final'
      } : null
    },
    championImage:champImg ? {
      url:champImg,
      caption:document.getElementById('temp_champ_caption').value.trim(),
      alt:document.getElementById('temp_champ_alt').value.trim() || 'Foto de campeones'
    } : null,
    campeon:document.getElementById('temp_campeon').value.trim(),
    subcampeon:document.getElementById('temp_subcampeon').value.trim(),
    goleador:document.getElementById('temp_goleador').value.trim(),
    notas:document.getElementById('temp_notas').value.trim(),
    audit:[...(activeSeason?.audit || []), {
      action:'finish_season',
      at:now,
      uid:currentUser?.uid || '',
      email:currentUser?.email || '',
      warnings:draft.warnings
    }],
    fecha:new Date(now).toISOString().split('T')[0],
    ts:now
  };
  const parentCategories = Array.isArray(activeSeason?.categorias) ? activeSeason.categorias.map(appCatId) : [activeSeason?.cat].filter(Boolean);
  const closesPartOfSharedSeason = !!activeSeason?._key && parentCategories.length > 1 && draft.cats.length === 1;
  let temporadaKey = activeSeason?._key || finalSeasonId || newDocId('temporada', `${nombre}_${Date.now()}`);
  if (closesPartOfSharedSeason) {
    temporadaKey = newDocId('historial', `${activeSeason.seasonId || activeSeason._key}_${mainCat}_${now}`);
    data.seasonId = temporadaKey;
    data.sourceSeasonId = activeSeason.seasonId || activeSeason._key;
    data.nombre = `${nombre} · ${CAT_NAMES[mainCat] || mainCat}`;
    data.seasonName = data.nombre;
    const categoryStates = { ...(activeSeason.categoryStates || {}), [mainCat]: 'finished' };
    const allCategoriesFinished = parentCategories.every((cat) => categoryStates[cat] === 'finished');
    const parentPatch = {
      categoryStates,
      estado: allCategoriesFinished ? 'archived' : 'cup_active',
      updatedAtMs: now,
      audit: [...(activeSeason.audit || []), { action: 'archive_category', cat: mainCat, historyId: temporadaKey, at: now, uid: currentUser?.uid || '', email: currentUser?.email || '' }]
    };
    if (fs) {
      await saveDoc('temporadas', temporadaKey, data);
      await updateDoc('temporadas', activeSeason._key, parentPatch);
    } else {
      await db.ref(`temporadas/${temporadaKey}`).set(data);
      await db.ref(`temporadas/${activeSeason._key}`).update(parentPatch);
    }
    C.temporadas[temporadaKey] = data;
    Object.assign(C.temporadas[activeSeason._key], parentPatch);
  } else {
    if(fs) await saveDoc('temporadas', temporadaKey, data);
    else await db.ref(`temporadas/${temporadaKey}`).set(data);
    C.temporadas[temporadaKey] = data;
  }
  closeModal('modalGuardarTemporada');
  ['temp_campeon','temp_subcampeon','temp_goleador','temp_notas','temp_confirm'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  showToast('✅ Temporada finalizada y guardada','tg');
  renderHistorial();
}

async function deleteTemporada(key){
  if(!isOwner){ showToast('Solo superadministrador','tr'); return; }
  if(!confirm('¿Archivar esta temporada del historial? No se borrará, solo quedará archivada.'))return;
  const t = C.temporadas[key] || {};
  const patch = {
    estado:'archived',
    audit:[...(t.audit || []), { action:'archive_season', at:Date.now(), uid:currentUser?.uid||'', email:currentUser?.email||'' }]
  };
  if(fs) await updateDoc('temporadas', key, patch);
  else await db.ref(`historial/${key}`).update(patch);
  if (C.temporadas[key]) Object.assign(C.temporadas[key], patch);
  showToast('Temporada archivada','ta');
  renderHistorial();
}

async function reabrirTemporada(key){
  if(!isOwner){ showToast('Solo superadministrador','tr'); return; }
  const motivo = prompt('Motivo obligatorio para reabrir la temporada:');
  if(!motivo || !motivo.trim()){ showToast('Motivo requerido','ta'); return; }
  const t = C.temporadas[key] || {};
  const patch = {
    estado:'active',
    immutable:false,
    needsSnapshotRegeneration:true,
    reopenedAt:firestoreServerTimestamp(),
    audit:[...(t.audit || []), { action:'reopen_season', reason:motivo.trim(), at:Date.now(), uid:currentUser?.uid||'', email:currentUser?.email||'' }]
  };
  if(fs) await updateDoc('temporadas', key, patch);
  else await db.ref(`historial/${key}`).update(patch);
  if (C.temporadas[key]) Object.assign(C.temporadas[key], patch);
  showToast('Temporada reabierta con auditoría','ta');
  renderHistorial();
}

// ══════════════════════════════════════
//  COMPARTIR TABLA Y GOLEADORES
// ══════════════════════════════════════
let compartirTextoActual = '';

function compartirTabla(){
  const tablaData=buildTablaData();
  if(!tablaData.length){showToast('Sin equipos registrados en esta categoría','ta');return;}
  openStatsShare('tabla');
}

// ══════════════════════════════════════
//  CUADRO COPA VISIBILITY TOGGLE (admin)
// ══════════════════════════════════════
function getCuadroCopaPublicKey(){ return 'ld_copa_public_'+currentTorneo+'_'+currentCat; }
function isCuadroCopaPublic(){
  const val = localStorage.getItem(getCuadroCopaPublicKey());
  return val === null ? true : val === '1';
}
function toggleCuadroCopa(){
  if(!isAdmin) return;
  const nowPublic = !isCuadroCopaPublic();
  localStorage.setItem(getCuadroCopaPublicKey(), nowPublic ? '1' : '0');
  updateCuadroCopaUI();
  showToast(nowPublic ? '👁️ Cuadro de copa visible al público' : '🔒 Cuadro de copa oculto al público', nowPublic ? 'tg' : 'ta');
}
function updateCuadroCopaUI(){
  const btn = document.getElementById('btnToggleCuadroCopa');
  const banner = document.getElementById('cuadroCopaBanner');
  const finalissimaBanner = document.getElementById('finalissimaBanner');
  const pub = isCuadroCopaPublic();
  if(btn){
    btn.style.display = isAdmin ? '' : 'none';
    btn.textContent = pub ? '👁️' : '🙈';
    btn.title = pub ? 'Ocultar al público' : 'Mostrar al público';
    btn.style.borderColor = pub ? '' : 'var(--red)';
    btn.style.color = pub ? '' : 'var(--red)';
  }
  if(banner) banner.style.display = (!pub && isAdmin) ? '' : 'none';
  if(finalissimaBanner && !isAdmin){
    finalissimaBanner.style.display = pub ? '' : 'none';
  }
}

// ── Helpers de slots con estilos inline para captura ──
function _shareSlot(s, sz=44){
  const logo = s.team?.logo
    ? `<img src="${escapeHtml(s.team.logo)}" crossorigin="anonymous" style="width:${sz}px;height:${sz}px;object-fit:contain;background:transparent;border:0;box-shadow:none;flex-shrink:0;"/>`
    : `<div style="width:${sz}px;height:${sz}px;border-radius:${Math.round(sz*.27)}px;background:#f1f5f9;border:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:${Math.round(sz*.45)}px;flex-shrink:0;">${s.isBye?'⬜':'⚽'}</div>`;
  const seedBg = s.seed===1 ? 'background:linear-gradient(135deg,#fbbf24,#ca8a04);border-color:#f5d487;color:#fff;' : 'background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;';
  const slotOp = s.isBye||s.isPlaceholder ? 'opacity:.5;' : '';
  const pts = s.team ? `<span style="font-size:11px;font-weight:700;color:#94a3b8;flex-shrink:0;margin-left:auto;">${s.team.pts||0}p</span>` : '';
  return `<div style="${slotOp}display:flex;align-items:center;gap:10px;padding:11px 13px;min-width:0;">
    <div style="${seedBg}min-width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0;">${s.seed?`#${s.seed}`:'?'}</div>
    ${logo}
    <span style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.2;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.displayName||'Por definirse')}</span>
    ${pts}
  </div>`;
}
function _shareMatch(match, isFinal=false){
  if(!match){
    const ph = {seed:null,displayName:'Por definirse',isBye:false,isPlaceholder:true,team:null};
    return _shareMatchCard({slotA:ph,slotB:ph,winner:null},isFinal);
  }
  return _shareMatchCard(match, isFinal);
}
function _shareMatchCard(match, isFinal=false){
  const border = isFinal ? 'border:2px solid #fcd34d;box-shadow:0 6px 20px rgba(202,138,4,.18);' : 'border:1.5px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,.06);';
  const winBadge = match.winner
    ? `<span style="font-size:10px;font-weight:900;color:#059669;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">✓ ${escapeHtml(match.winner.nombre)}</span>` : '';
  return `<div style="background:#fff;${border}border-radius:16px;overflow:hidden;width:100%;">
    ${_shareSlot(match.slotA)}
    <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 13px;background:#f8fafc;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:11px;color:#94a3b8;letter-spacing:2px;">VS</span>
      ${winBadge}
    </div>
    ${_shareSlot(match.slotB)}
  </div>`;
}
function buildShareBracketInline(cupData){
  if(cupData?.isTop4Format){
    return buildCupBracketHtml(cupData, {adminMode:false, shareMode:true});
  }
  const rounds = cupData.rounds;
  const r0 = rounds[0];
  const r1 = rounds.length > 1 ? rounds[1] : null;
  const rFinal = rounds[rounds.length-1];
  const finalMatch = rFinal?.matches[0]||null;
  const campeon = finalMatch?.winner||null;
  const half = Math.ceil(r0.matches.length/2);
  const r0L = r0.matches.slice(0,half);
  const r0R = r0.matches.slice(half);
  const r1L = r1 ? r1.matches.slice(0,Math.ceil(r1.matches.length/2)) : [];
  const r1R = r1 ? r1.matches.slice(Math.ceil(r1.matches.length/2)) : [];
  const semiName = r1 ? escapeHtml(r1.name) : 'SEMIFINAL';
  const campLogoHtml = campeon?.logo
    ? `<img src="${escapeHtml(campeon.logo)}" crossorigin="anonymous" style="width:54px;height:54px;object-fit:contain;background:transparent;border:0;box-shadow:none;"/>`
    : `<div style="width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,#fbbf24,#ca8a04);display:flex;align-items:center;justify-content:center;font-size:26px;">🏆</div>`;

  // Helper: columna de ronda
  const col = (label, matchesHtml) => `
    <div style="display:flex;flex-direction:column;align-items:stretch;gap:0;min-width:220px;flex:1;">
      <div style="font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:7px 12px;border-radius:10px;margin-bottom:12px;text-align:center;box-shadow:0 4px 12px rgba(29,78,216,.25);">${label}</div>
      <div style="display:flex;flex-direction:column;gap:12px;flex:1;">
        ${matchesHtml}
      </div>
    </div>`;

  // Helper: conector árbol
  const connTree = (n, dir='right') => {
    const branches = Array.from({length:n},()=>`<div style="flex:1;position:relative;width:100%;">
      <div style="position:absolute;top:50%;${dir==='right'?'right:0;left:auto;':'left:0;right:auto;'}width:18px;height:2px;background:linear-gradient(90deg,${dir==='right'?'#bfdbfe,#2563eb':'#2563eb,#bfdbfe'});border-radius:1px;"></div>
    </div>`).join('');
    const trunkSide = dir==='right' ? 'right:0;left:auto;' : 'left:0;right:auto;';
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:space-around;height:100%;position:relative;width:28px;flex-shrink:0;">
      ${branches}
      <div style="position:absolute;top:25%;${trunkSide}width:2px;height:50%;background:linear-gradient(180deg,#bfdbfe,#2563eb,#bfdbfe);border-radius:1px;"></div>
    </div>`;
  };

  // Helper: flecha simple
  const arrow = (dir) => `<div style="display:flex;align-items:center;justify-content:center;width:28px;flex-shrink:0;">
    <div style="width:22px;height:2px;background:linear-gradient(90deg,${dir==='right'?'#2563eb,#93c5fd':'#93c5fd,#2563eb'});border-radius:1px;"></div>
  </div>`;

  // Envuelve cada partido en un wrapper que ocupa el espacio verticalmente
  const wrapMatch = (m, isFinal=false) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;">${_shareMatch(m, isFinal)}</div>`;

  const r0LHtml = r0L.map(m=>wrapMatch(m)).join('');
  const r0RHtml = r0R.map(m=>wrapMatch(m)).join('');
  const r1LHtml = r1L.map(m=>wrapMatch(m)).join('');
  const r1RHtml = r1R.map(m=>wrapMatch(m)).join('');

  // Trofeo central
  const trofeoHtml = `
    <div style="background:linear-gradient(180deg,#fffbeb,#fff8e1 50%,#fff);border:2px solid #fcd34d;border-radius:18px;padding:16px 14px 14px;text-align:center;box-shadow:0 8px 24px rgba(202,138,4,.2);margin-bottom:10px;width:100%;">
      <div style="font-size:38px;line-height:1;margin-bottom:6px;">🏆</div>
      <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:#1a3a8a;margin-bottom:8px;">GRAN FINAL</div>
      ${campeon ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
        ${campLogoHtml}
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;color:#0f172a;line-height:1.1;margin-top:4px;word-break:break-word;">${escapeHtml(campeon.nombre)}</div>
        <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#ca8a04;">CAMPEÓN</div>
      </div>` : `<div style="font-size:12px;font-weight:800;color:#94a3b8;padding:4px 0;">Por definirse</div>`}
    </div>
    <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;text-align:center;margin-bottom:6px;">${escapeHtml(rFinal.name)}</div>
    ${_shareMatch(finalMatch, true)}`;

  return `
    <div style="display:flex;align-items:stretch;gap:0;width:100%;font-family:'Montserrat',sans-serif;">
      ${col(escapeHtml(r0.name), r0LHtml)}
      ${connTree(r0L.length, 'right')}
      ${col(semiName, r1LHtml)}
      ${arrow('right')}
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:240px;flex:1.2;padding:0 6px;">
        ${trofeoHtml}
      </div>
      ${arrow('left')}
      ${col(semiName, r1RHtml)}
      ${connTree(r0R.length, 'left')}
      ${col(escapeHtml(r0.name), r0RHtml)}
    </div>`;
}

function compartirCopa(){
  const cupData=buildCupProjectionData();
  if(!cupData){showToast('Aún no hay equipos suficientes para armar la copa','ta');return;}
  if(!isCuadroCopaPublic() && !isAdmin){showToast('Esta sección no está disponible','ta');return;}
  const cat = CAT_NAMES[currentCat]||currentCat||'';
  const torneo = TORNEO_NAMES[currentTorneo]||'Torneo';
  const fecha = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});

  if(typeof html2canvas === 'undefined'){ openStatsShare('copa'); return; }
  showToast('Generando imagen...','tg');

  const captureDiv = document.createElement('div');
  captureDiv.style.cssText = 'position:fixed;left:-20000px;top:0;width:1500px;font-family:Montserrat,sans-serif;background:#ffffff;overflow:hidden;';

  const torLogo = document.querySelector('.hdr-torneo-logo img');
  const shieldImg = document.querySelector('.hdr-shield img');
  const torLogoHtml = torLogo
    ? `<img src="${torLogo.src}" crossorigin="anonymous" style="width:76px;height:76px;object-fit:contain;background:transparent;border:0;box-shadow:none;flex-shrink:0;"/>`
    : `<div style="width:76px;height:76px;border-radius:20px;background:#eff6ff;border:1.5px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0;">🏆</div>`;
  const shieldHtml = shieldImg
    ? `<img src="${shieldImg.src}" crossorigin="anonymous" style="width:66px;height:66px;object-fit:contain;background:transparent;border:0;box-shadow:none;flex-shrink:0;"/>`
    : '';

  const bracketInlineHtml = buildShareBracketInline(cupData);
  const copaHeroLine = cupData?.isTop4Format
    ? `${escapeHtml(cat)} &nbsp;&middot;&nbsp; 4 equipos &nbsp;&middot;&nbsp; Semis 1° vs 4° y 2° vs 3° &nbsp;&middot;&nbsp; Gran Final`
    : `${escapeHtml(cat)} &nbsp;&middot;&nbsp; ${cupData.qualifiedTeams} equipos &nbsp;&middot;&nbsp; ${escapeHtml(cupData.stageLabel)} &nbsp;&middot;&nbsp; Final`;

  captureDiv.innerHTML = `
    <div style="background:radial-gradient(ellipse 70% 45% at 85% 5%,rgba(37,84,212,.08),transparent),radial-gradient(ellipse 50% 40% at 10% 92%,rgba(46,168,60,.07),transparent),linear-gradient(180deg,#ffffff 0%,#f7fbff 45%,#f0f6fc 100%);padding:58px 64px 52px;position:relative;overflow:hidden;">

      <!-- Barra tricolor superior -->
      <div style="position:absolute;top:0;left:0;right:0;height:12px;background:linear-gradient(90deg,#1a3a8a 0%,#2554d4 30%,#2ea83c 65%,#f59e0b 100%);"></div>

      <!-- Orbe decorativo -->
      <div style="position:absolute;top:20px;right:40px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(37,84,212,.05),transparent 65%);pointer-events:none;"></div>
      <div style="position:absolute;bottom:30px;left:20px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(46,168,60,.04),transparent 65%);pointer-events:none;"></div>

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:36px;position:relative;z-index:1;">
        <div style="display:flex;align-items:center;gap:18px;">
          ${torLogoHtml}
          ${shieldHtml}
          <div>
            <div style="font-size:13px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#2563eb;margin-bottom:5px;">${escapeHtml(torneo)}</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:88px;letter-spacing:2px;line-height:.86;color:#0f172a;">CUADRO DE COPA</div>
            <div style="font-size:18px;font-weight:800;color:#334155;margin-top:9px;letter-spacing:.5px;">${copaHeroLine}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;margin-top:6px;">
          <div style="padding:12px 22px;border-radius:999px;background:#fff;border:1.5px solid #dfe7f1;font-size:13px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:#1e3a8a;box-shadow:0 6px 18px rgba(15,23,42,.07);white-space:nowrap;">📅 ${escapeHtml(fecha)}</div>
          <div style="padding:8px 16px;border-radius:999px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;font-size:11px;font-weight:800;color:#1d4ed8;white-space:nowrap;">${cupData.qualifiedTeams} equipos clasificados</div>
        </div>
      </div>

      <!-- BRACKET VISUAL -->
      <div style="position:relative;z-index:1;background:#ffffff;border:2px solid #dbe4ee;border-radius:28px;padding:30px 26px 28px;box-shadow:0 16px 42px rgba(15,23,42,.09);overflow:hidden;">
        <!-- Barra color top interna -->
        <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#1a3a8a,#2554d4 35%,#2ea83c 65%,#f59e0b);border-radius:28px 28px 0 0;"></div>
        <div style="margin-top:6px;">
          ${bracketInlineHtml}
        </div>
      </div>

      <!-- FOOTER -->
      <div style="margin-top:30px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;position:relative;z-index:1;">
        <div style="font-size:14px;color:#475569;font-weight:700;line-height:1.6;">
          Proyección oficial según tabla en tiempo real · Cuadro de copa del ${escapeHtml(torneo)}.
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="padding:10px 18px;border-radius:16px;background:#fff;border:1.5px solid #d6dfeb;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#1e3a8a;white-space:nowrap;box-shadow:0 4px 12px rgba(15,23,42,.06);">${escapeHtml(getTournamentFooterTag())}</div>
          <div style="padding:10px 16px;border-radius:16px;background:linear-gradient(135deg,#0f172a,#1d4ed8);border:none;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#fff;white-space:nowrap;box-shadow:0 4px 14px rgba(29,78,216,.3);">CanchaDigital</div>
        </div>
      </div>

    </div>`;

  document.body.appendChild(captureDiv);

  // Esperar imágenes antes de capturar
  const imgs = Array.from(captureDiv.querySelectorAll('img'));
  const imgLoads = imgs.map(img => new Promise(r=>{ if(img.complete){r();}else{img.onload=r;img.onerror=r;} }));

  Promise.all(imgLoads).then(()=> html2canvas(captureDiv,{
    scale:2,
    backgroundColor:'#ffffff',
    useCORS:true,
    allowTaint:false,
    logging:false,
    width:1500,
    windowWidth:1500
  })).then(canvas=>{
    document.body.removeChild(captureDiv);
    canvas.toBlob(blob=>{
      if(!blob){ openStatsShare('copa'); return; }
      const url = URL.createObjectURL(blob);
      if(navigator.share && navigator.canShare && navigator.canShare({files:[new File([blob],'copa.png',{type:'image/png'})]})){
        navigator.share({
          title:`Cuadro de Copa · ${cat}`,
          text:`${torneo} | ${cat}\n${getTournamentHashtagLine(['#CopaDelTorneo'])}`,
          files:[new File([blob],'copa.png',{type:'image/png'})]
        }).then(()=>URL.revokeObjectURL(url))
        .catch(()=>{
          const a=document.createElement('a');
          a.href=url;a.download=`cuadro_copa_${cat.toLowerCase().replace(/\s+/g,'_')}.png`;
          a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
        });
      } else {
        abrirCompartirImagenCopa(url, canvas, cat, torneo, cupData);
      }
    },'image/png');
  }).catch(()=>{
    if(captureDiv.parentNode) document.body.removeChild(captureDiv);
    openStatsShare('copa');
  });
}

function abrirCompartirImagenCopa(blobUrl, canvas, cat, torneo, cupData){
  const existing = document.getElementById('modalCompartirCopa');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'modalCompartirCopa';
  modal.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(15,23,42,.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';
  const equipos = cupData?.qualifiedTeams || 0;
  const ronda = cupData?.stageLabel || 'Copa';
  const lider = cupData?.leader?.nombre || '—';
  modal.innerHTML = `
    <div style="background:#fff;border:1.5px solid #dbe4ee;border-radius:24px;padding:22px 20px;max-width:440px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 24px 50px rgba(15,23,42,.18);">
      <!-- Barra tricolor -->
      <div style="height:4px;background:linear-gradient(90deg,#1a3a8a,#2ea83c,#f59e0b);border-radius:999px;margin-bottom:18px;"></div>
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#0f172a;">📤 COMPARTIR COPA</div>
          <div style="font-size:11px;font-weight:700;color:#64748b;margin-top:2px;">${escapeHtml(torneo)} · ${escapeHtml(cat)}</div>
        </div>
        <button onclick="document.getElementById('modalCompartirCopa').remove()" style="background:#f8fafc;border:1px solid #dbe4ee;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:16px;color:#475569;transition:background .15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">✕</button>
      </div>
      <!-- Preview imagen -->
      <div style="border-radius:16px;overflow:hidden;border:1.5px solid #dbe4ee;margin-bottom:14px;box-shadow:0 8px 20px rgba(15,23,42,.07);">
        <img src="${blobUrl}" style="width:100%;display:block;" />
      </div>
      <!-- Stats mini -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:#f8fafc;border:1px solid #dbe4ee;border-radius:12px;padding:10px 8px;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:#1d4ed8;">${equipos}</div>
          <div style="font-size:9px;font-weight:800;letter-spacing:1px;color:#64748b;text-transform:uppercase;">Equipos</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #dbe4ee;border-radius:12px;padding:10px 8px;text-align:center;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;color:#1d4ed8;line-height:1.2;margin-top:4px;">${escapeHtml(ronda)}</div>
          <div style="font-size:9px;font-weight:800;letter-spacing:1px;color:#64748b;text-transform:uppercase;margin-top:4px;">Ronda</div>
        </div>
        <div style="background:linear-gradient(180deg,#fff8e6,#fff);border:1px solid #f5d487;border-radius:12px;padding:10px 8px;text-align:center;overflow:hidden;">
          <div style="font-size:11px;font-weight:900;color:#92400e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(lider)}</div>
          <div style="font-size:9px;font-weight:800;letter-spacing:1px;color:#92400e;text-transform:uppercase;margin-top:4px;">Cabeza #1</div>
        </div>
      </div>
      <!-- Botones -->
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button onclick="(()=>{const a=document.createElement('a');a.href='${blobUrl}';a.download='cuadro_copa_${cat.toLowerCase().replace(/\s+/g,'_')}.png';a.click();})()" style="background:linear-gradient(135deg,#1a3a8a,#2554d4);color:#fff;border:none;border-radius:12px;padding:13px;font-family:'Montserrat',sans-serif;font-weight:800;font-size:12px;letter-spacing:1px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 8px 18px rgba(37,84,212,.25);">⬇️ DESCARGAR IMAGEN</button>
        <button onclick="navigator.clipboard.writeText('${escapeHtml(torneo)} | ${escapeHtml(cat)}\\nCuadro de copa — proyectado al ${new Date().toLocaleDateString('es-MX')}.\\n${getTournamentHashtagLine(['#CopaDelTorneo','#CaminoAlTitulo'])}').then(()=>showToast('Texto copiado ✓','tg')).catch(()=>showToast('No se pudo copiar','ta'))" style="background:#fff;color:#1a3a8a;border:1.5px solid #dbe4ee;border-radius:12px;padding:12px;font-family:'Montserrat',sans-serif;font-weight:800;font-size:12px;letter-spacing:1px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">📋 COPIAR TEXTO</button>
      </div>
    </div>`;
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
  const copyBtn = modal.querySelectorAll('button')[2];
  if(copyBtn){
    copyBtn.onclick = ()=>{
      const text = `${torneo} | ${cat}\nCuadro de copa - proyectado al ${new Date().toLocaleDateString('es-MX')}.\n${getTournamentHashtagLine(['#CopaDelTorneo','#CaminoAlTitulo'])}`;
      navigator.clipboard.writeText(text).then(()=>showToast('Texto copiado ✓','tg')).catch(()=>showToast('No se pudo copiar','ta'));
    };
  }
}

function compartirGoleadores(){
  if(!getTopScorersData(10).length){showToast('Sin goles registrados','ta');return;}
  openStatsShare('goleadores');
}

function compartirWhatsApp(){
  const encoded=encodeURIComponent(compartirTextoActual);
  window.open(`https://wa.me/?text=${encoded}`,'_blank');
}

function copyPlainText(text, okMsg='📋 Copiado al portapapeles'){
  if(navigator.clipboard?.writeText){
    return navigator.clipboard.writeText(text).then(()=>{
      showToast(okMsg,'tg');
    }).catch(()=>{
      const ta=document.createElement('textarea');
      ta.value=text;
      document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
      showToast(okMsg,'tg');
    });
  }
  const ta=document.createElement('textarea');
  ta.value=text;
  document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
  showToast(okMsg,'tg');
  return Promise.resolve();
}

function copiarTextoCompartir(){
  navigator.clipboard.writeText(compartirTextoActual).then(()=>{
    showToast('📋 Copiado al portapapeles','tg');
  }).catch(()=>{
    // fallback
    const ta=document.createElement('textarea');
    ta.value=compartirTextoActual;
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    showToast('📋 Copiado','tg');
  });
}

// ══════════════════════════════════════
//  THEME
// ══════════════════════════════════════
function buildShareLogosHtml(){
  const logos = Array.from(new Set([TORNEO_LOGOS[currentTorneo], CD_LOGO_SHIELD].filter(Boolean)));
  return logos.map(src=>`<img src="${src}" alt="Logo torneo"/>`).join('');
}

function buildShareFooterTagHtml(footerTag){
  const logo = TORNEO_LOGOS[currentTorneo] || '';
  const tag = footerTag || getTournamentFooterTag();
  return `${logo ? `<img src="${logo}" alt="${escapeHtml(tag)}"/>` : ''}<span>${escapeHtml(tag)}</span>`;
}

function buildVisualShareCard({kicker, title, subtitle, dateLabel, bodyHtml, footerNote, footerTag, wideCard}){
  return `<div class="share-card${wideCard?' share-card-wide':''}">
    <!-- Orbs decorativos -->
    <div class="share-orb one"></div>
    <div class="share-orb two"></div>
    <!-- Header renovado -->
    <div class="share-header">
      <div class="share-brand">
        ${buildShareLogosHtml()}
        <div class="share-brand-copy">
          <div class="share-kicker">${escapeHtml(kicker || (TORNEO_NAMES[currentTorneo] || 'Torneo'))}</div>
          <div class="share-title">${escapeHtml(title || 'Visual oficial')}</div>
          <div class="share-sub">${escapeHtml(subtitle || '')}</div>
        </div>
      </div>
      <div class="share-date-pill">${escapeHtml(dateLabel || fmtDate(todayISO()))}</div>
    </div>
    ${bodyHtml || ''}
    <div class="share-footer">
      <div class="share-footer-note">${escapeHtml(footerNote || 'Contenido oficial listo para guardar, compartir y archivar.')}</div>
      <div class="share-footer-tag">${buildShareFooterTagHtml(footerTag)}</div>
    </div>
  </div>`;
}

function getShareCategoryLabel(){
  return CAT_NAMES[currentCat] || currentCat || 'Categoría';
}

function buildShareListRows(items){
  return items.map((item, i)=>`
    <div class="share-post-item">
      <div class="share-post-item-num">${i+1}</div>
      <div class="share-post-item-copy">
        <div class="share-post-item-title">${escapeHtml(item.title || '')}</div>
        ${(item.desc || '').trim() ? `<div class="share-post-item-desc">${escapeHtml(item.desc || '')}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function buildCleanTableSharePayload(data, torneo, categoria, fecha, organizerLine, baseFile) {
  const rows = data.map((team, index) => {
    const goalDifference = Number(team.gf || 0) - Number(team.gc || 0);
    const logo = team.logo
      ? `<img src="${escapeHtml(team.logo)}" alt="${escapeHtml(team.nombre)}" crossorigin="anonymous"/>`
      : '<span class="share-table-logo-placeholder">⚽</span>';
    return `<div class="share-table-row${index < 3 ? ` is-top is-top-${index + 1}` : ''}">
      <strong class="share-table-position">${index + 1}</strong>
      <div class="share-table-team">${logo}<span>${escapeHtml(team.nombre)}</span></div>
      <span>${Number(team.pj || 0)}</span>
      <span>${Number(team.g || 0)}</span>
      <span>${Number(team.e || 0)}</span>
      <span>${Number(team.pe || 0)}</span>
      <span>${Number(team.gf || 0)}</span>
      <span>${Number(team.gc || 0)}</span>
      <span class="${goalDifference > 0 ? 'is-positive' : goalDifference < 0 ? 'is-negative' : ''}">${goalDifference > 0 ? '+' : ''}${goalDifference}</span>
      <strong class="share-table-points">${Number(team.pts || 0)}</strong>
    </div>`;
  }).join('');
  const caption = `${torneo} | ${categoria}\nTabla general actualizada al ${fecha}.\n${organizerLine}`;
  return {
    kind: 'tabla',
    title: 'Tabla general',
    caption,
    filename: baseFile,
    html: `<div class="share-card share-table-only">
      <header class="share-table-header">
        <div class="share-table-identity">${buildShareLogosHtml()}</div>
        <div class="share-table-heading">
          <span>Tabla general</span>
          <h1>${escapeHtml(torneo)}</h1>
          <p>${escapeHtml(categoria)}</p>
        </div>
        <div class="share-table-details">
          <strong>${escapeHtml(ORGANIZER_NAME)}</strong>
          <span>${escapeHtml(ORGANIZER_PHONE)}</span>
          <time>${escapeHtml(fecha)}</time>
        </div>
      </header>
      <div class="share-table-board">
        <div class="share-table-columns"><span>#</span><span>Equipo</span><span>PJ</span><span>G</span><span>E</span><span>P</span><span>GF</span><span>GC</span><span>DG</span><span>PTS</span></div>
        ${rows}
      </div>
    </div>`
  };
}

function getStatsSharePayloadBase(tipo, dataOverride=null){
  const torneo = TORNEO_NAMES[currentTorneo] || 'TORNEO LOMBARDO TOLEDANO';
  const categoria = getShareCategoryLabel();
  const fecha = fmtDate(todayISO());
  const organizerLine = `${ORGANIZER_NAME} · ${ORGANIZER_PHONE}`;
  const baseFile = `${slugifyBasic(torneo)}_${slugifyBasic(tipo)}_${slugifyBasic(categoria)}_${todayISO()}`;

  if(tipo === 'tabla'){
    const data = Array.isArray(dataOverride) && dataOverride.length ? dataOverride : buildTablaData();
    if(!data.length) return null;
    return buildCleanTableSharePayload(data, torneo, categoria, fecha, organizerLine, baseFile);
  }
  if(tipo === 'finalissima'){
    const data = Array.isArray(dataOverride) && dataOverride.length ? dataOverride : buildTablaData();
    if(data.length < 2) return null;
    const top = data[0];
    const segundo = data[1];
    const topLogo = top.logo
      ? `<img src="${top.logo}" alt="${escapeHtml(top.nombre)}"/>`
      : `<div class="share-finalissima-only-logo">⚽</div>`;
    const secondLogo = segundo.logo
      ? `<img src="${segundo.logo}" alt="${escapeHtml(segundo.nombre)}"/>`
      : `<div class="share-finalissima-only-logo">⚽</div>`;
    const bodyHtml = `
      <div class="share-finalissima-only">
        <div class="share-finalissima-only-frame">
          <div class="share-finalissima-only-top">
            <div class="share-finalissima-only-copy">
              <small>Partido a campeón de copa</small>
              <strong>FINALISSIMA</strong>
              <span>Al finalizar el torneo</span>
            </div>
            <div class="share-finalissima-only-contact">${escapeHtml(organizerLine)}</div>
          </div>
          <div class="share-finalissima-only-duel">
            <div class="share-finalissima-only-side champion">
              ${topLogo}
              <div class="share-finalissima-only-name">${escapeHtml(top.nombre)}</div>
              <div class="share-finalissima-only-rank">1er lugar</div>
            </div>
            <div class="share-finalissima-only-vs">
              <strong>VS</strong>
              <span>${escapeHtml(categoria)}</span>
            </div>
            <div class="share-finalissima-only-side second">
              ${secondLogo}
              <div class="share-finalissima-only-name">${escapeHtml(segundo.nombre)}</div>
              <div class="share-finalissima-only-rank">2do lugar</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const caption = [
      `${torneo} | ${categoria}`,
      `${ORGANIZER_NAME} · ${ORGANIZER_PHONE}`,
      `Finalissima: ${top.nombre} vs ${segundo.nombre}.`,
      'Al finalizar el torneo se define el duelo por el campeón de copa.',
      getTournamentHashtagLine(['#Finalissima'])
    ].join('\n');
    return {
      kind:'finalissima',
      title:'Finalissima',
      caption,
      filename: `finalissima_${slugifyBasic(categoria)}_${todayISO()}`,
      html: buildVisualShareCard({
        kicker: torneo,
        title: 'FINALISSIMA',
        subtitle: `${categoria} · ${organizerLine}`,
        dateLabel: `Actualizado · ${fecha}`,
        bodyHtml,
        footerNote: 'Visual oficial de la Finalissima listo para compartir y guardar.',
        footerTag: getTournamentFooterTag()
      })
    };
  }

  if(tipo === 'copa'){
    const cup = dataOverride?.rounds ? dataOverride : buildCupProjectionData(Array.isArray(dataOverride) ? dataOverride : null);
    if(!cup) return null;
    const firstRound = cup.rounds[0];
    // Texto para caption
    const firstRoundLines = firstRound.matches.map((match, index)=>{
      const left = match.slotA.team ? `${match.slotA.seed}. ${match.slotA.team.nombre}` : 'BYE';
      const right = match.slotB.team ? `${match.slotB.seed}. ${match.slotB.team.nombre}` : 'BYE';
      return `${index+1}. ${left} vs ${right}`;
    });

    // ── Bracket completo con estilos inline para imagen exportable ──
    const bracketFullHtml = buildCupBracketHtml(cup, {adminMode: false});

    const bodyHtml = `
      <div style="position:relative;z-index:1;margin-top:8px;">
        <!-- Chips de contexto -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
          <span style="padding:5px 14px;border-radius:999px;background:linear-gradient(135deg,#fbbf24,#ca8a04);color:#fff;font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 4px 10px rgba(202,138,4,.3);">${escapeHtml(cup.leader?.nombre||'—')} #1</span>
          <span style="padding:5px 14px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">${cup.qualifiedTeams} equipos</span>
          <span style="padding:5px 14px;border-radius:999px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(cup.stageLabel)}</span>
        </div>
        <!-- Bracket completo -->
        <div style="background:#ffffff;border:1.5px solid #dbe4ee;border-radius:22px;overflow:hidden;padding:22px 18px 20px;box-shadow:0 12px 32px rgba(15,23,42,.08);position:relative;">
          <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#1a3a8a 0%,#2ea83c 50%,#f59e0b 100%);"></div>
          <div style="margin-top:4px;overflow-x:auto;">
            ${bracketFullHtml}
          </div>
        </div>
      </div>
    `;
    const isTop4Cup = !!cup.isTop4Format;
    const cupCaptionLine = isTop4Cup
      ? `Cuadro de copa proyectado al ${fecha}: clasifican cuatro equipos, semifinales y gran final.`
      : `Cuadro de copa proyectado al ${fecha}: ${cup.qualifiedTeams} equipos.`;
    const cupSubtitleLine = isTop4Cup
      ? `${categoria} · ${organizerLine} · 4 equipos · SF · Final`
      : `${categoria} · ${organizerLine} · ${cup.qualifiedTeams} equipos · ${cup.stageLabel} · Final`;
    const caption = [
      `${torneo} | ${categoria}`,
      `${ORGANIZER_NAME} · ${ORGANIZER_PHONE}`,
      cupCaptionLine,
      `Ronda inicial: ${cup.stageLabel}.`,
      ...firstRoundLines,
      getTournamentHashtagLine(['#CopaDelTorneo','#CaminoAlTitulo'])
    ].join('\n');
    return {
      kind:'copa',
      title:'Cuadro de Copa',
      caption,
      filename:`copa_${slugifyBasic(categoria)}_${todayISO()}`,
      html: buildVisualShareCard({
        kicker: torneo,
        title: 'CUADRO DE COPA',
        subtitle: cupSubtitleLine,
        dateLabel: `Actualizado · ${fecha}`,
        bodyHtml,
        footerNote: 'Visual oficial del camino al título — bracket completo según tabla actual.',
        footerTag: getTournamentFooterTag(),
        wideCard: true
      })
    };
  }

  if(tipo === 'goleadores'){
    const data = Array.isArray(dataOverride) && dataOverride.length ? dataOverride : getTopScorersData(10);
    if(!data.length) return null;
    const lider = data[0];
    const bodyHtml = `
      <div class="share-post-hero">
        <h2>TOP 10<br/>GOLEADORES</h2>
        <p>Los jugadores más encendidos del torneo en ${escapeHtml(categoria)}.</p>
      </div>
      <div class="share-stat-grid">
        <div class="share-stat-box"><div class="share-stat-val">${lider.goles}</div><div class="share-stat-lbl">Líder actual</div></div>
        <div class="share-stat-box"><div class="share-stat-val">${data.length}</div><div class="share-stat-lbl">Jugadores en ranking</div></div>
        <div class="share-stat-box"><div class="share-stat-val">${data.reduce((sum,g)=>sum+(g.goles||0),0)}</div><div class="share-stat-lbl">Goles top 10</div></div>
      </div>
      <div class="share-post-list">${buildShareListRows(data.map(g=>({
        title: `${g.jugador} · ${g.goles} gol${g.goles===1?'':'es'}`,
        desc: g.equipo || 'Sin equipo'
      })))}</div>
    `;
    const caption = [
      `${torneo} | ${categoria}`,
      `Top 10 de goleadores al ${fecha}:`,
      ...data.map((g,i)=>`${i+1}. ${g.jugador} (${g.equipo}) - ${g.goles}`),
      getTournamentHashtagLine(['#Top10Goleadores','#Futbol'])
    ].join('\n');
    return {
      kind:'goleadores',
      title: 'Top 10 Goleadores',
      caption,
      filename: baseFile,
      html: buildVisualShareCard({
        kicker: torneo,
        title: 'TOP 10 GOLEADORES',
        subtitle: `${categoria} · Tabla individual`,
        dateLabel: `Actualizado · ${fecha}`,
        bodyHtml,
        footerNote: 'Ranking oficial para historias, carruseles y difusión del torneo.',
        footerTag: getTournamentFooterTag()
      })
    };
  }

  if(tipo === 'porteros'){
    const data = Array.isArray(dataOverride) && dataOverride.length ? dataOverride : getTopGoalkeepersData(10);
    if(!data.length) return null;
    const lider = data[0];
    const bodyHtml = `
      <div class="share-post-hero">
        <h2>TOP 10<br/>PORTEROS</h2>
        <p>Ranking basado en porterías imbatidas y menor promedio de goles recibidos por partido.</p>
      </div>
      <div class="share-stat-grid">
        <div class="share-stat-box"><div class="share-stat-val">${lider.porteriasImbatidas}</div><div class="share-stat-lbl">PI del líder</div></div>
        <div class="share-stat-box"><div class="share-stat-val">${lider.promedioGC.toFixed(2)}</div><div class="share-stat-lbl">GC/PJ líder</div></div>
        <div class="share-stat-box"><div class="share-stat-val">${data.length}</div><div class="share-stat-lbl">Porteros rankeados</div></div>
      </div>
      <div class="share-post-list">${buildShareListRows(data.map(g=>({
        title: `${g.portero} · ${g.porteriasImbatidas} PI`,
        desc: `${g.equipo} · ${g.promedioGC.toFixed(2)} GC/PJ · ${g.golesRecibidos} GC`
      })))}</div>
    `;
    const caption = [
      `${torneo} | ${categoria}`,
      `Top 10 de mejores porteros al ${fecha}:`,
      ...data.map((g,i)=>`${i+1}. ${g.portero} (${g.equipo}) - ${g.porteriasImbatidas} PI | ${g.promedioGC.toFixed(2)} GC/PJ`),
      getTournamentHashtagLine(['#Top10Porteros','#CopaDelTorneo'])
    ].join('\n');
    return {
      kind:'porteros',
      title: 'Top 10 Porteros',
      caption,
      filename: baseFile,
      html: buildVisualShareCard({
        kicker: torneo,
        title: 'TOP 10 PORTEROS',
        subtitle: `${categoria} · Portería imbatida y solidez defensiva`,
        dateLabel: `Actualizado · ${fecha}`,
        bodyHtml,
        footerNote: 'Ranking oficial de guardametas listo para redes y PDF.',
        footerTag: getTournamentFooterTag()
      })
    };
  }

  return null;
}

function openStatsShare(tipo){
  const payload = getStatsSharePayload(tipo);
  if(!payload){
    showToast('No hay información suficiente para compartir','ta');
    return;
  }
  openVisualShare(payload);
}

function setVisualShareTablaStats(enabled){
  if(!isAdmin) return;
  visualShareOptions.showTablaStats = !!enabled;
  localStorage.setItem('ld_share_show_tabla_stats', enabled ? '1' : '0');
  if(visualShareState?.kind === 'tabla'){
    const refreshed = getStatsSharePayload('tabla');
    if(refreshed){
      visualShareState = refreshed;
      renderVisualShareModal();
    }
  }
}

function openVisualShare(payload){
  if(!payload || !payload.html) return;
  visualShareState = payload;
  renderVisualShareModal();
  openModal('modalVisualShare');
}

function canvasToBlob(canvas, type='image/png', quality=1){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(blob) resolve(blob);
      else reject(new Error('No se pudo convertir el canvas'));
    }, type, quality);
  });
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1200);
}

function copyVisualShareCaption(){
  if(!visualShareState) return;
  if(!isAdmin) return;
  return copyPlainText(document.getElementById('visualShareCaption')?.value || visualShareState.caption || '', '📋 Caption copiado');
}

function getVisualShareStatsEnabled(){
  return !!(isAdmin && visualShareOptions.showTablaStats);
}

function getStatsSharePayload(tipo, dataOverride=null){
  if(tipo === 'copa'){
    const torneo = TORNEO_NAMES[currentTorneo] || 'TORNEO LOMBARDO TOLEDANO';
    const categoria = getShareCategoryLabel();
    const fecha = fmtDate(todayISO());
    const organizerLine = `${ORGANIZER_NAME} · ${ORGANIZER_PHONE}`;
    const cup = dataOverride?.rounds ? dataOverride : buildCupProjectionData(Array.isArray(dataOverride) ? dataOverride : null);
    if(!cup) return null;
    // Redirigir al payload base mejorado
    return getStatsSharePayloadBase('copa', cup);
  }
  return getStatsSharePayloadBase(tipo, dataOverride);
}

function setVisualShareBusy(busy){
  visualShareBusy = !!busy;
  const btnPng = document.getElementById('visualShareBtnPng');
  const btnPdf = document.getElementById('visualShareBtnPdf');
  const btnShare = document.getElementById('visualShareBtnShare');
  const btnCopy = document.getElementById('visualShareBtnCopy');
  [btnPng,btnPdf,btnShare,btnCopy].forEach(btn=>{ if(btn) btn.disabled = visualShareBusy; });
  if(btnPng) btnPng.textContent = visualShareBusy ? 'Generando imagen...' : '💾 Guardar imagen PNG';
  if(btnShare) btnShare.textContent = visualShareBusy ? 'Preparando...' : '📲 Compartir imagen';
}

function renderVisualShareModal(){
  const payload = visualShareState;
  if(!payload || !payload.html) return;
  compartirTextoActual = payload.caption || '';
  const titleEl = document.getElementById('visualShareTitle');
  const previewEl = document.getElementById('visualSharePreview');
  const captionEl = document.getElementById('visualShareCaption');
  const captionWrap = document.getElementById('visualShareCaptionWrap');
  const actionsWrap = document.getElementById('visualShareActions');
  const btnPdf = document.getElementById('visualShareBtnPdf');
  const btnShare = document.getElementById('visualShareBtnShare');
  const btnCopy = document.getElementById('visualShareBtnCopy');
  const adminControls = document.getElementById('visualShareAdminControls');
  const statsToggle = document.getElementById('visualShareShowStats');
  if(titleEl) titleEl.textContent = isAdmin ? `📤 ${payload.title || 'Compartir Visual'}` : '🖼️ Guardar imagen';
  if(previewEl) previewEl.innerHTML = payload.html;
  if(captionEl) captionEl.value = payload.caption || '';
  const isCleanTable = payload.kind === 'tabla';
  if(captionWrap) captionWrap.style.display = isAdmin && !isCleanTable ? '' : 'none';
  if(adminControls) adminControls.style.display = 'none';
  if(statsToggle) statsToggle.checked = getVisualShareStatsEnabled();
  if(btnPdf) btnPdf.style.display = isAdmin && !isCleanTable ? '' : 'none';
  if(btnShare) btnShare.style.display = '';
  if(btnCopy) btnCopy.style.display = isAdmin && !isCleanTable ? '' : 'none';
  if(actionsWrap) actionsWrap.style.gridTemplateColumns = '1fr 1fr';
  setVisualShareBusy(false);
  // Scale preview to fit container width
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const scaleEl = document.getElementById('visualShareScaleEl');
    const wrapEl = document.getElementById('visualShareScaleWrap');
    const root = previewEl?.firstElementChild;
    if(scaleEl && wrapEl && root){
      const srcW = root.classList.contains('share-card-wide') ? 1440 : 1080;
      const wrapW = wrapEl.clientWidth || wrapEl.offsetWidth || 320;
      const scale = Math.min(1, wrapW / srcW);
      const srcH = root.scrollHeight || root.offsetHeight || 900;
      scaleEl.style.transform = `scale(${scale})`;
      scaleEl.style.transformOrigin = 'top left';
      scaleEl.style.width = `${srcW}px`;
      scaleEl.style.display = 'block';
      wrapEl.style.height = `${Math.round(srcH * scale)}px`;
    }
  }));
}

async function waitForNodeImages(node){
  const images = Array.from(node.querySelectorAll('img')).filter(img=>img.src);
  if(!images.length) return;
  await Promise.all(images.map(async img=>{
    try{
      if(!img.complete){
        await new Promise(resolve=>{
          img.addEventListener('load', resolve, { once:true });
          img.addEventListener('error', resolve, { once:true });
        });
      }
      if(typeof img.decode === 'function'){
        await img.decode().catch(()=>{});
      }
    }catch(_err){}
  }));
}

async function buildVisualShareRenderNode(){
  const source = document.querySelector('#visualSharePreview > *');
  if(!source) throw new Error('No hay visual listo para exportar');
  const width = Math.ceil(source.scrollWidth || source.offsetWidth || 1080);
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = `${width}px`;
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.background = '#ffffff';
  host.style.zIndex = '-1';
  host.style.overflow = 'hidden';
  const clone = source.cloneNode(true);
  clone.style.transform = 'none';
  clone.style.width = `${width}px`;
  clone.style.maxWidth = 'none';
  clone.style.display = 'block';
  host.appendChild(clone);
  document.body.appendChild(host);
  if(document.fonts?.ready) await document.fonts.ready;
  await waitForNodeImages(clone);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return { host, clone };
}

async function getVisualShareCanvas(){
  if(typeof html2canvas !== 'function') throw new Error('html2canvas no está disponible');
  const { host, clone } = await buildVisualShareRenderNode();
  try{
    const width = Math.ceil(clone.scrollWidth || clone.offsetWidth || 1080);
    const height = Math.ceil(clone.scrollHeight || clone.offsetHeight || 1180);
    return await html2canvas(clone,{
      backgroundColor:'#ffffff',
      scale:2,
      useCORS:true,
      allowTaint:true,
      logging:false,
      imageTimeout:0,
      width,
      height,
      windowWidth:width,
      windowHeight:height,
      scrollX:0,
      scrollY:0,
      removeContainer:true
    });
  }finally{
    host.remove();
  }
}

async function runVisualShareTask(task){
  if(visualShareBusy) return null;
  setVisualShareBusy(true);
  try{
    return await task();
  }finally{
    setVisualShareBusy(false);
  }
}

async function downloadVisualShare(mode='png'){
  if(!visualShareState) return;
  if(!isAdmin && mode!=='png') return;
  return runVisualShareTask(async ()=>{
    try{
      const canvas = await getVisualShareCanvas();
      const filename = visualShareState.filename || `${slugifyBasic(TORNEO_NAMES[currentTorneo] || 'torneo')}_${todayISO()}`;
      if(mode === 'pdf'){
        const jsPDFCtor = window.jspdf?.jsPDF;
        if(!jsPDFCtor) throw new Error('jsPDF no está disponible');
        const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
        const pdf = new jsPDFCtor({ orientation, unit:'pt', format:[canvas.width, canvas.height], compress:true });
        pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height,undefined,'FAST');
        pdf.save(`${filename}.pdf`);
        showToast('📄 PDF generado correctamente','tg');
        return;
      }
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, `${filename}.png`);
      showToast('💾 Imagen guardada correctamente','tg');
    }catch(err){
      if(err?.name === 'AbortError') return;
      console.error(err);
      showToast('No se pudo generar el archivo visual','tr');
    }
  });
}

async function shareVisualAsset(){
  if(!visualShareState) return;
  return runVisualShareTask(async ()=>{
    try{
      const canvas = await getVisualShareCanvas();
      const blob = await canvasToBlob(canvas);
      const filename = `${visualShareState.filename || `${slugifyBasic(TORNEO_NAMES[currentTorneo] || 'torneo')}_${todayISO()}`}.png`;
      const file = new File([blob], filename, { type:'image/png' });
      if(navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))){
        await navigator.share({
          title: visualShareState.title || (TORNEO_NAMES[currentTorneo] || 'Torneo'),
          text: visualShareState.caption || '',
          files:[file]
        });
        showToast('📲 Visual listo para compartir','tg');
        return;
      }
      downloadBlob(blob, filename);
      showToast('Tu dispositivo no admite compartir archivos; guardamos la imagen para que puedas enviarla','ta');
    }catch(err){
      if(err?.name === 'AbortError') return;
      console.error(err);
      showToast('No se pudo compartir el visual','tr');
    }
  });
}

function readMarketingNetworksForm(){
  const num = id => Number(document.getElementById(id)?.value || 0);
  const txt = id => (document.getElementById(id)?.value || '').trim();
  return {
    instagram:{ handle:txt('mk_ig_handle'), followers:num('mk_ig_followers'), reach:num('mk_ig_reach'), eng:num('mk_ig_eng'), goal:num('mk_ig_goal') },
    tiktok:{ handle:txt('mk_tt_handle'), followers:num('mk_tt_followers'), reach:num('mk_tt_reach'), eng:num('mk_tt_eng'), goal:num('mk_tt_goal') },
    facebook:{ handle:txt('mk_fb_handle'), followers:num('mk_fb_followers'), reach:num('mk_fb_reach'), eng:num('mk_fb_eng'), goal:num('mk_fb_goal') }
  };
}

function fillMarketingNetworksForm(redes={}, force=false){
  const activeId = document.activeElement?.id || '';
  if(!force && activeId.startsWith('mk_')) return;
  const merged = {
    instagram:{ handle:'', followers:0, reach:0, eng:0, goal:3, ...(redes.instagram||{}) },
    tiktok:{ handle:'', followers:0, reach:0, eng:0, goal:2, ...(redes.tiktok||{}) },
    facebook:{ handle:'', followers:0, reach:0, eng:0, goal:2, ...(redes.facebook||{}) }
  };
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.value = val ?? '';
  };
  setVal('mk_ig_handle', merged.instagram.handle);
  setVal('mk_ig_followers', merged.instagram.followers);
  setVal('mk_ig_reach', merged.instagram.reach);
  setVal('mk_ig_eng', merged.instagram.eng);
  setVal('mk_ig_goal', merged.instagram.goal);
  setVal('mk_tt_handle', merged.tiktok.handle);
  setVal('mk_tt_followers', merged.tiktok.followers);
  setVal('mk_tt_reach', merged.tiktok.reach);
  setVal('mk_tt_eng', merged.tiktok.eng);
  setVal('mk_tt_goal', merged.tiktok.goal);
  setVal('mk_fb_handle', merged.facebook.handle);
  setVal('mk_fb_followers', merged.facebook.followers);
  setVal('mk_fb_reach', merged.facebook.reach);
  setVal('mk_fb_eng', merged.facebook.eng);
  setVal('mk_fb_goal', merged.facebook.goal);
}

function getMarketingActivity(){
  return getMarketingData().actividad || {};
}

function getMarketingSortedParts(){
  return filteredParts().slice().sort((a,b)=>`${b.fecha||''} ${b.horaIni||''}`.localeCompare(`${a.fecha||''} ${a.horaIni||''}`));
}

function getMatchScoreLine(p){
  return `${p.localNombre||p.local||'Local'} ${p.gL||0}-${p.gV||0} ${p.visitaNombre||p.visita||'Visita'}`;
}

function summarizeMatchScorers(p){
  const goles = p.goles ? Object.values(p.goles) : [];
  if(!goles.length) return 'Sin goleadores registrados';
  const buckets = { local:{}, visita:{} };
  goles.forEach(g=>{
    const side = g.equipo === 'local' ? 'local' : 'visita';
    const player = (g.jugador || 'Jugador').trim();
    buckets[side][player] = (buckets[side][player] || 0) + 1;
  });
  const renderSide = (side, label) => {
    const entries = Object.entries(buckets[side]);
    if(!entries.length) return '';
    return `${label}: ${entries.map(([name,count])=>`${name}${count>1?` x${count}`:''}`).join(', ')}`;
  };
  return [
    renderSide('local', p.localNombre||p.local||'Local'),
    renderSide('visita', p.visitaNombre||p.visita||'Visita')
  ].filter(Boolean).join(' | ');
}

function getMarketingStatusLabel(status){
  return ({ borrador:'Borrador', programado:'Programado', publicado:'Publicado' })[status] || 'Borrador';
}

function getMarketingStatusBadge(status){
  const map = {
    borrador:{ bg:'rgba(148,163,184,.12)', bd:'rgba(148,163,184,.22)', color:'#64748b' },
    programado:{ bg:'rgba(37,84,212,.12)', bd:'rgba(37,84,212,.22)', color:'#1d4ed8' },
    publicado:{ bg:'rgba(22,163,74,.12)', bd:'rgba(22,163,74,.22)', color:'#15803d' }
  };
  const style = map[status] || map.borrador;
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;background:${style.bg};border:1px solid ${style.bd};font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${style.color}">${getMarketingStatusLabel(status)}</span>`;
}

function buildMarketingSharePayload(post){
  const heroTitle = escapeHtml((post.visualTitle || post.title || '').toUpperCase()).replace(/\n/g,'<br/>');
  const bodyHtml = `
    <div class="share-post-hero">
      <h2>${heroTitle}</h2>
      <p>${escapeHtml(post.visualSubtitle || post.desc || '')}</p>
    </div>
    ${post.visualStats?.length ? `<div class="share-stat-grid">${post.visualStats.map(stat=>`
      <div class="share-stat-box">
        <div class="share-stat-val">${escapeHtml(String(stat.val))}</div>
        <div class="share-stat-lbl">${escapeHtml(stat.lbl)}</div>
      </div>`).join('')}</div>` : ''}
    <div class="share-post-list">${buildShareListRows(post.visualItems || [])}</div>
    <div class="share-hashtags">${escapeHtml(post.hashtags || '')}</div>
  `;
  return {
    title: post.title,
    caption: post.caption,
    filename: `mercadotecnia_${slugifyBasic(post.id || post.title)}_${todayISO()}`,
    html: buildVisualShareCard({
      kicker: `${TORNEO_NAMES[currentTorneo] || 'Torneo Lombardo Toledano'} · Mercadotecnia`,
      title: (post.shareTitle || post.title || 'Publicación').toUpperCase(),
      subtitle: post.visualSubtitle || post.desc || '',
      dateLabel: `Listo para publicar · ${fmtDate(todayISO())}`,
      bodyHtml,
      footerNote: post.footerNote || 'Publicación automática lista para redes, difusión y archivo.',
      footerTag: 'Community Manager'
    })
  };
}

function buildMarketingAutoPosts(){
  const torneo = TORNEO_NAMES[currentTorneo] || 'TORNEO LOMBARDO TOLEDANO';
  const categoria = getShareCategoryLabel();
  const tabla = buildTablaData();
  const scorers = getTopScorersData(10);
  const keepers = getTopGoalkeepersData(10);
  const cup = buildCupProjectionData(tabla);
  const sortedParts = getMarketingSortedParts();
  const finished = sortedParts.filter(p=>p.status==='terminado');
  const today = todayISO();
  const todayFinished = finished.filter(p=>p.fecha===today).slice(0,4);
  const todayAgenda = sortedParts.filter(p=>p.fecha===today && p.status!=='terminado').slice().reverse().slice(0,5);
  const weekRange = getWeekRangeISO(today);
  const weekAgenda = sortedParts.filter(p=>(p.fecha||'')>=weekRange.start && (p.fecha||'')<=weekRange.end && p.status!=='terminado').slice().reverse().slice(0,6);
  const weekFinished = finished.filter(p=>(p.fecha||'')>=weekRange.start && (p.fecha||'')<=weekRange.end).slice(0,6);
  const activity = getMarketingActivity();
  const posts = [];
  const leader = tabla[0] || null;
  const runnerUp = tabla[1] || null;
  const topScorer = scorers[0] || null;
  const topKeeper = keepers[0] || null;
  const matchTitle = p => `${p.localNombre||p.local||'Local'} vs ${p.visitaNombre||p.visita||'Visita'}`;

  const addPost = post => posts.push(post);

  if(todayAgenda.length){
    const opener = todayAgenda[0];
    addPost({
      id:'agenda-hoy',
      title:'Partidos de hoy',
      desc:'La jornada de hoy sale con horarios reales, cancha y orden de aparición para mover asistencia desde temprano.',
      format:'Story + feed + WhatsApp',
      platforms:'Instagram Stories · Facebook Stories · WhatsApp',
      priority:'Alta',
      visualTitle:'Partidos\nde hoy',
      visualSubtitle:`${categoria} · Jornada en Cancha Principal`,
      visualItems:todayAgenda.map(p=>({
        title:`${p.horaIni||'--:--'} · ${matchTitle(p)}`,
        desc:`${p.cancha||'Cancha Principal'} · ${p.status==='jugando'?'En juego':'Programado'}`
      })),
      visualStats:[
        { val:todayAgenda.length, lbl:'Partidos' },
        { val:opener?.horaIni || '--:--', lbl:'Primer juego' },
        { val:'Asistencia', lbl:'Objetivo' }
      ],
      hashtags:'#TorneoLombardoToledano #PartidosDeHoy #VamosALombardo',
      footerNote:'Agenda oficial para activar historias, estados y recordatorios previos a la jornada.',
      hook:`Hoy la cancha no descansa: abrimos con ${matchTitle(opener)} a las ${opener?.horaIni||'--:--'}.`,
      cta:'Pregunta en historias cuál es el juego que más esperan y empuja respuestas rápidas.',
      timing:'Publicar 2 horas antes del primer silbatazo y reactivar 15 minutos antes del juego fuerte.',
      networkFocus:'Historias, estados y grupos de WhatsApp para mover asistencia inmediata.',
      caption:[
        `${torneo} | Partidos de hoy`,
        `${categoria}`,
        `Hoy la cancha no descansa: abrimos con ${matchTitle(opener)} a las ${opener?.horaIni||'--:--'}.`,
        ...todayAgenda.map(p=>`${p.horaIni||'--:--'} · ${matchTitle(p)} · ${p.cancha||'Cancha Principal'}`),
        'CTA: comenta cuál juego vienes a ver y etiqueta al equipo que debe pegar primero.',
        '#TorneoLombardoToledano #PartidosDeHoy #VamosALombardo'
      ].join('\n')
    });
  }

  if(todayFinished.length){
    const mainResult = todayFinished[0];
    addPost({
      id:'resultados-hoy',
      title:'Resultados de hoy',
      desc:'Marcadores finales con contexto real de la jornada, listos para feed, grupos y recap rápido.',
      format:'Carrusel premium',
      platforms:'Instagram · Facebook · WhatsApp',
      priority:'Alta',
      visualTitle:'Resultados\nde hoy',
      visualSubtitle:`${categoria} · Cierre oficial del dia`,
      visualItems:todayFinished.map(p=>({ title:getMatchScoreLine(p), desc:summarizeMatchScorers(p) })),
      visualStats:[
        { val:todayFinished.length, lbl:'Partidos' },
        { val:todayFinished.reduce((sum,p)=>sum+(p.gL||0)+(p.gV||0),0), lbl:'Goles del dia' },
        { val:matchTitle(mainResult), lbl:'Juego foco' }
      ],
      hashtags:'#TorneoLombardoToledano #ResultadosDelDia #FutbolLocal',
      footerNote:'Recap oficial para cerrar la jornada con marcadores, goleadores y conversación.',
      hook:`Se cerró el día y ${matchTitle(mainResult)} dejó ruido en la categoría.`,
      cta:'Cierra el copy preguntando quién fue el MVP de la jornada para empujar comentarios.',
      timing:'Publicar apenas cierre el último partido o máximo 20 minutos después.',
      networkFocus:'Feed para autoridad visual y WhatsApp para difusión rápida del resultado completo.',
      caption:[
        `${torneo} | Resultados de hoy`,
        `${categoria}`,
        `Se cerró el día y ${matchTitle(mainResult)} dejó ruido en la categoría.`,
        ...todayFinished.map(p=>`${getMatchScoreLine(p)}\n${summarizeMatchScorers(p)}`),
        'CTA: deja tu MVP de la jornada y etiqueta al equipo que salió más fuerte.',
        '#TorneoLombardoToledano #ResultadosDelDia #FutbolLocal'
      ].join('\n\n')
    });
  }

  if(weekAgenda.length){
    addPost({
      id:'agenda-semana',
      title:'Partidos de la semana',
      desc:'Calendario semanal armado con cruces reales para planear difusión continua y no publicar solo a última hora.',
      format:'Carrusel calendario',
      platforms:'Instagram · Facebook',
      priority:'Alta',
      visualTitle:'Partidos\nde la semana',
      visualSubtitle:`${categoria} · Del ${fmtDate(weekRange.start)} al ${fmtDate(weekRange.end)}`,
      visualItems:weekAgenda.map(p=>({
        title:`${fmtDate(p.fecha)} · ${matchTitle(p)}`,
        desc:`${p.horaIni||'--:--'} · ${p.cancha||'Cancha Principal'}`
      })),
      visualStats:[
        { val:weekAgenda.length, lbl:'Cruces' },
        { val:fmtDate(weekRange.start), lbl:'Arranque' },
        { val:fmtDate(weekRange.end), lbl:'Cierre' }
      ],
      hashtags:'#TorneoLombardoToledano #PartidosDeLaSemana #AgendaSemanal',
      footerNote:'Pieza semanal para ordenar la narrativa del torneo de lunes a domingo.',
      hook:`La semana ya tiene ruta: ${weekAgenda.length} cruces confirmados en ${categoria}.`,
      cta:'Usa el caption para pedir que guarden la publicación y no se pierdan su juego.',
      timing:'Publicar al arrancar la semana y reactivar el día con más partidos.',
      networkFocus:'Feed y Facebook para visibilidad sostenida durante varios días.',
      caption:[
        `${torneo} | Partidos de la semana`,
        `${categoria} · Del ${fmtDate(weekRange.start)} al ${fmtDate(weekRange.end)}`,
        `La semana ya tiene ruta: ${weekAgenda.length} cruces confirmados.`,
        ...weekAgenda.map(p=>`${fmtDate(p.fecha)} · ${p.horaIni||'--:--'} · ${matchTitle(p)} · ${p.cancha||'Cancha Principal'}`),
        'CTA: guarda esta publicación y etiqueta al equipo que llega con más presión.',
        '#TorneoLombardoToledano #PartidosDeLaSemana #AgendaSemanal'
      ].join('\n')
    });
  }

  if(weekFinished.length){
    addPost({
      id:'resumen-semana',
      title:'Resumen de la semana',
      desc:'Cierre semanal con resultados reales para que la conversación no se enfríe entre jornadas.',
      format:'Carrusel resumen',
      platforms:'Instagram · Facebook · TikTok',
      priority:'Media',
      visualTitle:'Resumen\nde la semana',
      visualSubtitle:`${categoria} · Lo que dejó la semana`,
      visualItems:weekFinished.map(p=>({ title:getMatchScoreLine(p), desc:summarizeMatchScorers(p) })),
      visualStats:[
        { val:weekFinished.length, lbl:'Partidos' },
        { val:weekFinished.reduce((sum,p)=>sum+(p.gL||0)+(p.gV||0),0), lbl:'Goles' },
        { val:leader?.nombre || 'Abierto', lbl:'Lider' }
      ],
      hashtags:'#TorneoLombardoToledano #ResumenSemanal #FutbolLocal',
      footerNote:'Recap semanal para sostener highlights, tabla y debate del torneo.',
      hook:`Así se movió la semana en ${categoria}: marcadores, goles y tabla metiendo presión.`,
      cta:'Remata con una pregunta directa: ¿qué partido cambió más la tabla?',
      timing:'Publicar al cierre del último juego del fin de semana.',
      networkFocus:'Feed para resumen formal y reel corto para TikTok.',
      caption:[
        `${torneo} | Resumen de la semana`,
        `${categoria}`,
        'Así se movió la semana en la categoría:',
        ...weekFinished.map(p=>`${getMatchScoreLine(p)}\n${summarizeMatchScorers(p)}`),
        'CTA: comenta qué partido cambió más el torneo esta semana.',
        '#TorneoLombardoToledano #ResumenSemanal #FutbolLocal'
      ].join('\n\n')
    });
  }

  if(finished.length){
    const latest = finished.slice(0,3);
    addPost({
      id:'ultimos-partidos',
      title:'Ultimos partidos',
      desc:'Resumen express de los juegos más recientes para mantener vivas las redes entre una publicación fuerte y otra.',
      format:'Carrusel / reel corto',
      platforms:'Instagram · TikTok · Facebook',
      priority:'Media',
      visualTitle:'Ultimos\npartidos',
      visualSubtitle:`${categoria} · Lo mas reciente del torneo`,
      visualItems:latest.map(p=>({ title:getMatchScoreLine(p), desc:summarizeMatchScorers(p) })),
      visualStats:[
        { val:latest.length, lbl:'Partidos' },
        { val:latest.reduce((sum,p)=>sum+(p.gL||0)+(p.gV||0),0), lbl:'Goles' },
        { val:topScorer?.jugador || 'Foco', lbl:'Jugador caliente' }
      ],
      hashtags:'#TorneoLombardoToledano #UltimosPartidos #FutbolLocal',
      footerNote:'Resumen rápido para sostener ritmo editorial sin caer en copy genérico.',
      hook:'Los últimos movimientos del torneo ya pegaron en la tabla y en el ánimo de la categoría.',
      cta:'Invita a guardar el post y a debatir cuál marcador pesó más.',
      timing:'Publicar entre jornadas cuando quieras sostener conversación.',
      networkFocus:'TikTok para recap rápido y feed para formato editorial.',
      caption:[
        `${torneo} | Ultimos partidos`,
        `${categoria}`,
        ...latest.map(p=>`${getMatchScoreLine(p)}\n${summarizeMatchScorers(p)}`),
        'CTA: ¿qué resultado pesó más en la carrera por la cima?',
        '#TorneoLombardoToledano #UltimosPartidos #FutbolLocal'
      ].join('\n\n')
    });
  }

  const tablaPayload = getStatsSharePayload('tabla', tabla);
  if(tablaPayload && leader){
    addPost({
      id:'tabla-general',
      title:'Tabla general del torneo',
      desc:'Pieza institucional para reforzar la pelea por la cima y ordenar el discurso competitivo con datos reales.',
      format:'Carrusel premium',
      platforms:'Instagram · Facebook',
      priority:'Alta',
      visualTitle:'Tabla general',
      visualSubtitle:'Clasificacion actual y presion por el liderato',
      hashtags:'#TorneoLombardoToledano #TablaGeneral #CopaDelTorneo',
      footerNote:'Pieza clave para reforzar la narrativa del torneo con autoridad visual.',
      hook:`${leader.nombre} manda hoy la tabla${runnerUp ? `, pero ${runnerUp.nombre} sigue pegado.` : '.'}`,
      cta:'Cierra con la pregunta: ¿quién llega líder al corte final?',
      timing:'Publicar cada vez que un resultado cambie la parte alta.',
      networkFocus:'Feed y Facebook como pieza oficial de referencia.',
      caption:[
        `${torneo} | Tabla general`,
        `${categoria}`,
        `${leader.nombre} manda hoy la tabla${runnerUp ? `, pero ${runnerUp.nombre} sigue metido en la pelea.` : '.'}`,
        tablaPayload.caption
      ].join('\n\n'),
      sharePayload:tablaPayload
    });
  }

  const cupPayload = getStatsSharePayload('copa', cup);
  if(cupPayload && cup){
    const firstPair = cup.rounds[0]?.matches[0] || null;
    addPost({
      id:'cuadro-copa',
      title:'Camino a la copa',
      desc:'Visual de bracket vivo para explicar cómo se sembraría la copa según la tabla del momento.',
      format:'Bracket share',
      platforms:'Instagram · Facebook · WhatsApp',
      priority:'Alta',
      visualTitle:'Camino a la copa',
      visualSubtitle:'El cuadro se actualiza solo con la tabla',
      hashtags:'#TorneoLombardoToledano #CopaDelTorneo #CaminoAlTitulo',
      footerNote:'Bracket oficial para explicar el camino al título sin depender de copies genéricos.',
      hook:firstPair ? `Si la copa arrancara hoy, abriría con ${firstPair.slotA.displayName} vs ${firstPair.slotB.displayName}.` : 'La copa ya tiene cuadro provisional según la tabla.',
      cta:'Usa este post para preguntar qué seed está mejor acomodado rumbo al título.',
      timing:'Publicar después de cada cambio fuerte en tabla o al cierre semanal.',
      networkFocus:'Feed, estados y grupos para disparar debate de cruces.',
      caption:[
        `${torneo} | Camino a la copa`,
        `${categoria}`,
        firstPair ? `La llave ya marca cruces como ${firstPair.slotA.displayName} vs ${firstPair.slotB.displayName}.` : 'La copa ya tiene sembrado provisional.',
        cupPayload.caption
      ].join('\n\n'),
      sharePayload:cupPayload
    });
  }

  const scorersPayload = getStatsSharePayload('goleadores', scorers);
  if(scorersPayload && topScorer){
    addPost({
      id:'top-goleadores',
      title:'Top 10 goleadores',
      desc:'Contenido ideal para conversación, etiquetas y rivalidad sana entre jugadores que están marcando diferencia.',
      format:'Carrusel + historia',
      platforms:'Instagram · Facebook · WhatsApp',
      priority:'Media',
      visualTitle:'Top 10 goleadores',
      visualSubtitle:'Quien esta rompiendo la red',
      hashtags:'#TorneoLombardoToledano #Top10Goleadores #Futbol',
      footerNote:'Post de alto engagement para menciones, comentarios y rivalidad deportiva.',
      hook:`${topScorer.jugador} está encendido y hoy marca el paso en la tabla individual.`,
      cta:'Etiqueta a los jugadores del top para empujar re-shares orgánicos.',
      timing:'Publicar tras jornadas con varios goles o cuando cambie el líder del ranking.',
      networkFocus:'Instagram y WhatsApp para mover menciones directas de jugadores.',
      caption:[
        `${torneo} | Top 10 goleadores`,
        `${categoria}`,
        `${topScorer.jugador} tomó la punta individual y la pelea sigue abierta.`,
        scorersPayload.caption
      ].join('\n\n'),
      sharePayload:scorersPayload
    });
  }

  const keepersPayload = getStatsSharePayload('porteros', keepers);
  if(keepersPayload && topKeeper){
    addPost({
      id:'top-porteros',
      title:'Top 10 porteros',
      desc:'Contenido diferencial para destacar seguridad defensiva, porterías imbatidas y constancia bajo los tres palos.',
      format:'Carrusel premium',
      platforms:'Instagram · Facebook',
      priority:'Media',
      visualTitle:'Top 10 porteros',
      visualSubtitle:'Seguridad bajo los tres palos',
      hashtags:'#TorneoLombardoToledano #Top10Porteros #CopaDelTorneo',
      footerNote:'Post diferencial para profesionalizar la comunicación del torneo.',
      hook:`${topKeeper.portero} hoy sostiene la vara más alta en el arco de ${topKeeper.equipo}.`,
      cta:'Invita a etiquetar al portero más pesado de la categoría.',
      timing:'Publicar cuando haya porterías imbatidas recientes o antes de jornadas cerradas.',
      networkFocus:'Feed y Facebook para posicionar contenido menos obvio y más profesional.',
      caption:[
        `${torneo} | Top 10 porteros`,
        `${categoria}`,
        `${topKeeper.portero} hoy sostiene la vara más alta en el arco de ${topKeeper.equipo}.`,
        keepersPayload.caption
      ].join('\n\n'),
      sharePayload:keepersPayload
    });
  }

  if(!posts.length){
    addPost({
      id:'post-placeholder',
      title:'Calienta redes del torneo',
      desc:'Todavía faltan resultados cerrados, pero la marca del torneo puede seguir activa con una pieza de expectativa.',
      format:'Post informativo',
      platforms:'Instagram · Facebook',
      priority:'Media',
      visualTitle:'Torneo\nLombardo',
      visualSubtitle:'Proximamente mas partidos, tabla y copa',
      visualItems:[
        { title:'Categoria activa', desc:categoria },
        { title:'Objetivo', desc:'Mantener el torneo visible entre jornadas' },
        { title:'Siguiente paso', desc:'Registrar partidos para disparar posts automaticos' }
      ],
      visualStats:[
        { val:'Plan', lbl:'Motor' },
        { val:'Auto', lbl:'Posts' },
        { val:'Listo', lbl:'Panel' }
      ],
      hashtags:'#TorneoLombardoToledano #Proximamente #Futbol',
      footerNote:'Plantilla base para no dejar frías las redes mientras entra más data.',
      hook:'La categoria ya está encendida y apenas empieza a tomar forma.',
      cta:'Usa esta pieza para invitar a seguir la cuenta y activar la próxima jornada.',
      timing:'Publicar cuando todavía no haya resultados pero sí quieras sostener presencia.',
      networkFocus:'Feed y estados para mantener continuidad visual.',
      caption:[
        `${torneo} | ${categoria}`,
        'La categoria ya está encendida y la próxima jornada viene con más movimiento.',
        'Sigue la cuenta para ver partidos del dia, de la semana, tabla, copa y rankings automaticos.',
        '#TorneoLombardoToledano #Proximamente #Futbol'
      ].join('\n')
    });
  }

  return posts.map((post, index)=>{
    const saved = activity[post.id] || {};
    return {
      ...post,
      status:saved.status || (index<3 ? 'programado' : 'borrador')
    };
  });
}

function buildMarketingIdeasFallback(){
  const tabla = buildTablaData();
  const scorers = getTopScorersData(3);
  const keepers = getTopGoalkeepersData(3);
  const finished = getMarketingSortedParts().filter(p=>p.status==='terminado').slice(0,3);
  const leader = tabla[0]?.nombre || 'liderato abierto';
  const runnerUp = tabla[1]?.nombre || 'sin segundo definido';
  return [
    '1. Post de resultados del día: portada fuerte, tres mejores marcadores y CTA para comentar el mejor partido.',
    `2. Post tabla general: resalta que ${leader} va primero y que ${runnerUp} sigue pegado en la pelea por la cima.`,
    `3. Reel corto: transición de marcadores + celebración final con audio en tendencia y cierre "Así se jugó en Lombardo Toledano".`,
    `4. Story interactiva: encuesta entre goleadores destacados (${scorers.map(s=>s.jugador).join(', ') || 'sin datos aún'}) para empujar respuestas y menciones.`,
    `5. Post diferencial de porteros: destaca a ${keepers[0]?.portero || 'los guardametas del torneo'} con enfoque en porterías imbatidas.`,
    `6. Publicidad local: impulsa la próxima jornada con clip de ${finished[0] ? getMatchScoreLine(finished[0]) : 'la última actividad'} y llamado a asistir / seguir redes.`,
    'Calendario sugerido 7 días: hoy resultados, mañana tabla, pasado mañana goleadores, luego porteros, después agenda de jornada, reel emocional y cierre con patrocinio o convocatoria.',
    'Tono recomendado: barrio, competitivo, auténtico, directo y orgulloso del torneo; evita frases genéricas y usa lenguaje de cancha.'
  ].join('\n\n');
}

function persistMarketingAutoPosts(reason='partidos'){
  if(!isAdmin) return Promise.resolve();
  const key = getMarketingKey();
  const posts = buildMarketingAutoPosts();
  const tabla = buildTablaData();
  const cup = buildCupProjectionData(tabla);
  const signature = JSON.stringify({
    tabla:tabla.map(t=>[t.nombre,t.pts,t.gf,t.gc]),
    posts:posts.map(p=>[p.id,p.title,p.caption]),
    cup:cup?.rounds?.[0]?.matches?.map(m=>[m.slotA.displayName,m.slotB.displayName]) || []
  });
  if(marketingAutoSyncState.signatures[key] === signature) return Promise.resolve();
  marketingAutoSyncState.signatures[key] = signature;

  const batch = {};
  const base = `mercadotecnia/${key}`;
  const now = Date.now();
  const autoPosts = {};
  const existingActivity = getMarketingActivity();
  const actividad = { ...existingActivity };
  posts.forEach((post,index)=>{
    autoPosts[post.id] = {
      title:post.title,
      desc:post.desc,
      caption:post.caption,
      priority:post.priority,
      platforms:post.platforms,
      hook:post.hook || '',
      cta:post.cta || '',
      timing:post.timing || '',
      networkFocus:post.networkFocus || '',
      hashtags:post.hashtags || '',
      generatedAt:now
    };
    if(!existingActivity[post.id]){
      actividad[post.id] = {
        status:index<3 ? 'programado' : 'borrador',
        updatedAt:now,
        title:post.title,
        auto:true
      };
      batch[`${base}/actividad/${post.id}`] = actividad[post.id];
    }
  });
  const autoPostsMeta = {
    updatedAt:now,
    reason,
    total:posts.length,
    leader:tabla[0]?.nombre || '',
    cupStage:cup?.stageLabel || '',
    summary:posts.slice(0,3).map(p=>p.title).join(' · ')
  };
  batch[`${base}/autoPosts`] = autoPosts;
  batch[`${base}/autoPostsMeta`] = autoPostsMeta;
  batch[`${base}/updatedAt`] = now;
  if(fs){
    return saveDoc('mercadotecnia', getMarketingKey(), scopedPayload({
      torneo:currentTorneo,
      cat:currentCat,
      autoPosts,
      actividad,
      autoPostsMeta,
      updatedAt:now
    })).catch(err=>{
      console.error(err);
    });
  }
  return db.ref().update(batch).catch(err=>{
    console.error(err);
  });
}

function scheduleMarketingAutoSync(reason='partidos'){
  if(!isAdmin) return;
  clearTimeout(marketingAutoSyncState.timer);
  marketingAutoSyncState.timer = setTimeout(()=>{
    persistMarketingAutoPosts(reason);
  }, 450);
}

function renderMercadotecnia(){
  if(!isAdmin) return;
  const data = getMarketingData();
  fillMarketingNetworksForm(data.redes || {});
  const posts = buildMarketingAutoPosts();
  marketingPostsCache = {};
  posts.forEach(post=>{ marketingPostsCache[post.id] = post; });

  const redes = { instagram:{followers:0,reach:0,eng:0,goal:0}, tiktok:{followers:0,reach:0,eng:0,goal:0}, facebook:{followers:0,reach:0,eng:0,goal:0}, ...(data.redes||{}) };
  const followers = ['instagram','tiktok','facebook'].reduce((sum,key)=>sum+Number(redes[key]?.followers||0),0);
  const reach = ['instagram','tiktok','facebook'].reduce((sum,key)=>sum+Number(redes[key]?.reach||0),0);
  const engValues = ['instagram','tiktok','facebook'].map(key=>Number(redes[key]?.eng||0)).filter(Boolean);
  const avgEng = engValues.length ? (engValues.reduce((a,b)=>a+b,0)/engValues.length).toFixed(1) : '0.0';
  const weeklyGoal = ['instagram','tiktok','facebook'].reduce((sum,key)=>sum+Number(redes[key]?.goal||0),0);
  const scheduled = posts.filter(p=>p.status==='programado').length;
  const published = posts.filter(p=>p.status==='publicado').length;
  const draft = posts.filter(p=>p.status==='borrador').length;
  const projectedInteractions = Math.round(['instagram','tiktok','facebook'].reduce((sum,key)=>{
    const network = redes[key] || {};
    return sum + ((Number(network.reach||0) * Number(network.eng||0)) / 100);
  },0));
  const tabla = buildTablaData();
  const autoMeta = data.autoPostsMeta || {};

  const dashboard = document.getElementById('mercaDashboard');
  if(dashboard){
    dashboard.innerHTML = `
      <div class="marketing-grid">
        <div class="marketing-metric"><div class="marketing-metric-val">${followers}</div><div class="marketing-metric-lbl">Seguidores conectados</div><div class="marketing-metric-sub">Suma de Instagram, TikTok y Facebook registrados en el panel.</div></div>
        <div class="marketing-metric"><div class="marketing-metric-val">${reach}</div><div class="marketing-metric-lbl">Alcance semanal base</div><div class="marketing-metric-sub">Proyección simple con el alcance promedio cargado por red.</div></div>
        <div class="marketing-metric"><div class="marketing-metric-val">${projectedInteractions}</div><div class="marketing-metric-lbl">Interacción estimada</div><div class="marketing-metric-sub">Calculada con alcance y engagement promedio reportado.</div></div>
        <div class="marketing-metric"><div class="marketing-metric-val">${weeklyGoal}</div><div class="marketing-metric-lbl">Meta de piezas / semana</div><div class="marketing-metric-sub">La meta sale de las redes conectadas para empujar consistencia editorial.</div></div>
        <div class="marketing-metric"><div class="marketing-metric-val">${published}/${scheduled}/${draft}</div><div class="marketing-metric-lbl">Publicado / Programado / Borrador</div><div class="marketing-metric-sub">Estado real del contenido generado en este apartado.</div></div>
        <div class="marketing-metric"><div class="marketing-metric-val">${tabla[0]&&tabla[tabla.length-1]?`${tabla[0].nombre.split(' ')[0]} vs ${tabla[tabla.length-1].nombre.split(' ')[0]}`:'En construcción'}</div><div class="marketing-metric-lbl">Cruce de copa</div><div class="marketing-metric-sub">Usa el sembrado actual para empujar expectativa por el camino al título.</div></div>
      </div>
      <div class="info-box" style="margin-top:12px">Engagement promedio actual: <strong>${avgEng}%</strong>. Publicaciones automáticas listas: <strong>${posts.length}</strong>. Última automatización: <strong>${autoMeta.updatedAt ? new Date(autoMeta.updatedAt).toLocaleString('es-MX',{ day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : 'pendiente'}</strong>.</div>
    `;
  }

  const calendarEl = document.getElementById('mercaCalendar');
  if(calendarEl){
    const today = new Date();
    const formats = ['Carrusel','Reel / video','Historia','Foto','Carrusel','Reel','Story + feed'];
    const platforms = ['Instagram','TikTok','Instagram','Facebook','Instagram','TikTok','Facebook'];
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const items = Array.from({length:7}, (_,i)=>{
      const d = new Date(today);
      d.setDate(today.getDate()+i);
      const post = posts[i % posts.length];
      return {
        day:d.getDate(),
        month:months[d.getMonth()],
        weekday:days[d.getDay()],
        title:post.title,
        desc:`${formats[i]} para ${platforms[i]} · ${post.priority} prioridad · ${post.desc}`,
        status:post.status
      };
    });
    calendarEl.innerHTML = items.map(item=>`
      <div class="marketing-calendar-item">
        <div class="marketing-calendar-day"><strong>${item.day}</strong><span>${item.month}</span></div>
        <div class="marketing-calendar-copy">
          <div class="marketing-calendar-title">${escapeHtml(item.weekday)} · ${escapeHtml(item.title)}</div>
          <div class="marketing-calendar-desc">${escapeHtml(item.desc)}</div>
        </div>
        ${getMarketingStatusBadge(item.status)}
      </div>
    `).join('');
  }

  const ideasEl = document.getElementById('mercaIdeasOutput');
  if(ideasEl){
    const ideas = data.ideasMarketing || data.ideasIA || buildMarketingIdeasFallback();
    ideasEl.innerHTML = `<pre>${escapeHtml(ideas)}</pre>`;
  }

  const postsEl = document.getElementById('mercaPosts');
  if(postsEl){
    postsEl.innerHTML = `<div class="marketing-post-grid">${posts.map(post=>`
      <div class="marketing-post-card">
        <div class="marketing-post-preview">
          <div class="marketing-post-eyebrow">${escapeHtml(post.platforms)} · ${escapeHtml(post.format)}</div>
          <div class="marketing-post-title">${escapeHtml(post.title).replace(/\n/g,'<br/>')}</div>
          <div class="marketing-post-desc">${escapeHtml(post.desc)}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0">
          ${getMarketingStatusBadge(post.status)}
          <span class="share-mini-chip">${escapeHtml(post.priority)} prioridad</span>
        </div>
        <div class="marketing-post-meta">
          ${post.hook ? `<div class="marketing-post-line"><strong>Hook:</strong> ${escapeHtml(post.hook)}</div>` : ''}
          ${post.cta ? `<div class="marketing-post-line"><strong>CTA:</strong> ${escapeHtml(post.cta)}</div>` : ''}
          ${post.timing ? `<div class="marketing-post-line"><strong>Momento:</strong> ${escapeHtml(post.timing)}</div>` : ''}
          ${post.networkFocus ? `<div class="marketing-post-line"><strong>Enfoque:</strong> ${escapeHtml(post.networkFocus)}</div>` : ''}
        </div>
        <div class="marketing-post-caption">${escapeHtml(post.caption)}</div>
        <div class="marketing-post-actions">
          <button class="btn btn-g btn-sm" onclick="openMarketingPostShare('${post.id}')">📤 Visual</button>
          <button class="btn btn-out btn-sm" onclick="copyMarketingCaption('${post.id}')">📋 Copiar caption</button>
          <button class="btn btn-out btn-sm" onclick="setMarketingPostStatus('${post.id}','borrador')">Borrador</button>
          <button class="btn btn-b btn-sm" onclick="setMarketingPostStatus('${post.id}','programado')">Programado</button>
          <button class="btn btn-g btn-sm" onclick="setMarketingPostStatus('${post.id}','publicado')">Publicado</button>
        </div>
      </div>
    `).join('')}</div>`;
  }
}

async function saveMarketingNetworks(){
  const redes = readMarketingNetworksForm();
  const patch = scopedPayload({
    torneo:currentTorneo,
    cat:currentCat,
    redes,
    updatedAt:Date.now()
  });
  try{
    if(fs) await saveDoc('mercadotecnia', getMarketingKey(), patch);
    else await db.ref(`mercadotecnia/${getMarketingKey()}`).update(patch);
    showToast('Datos de redes guardados','tg');
  }catch(err){
    console.error(err);
    showToast('No se pudieron guardar los datos de redes','tr');
  }
}

async function setMarketingPostStatus(id, status){
  const data = getMarketingData();
  const actividad = { ...(data.actividad || {}) };
  actividad[id] = {
    ...(actividad[id] || {}),
    status,
    updatedAt:Date.now(),
    title:marketingPostsCache[id]?.title || id
  };
  try{
    if(fs) await saveDoc('mercadotecnia', getMarketingKey(), scopedPayload({ torneo:currentTorneo, cat:currentCat, actividad, updatedAt:Date.now() }));
    else await db.ref(`mercadotecnia/${getMarketingKey()}/actividad/${id}`).update(actividad[id]);
    showToast(`Estado actualizado a ${getMarketingStatusLabel(status)}`,'tg');
  }catch(err){
    console.error(err);
    showToast('No se pudo actualizar el estado','tr');
  }
}

function openMarketingPostShare(id){
  const post = marketingPostsCache[id];
  if(!post) return;
  const payload = post.sharePayload || buildMarketingSharePayload(post);
  post.sharePayload = payload;
  openVisualShare(payload);
}

function copyMarketingCaption(id){
  const post = marketingPostsCache[id];
  if(!post) return;
  return copyPlainText(post.caption || '', '📋 Caption copiado');
}

async function generarIdeasMerca(){
  const btn = document.getElementById('mercaIdeasBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Actualizando...'; }
  try{
    const ideas = buildMarketingIdeasFallback();
    const patch = scopedPayload({
      torneo:currentTorneo,
      cat:currentCat,
      ideasMarketing:ideas,
      ideasUpdatedAt:Date.now()
    });
    if(fs) await saveDoc('mercadotecnia', getMarketingKey(), patch);
    else await db.ref(`mercadotecnia/${getMarketingKey()}`).update(patch);
    const ideasEl = document.getElementById('mercaIdeasOutput');
    if(ideasEl) ideasEl.innerHTML = `<pre>${escapeHtml(ideas)}</pre>`;
    showToast('Ideas de Mercadotecnia actualizadas','tg');
  }catch(err){
    console.error(err);
    showToast('No se pudieron actualizar las ideas','tr');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = '💡 Actualizar ideas'; }
  }
}

