function setFechaUltimos(dias) {
  const el = document.getElementById('partidos_fecha_desde');
  if (!el) return;
  if (dias === 0) {
    el.value = '';
    renderPartidos();
    return;
  }
  const d = new Date();
  d.setDate(d.getDate() - dias);
  el.value = d.toISOString().split('T')[0];
  renderPartidos();
}

function filterProximos() {
  if (typeof renderPartidos === 'function') renderPartidos();
}

function populatePartidosTeamFilter() {
  const sel = document.getElementById('partidos_equipo_filter');
  if (!sel) return;
  const currentVal = sel.value;
  const teams = new Set();
  filteredParts().forEach((p) => {
    if (p.localNombre || p.local) teams.add(p.localNombre || p.local);
    if (p.visitaNombre || p.visita) teams.add(p.visitaNombre || p.visita);
  });
  const sorted = [...teams].sort((a, b) => a.localeCompare(b));
  sel.innerHTML =
    `<option value="">Todos los equipos</option>` +
    sorted
      .map((t) => `<option value="${t}"${t === currentVal ? 'selected' : ''}>${t}</option>`)
      .join('');
}

function buildArbitrajeMatchHtml(p) {
  if (typeof getArbitrajeEstado !== 'function') return '';
  const row = (role) => {
    const name = getEquipoNombreFromPartido(p, role);
    const estado = getArbitrajeEstado(p, role);
    const node = getArbitrajeNode(p, role);
    const expected = getMontoEsperadoArbitraje(p, role);
    const paid = getMontoPagadoArbitraje(p, role);
    const icon = estado === 'pagado' ? '✅' : estado === 'parcial' ? '⚠️' : '❌';
    const method = node.metodoPago ? ` · ${escapeHtml(normalizePaymentMethod(node.metodoPago))}` : '';
    const receiver = node.recibidoPor ? ` · Recibió: ${escapeHtml(node.recibidoPor)}` : '';
    const note = node.nota ? `<div class="arb-note">Nota: ${escapeHtml(node.nota)}</div>` : '';
    return `<div class="arb-match-row ${estado}">
      <div><strong>${escapeHtml(name)}</strong><span>${estado.toUpperCase()} ${icon} · ${formatMoney(paid)}/${formatMoney(expected)}${method}${receiver}</span>${note}</div>
    </div>`;
  };
  return `<div class="arb-match-box"><div class="arb-match-title">Arbitraje</div>${row('local')}${row('visitante')}</div>`;
}

function renderPartidos() {
  const el = document.getElementById('partidosList');
  if (!el) return;
  const filterEl = document.getElementById('partidos_fecha_desde');
  const desdeDate = filterEl?.value || null;
  const teamFilterEl = document.getElementById('partidos_equipo_filter');
  const teamFilter = teamFilterEl?.value || '';
  let parts = filteredParts().sort((a, b) => {
    const ad = (b.fecha || '') + (b.horaIni || '');
    const bd = (a.fecha || '') + (a.horaIni || '');
    return ad.localeCompare(bd);
  });
  if (desdeDate) parts = parts.filter((p) => (p.fecha || '') >= desdeDate);
  if (teamFilter) {
    parts = parts.filter(
      (p) => (p.localNombre || p.local || '') === teamFilter || (p.visitaNombre || p.visita || '') === teamFilter
    );
  }
  if (!parts.length) {
    el.innerHTML = `<div class="empty"><span class="empty-icon">⚽</span>Sin partidos${
      desdeDate ? ' desde ' + fmtDate(desdeDate) : teamFilter ? ' de ' + teamFilter : ' en esta categoría'
    }</div>`;
    return;
  }
  el.innerHTML = parts
    .map((p) => {
      const eqL = getEqs().find(
        (e) => e.nombre === (p.localNombre || p.local) && e.torneo === currentTorneo && e.cat === currentCat
      );
      const eqV = getEqs().find(
        (e) => e.nombre === (p.visitaNombre || p.visita) && e.torneo === currentTorneo && e.cat === currentCat
      );
      const wL = p.status === 'terminado' && (p.gL || 0) > (p.gV || 0);
      const wV = p.status === 'terminado' && (p.gV || 0) > (p.gL || 0);
      const goles = p.goles ? Object.values(p.goles) : [];
      const scorersHtml = buildScorersHtml(goles, p.localNombre || p.local, p.visitaNombre || p.visita);
      const lLogo = eqL?.logo ? `<img class="team-logo" src="${eqL.logo}"/>` : `<div class="team-ph">⚽</div>`;
      const vLogo = eqV?.logo ? `<img class="team-logo" src="${eqV.logo}"/>` : `<div class="team-ph">⚽</div>`;
      const statusClass = p.status === 'terminado' ? 'ms-done' : p.status === 'jugando' ? 'ms-live' : 'ms-pen';
      const statusTxt = p.porDefault
        ? '⚠️ Default'
        : p.status === 'terminado'
        ? '✅ Terminado'
        : p.status === 'jugando'
        ? '🟢 En Juego'
        : '⏳ Pendiente';
      const mcCls = p.status !== 'terminado' ? 'mc-pending' : wL ? 'mc-win' : wV ? 'mc-win' : 'mc-draw';
      const arbitrajeHtml = buildArbitrajeMatchHtml(p);
      return `<div class="match-card ${mcCls}" onclick="openPartidoDetail('${p._key}')">
      <div class="mc-top">
        <span>📅 ${fmtDate(p.fecha)} · ⏰ ${p.horaIni || '--:--'} ${p.horaFin ? '→' + p.horaFin : ''} · 🏟️ ${
        p.cancha || '—'
      }</span>
        <span class="mc-status ${statusClass}">${statusTxt}</span>
      </div>
      <div class="mc-body">
        <div class="scoreboard">
          <div class="team-side">${lLogo}<div class="team-name">${p.localNombre || p.local || 'Local'}</div><div class="team-score ${
        wL ? 'winner' : ''
      }">${p.gL || 0}</div></div>
          <div class="score-sep">:</div>
          <div class="team-side">${vLogo}<div class="team-name">${p.visitaNombre || p.visita || 'Visita'}</div><div class="team-score ${
        wV ? 'winner' : ''
      }">${p.gV || 0}</div></div>
        </div>
      </div>
      ${scorersHtml || ''}
      ${arbitrajeHtml}
      <div class="mc-footer">
        ${p.arbitroNombre ? `<span class="mc-meta">🦺 ${p.arbitroNombre}</span>` : ''}
        ${p.cancha ? `<span class="mc-meta">🏟️ ${p.cancha}</span>` : ''}
        ${
          isAdmin
            ? `<span class="mc-meta" style="margin-left:auto"><button class="btn btn-out btn-sm" onclick="event.stopPropagation();openEditPartido('${p._key}')">✏️ Editar</button> <button class="btn btn-r btn-sm" onclick="event.stopPropagation();deletePartido('${p._key}')">🗑️</button></span>`
            : ''
        }
      </div>
    </div>`;
    })
    .join('');
}

