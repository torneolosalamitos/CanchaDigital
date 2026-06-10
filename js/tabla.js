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
  const parts = filteredParts().filter(p=>p.status==='terminado');
  return buildTablaDataFromParts(parts);
}

function buildTablaVuelta(vuelta){ // vuelta: 1 o 2
  // Una "vuelta" = JORNADAS_POR_VUELTA jornadas seguidas
  // Detectamos la jornada de cada partido por su campo jornada o posición cronológica
  const allParts = filteredParts().filter(p=>p.status==='terminado');
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

function buildCupProjectionDataFemenil(dataOverride=null){
  // FORMATO CATEGORÍA LIBRE FEMENIL:
  // 4 equipos · todos vs todos · 2 vueltas · 6 jornadas
  // Semis: 1° vs 4° / 2° vs 3°
  // Final: ganadoras de semifinal
  const tabla = Array.isArray(dataOverride) && dataOverride.length ? dataOverride.slice() : buildTablaData();
  if(tabla.length < 2) return null;
  const seededTeams = tabla.slice(0, Math.min(tabla.length, 4)).map((t,i)=>({...t, seed:i+1}));
  const s = (n) => seededTeams.find(t=>t.seed===n) || null;

  const sf1 = {
    id:'sf1',
    slotA: createCupSlot(s(1),1,s(1)?s(1).nombre:'1°',{subtitle:'Llega como líder'}),
    slotB: createCupSlot(s(4),4,s(4)?s(4).nombre:'4°',{subtitle:s(4)?'Va por la sorpresa':'4° Lugar'}),
    winner: null,
    winnerLabel: 'Ganadora SF1',
    note: `${s(1)?.nombre||'1°'} vs ${s(4)?.nombre||'4°'}`
  };
  const sf2 = {
    id:'sf2',
    slotA: createCupSlot(s(2),2,s(2)?s(2).nombre:'2°',{subtitle:'Quiere la gran final'}),
    slotB: createCupSlot(s(3),3,s(3)?s(3).nombre:'3°',{subtitle:s(3)?'Busca dar el golpe':'3° Lugar'}),
    winner: null,
    winnerLabel: 'Ganadora SF2',
    note: `${s(2)?.nombre||'2°'} vs ${s(3)?.nombre||'3°'}`
  };
  const rSemi = { name:'Semifinales', short:'SF', matches:[sf1, sf2] };

  const fin = {
    id:'final',
    slotA: createCupSlot(sf1.winner,sf1.winner?.seed||null,sf1.winnerLabel,{subtitle:'Ganadora de Semifinal 1'}),
    slotB: createCupSlot(sf2.winner,sf2.winner?.seed||null,sf2.winnerLabel,{subtitle:'Ganadora de Semifinal 2'}),
    winner: null,
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
    isFemenilFormat: true
  };
}

function buildCupProjectionData(dataOverride=null){
  // FORMATO CATEGORÍA LIBRE VARONIL:
  // TOP 6 clasifican
  // Ronda de Repechaje:
  //   Rep-A: 4° vs 5°  → ganador a SF contra 1° (Bracket Izquierdo)
  //   Rep-B: 3° vs 6°  → ganador a SF contra 2° (Bracket Derecho)
  // Semifinales:
  //   SF1 (Izq): 1° vs Gan(Rep-A)
  //   SF2 (Der): 2° vs Gan(Rep-B)
  // Final: Gan SF1 vs Gan SF2
  if(currentCat === 'cat_libre_femenil') return buildCupProjectionDataFemenil(dataOverride);
  const tabla = Array.isArray(dataOverride) && dataOverride.length ? dataOverride.slice() : buildTablaData();
  if(tabla.length < 2) return null;
  const CUP_QUALIFY = 6;
  const seededTeams = tabla.slice(0, Math.min(tabla.length, CUP_QUALIFY)).map((t,i)=>({...t, seed:i+1}));
  const s = (n) => seededTeams.find(t=>t.seed===n) || null;

  // ── REPECHAJE ──
  const repA = {
    id:'repA',
    slotA: createCupSlot(s(4),4,s(4)?s(4).nombre:'4°',{}),
    slotB: createCupSlot(s(5),5,s(5)?s(5).nombre:'5°',{}),
    winner: null,
    winnerLabel: 'Gan. Rep-A',
    note: `${s(4)?.nombre||'4°'} vs ${s(5)?.nombre||'5°'}`
  };
  const repB = {
    id:'repB',
    slotA: createCupSlot(s(3),3,s(3)?s(3).nombre:'3°',{}),
    slotB: createCupSlot(s(6),6,s(6)?s(6).nombre:'6°',{}),
    winner: null,
    winnerLabel: 'Gan. Rep-B',
    note: `${s(3)?.nombre||'3°'} vs ${s(6)?.nombre||'6°'}`
  };
  const r0 = { name:'Repechaje', short:'REP', matches:[repA, repB] };

  // ── SEMIFINALES ──
  // SF1 (bracket izquierdo): 1° (bye directo) vs Ganador Rep-A
  const sf1 = {
    id:'sf1',
    slotA: createCupSlot(s(1),1,s(1)?s(1).nombre:'1°',{subtitle:s(1)?`${s(1).pts||0}pts · Clasificó directo`:'Clasificó directo'}),
    slotB: createCupSlot(repA.winner,repA.winner?.seed||null,repA.winnerLabel,{subtitle:repA.winner?`Seed ${repA.winner.seed}`:'Ganador Rep-A'}),
    winner: null,
    winnerLabel: 'Ganador SF1',
    note: `${s(1)?.nombre||'1°'} vs ${repA.winnerLabel}`
  };
  // SF2 (bracket derecho): 2° (bye directo) vs Ganador Rep-B
  const sf2 = {
    id:'sf2',
    slotA: createCupSlot(s(2),2,s(2)?s(2).nombre:'2°',{subtitle:s(2)?`${s(2).pts||0}pts · Clasificó directo`:'Clasificó directo'}),
    slotB: createCupSlot(repB.winner,repB.winner?.seed||null,repB.winnerLabel,{subtitle:repB.winner?`Seed ${repB.winner.seed}`:'Ganador Rep-B'}),
    winner: null,
    winnerLabel: 'Ganador SF2',
    note: `${s(2)?.nombre||'2°'} vs ${repB.winnerLabel}`
  };
  const r1 = { name:'Semifinales', short:'SF', matches:[sf1, sf2] };

  // ── FINAL ──
  const fin = {
    id:'final',
    slotA: createCupSlot(sf1.winner,sf1.winner?.seed||null,sf1.winnerLabel,{subtitle:sf1.winner?`Seed ${sf1.winner.seed}`:'Ganador SF1'}),
    slotB: createCupSlot(sf2.winner,sf2.winner?.seed||null,sf2.winnerLabel,{subtitle:sf2.winner?`Seed ${sf2.winner.seed}`:'Ganador SF2'}),
    winner: null,
    winnerLabel: 'Campeón',
    note: 'Gran Final'
  };
  const r2 = { name:'Final', short:'F', matches:[fin] };

  const rounds = [r0, r1, r2];
  const eliminated = tabla.slice(CUP_QUALIFY).map((t,i)=>({...t, seed:CUP_QUALIFY+i+1}));
  return {
    bracketSize: 6,
    qualifiedTeams: seededTeams.length,
    hasByes: true, // 1° y 2° tienen bye a semis
    stageLabel: 'Repechaje',
    leader: seededTeams[0]||null,
    rounds, seeds: seededTeams, eliminated
  };
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

function buildGranFinalFemenilHtml(cupData, adminMode=false){
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
          <div class="gff-camp-tag">CAMPEONAS</div>
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
          <div class="gff-grand-sub">Ganadoras de semifinales</div>
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

  // Formato Femenil: Gran Final directa 1° vs 2°
  if(cupData.isFemenilFormat){
    return buildGranFinalFemenilHtml(cupData, adminMode);
  }

  // Copa visual: si hay exactamente 3 rondas (8 equipos), usar layout estilo torneo
  // Izquierda: ronda 0 (mitad A) + ronda 1 mitad A, Centro: Final, Derecha: ronda 0 (mitad B) + ronda 1 mitad B
  const rounds = cupData.rounds;
  const totalRounds = rounds.length;

  // Layout tipo bracket de copa: izquierda → centro ← derecha
  if(totalRounds >= 2 && !shareMode){
    return buildCopaBracketVisual(cupData, adminMode);
  }

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

function buildCopaBracketVisual(cupData, adminMode=false){
  // FORMATO CATEGORÍA LIBRE VARONIL
  // Rondas: [Repechaje, Semifinales, Final]
  // Bracket Izquierdo: Rep-A (4°vs5°) → SF1 contra 1°
  // Bracket Derecho:  Rep-B (3°vs6°) → SF2 contra 2°
  const rounds = cupData.rounds;
  const rRep   = rounds[0];  // Repechaje (2 partidos)
  const rSemi  = rounds.length > 1 ? rounds[1] : null; // Semifinales
  const rFinal = rounds[rounds.length - 1]; // Final
  const finalMatch = rFinal?.matches[0] || null;
  const campeon = finalMatch?.winner || null;

  // Rep-A (4vs5) → izquierda  /  Rep-B (3vs6) → derecha
  const repA = rRep?.matches[0] || null;
  const repB = rRep?.matches[1] || null;
  const sf1  = rSemi?.matches[0] || null; // izquierda (1° + ganRepA)
  const sf2  = rSemi?.matches[1] || null; // derecha (2° + ganRepB)

  // — render un slot individual —
  function slotHtml(s, isByeSlot=false){
    if(!s) return `<div class="cb-vs-slot cb-tbd-slot"><span class="cb-seed">?</span><span class="cb-logo-ph">⚽</span><span class="cb-name">Por definirse</span></div>`;
    const logo = s.team?.logo
      ? `<img class="cb-logo" src="${escapeHtml(s.team.logo)}" />`
      : `<span class="cb-logo-ph">${s.isBye?'⬜':'⚽'}</span>`;
    const seedCls = s.seed===1 ? 'cb-seed cb-seed-gold' : s.seed===2 ? 'cb-seed cb-seed-silver' : 'cb-seed';
    const slotCls = `cb-vs-slot${s.isBye?' cb-bye':''}${s.isPlaceholder?' cb-tbd-slot':''}${isByeSlot?' cb-direct-slot':''}`;
    const pts = adminMode && s.team ? `<span class="cb-pts">${s.team.pts||0}p</span>` : '';
    const directBadge = isByeSlot ? `<span class="cb-direct-badge">Directo</span>` : '';
    return `<div class="${slotCls}">
      <span class="${seedCls}">${s.seed?`#${s.seed}`:'?'}</span>
      ${logo}
      <span class="cb-name">${escapeHtml(s.displayName||'Por definirse')}</span>
      ${directBadge}${pts}
    </div>`;
  }

  // — tarjeta de partido —
  function matchCard(match, extraClass='', byeSlotIndex=-1){
    if(!match) return `<div class="cb-match cb-tbd ${extraClass}">
      <div class="cb-vs-slot cb-tbd-slot"><span class="cb-seed">?</span><span class="cb-logo-ph">⚽</span><span class="cb-name">Por definirse</span></div>
      <div class="cb-divider"><span>VS</span></div>
      <div class="cb-vs-slot cb-tbd-slot"><span class="cb-seed">?</span><span class="cb-logo-ph">⚽</span><span class="cb-name">Por definirse</span></div>
    </div>`;
    const winnerBadge = match.winner
      ? `<span class="cb-winner-badge">✓ ${escapeHtml(match.winner.nombre)}</span>`
      : '';
    return `<div class="cb-match ${extraClass}">
      ${slotHtml(match.slotA, byeSlotIndex===0)}
      <div class="cb-divider"><span>VS</span>${winnerBadge}</div>
      ${slotHtml(match.slotB, byeSlotIndex===1)}
    </div>`;
  }

  const campLogoHtml = campeon?.logo
    ? `<img src="${escapeHtml(campeon.logo)}" class="cb-camp-logo"/>`
    : `<div class="cb-camp-logo-ph">🏆</div>`;

  const repName  = escapeHtml(rRep?.name || 'Repechaje');
  const semiName = escapeHtml(rSemi?.name || 'Semifinales');
  const finalName = escapeHtml(rFinal?.name || 'Final');

  return `
  <div class="cb-bracket">

    <!-- ════ NOTA FORMATO ════ -->
    <div style="text-align:center;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
      <span style="background:linear-gradient(135deg,#fbbf24,#ca8a04);color:#fff;font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">🥇 1° y 2° → Directo a Semis</span>
      <span style="background:rgba(37,84,212,.1);color:var(--acc);border:1px solid rgba(37,84,212,.25);font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">🔥 3°-6° → Repechaje</span>
    </div>

    <!-- ════ LAYOUT DESKTOP ════
         REP-A | conn | SF1(1°+ganA) | conn | FINAL | conn | SF2(2°+ganB) | conn | REP-B
    -->
    <div class="cb-full-grid">

      <!-- COL 1: Repechaje A (4° vs 5°) -->
      <div class="cb-col">
        <div class="cb-col-label" style="background:linear-gradient(135deg,#dc2626,#991b1b)">${repName} A</div>
        <div class="cb-col-matches" style="justify-content:center">
          <div class="cb-col-sublabel" style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--muted);text-align:center;margin-bottom:6px;text-transform:uppercase;">4° vs 5°</div>
          ${matchCard(repA)}
        </div>
      </div>

      <!-- COL 2: Conector Rep→SF izquierda -->
      <div class="cb-col cb-col-conn">
        <div class="cb-conn-tree cb-conn-tree-right">
          <div class="cb-tree-branch"></div>
          <div class="cb-tree-trunk"></div>
        </div>
      </div>

      <!-- COL 3: Semifinal 1 (1° directo + Gan.Rep-A) -->
      <div class="cb-col">
        <div class="cb-col-label">${semiName} 1</div>
        <div class="cb-col-matches cb-col-matches-centered">
          <div class="cb-col-sublabel" style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--muted);text-align:center;margin-bottom:6px;text-transform:uppercase;">1° vs Gan. Rep-A</div>
          ${matchCard(sf1,'',0)}
        </div>
      </div>

      <!-- COL 4: Conector SF→Final izquierda -->
      <div class="cb-col cb-col-conn cb-col-conn-sm">
        <div class="cb-conn-arrow cb-conn-arrow-right"></div>
      </div>

      <!-- COL 5: Centro — Trofeo + Final -->
      <div class="cb-col cb-col-center">
        <div class="cb-trophy-box">
          <div class="cb-trophy-icon">🏆</div>
          <div class="cb-trophy-label">GRAN FINAL</div>
          ${campeon ? `
          <div class="cb-camp-wrap">
            ${campLogoHtml}
            <div class="cb-camp-name">${escapeHtml(campeon.nombre)}</div>
            <div class="cb-camp-tag">CAMPEÓN</div>
          </div>` : `<div class="cb-camp-tbd">Por definirse</div>`}
        </div>
        <div class="cb-final-label">${finalName}</div>
        ${matchCard(finalMatch, 'cb-match-final')}
      </div>

      <!-- COL 6: Conector Final→SF derecha -->
      <div class="cb-col cb-col-conn cb-col-conn-sm">
        <div class="cb-conn-arrow cb-conn-arrow-left"></div>
      </div>

      <!-- COL 7: Semifinal 2 (2° directo + Gan.Rep-B) -->
      <div class="cb-col">
        <div class="cb-col-label">${semiName} 2</div>
        <div class="cb-col-matches cb-col-matches-centered">
          <div class="cb-col-sublabel" style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--muted);text-align:center;margin-bottom:6px;text-transform:uppercase;">2° vs Gan. Rep-B</div>
          ${matchCard(sf2,'',0)}
        </div>
      </div>

      <!-- COL 8: Conector SF→Rep derecha -->
      <div class="cb-col cb-col-conn">
        <div class="cb-conn-tree cb-conn-tree-left">
          <div class="cb-tree-branch"></div>
          <div class="cb-tree-trunk"></div>
        </div>
      </div>

      <!-- COL 9: Repechaje B (3° vs 6°) -->
      <div class="cb-col">
        <div class="cb-col-label" style="background:linear-gradient(135deg,#dc2626,#991b1b)">${repName} B</div>
        <div class="cb-col-matches" style="justify-content:center">
          <div class="cb-col-sublabel" style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--muted);text-align:center;margin-bottom:6px;text-transform:uppercase;">3° vs 6°</div>
          ${matchCard(repB)}
        </div>
      </div>

    </div><!-- /cb-full-grid -->

    <!-- ════ LAYOUT MÓVIL: stack vertical ════ -->
    <div class="cb-mobile-stack">
      <div class="cb-mob-label" style="background:linear-gradient(135deg,#dc2626,#991b1b)">🔥 ${repName} A — 4° vs 5°</div>
      ${matchCard(repA)}
      <div class="cb-mob-connector"></div>
      <div class="cb-mob-label">${semiName} 1 — 1° vs Gan.Rep-A</div>
      ${matchCard(sf1,'',0)}

      <div class="cb-mob-connector"></div>
      <div class="cb-mob-center">
        <div class="cb-trophy-box">
          <div class="cb-trophy-icon">🏆</div>
          <div class="cb-trophy-label">GRAN FINAL</div>
          ${campeon ? `<div class="cb-camp-wrap">${campLogoHtml}<div class="cb-camp-name">${escapeHtml(campeon.nombre)}</div><div class="cb-camp-tag">CAMPEÓN</div></div>` : `<div class="cb-camp-tbd">Por definirse</div>`}
        </div>
        <div class="cb-final-label" style="margin-top:8px;">${finalName}</div>
        ${matchCard(finalMatch, 'cb-match-final')}
      </div>

      <div class="cb-mob-connector"></div>
      <div class="cb-mob-label">${semiName} 2 — 2° vs Gan.Rep-B</div>
      ${matchCard(sf2,'',0)}
      <div class="cb-mob-connector"></div>
      <div class="cb-mob-label" style="background:linear-gradient(135deg,#dc2626,#991b1b)">🔥 ${repName} B — 3° vs 6°</div>
      ${matchCard(repB)}
    </div><!-- /cb-mobile-stack -->

  </div><!-- /cb-bracket -->`;
}

// ── VUELTA STATE ──────────────────────────────────────────
let currentVuelta = 'general'; // 'general' | 'v1' | 'v2'

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
    const isFemenil = !!cupData.isFemenilFormat;
    const copaHeaderHtml = isFemenil ? '' : `
        <div class="bracket-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;">🏆</span>
            <div>
              <div class="bracket-title">CUADRO DE COPA</div>
              <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;margin-top:2px;">Top 6 · Repechaje → SF → Final</div>
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
function renderHistorial(){
  // Show save button only for admins
  const saveBtn=document.getElementById('adminAddTemporada');
  if(saveBtn) saveBtn.style.display=isAdmin?'block':'none';
  if(isAdmin){
    // Pre-fill torneo/cat with current
    const tt=document.getElementById('temp_torneo');
    const tc=document.getElementById('temp_cat');
    if(tt) tt.value=currentTorneo;
    if(tc) tc.value=currentCat;
    // Auto-fill goleador
    const tabData=buildTablaData();
    const byP={};
    filteredParts().filter(p=>p.status==='terminado').forEach(p=>{
      const goles=p.goles?Object.values(p.goles):[];
      goles.forEach(g=>{
        const team=g.equipo==='local'?(p.localNombre||p.local):(p.visitaNombre||p.visita);
        const key=g.jugador+'|'+team;
        if(!byP[key])byP[key]={jugador:g.jugador,equipo:team,goles:0};
        byP[key].goles++;
      });
    });
    const top=Object.values(byP).sort((a,b)=>b.goles-a.goles)[0];
    const gField=document.getElementById('temp_goleador');
    if(gField&&top&&!gField.value) gField.value=`${top.jugador} · ${top.equipo} · ${top.goles} goles`;
    if(tabData.length>0){
      const c1Field=document.getElementById('temp_campeon');
      const c2Field=document.getElementById('temp_subcampeon');
      if(c1Field&&!c1Field.value) c1Field.value=tabData[0]?.nombre||'';
      if(c2Field&&!c2Field.value) c2Field.value=tabData[1]?.nombre||'';
    }
  }

  const el=document.getElementById('historialList'); if(!el)return;
  const renderTemps = (temps=[]) => {
    if(!temps.length){el.innerHTML='<div class="empty"><span class="empty-icon">🏆</span>Sin temporadas guardadas aún.<br/><span style="font-size:11px;color:var(--muted)">Guarda la temporada actual desde el botón de arriba.</span></div>';return;}
    el.innerHTML=temps.map(t=>`
      <div style="background:var(--card);border:2px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--gold),var(--amber))"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:var(--text)">${t.nombre||'Temporada'}</div>
            <div style="font-size:10px;font-weight:700;color:var(--muted);margin-top:2px">${TORNEO_NAMES[t.torneo]||t.torneo} · ${CAT_NAMES[t.cat]||t.cat}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:1px">📅 ${fmtDate(t.fecha)||new Date(t.ts).toLocaleDateString('es-MX')}</div>
          </div>
          ${isAdmin?`<button class="btn btn-r btn-sm" onclick="deleteTemporada('${t._key}')">🗑️</button>`:''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="background:linear-gradient(135deg,rgba(202,138,4,.12),rgba(202,138,4,.04));border:1px solid rgba(202,138,4,.3);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:18px;margin-bottom:3px">🥇</div>
            <div style="font-size:10px;font-weight:800;color:var(--gold);letter-spacing:1px;text-transform:uppercase">Campeón</div>
            <div style="font-size:13px;font-weight:800;margin-top:3px;color:var(--text)">${t.campeon||'—'}</div>
          </div>
          <div style="background:rgba(148,163,184,.07);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:18px;margin-bottom:3px">🥈</div>
            <div style="font-size:10px;font-weight:800;color:var(--muted);letter-spacing:1px;text-transform:uppercase">Subcampeón</div>
            <div style="font-size:13px;font-weight:800;margin-top:3px;color:var(--text)">${t.subcampeon||'—'}</div>
          </div>
        </div>
        ${t.goleador?`<div style="background:var(--acc3);border:1px solid rgba(26,58,138,.25);border-radius:9px;padding:9px;text-align:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:800;color:var(--acc)">⚽ Goleador: </span><span style="font-size:12px;font-weight:700">${t.goleador}</span>
        </div>`:''}
        ${t.tabla&&t.tabla.length?`<div>
          <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:6px">TABLA FINAL</div>
          ${t.tabla.slice(0,5).map((eq,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:${i===0?'var(--gold)':i===1?'#94a3b8':i===2?'#b45309':'var(--muted)'};width:18px;text-align:center">${i+1}</span>
            <span style="flex:1;font-weight:700">${eq.nombre}</span>
            <span style="color:var(--muted)">${eq.pj}J</span>
            <span style="font-weight:800;color:var(--acc)">${eq.pts}pts</span>
          </div>`).join('')}
        </div>`:''}
        ${t.notas?`<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">📝 ${t.notas}</div>`:''}
      </div>`).join('');
  };
  if(fs){
    const temps=Object.entries(C.temporadas || {}).map(([k,v])=>({...v,_key:k})).sort((a,b)=>(b.ts||0)-(a.ts||0));
    renderTemps(temps);
    return;
  }
  db.ref('historial').once('value', s=>{
    const temps=s.exists()?Object.entries(s.val()).map(([k,v])=>({...v,_key:k})).sort((a,b)=>b.ts-a.ts):[];
    renderTemps(temps);
  });
}

async function guardarTemporada(){
  const nombre=document.getElementById('temp_nombre').value.trim();
  if(!nombre){showToast('Ingresa un nombre para la temporada','ta');return;}
  const torneo=appTorneoId(document.getElementById('temp_torneo').value || currentTorneo || 'lombardo_toledano');
  const cat=appCatId(document.getElementById('temp_cat').value || currentCat || 'cat_libre_varonil');
  // Save current tabla snapshot
  const tablaData=buildTablaData();
  const data={
    nombre, torneo, cat,
    torneoId:firestoreTorneoId(torneo),
    categoriaId:firestoreCatId(cat),
    campeon:document.getElementById('temp_campeon').value.trim(),
    subcampeon:document.getElementById('temp_subcampeon').value.trim(),
    goleador:document.getElementById('temp_goleador').value.trim(),
    notas:document.getElementById('temp_notas').value.trim(),
    tabla:tablaData.slice(0,10).map(t=>({nombre:t.nombre,pj:t.pj,pts:t.pts,gf:t.gf,gc:t.gc})),
    tablaFinal:tablaData.slice(0,10).map(t=>({nombre:t.nombre,pj:t.pj,pts:t.pts,gf:t.gf,gc:t.gc})),
    fecha:new Date().toISOString().split('T')[0],
    ts:Date.now()
  };
  if(fs) await saveDoc('temporadas', newDocId('temporada', `${nombre}_${Date.now()}`), data);
  else await db.ref('historial').push(data);
  closeModal('modalGuardarTemporada');
  ['temp_nombre','temp_campeon','temp_subcampeon','temp_goleador','temp_notas'].forEach(id=>document.getElementById(id).value='');
  showToast('✅ Temporada guardada en el historial','tg');
  renderHistorial();
}

async function deleteTemporada(key){
  if(!confirm('¿Eliminar esta temporada del historial?'))return;
  if(fs) await deleteDoc('temporadas', key);
  else await db.ref(`historial/${key}`).remove();
  showToast('Temporada eliminada','tr');
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
    ? `<img src="${escapeHtml(s.team.logo)}" crossorigin="anonymous" style="width:${sz}px;height:${sz}px;border-radius:${Math.round(sz*.27)}px;object-fit:cover;background:#fff;border:1.5px solid #e2e8f0;flex-shrink:0;"/>`
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
  if(cupData?.isFemenilFormat){
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
    ? `<img src="${escapeHtml(campeon.logo)}" crossorigin="anonymous" style="width:54px;height:54px;border-radius:14px;object-fit:cover;background:#fff;border:2px solid #fcd34d;box-shadow:0 6px 14px rgba(202,138,4,.25);"/>`
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
    ? `<img src="${torLogo.src}" crossorigin="anonymous" style="width:76px;height:76px;object-fit:contain;border-radius:20px;background:#fff;padding:8px;border:1.5px solid #d6dfeb;box-shadow:0 6px 20px rgba(15,23,42,.1);flex-shrink:0;"/>`
    : `<div style="width:76px;height:76px;border-radius:20px;background:#eff6ff;border:1.5px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0;">🏆</div>`;
  const shieldHtml = shieldImg
    ? `<img src="${shieldImg.src}" crossorigin="anonymous" style="width:66px;height:66px;object-fit:contain;border-radius:16px;background:#fff;border:1.5px solid #d6dfeb;flex-shrink:0;"/>`
    : '';

  const bracketInlineHtml = buildShareBracketInline(cupData);
  const copaHeroLine = cupData?.isFemenilFormat
    ? `${escapeHtml(cat)} &nbsp;&middot;&nbsp; 4 equipos &nbsp;&middot;&nbsp; Semis 1° vs 4° y 2° vs 3° &nbsp;&middot;&nbsp; Gran Final`
    : `${escapeHtml(cat)} &nbsp;&middot;&nbsp; Top 6 &nbsp;&middot;&nbsp; Cuartos &nbsp;&middot;&nbsp; SF &nbsp;&middot;&nbsp; Final`;

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

function getStatsSharePayloadBase(tipo, dataOverride=null){
  const torneo = TORNEO_NAMES[currentTorneo] || 'TORNEO LOMBARDO TOLEDANO';
  const categoria = getShareCategoryLabel();
  const fecha = fmtDate(todayISO());
  const organizerLine = `${ORGANIZER_NAME} · ${ORGANIZER_PHONE}`;
  const baseFile = `${slugifyBasic(torneo)}_${slugifyBasic(tipo)}_${slugifyBasic(categoria)}_${todayISO()}`;

  if(tipo === 'tabla'){
    const data = Array.isArray(dataOverride) && dataOverride.length ? dataOverride : buildTablaData();
    if(!data.length) return null;
    const partidos = filteredParts().filter(p=>p.status==='terminado');
    const totalGoles = partidos.reduce((sum,p)=>sum+(p.gL||0)+(p.gV||0),0);
    const top = data[0];
    const segundo = data[1] || null;

    // — logos —
    const logoTop = top.logo
      ? `<img src="${top.logo}" style="width:100px;height:100px;border-radius:22px;object-fit:cover;background:#fff;border:2px solid rgba(255,255,255,.4);box-shadow:0 12px 28px rgba(0,0,0,.25);display:block;"/>`
      : `<div style="width:100px;height:100px;border-radius:22px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:44px;">⚽</div>`;
    const logoSeg = segundo?.logo
      ? `<img src="${segundo.logo}" style="width:88px;height:88px;border-radius:20px;object-fit:cover;background:#fff;border:2px solid rgba(255,255,255,.3);box-shadow:0 10px 22px rgba(0,0,0,.2);display:block;"/>`
      : `<div style="width:88px;height:88px;border-radius:20px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:38px;">⚽</div>`;

    // Stats mini chips for top team
    const dgTop = (top.gf||0)-(top.gc||0);
    const pctTop = top.pj>0?Math.round(top.g/top.pj*100):0;

    // Rows for tabla (top 10)
    const rows = data.slice(0,10).map((t,i)=>{
      const pos = i + 1;
      const dg = (t.gf||0) - (t.gc||0);
      const isTop = pos===1, isSeg = pos===2, isTop3 = pos===3;
      const rowBg = isTop
        ? 'background:linear-gradient(90deg,rgba(251,191,36,.12),rgba(255,255,255,.7) 70%);border-left:4px solid #f59e0b;'
        : isSeg
        ? 'background:linear-gradient(90deg,rgba(37,99,235,.09),rgba(255,255,255,.7) 70%);border-left:4px solid #3b82f6;'
        : isTop3
        ? 'background:linear-gradient(90deg,rgba(180,83,9,.07),rgba(255,255,255,.7) 70%);border-left:4px solid #b45309;'
        : '';
      const posBg = isTop
        ? 'background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#fff;box-shadow:0 4px 10px rgba(245,158,11,.4);'
        : isSeg
        ? 'background:linear-gradient(135deg,#e2e8f0,#94a3b8);color:#fff;'
        : isTop3
        ? 'background:linear-gradient(135deg,#fed7aa,#b45309);color:#fff;'
        : 'background:#f1f5f9;color:#64748b;border:1px solid #dbe4ee;';
      const logoHtml = t.logo
        ? `<img src="${t.logo}" style="width:36px;height:36px;border-radius:10px;object-fit:cover;background:#fff;border:1px solid #dbe4ee;flex-shrink:0;"/>`
        : `<div style="width:36px;height:36px;border-radius:10px;background:#f8fafc;border:1px solid #dbe4ee;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">⚽</div>`;
      return `<div style="${rowBg}display:grid;grid-template-columns:60px minmax(0,1fr) 56px 52px 52px 52px 68px 80px;align-items:center;padding:13px 18px;border-bottom:1px solid #edf2f7;gap:6px;">
        <div style="${posBg}width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:20px;font-weight:900;margin:0 auto;">${pos}</div>
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">${logoHtml}<div style="min-width:0;"><div style="font-size:17px;font-weight:900;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.nombre)}</div>${isTop?`<div style="font-size:10px;font-weight:800;color:#ca8a04;letter-spacing:.5px;margin-top:1px;">Líder del torneo</div>`:isSeg?`<div style="font-size:10px;font-weight:800;color:#2563eb;letter-spacing:.5px;margin-top:1px;">Gran Final</div>`:''}</div></div>
        <div style="text-align:center;font-size:16px;font-weight:700;color:#475569;">${t.pj||0}</div>
        <div style="text-align:center;font-size:16px;font-weight:800;color:#16a34a;">${t.g||0}</div>
        <div style="text-align:center;font-size:16px;font-weight:700;color:#64748b;">${t.e||0}</div>
        <div style="text-align:center;font-size:16px;font-weight:700;color:#dc2626;">${t.pe||0}</div>
        <div style="text-align:center;font-size:16px;font-weight:700;color:${dg>0?'#16a34a':dg<0?'#dc2626':'#64748b'};">${dg>0?'+':''}${dg}</div>
        <div style="text-align:center;font-family:'Bebas Neue',sans-serif;font-size:28px;color:#1d4ed8;line-height:1;">${t.pts||0}</div>
      </div>`;
    }).join('');

    const bodyHtml = `
      <!-- ══ BLOQUE 1: LÍDER ══ -->
      <div style="position:relative;overflow:hidden;border-radius:28px;margin-bottom:18px;z-index:1;">
        <!-- Fondo degradado vibrante -->
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,#1a3a8a 0%,#1d4ed8 40%,#0ea5e9 75%,#2ea83c 100%);"></div>
        <!-- Textura / partículas decorativas -->
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 85% 20%,rgba(255,255,255,.12) 0%,transparent 40%),radial-gradient(circle at 15% 80%,rgba(255,255,255,.08) 0%,transparent 35%);pointer-events:none;"></div>
        <!-- Barra brillante superior -->
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.7),rgba(255,255,255,0));"></div>
        <!-- Contenido -->
        <div style="position:relative;z-index:1;padding:28px 30px 26px;display:flex;align-items:center;gap:22px;">
          <!-- Corona + logo -->
          <div style="position:relative;flex-shrink:0;">
            <div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:22px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));">👑</div>
            ${logoTop}
            <!-- Badge #1 -->
            <div style="position:absolute;bottom:-8px;right:-8px;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:#7c2d12;box-shadow:0 4px 10px rgba(245,158,11,.5);">1</div>
          </div>
          <!-- Info equipo -->
          <div style="flex:1;min-width:0;">
            <div style="font-size:10px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:4px;">Líder del Torneo · ${escapeHtml(categoria)}</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:54px;letter-spacing:1.5px;line-height:.9;color:#fff;word-break:break-word;text-shadow:0 4px 18px rgba(0,0,0,.25);">${escapeHtml(top.nombre)}</div>
            <!-- Stats inline -->
            <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
              <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:7px 14px;text-align:center;">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:#fff;line-height:1;">${top.pts||0}</div>
                <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:2px;">Puntos</div>
              </div>
              <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:7px 14px;text-align:center;">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:#fff;line-height:1;">${top.g||0}</div>
                <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:2px;">Ganados</div>
              </div>
              <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:7px 14px;text-align:center;">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:${dgTop>=0?'#86efac':'#fca5a5'};line-height:1;">${dgTop>0?'+':''}${dgTop}</div>
                <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:2px;">DG</div>
              </div>
              <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:7px 14px;text-align:center;">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:#fff;line-height:1;">${pctTop}%</div>
                <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:2px;">Win Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ BLOQUE 2: GRAN FINAL ══ -->
      ${segundo ? `
      <div style="position:relative;overflow:hidden;border-radius:28px;margin-bottom:18px;z-index:1;background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%);box-shadow:0 14px 34px rgba(15,23,42,.18);">
        <!-- Barra dorada superior -->
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#d97706,#f59e0b,#fbbf24,#f59e0b,#d97706);"></div>
        <!-- Orbs decorativos -->
        <div style="position:absolute;top:0;right:0;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.18),transparent 65%);pointer-events:none;"></div>
        <div style="position:absolute;bottom:0;left:0;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.2),transparent 65%);pointer-events:none;"></div>
        <!-- Contenido -->
        <div style="position:relative;z-index:1;padding:24px 28px 26px;">
          <!-- Label -->
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:20px;">
            <div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(251,191,36,.4));"></div>
            <div style="font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#fbbf24;display:flex;align-items:center;gap:6px;white-space:nowrap;">⚡ GRAN FINAL ⚡</div>
            <div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(251,191,36,.4),transparent);"></div>
          </div>
          <!-- Duelo -->
          <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;">
            <!-- Equipo 1 -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:10px;background:rgba(255,255,255,.06);border:1px solid rgba(251,191,36,.25);border-radius:22px;padding:20px 14px;box-shadow:0 8px 20px rgba(0,0,0,.15);">
              <div style="position:relative;">
                ${logoTop}
                <div style="position:absolute;top:-10px;left:-10px;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:#7c2d12;box-shadow:0 3px 8px rgba(245,158,11,.5);">1</div>
              </div>
              <div style="font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:rgba(251,191,36,.8);">1er Lugar</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:1px;color:#fff;text-align:center;line-height:1;word-break:break-word;">${escapeHtml(top.nombre)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
                <span style="background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:3px 9px;font-size:11px;font-weight:800;color:#fde68a;">${top.pts||0} PTS</span>
                <span style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:3px 9px;font-size:11px;font-weight:700;color:rgba(255,255,255,.65);">${pctTop}% win</span>
              </div>
            </div>
            <!-- VS central -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 6px;">
              <div style="font-family:'Bebas Neue',sans-serif;font-size:72px;color:rgba(255,255,255,.12);line-height:1;letter-spacing:2px;">VS</div>
              <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#d97706,#f59e0b);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 6px 18px rgba(217,119,6,.45);">⚽</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:72px;color:rgba(255,255,255,.12);line-height:1;letter-spacing:2px;">VS</div>
            </div>
            <!-- Equipo 2 -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:10px;background:rgba(255,255,255,.06);border:1px solid rgba(99,102,241,.3);border-radius:22px;padding:20px 14px;box-shadow:0 8px 20px rgba(0,0,0,.15);">
              <div style="position:relative;">
                ${logoSeg}
                <div style="position:absolute;top:-10px;right:-10px;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#818cf8,#6366f1);border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#fff;box-shadow:0 3px 8px rgba(99,102,241,.4);">2</div>
              </div>
              <div style="font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:rgba(129,140,248,.9);">2do Lugar</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:1px;color:#fff;text-align:center;line-height:1;word-break:break-word;">${escapeHtml(segundo.nombre)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
                <span style="background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.35);border-radius:8px;padding:3px 9px;font-size:11px;font-weight:800;color:#c7d2fe;">${segundo.pts||0} PTS</span>
                <span style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:3px 9px;font-size:11px;font-weight:700;color:rgba(255,255,255,.65);">${segundo.pj>0?Math.round(segundo.g/segundo.pj*100):0}% win</span>
              </div>
            </div>
          </div>
          <!-- Sub label -->
          <div style="text-align:center;margin-top:16px;font-size:11px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:1px;">El duelo que definirá al campeón al finalizar el torneo</div>
        </div>
      </div>` : ''}

      <!-- ══ BLOQUE 3: TABLA GENERAL ══ -->
      <div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.07);position:relative;z-index:1;">
        <!-- Header tabla -->
        <div style="background:linear-gradient(180deg,#f8fafc,#f1f5f9);padding:14px 18px;display:grid;grid-template-columns:60px minmax(0,1fr) 56px 52px 52px 52px 68px 80px;gap:6px;align-items:center;border-bottom:2px solid #e2e8f0;">
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;text-align:center;">#</div>
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">Equipo</div>
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;text-align:center;">PJ</div>
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#16a34a;text-align:center;">G</div>
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;text-align:center;">E</div>
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#dc2626;text-align:center;">P</div>
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;text-align:center;">DG</div>
          <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#1d4ed8;text-align:center;">PTS</div>
        </div>
        ${rows}
      </div>

      ${visualShareOptions.showTablaStats?`
      <!-- Stats footer -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px;position:relative;z-index:1;">
        <div style="background:#fff;border:1.5px solid #dbe4ee;border-radius:20px;padding:16px;text-align:center;box-shadow:0 6px 16px rgba(15,23,42,.05);">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:38px;line-height:1;color:#0f172a;">${data.length}</div>
          <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-top:6px;">Equipos</div>
        </div>
        <div style="background:#fff;border:1.5px solid #dbe4ee;border-radius:20px;padding:16px;text-align:center;box-shadow:0 6px 16px rgba(15,23,42,.05);">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:38px;line-height:1;color:#0f172a;">${partidos.length}</div>
          <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-top:6px;">Partidos</div>
        </div>
        <div style="background:#fff;border:1.5px solid #dbe4ee;border-radius:20px;padding:16px;text-align:center;box-shadow:0 6px 16px rgba(15,23,42,.05);">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:38px;line-height:1;color:#0f172a;">${totalGoles}</div>
          <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-top:6px;">Goles</div>
        </div>
      </div>`:''}
    `;
    const caption = [
      `${torneo} | ${categoria}`,
      `Tabla general actualizada al ${fecha}.`,
      `1. ${top.nombre} - ${top.pts||0} pts`,
      segundo ? `2. ${segundo.nombre} - ${segundo.pts||0} pts | Finalissima` : '',
      `Partidos cerrados: ${partidos.length}`,
      getTournamentHashtagLine(['#Finalissima','#TablaGeneral'])
    ].filter(Boolean).join('\n');
    return {
      kind:'tabla',
      title: 'Tabla de Posiciones',
      caption,
      filename: baseFile,
      html: buildVisualShareCard({
        kicker: torneo,
        title: 'TABLA DE POSICIONES',
        subtitle: `${categoria} · ${organizerLine}`,
        dateLabel: `Actualizado · ${fecha}`,
        bodyHtml,
        footerNote: 'Visual oficial de la tabla general listo para compartir sin pasar por imprimir.',
        footerTag: getTournamentFooterTag()
      })
    };
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
    const isFemenilCup = !!cup.isFemenilFormat;
    const cupCaptionLine = isFemenilCup
      ? `Cuadro de copa femenil proyectado al ${fecha}: 4 equipos, semifinales y gran final.`
      : `Cuadro de copa (Top 8) proyectado al ${fecha}.`;
    const cupSubtitleLine = isFemenilCup
      ? `${categoria} · ${organizerLine} · 4 equipos · SF · Final`
      : `${categoria} · ${organizerLine} · Top 6 equipos · CF · SF · Final`;
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
  if(btnPng) btnPng.textContent = visualShareBusy ? 'Generando...' : '🖼️ Guardar / compartir imagen';
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
  if(captionWrap) captionWrap.style.display = isAdmin ? '' : 'none';
  if(adminControls) adminControls.style.display = isAdmin && payload.kind==='tabla' ? '' : 'none';
  if(statsToggle) statsToggle.checked = getVisualShareStatsEnabled();
  if(btnPdf) btnPdf.style.display = isAdmin ? '' : 'none';
  if(btnShare) btnShare.style.display = '';
  if(btnCopy) btnCopy.style.display = isAdmin ? '' : 'none';
  if(actionsWrap) actionsWrap.style.gridTemplateColumns = isAdmin ? '1fr 1fr' : '1fr 1fr';
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
      const file = new File([blob], `${filename}.png`, { type:'image/png' });
      if(navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))){
        await navigator.share({
          title: visualShareState.title || (TORNEO_NAMES[currentTorneo] || 'Torneo'),
          text: visualShareState.caption || '',
          files:[file]
        });
        showToast('📲 Imagen lista para guardar o compartir','tg');
        return;
      }
      downloadBlob(blob, `${filename}.png`);
      showToast('🖼️ Imagen descargada correctamente','tg');
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
      await copyPlainText(visualShareState.caption || '', '📋 Texto listo para pegar');
      showToast('Tu navegador descargó la imagen para compartirla manualmente','ta');
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