function buildScorersHtml(goles, local, visita) {
  if (!goles || !goles.length) return '';
  const byL = {};
  const byV = {};
  goles.forEach((g) => {
    const s = g.equipo === 'local' ? byL : byV;
    s[g.jugador] = (s[g.jugador] || 0) + 1;
  });
  function renderSide(store, label) {
    const entries = Object.entries(store);
    if (!entries.length) return '';
    const tags = entries
      .map((e) => {
        const n = e[0];
        const c = e[1];
        const isHat = c >= 3;
        const icon = isHat ? '🎩⚽' : '⚽';
        const extra = c > 1 ? ' ×' + c : '';
        return '<span class="scorer-tag' + (isHat ? ' hat-trick' : '') + '">' + icon + ' ' + n + extra + '</span>';
      })
      .join('');
    return (
      '<div class="scorers-side"><div class="scorers-side-label">' +
      label +
      '</div><div class="scorers-side-list">' +
      tags +
      '</div></div>'
    );
  }
  const lH = renderSide(byL, local || 'Local');
  const vH = renderSide(byV, visita || 'Visita');
  if (!lH && !vH) return '';
  return '<div class="scorers-split">' + lH + vH + '</div>';
}

async function deletePartido(key) {
  if (!confirm('¿Eliminar este partido?')) return;
  try {
    if (fs) await deleteDoc('partidos', key);
    else await db.ref(`partidos/${key}`).remove();
    showToast('Partido eliminado', 'tr');
  } catch (error) {
    console.error(error);
    showToast('Error al eliminar partido', 'tr');
  }
}

async function guardarMarcadorEdit() {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  const gL = parseInt(document.getElementById('edit_gL')?.value) || 0;
  const gV = parseInt(document.getElementById('edit_gV')?.value) || 0;
  const updatedAt = Date.now();
  try {
    if (fs) await updateDoc('partidos', activePartidoKey, { gL, gV, updatedAt });
    else await db.ref(`partidos/${activePartidoKey}`).update({ gL, gV, updatedAt });
    await intentarSincronizarResultado(activePartidoKey, { ...p, gL, gV, updatedAt });
    showToast('Marcador actualizado', 'tg');
  } catch (error) {
    console.log('[Make] Error al guardar marcador editado', error);
    showToast('Error al actualizar marcador', 'tr');
  }
}

async function eliminarGolEspecifico(partKey, golKey, equipo) {
  const p = C.partidos[partKey];
  if (!p) return;
  const campo = equipo === 'local' ? 'gL' : 'gV';
  const nextScore = Math.max(0, (p[campo] || 1) - 1);
  const updatedAt = Date.now();
  try {
    if (fs) {
      const goles = { ...(p.goles || {}) };
      delete goles[golKey];
      await updateDoc('partidos', partKey, { goles, [campo]: nextScore, updatedAt });
    } else {
      const updates = {};
      updates[`partidos/${partKey}/goles/${golKey}`] = null;
      updates[`partidos/${partKey}/${campo}`] = nextScore;
      updates[`partidos/${partKey}/updatedAt`] = updatedAt;
      await db.ref().update(updates);
    }
    await intentarSincronizarResultado(partKey, { ...p, [campo]: nextScore, updatedAt });
    showToast('Gol eliminado', 'tr');
  } catch (error) {
    console.log('[Make] Error al eliminar gol específico', error);
    showToast('Error al eliminar gol', 'tr');
  }
}

async function reabrirPartido(key) {
  if (!confirm('¿Reabrir este partido? Volverá a estado "jugando"')) return;
  try {
    if (fs) await updateDoc('partidos', key, { status: 'jugando' });
    else await db.ref(`partidos/${key}/status`).set('jugando');
    showToast('Partido reabierto', 'ta');
  } catch (error) {
    console.error(error);
    showToast('Error al reabrir partido', 'tr');
  }
}

function openPartidoDetail(key) {
  activePartidoKey = key;
  renderPartidoDetail();
  openModal('modalPartidoDetail');
}

function renderPartidoDetail() {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  const arb = p.arbId ? C.arbitros[p.arbId] : null;
  const done = p.status === 'terminado';
  const goles = p.goles ? Object.values(p.goles) : [];
  const eqL =
    findEquipoMatchRef(p.local, p.torneo || currentTorneo, p.cat || currentCat) ||
    findEquipoMatchRef(p.localNombre, p.torneo || currentTorneo, p.cat || currentCat);
  const eqV =
    findEquipoMatchRef(p.visita, p.torneo || currentTorneo, p.cat || currentCat) ||
    findEquipoMatchRef(p.visitaNombre, p.torneo || currentTorneo, p.cat || currentCat);
  const porteroLocal = resolveMatchGoalkeeperName(p, 'local', eqL);
  const porteroVisita = resolveMatchGoalkeeperName(p, 'visita', eqV);
  const arbitrajeHtml = buildArbitrajeMatchHtml(p);
  const lLogo = eqL?.logo ? `<img class="team-logo" src="${eqL.logo}"/>` : `<div class="team-ph">⚽</div>`;
  const vLogo = eqV?.logo ? `<img class="team-logo" src="${eqV.logo}"/>` : `<div class="team-ph">⚽</div>`;
  document.getElementById('pdTitle').textContent = `${p.localNombre || p.local} vs ${p.visitaNombre || p.visita}`;
  const lineup_local = p.alineLocal || [];
  const lineup_visita = p.alineVisita || [];
  let adminActions = '';
  if (isAdmin && !done) {
    adminActions = `<div class="crono-wrap">
      <div class="crono-display" id="cronoDisp">${fmt(p.elapsed || 0)}</div>
      <div class="crono-ctrls">
        <button class="btn ${p.timerRunning ? 'btn-b' : 'btn-g'} btn-sm" id="btnTimer" onclick="toggleTimer()">${
      p.timerRunning ? '⏸ Pausar' : '▶ Iniciar'
    }</button>
        <button class="btn btn-r btn-sm" onclick="terminarPartido()">🏁 Terminar</button>
      </div>
    </div>
    <div class="form-2" style="margin:10px 0">
      <div class="sh" style="grid-column:1/-1;margin-bottom:6px"><div class="st">⚽ Registrar Gol</div></div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-align:center;margin-bottom:5px">${
          p.localNombre || p.local
        }</div>
        <button class="gol-btn add" onclick="openGolModal('local')">⚽ GOL LOCAL</button>
        <button class="gol-btn undo" style="margin-top:4px" onclick="quitarGol('local')">↩ Quitar</button>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-align:center;margin-bottom:5px">${
          p.visitaNombre || p.visita
        }</div>
        <button class="gol-btn add" onclick="openGolModal('visita')">⚽ GOL VISITA</button>
        <button class="gol-btn undo" style="margin-top:4px" onclick="quitarGol('visita')">↩ Quitar</button>
      </div>
    </div>`;
  }
  if (isAdmin && done) {
    adminActions = `
    <div style="background:var(--card2);border:1.5px solid var(--border);border-radius:10px;padding:12px;margin:8px 0">
      <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px">✏️ EDITAR PARTIDO TERMINADO</div>
      <div class="form-2" style="margin-bottom:8px">
        <div class="fg"><label class="fl">Goles ${p.localNombre || p.local}</label><input class="fi" id="edit_gL" type="number" value="${p.gL || 0}" min="0"/></div>
        <div class="fg"><label class="fl">Goles ${p.visitaNombre || p.visita}</label><input class="fi" id="edit_gV" type="number" value="${p.gV || 0}" min="0"/></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button class="btn btn-g btn-sm" onclick="openGolModal('local')">⚽ + Gol ${p.localNombre || p.local}</button>
        <button class="btn btn-g btn-sm" onclick="openGolModal('visita')">⚽ + Gol ${p.visitaNombre || p.visita}</button>
        <button class="btn btn-out btn-sm" onclick="guardarMarcadorEdit()">💾 Guardar marcador</button>
      </div>
      ${
        goles.length
          ? `<div style="font-size:10px;font-weight:800;letter-spacing:1px;color:var(--muted);margin-bottom:6px">ELIMINAR GOLES</div>
      <div>${Object.entries(p.goles || {})
        .map(
          ([gk, g]) =>
            `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;flex:1">⚽ ${g.jugador} · ${
              g.equipo === 'local' ? p.localNombre || p.local : p.visitaNombre || p.visita
            }</span><button class="btn btn-r btn-sm" onclick="eliminarGolEspecifico('${activePartidoKey}','${gk}','${g.equipo}')">✕</button></div>`
        )
        .join('')}</div>`
          : ''
      }
    </div>
    <button class="btn btn-a btn-full" style="margin:4px 0" onclick="openModal('modalPagoArb');initPagoArb()">💰 Pagos de Arbitraje</button>
    <button class="btn btn-out btn-full" style="margin-top:4px" onclick="reabrirPartido('${activePartidoKey}')">🔄 Reabrir partido</button>`;
  }
  document.getElementById('modalPartidoContent').innerHTML = `
    <div style="text-align:center;margin-bottom:10px">
      <span class="mc-status ${p.porDefault ? 'ms-default' : p.status === 'terminado' ? 'ms-done' : p.status === 'jugando' ? 'ms-live' : 'ms-pen'}">
        ${p.porDefault ? '⚠️ DEFAULT (2-0)' : p.status === 'terminado' ? '✅ Terminado' : p.status === 'jugando' ? '🟢 En Juego' : '⏳ Pendiente'}
      </span>
    </div>
    <div class="scoreboard" style="margin-bottom:10px">
      <div class="team-side">${lLogo}<div class="team-name">${p.localNombre || p.local}</div><div class="team-score ${
    done && (p.gL || 0) > (p.gV || 0) ? 'winner' : ''
  }" id="mgl">${p.gL || 0}</div></div>
      <div class="score-sep">:</div>
      <div class="team-side">${vLogo}<div class="team-name">${p.visitaNombre || p.visita}</div><div class="team-score ${
    done && (p.gV || 0) > (p.gL || 0) ? 'winner' : ''
  }" id="mgv">${p.gV || 0}</div></div>
    </div>
    ${
      porteroLocal || porteroVisita
        ? `<div class="form-2" style="margin-bottom:10px">
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px 12px">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.6px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Portero local</div>
        <div style="font-size:13px;font-weight:800;color:#0f766e">${escapeHtml(porteroLocal || 'Sin asignar')}</div>
      </div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px 12px">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.6px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Portero visita</div>
        <div style="font-size:13px;font-weight:800;color:#0f766e">${escapeHtml(porteroVisita || 'Sin asignar')}</div>
      </div>
    </div>`
        : ''
    }
    ${
      goles.length
        ? `<div class="card" style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:7px">GOLES</div>
      ${goles
        .map(
          (g) =>
            `<div style="font-size:12px;padding:3px 0;display:flex;gap:7px"><span>⚽</span><strong>${g.jugador}</strong><span style="color:var(--muted)">${
              g.equipo === 'local' ? p.localNombre || p.local : p.visitaNombre || p.visita
            }</span></div>`
        )
        .join('')}
    </div>`
        : ''
    }
    ${arbitrajeHtml}
    ${adminActions}
    ${
      lineup_local.length || lineup_visita.length
        ? `<div class="form-2" style="margin-top:8px">
      <div class="lineup-box"><div class="lineup-title">${p.localNombre || p.local}</div>${lineup_local
            .map((pl, i) => {
              const gc = goles.filter((g) => g.equipo === 'local' && g.jugador === pl).length;
              return `<div style="font-size:12px;padding:3px 0;display:flex;justify-content:space-between"><span>${
                i + 1
              }. ${pl}</span>${gc ? `<span style="color:var(--acc);font-weight:800">${gc} ⚽</span>` : ''}</div>`;
            })
            .join('')}</div>
      <div class="lineup-box"><div class="lineup-title">${p.visitaNombre || p.visita}</div>${lineup_visita
            .map((pl, i) => {
              const gc = goles.filter((g) => g.equipo === 'visita' && g.jugador === pl).length;
              return `<div style="font-size:12px;padding:3px 0;display:flex;justify-content:space-between"><span>${
                i + 1
              }. ${pl}</span>${gc ? `<span style="color:var(--acc);font-weight:800">${gc} ⚽</span>` : ''}</div>`;
            })
            .join('')}</div>
    </div>`
        : ''
    }
    ${
      arb
        ? `<div style="background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:10px;text-align:center;margin-top:8px">
      <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:var(--muted);margin-bottom:3px">ÁRBITRO</div>
      <div style="font-size:14px;font-weight:800">${arb.nombre}</div>
      <div style="color:var(--amber);font-size:12px;margin-top:2px">$${p.costArb || 250}/equipo</div>
    </div>`
        : ''
    }`;
  if (p.timerRunning) startTimerUI(activePartidoKey);
}

function openGolModal(side) {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  pendingGolSide = side;
  document.getElementById('golModalTitle').textContent = `⚽ Gol de ${
    side === 'local' ? p.localNombre || p.local : p.visitaNombre || p.visita
  }`;
  const lineup = side === 'local' ? p.alineLocal || [] : p.alineVisita || [];
  document.getElementById('gol_jugador').innerHTML =
    `<option value="">— Seleccionar —</option>` + lineup.map((pl) => `<option value="${pl}">${pl}</option>`).join('');
  document.getElementById('gol_manual').value = '';
  document.getElementById('gol_equipo').value = side;
  openModal('modalGol');
}

async function confirmGol() {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  const side = document.getElementById('gol_equipo').value;
  const manual = document.getElementById('gol_manual').value.trim();
  const fromList = document.getElementById('gol_jugador').value;
  const jugador = manual || fromList;
  if (!jugador) {
    showToast('Indica el jugador', 'ta');
    return;
  }
  const field = side === 'local' ? 'gL' : 'gV';
  const nextScore = (p[field] || 0) + 1;
  const updatedAt = Date.now();
  try {
    if (fs) {
      const goles = { ...(p.goles || {}) };
      const golKey = newDocId('gol', `${jugador}_${updatedAt}`);
      goles[golKey] = { jugador, equipo: side, ts: updatedAt };
      await updateDoc('partidos', activePartidoKey, { [field]: nextScore, goles, updatedAt });
    } else {
      const golRef = db.ref(`partidos/${activePartidoKey}/goles`).push();
      const updates = {};
      updates[`partidos/${activePartidoKey}/${field}`] = nextScore;
      updates[`partidos/${activePartidoKey}/goles/${golRef.key}`] = { jugador, equipo: side, ts: updatedAt };
      updates[`partidos/${activePartidoKey}/updatedAt`] = updatedAt;
      await db.ref().update(updates);
    }
    await intentarSincronizarResultado(activePartidoKey, { ...p, [field]: nextScore, updatedAt });
    closeModal('modalGol');
    showToast(`⚽ GOL de ${jugador}!`, 'tg');
  } catch (error) {
    console.log('[Make] Error al registrar gol', error);
    showToast('Error al registrar gol', 'tr');
  }
}

async function quitarGol(side) {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  const field = side === 'local' ? 'gL' : 'gV';
  const cur = p[field] || 0;
  if (cur <= 0) return;
  const goles = p.goles ? Object.entries(p.goles) : [];
  const last = goles.filter(([, g]) => g.equipo === side).sort((a, b) => b[1].ts - a[1].ts)[0];
  const updatedAt = Date.now();
  try {
    if (fs) {
      const nextGoles = { ...(p.goles || {}) };
      if (last) delete nextGoles[last[0]];
      await updateDoc('partidos', activePartidoKey, { [field]: cur - 1, goles: nextGoles, updatedAt });
    } else {
      const updates = {};
      if (last) updates[`partidos/${activePartidoKey}/goles/${last[0]}`] = null;
      updates[`partidos/${activePartidoKey}/${field}`] = cur - 1;
      updates[`partidos/${activePartidoKey}/updatedAt`] = updatedAt;
      await db.ref().update(updates);
    }
    await intentarSincronizarResultado(activePartidoKey, { ...p, [field]: cur - 1, updatedAt });
  } catch (error) {
    console.log('[Make] Error al quitar gol', error);
    showToast('Error al quitar gol', 'tr');
  }
}

async function toggleTimer() {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  if (p.timerRunning) {
    const ne = (p.elapsed || 0) + (Date.now() - (p.timerStart || Date.now())) / 1000;
    clearInterval(timers[activePartidoKey]);
    if (fs) await updateDoc('partidos', activePartidoKey, { timerRunning: false, elapsed: ne });
    else await db.ref(`partidos/${activePartidoKey}`).update({ timerRunning: false, elapsed: ne });
  } else {
    const patch = { timerRunning: true, timerStart: Date.now(), status: 'jugando' };
    if (fs) await updateDoc('partidos', activePartidoKey, patch);
    else await db.ref(`partidos/${activePartidoKey}`).update(patch);
  }
}

function startTimerUI(key) {
  clearInterval(timers[key]);
  timers[key] = setInterval(() => {
    const p = C.partidos[key];
    if (!p || !p.timerRunning) {
      clearInterval(timers[key]);
      return;
    }
    const el = document.getElementById('cronoDisp');
    if (el) el.textContent = fmt((p.elapsed || 0) + (Date.now() - (p.timerStart || Date.now())) / 1000);
  }, 500);
}

async function terminarPartido() {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  const elapsed = p.timerRunning
    ? (p.elapsed || 0) + (Date.now() - (p.timerStart || Date.now())) / 1000
    : p.elapsed || 0;
  const updatedAt = Date.now();
  clearInterval(timers[activePartidoKey]);
  try {
    const patch = { status: 'terminado', timerRunning: false, elapsed, updatedAt };
    if (fs) await updateDoc('partidos', activePartidoKey, patch);
    else await db.ref(`partidos/${activePartidoKey}`).update(patch);
    await intentarSincronizarResultado(activePartidoKey, {
      ...p,
      status: 'terminado',
      timerRunning: false,
      elapsed,
      updatedAt,
    });
    closeModal('modalPartidoDetail');
    showToast('🏁 Partido terminado', 'tg');
  } catch (error) {
    console.log('[Make] Error al terminar partido', error);
    showToast('Error al terminar partido', 'tr');
  }
}

function resetPartidoForm() {
  document.getElementById('mp_key').value = '';
  document.getElementById('mpModalTitle').textContent = 'Registrar Partido';
  const now = new Date();
  document.getElementById('mp_fecha').value = now.toISOString().split('T')[0];
  document.getElementById('mp_hora_ini').value = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
  document.getElementById('mp_hora_fin').value = '';
  document.getElementById('mp_gL').value = 0;
  document.getElementById('mp_gV').value = 0;
  document.getElementById('mp_portero_local').value = '';
  document.getElementById('mp_portero_visita').value = '';
  document.getElementById('mp_status').value = 'pendiente';
  document.getElementById('mp_costo').value = 250;
  document.getElementById('lineup_local').innerHTML = '';
  document.getElementById('lineup_visita').innerHTML = '';
  document.getElementById('lineup_local_roster').innerHTML = '';
  document.getElementById('lineup_visita_roster').innerHTML = '';
  if (document.getElementById('mp_is_default')) document.getElementById('mp_is_default').checked = false;
  if (document.getElementById('mp_default_options')) document.getElementById('mp_default_options').style.display = 'none';
  if (document.getElementById('mp_default_loser')) document.getElementById('mp_default_loser').value = '';
  const mps = document.getElementById('mp_marcador_section');
  if (mps) mps.style.display = 'block';
  document.getElementById('mp_torneo').value = currentTorneo;
  document.getElementById('mp_cat').value = currentCat;
  const sel = document.getElementById('mp_arbitro');
  sel.innerHTML = '<option value="">Sin árbitro</option>' + getArbs().map((a) => `<option value="${a._key}">${a.nombre}</option>`).join('');
  updateMPEquipos();
}

function updateMPEquipos() {
  const t = document.getElementById('mp_torneo')?.value || currentTorneo;
  const c = document.getElementById('mp_cat')?.value || currentCat;
  const catSel = document.getElementById('mp_cat');
  if (catSel) {
    const orderedKeys = catOrderKeys.filter((k) => CAT_NAMES[k]);
    Object.keys(CAT_NAMES).forEach((k) => {
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    });
    catSel.innerHTML = orderedKeys
      .filter((k) => canAccessCat(k, t))
      .map((k) => `<option value="${k}"${k === c ? ' selected' : ''}>${CAT_NAMES[k]}</option>`).join('');
  }
  const cat2 = document.getElementById('mp_cat')?.value || c;
  const eqs = getEqs().filter((e) => e.torneo === t && e.cat === cat2);
  const opts = '<option value="">Seleccionar...</option>' + eqs.map((e) => `<option value="${e._key}">${e.nombre}</option>`).join('');
  document.getElementById('mp_local').innerHTML = opts;
  document.getElementById('mp_visita').innerHTML = opts;
  if (document.getElementById('mp_portero_local')) document.getElementById('mp_portero_local').value = '';
  if (document.getElementById('mp_portero_visita')) document.getElementById('mp_portero_visita').value = '';
}

function syncPartidoPorteroDefaults(force = false) {
  const localKey = document.getElementById('mp_local')?.value;
  const visitaKey = document.getElementById('mp_visita')?.value;
  const localInput = document.getElementById('mp_portero_local');
  const visitaInput = document.getElementById('mp_portero_visita');
  const eqL = localKey ? C.equipos[localKey] : null;
  const eqV = visitaKey ? C.equipos[visitaKey] : null;
  if (localInput && (force || !localInput.value.trim())) localInput.value = eqL?.portero || '';
  if (visitaInput && (force || !visitaInput.value.trim())) visitaInput.value = eqV?.portero || '';
}

function toggleDefaultMode() {
  const isDefault = document.getElementById('mp_is_default').checked;
  document.getElementById('mp_default_options').style.display = isDefault ? 'block' : 'none';
  const section = document.getElementById('mp_marcador_section');
  if (section) section.style.display = isDefault ? 'none' : 'block';
  if (!isDefault) {
    document.getElementById('mp_gL').value = 0;
    document.getElementById('mp_gV').value = 0;
    document.getElementById('mp_status').value = 'pendiente';
  }
}

function syncLineupFromTeam(side) {
  const key = document.getElementById(side === 'local' ? 'mp_local' : 'mp_visita').value;
  const rosterEl = document.getElementById(`lineup_${side}_roster`);
  if (!rosterEl) return;
  rosterEl.innerHTML = '';
  if (!key) return;
  const eq = C.equipos[key];
  const aline = eq?.alineacion || [];
  if (!aline.length) {
    rosterEl.innerHTML = '<div style="font-size:10px;color:var(--muted);padding:4px 0">Sin alineación guardada</div>';
    return;
  }
  rosterEl.innerHTML =
    '<div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--acc);margin-bottom:5px">👕 Alineación registrada — toca para agregar</div>' +
    aline
      .map(
        (pl) =>
          `<div class="roster-player-chip" onclick="toggleRosterPlayer('${side}','${pl.replace(
            /'/g,
            "\\'"
          )}',this)" style="display:inline-flex;align-items:center;gap:5px;background:var(--card2);border:1.5px solid var(--border);border-radius:20px;padding:5px 10px;margin:3px 3px 3px 0;cursor:pointer;font-size:11px;font-weight:700;transition:all .2s">${pl}</div>`
      )
      .join('');
}

function toggleRosterPlayer(side, name, chip) {
  const cont = document.getElementById(`lineup_${side}`);
  const existing = Array.from(cont.querySelectorAll('input')).find((i) => i.value.trim() === name.trim());
  if (existing) {
    existing.closest('.player-input-row').remove();
    chip.style.background = 'var(--card2)';
    chip.style.borderColor = 'var(--border)';
    chip.style.color = 'var(--text)';
    Array.from(cont.querySelectorAll('.player-input-row')).forEach((row, i) => {
      const num = row.querySelector('span');
      if (num) num.textContent = i + 1;
      const inp = row.querySelector('input');
      if (inp) inp.placeholder = `Jugador ${i + 1}`;
    });
    return;
  }
  const idx = cont.children.length + 1;
  const div = document.createElement('div');
  div.className = 'player-input-row';
  div.innerHTML = `<span style="font-size:10px;color:var(--muted);width:16px;text-align:center;line-height:28px">${idx}</span><input class="fi" value="${name}" placeholder="Jugador ${idx}" style="flex:1"/>`;
  cont.appendChild(div);
  chip.style.background = 'rgba(37,84,212,.12)';
  chip.style.borderColor = 'var(--acc)';
  chip.style.color = 'var(--acc)';
}

function openEditPartido(key) {
  const p = C.partidos[key];
  if (!p) return;
  resetPartidoForm();
  document.getElementById('mp_key').value = key;
  document.getElementById('mpModalTitle').textContent = 'Editar Partido';
  document.getElementById('mp_torneo').value = appTorneoId(p.torneo || p.torneoId || 'lombardo_toledano');
  document.getElementById('mp_cat').value = appCatId(p.cat || p.categoriaId || 'cat_libre_varonil');
  updateMPEquipos();
  document.getElementById('mp_cancha').value = p.cancha || 'Cancha Principal';
  document.getElementById('mp_arbitro').value = p.arbId || '';
  document.getElementById('mp_fecha').value = p.fecha || '';
  document.getElementById('mp_hora_ini').value = p.horaIni || '';
  document.getElementById('mp_hora_fin').value = p.horaFin || '';
  document.getElementById('mp_gL').value = p.gL || 0;
  document.getElementById('mp_gV').value = p.gV || 0;
  document.getElementById('mp_status').value = p.status || 'pendiente';
  document.getElementById('mp_costo').value = p.costArb || 250;
  (p.alineLocal || []).forEach((pl) => addPlayer('local', pl));
  (p.alineVisita || []).forEach((pl) => addPlayer('visita', pl));
  const eqs = getEqs();
  const lEq =
    eqs.find(
      (e) =>
        (e._key === p.local || e.nombre === (p.localNombre || p.local)) &&
        e.torneo === (p.torneo || currentTorneo) &&
        e.cat === (p.cat || currentCat)
    ) || eqs.find((e) => e._key === p.local || e.nombre === (p.localNombre || p.local));
  const vEq =
    eqs.find(
      (e) =>
        (e._key === p.visita || e.nombre === (p.visitaNombre || p.visita)) &&
        e.torneo === (p.torneo || currentTorneo) &&
        e.cat === (p.cat || currentCat)
    ) || eqs.find((e) => e._key === p.visita || e.nombre === (p.visitaNombre || p.visita));
  const lKey = lEq ? lEq._key : '';
  const vKey = vEq ? vEq._key : '';
  document.getElementById('mp_local').value = lKey;
  document.getElementById('mp_visita').value = vKey;
  document.getElementById('mp_portero_local').value = (p.porteroLocal || lEq?.portero || '').trim();
  document.getElementById('mp_portero_visita').value = (p.porteroVisita || vEq?.portero || '').trim();
  syncLineupFromTeam('local');
  syncLineupFromTeam('visita');
  setTimeout(() => {
    ['local', 'visita'].forEach((side) => {
      const cont = document.getElementById(`lineup_${side}`);
      const chips = document.querySelectorAll(`#lineup_${side}_roster .roster-player-chip`);
      const added = Array.from(cont.querySelectorAll('input')).map((i) => i.value.trim());
      chips.forEach((chip) => {
        if (added.includes(chip.textContent.trim())) {
          chip.style.background = 'rgba(37,84,212,.12)';
          chip.style.borderColor = 'var(--acc)';
          chip.style.color = 'var(--acc)';
        }
      });
    });
  }, 50);
  openModal('modalPartido');
}

function addPlayer(side, val = '') {
  const cont = document.getElementById(`lineup_${side}`);
  const idx = cont.children.length + 1;
  const div = document.createElement('div');
  div.className = 'player-input-row';
  div.innerHTML = `<span style="font-size:10px;color:var(--muted);width:16px;text-align:center;line-height:28px">${idx}</span><input class="fi" value="${val}" placeholder="Jugador ${idx}" style="flex:1"/>`;
  cont.appendChild(div);
}

function getLineup(side) {
  return Array.from(document.getElementById(`lineup_${side}`).querySelectorAll('input'))
    .map((i) => i.value.trim())
    .filter((v) => v);
}

async function savePartido() {
  const localKey = document.getElementById('mp_local').value;
  const visitaKey = document.getElementById('mp_visita').value;
  const eqL = localKey ? C.equipos[localKey] : null;
  const eqV = visitaKey ? C.equipos[visitaKey] : null;
  if (!eqL || !eqV) {
    showToast('Selecciona ambos equipos', 'ta');
    return;
  }
  const torneo = appTorneoId(document.getElementById('mp_torneo').value || currentTorneo || 'lombardo_toledano');
  const cat = appCatId(document.getElementById('mp_cat').value || currentCat || 'cat_libre_varonil');
  if (!canAccessTorneo(torneo) || !canAccessCat(cat, torneo)) {
    showToast('No tienes permiso para esa categoría', 'tr');
    return;
  }
  const arbId = document.getElementById('mp_arbitro').value || null;
  const arb = arbId ? C.arbitros[arbId] : null;
  const key = document.getElementById('mp_key').value;
  const porteroLocal = document.getElementById('mp_portero_local').value.trim();
  const porteroVisita = document.getElementById('mp_portero_visita').value.trim();
  const updatedAt = Date.now();
  const isDefault = document.getElementById('mp_is_default')?.checked || false;
  let gL, gV, status, defaultFlag = false;
  if (isDefault) {
    const loser = document.getElementById('mp_default_loser').value;
    if (!loser) {
      showToast('Selecciona qué equipo no se presentó', 'ta');
      return;
    }
    gL = loser === 'local' ? 0 : 2;
    gV = loser === 'visita' ? 0 : 2;
    status = 'terminado';
    defaultFlag = true;
  } else {
    gL = parseInt(document.getElementById('mp_gL').value) || 0;
    gV = parseInt(document.getElementById('mp_gV').value) || 0;
    status = document.getElementById('mp_status').value;
  }
  const data = {
    torneo,
    cat,
    torneoId: firestoreTorneoId(torneo),
    categoriaId: firestoreCatId(cat),
    local: localKey,
    localNombre: eqL.nombre,
    visita: visitaKey,
    visitaNombre: eqV.nombre,
    cancha: document.getElementById('mp_cancha').value,
    arbId,
    arbitroNombre: arb?.nombre || null,
    fecha: document.getElementById('mp_fecha').value,
    horaIni: document.getElementById('mp_hora_ini').value,
    horaFin: document.getElementById('mp_hora_fin').value || null,
    gL,
    gV,
    porteroLocal: porteroLocal || null,
    porteroVisita: porteroVisita || null,
    status,
    porDefault: defaultFlag || null,
    costArb: parseInt(document.getElementById('mp_costo').value) || 250,
    alineLocal: isDefault ? [] : getLineup('local'),
    alineVisita: isDefault ? [] : getLineup('visita'),
    updatedAt,
  };
  try {
    let partidoKey = key;
    let partidoData = { ...data };
    if (fs) {
      partidoKey = key || newDocId('partido', `${data.fecha}_${localKey}_${visitaKey}_${updatedAt}`);
      partidoData = key
        ? { ...(C.partidos[key] || {}), ...data }
        : {
            ...data,
            goles: {},
            arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } },
            arbPagado: false,
            creadoAt: updatedAt
          };
      await saveDoc('partidos', partidoKey, partidoData);
    } else if (key) {
      await db.ref(`partidos/${key}`).update(data);
      partidoData = { ...(C.partidos[key] || {}), ...data };
    } else {
      const partidoRef = db.ref('partidos').push();
      partidoKey = partidoRef.key;
      partidoData = {
        ...data,
        goles: {},
        arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } },
        creadoAt: updatedAt,
      };
      await partidoRef.set(partidoData);
    }
    await intentarSincronizarResultado(partidoKey, partidoData);
    closeModal('modalPartido');
    showToast(key ? 'Partido actualizado' : defaultFlag ? '⚠️ Default registrado' : 'Partido registrado', 'tg');
  } catch (error) {
    console.log('[Make] Error al guardar partido', error);
    showToast('Error al guardar partido', 'tr');
  }
}

function initPagoArb() {
  const p = C.partidos[activePartidoKey];
  if (!p) return;
  document.getElementById('pa_key').value = activePartidoKey;
  document.getElementById('pa_local_title').textContent = `🏠 ${p.localNombre || p.local}`;
  document.getElementById('pa_visita_title').textContent = `✈️ ${p.visitaNombre || p.visita}`;
  payMethods = { local: null, visita: null };
  ['local', 'visita'].forEach((s) => {
    ['ef', 'tr', 'pp', 'mx'].forEach((m) => (document.getElementById(`btn_${s[0]}_${m}`).className = 'pmo'));
    document.getElementById(`pa_${s[0]}_amounts`).style.display = 'none';
    document.getElementById(`pa_${s[0]}_status`).textContent = '';
    const prev = p.arbPago?.[s];
    if (prev) {
      const tot = (prev.ef || 0) + (prev.tr || 0) + (prev.pp || 0);
      if (tot > 0) document.getElementById(`pa_${s[0]}_status`).textContent = `Registrado: $${tot}`;
    }
  });
}

function setPM(side, method) {
  const s = side[0];
  ['ef', 'tr', 'pp', 'mx', 'nd'].forEach((m) => {
    const btn = document.getElementById(`btn_${s}_${m}`);
    if (btn) btn.className = 'pmo';
  });
  const activeBtn = document.getElementById(`btn_${s}_${method}`);
  if (activeBtn) activeBtn.className = `pmo sel-${method === 'mx' ? 'mx' : method === 'nd' ? 'nd' : method}`;
  if (side === 'local') payMethods.local = method;
  else payMethods.visita = method;
  const amts = document.getElementById(`pa_${s}_amounts`);
  const status = document.getElementById(`pa_${s}_status`);
  if (method === 'nd') {
    if (amts) amts.style.display = 'none';
    if (status) status.innerHTML = '<span style="color:var(--red);font-weight:800">❌ No pagó arbitraje — quedará pendiente</span>';
  } else if (method === 'pp') {
    if (amts) amts.style.display = 'none';
    document.getElementById(`${s}_pp_a`).value = 250;
    if (status) status.textContent = '✅ Prepago: $250';
  } else if (method === 'ef') {
    if (amts) amts.style.display = 'none';
    document.getElementById(`${s}_ef_a`).value = 250;
    if (status) status.textContent = '💵 Efectivo: $250';
  } else if (method === 'tr') {
    if (amts) amts.style.display = 'none';
    document.getElementById(`${s}_tr_a`).value = 250;
    if (status) status.textContent = '📱 Transf.: $250';
  } else {
    if (amts) amts.style.display = 'grid';
    ['ef', 'tr', 'pp'].forEach((x) => (document.getElementById(`${s}_${x}_a`).value = 0));
    if (status) status.textContent = 'Ingresa montos (deben sumar $250)';
  }
}

async function guardarPagoArb() {
  const key = document.getElementById('pa_key').value;
  const partido = C.partidos[key] || {};
  const ga = (id) => parseInt(document.getElementById(id)?.value) || 0;
  const build = (side) => {
    const m = side === 'local' ? payMethods.local : payMethods.visita;
    const s = side[0];
    if (!m) return null;
    if (m === 'nd') return { nd: true, ef: 0, tr: 0, pp: 0 };
    if (m === 'ef') return { ef: 250, tr: 0, pp: 0 };
    if (m === 'tr') return { ef: 0, tr: 250, pp: 0 };
    if (m === 'pp') return { ef: 0, tr: 0, pp: 250 };
    return { ef: ga(`${s}_ef_a`), tr: ga(`${s}_tr_a`), pp: ga(`${s}_pp_a`) };
  };
  const lp = build('local');
  const vp = build('visita');
  const updates = {};
  const arbPago = {
    local: { ...(partido.arbPago?.local || { ef: 0, tr: 0, pp: 0 }) },
    visita: { ...(partido.arbPago?.visita || { ef: 0, tr: 0, pp: 0 }) }
  };
  if (lp) {
    arbPago.local = lp;
    updates[`partidos/${key}/arbPago/local`] = lp;
  }
  if (vp) {
    arbPago.visita = vp;
    updates[`partidos/${key}/arbPago/visita`] = vp;
  }
  const fullyPaid = lp && vp && !lp.nd && !vp.nd;
  try {
    if (fs) await updateDoc('partidos', key, { arbPago, arbPagado: fullyPaid });
    else {
      updates[`partidos/${key}/arbPagado`] = fullyPaid;
      await db.ref().update(updates);
    }
    closeModal('modalPagoArb');
    showToast(fullyPaid ? 'Pagos guardados ✅' : 'Guardado — hay pagos pendientes ⚠️', 'tg');
  } catch (error) {
    console.error(error);
    showToast('Error al guardar pagos de arbitraje', 'tr');
  }
}
