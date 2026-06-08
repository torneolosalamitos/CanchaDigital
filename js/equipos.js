function renderEquiposPage() {
  const el = document.getElementById('equiposView');
  if (!el) return;
  const eqs = getEqs().filter((e) => e.torneo === currentTorneo && e.cat === currentCat);
  if (!eqs.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">🏆</span>Sin equipos registrados en esta categoría</div>';
    return;
  }
  el.innerHTML = `<div class="equipos-grid">${eqs
    .map(
      (e) => `
    <div class="equipo-card" onclick="openEquipoDetail('${e._key}')">
      ${e.logo ? `<img class="eq-logo" src="${e.logo}"/>` : `<div class="eq-ph" style="background:${e.color || 'var(--card2)'}22">⚽</div>`}
      <div class="eq-name">${e.nombre}</div>
      <div class="eq-cat">${CAT_NAMES[e.cat] || e.cat}</div>
      ${
        isAdmin
          ? `<div style="display:flex;gap:4px;margin-top:6px;justify-content:center"><button class="btn btn-out btn-sm" onclick="event.stopPropagation();editEquipo('${e._key}')">✏️</button><button class="btn btn-r btn-sm" onclick="event.stopPropagation();deleteEquipo('${e._key}')">🗑️</button></div>`
          : ''
      }
    </div>`
    )
    .join('')}</div>`;
}

function openEquipoDetail(key) {
  const e = C.equipos[key];
  if (!e) return;
  document.getElementById('edTitle').textContent = e.nombre;
  const eqParts = filteredParts().filter(
    (p) => p.status === 'terminado' && (p.local === key || p.visita === key || p.localNombre === e.nombre || p.visitaNombre === e.nombre)
  );
  let pj = 0,
    g = 0,
    em = 0,
    pe = 0,
    gf = 0,
    gc = 0,
    pts = 0;
  eqParts.forEach((p) => {
    const isLocal = p.local === key || p.localNombre === e.nombre;
    const myG = isLocal ? p.gL || 0 : p.gV || 0;
    const oppG = isLocal ? p.gV || 0 : p.gL || 0;
    pj++;
    gf += myG;
    gc += oppG;
    if (myG > oppG) {
      g++;
      pts += 3;
    } else if (myG < oppG) {
      pe++;
    } else {
      em++;
      pts++;
    }
  });
  const byP = {};
  eqParts.forEach((p) => {
    const goles = p.goles ? Object.values(p.goles) : [];
    const isLocal = p.local === key || p.localNombre === e.nombre;
    goles
      .filter((gol) => gol.equipo === (isLocal ? 'local' : 'visita'))
      .forEach((gol) => {
        if (!byP[gol.jugador]) byP[gol.jugador] = 0;
        byP[gol.jugador]++;
      });
  });
  const topScorers = Object.entries(byP)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const tablaData = buildTablaData();
  const pos = tablaData.findIndex((t) => t.nombre === e.nombre) + 1;
  document.getElementById('equipoDetailContent').innerHTML = `
    <div class="eq-detail-header">
      ${e.logo ? `<img class="eq-detail-logo" src="${e.logo}"/>` : `<div class="eq-detail-ph" style="background:${e.color || 'var(--acc3)'}">⚽</div>`}
      <div>
        <div class="eq-detail-name">${e.nombre}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:600">${TORNEO_NAMES[e.torneo] || ''} · ${CAT_NAMES[e.cat] || ''}</div>
        ${e.tel ? `<div style="font-size:11px;color:var(--muted);font-weight:600">📞 ${e.tel}</div>` : ''}
        ${e.portero ? `<div style="font-size:11px;color:#0369a1;font-weight:800;margin-top:4px">🧤 Portero: ${e.portero}</div>` : ''}
      </div>
    </div>
    <div class="eq-stat-grid">
      <div class="eq-stat"><div class="eq-stat-n" style="color:var(--amber)">${pos || '—'}</div><div class="eq-stat-l">Posición</div></div>
      <div class="eq-stat"><div class="eq-stat-n">${pj}</div><div class="eq-stat-l">Partidos</div></div>
      <div class="eq-stat"><div class="eq-stat-n">${pts}</div><div class="eq-stat-l">Puntos</div></div>
      <div class="eq-stat"><div class="eq-stat-n">${g}</div><div class="eq-stat-l">Ganados</div></div>
      <div class="eq-stat"><div class="eq-stat-n">${gf}</div><div class="eq-stat-l">Goles F.</div></div>
      <div class="eq-stat"><div class="eq-stat-n" style="color:var(--red)">${gc}</div><div class="eq-stat-l">Goles C.</div></div>
    </div>
    ${
      topScorers.length
        ? `<div class="sh"><div class="st">⚽ Goleadores del equipo</div></div>
    <div class="card">
      ${topScorers
        .map(
          ([n, c], i) => `<div class="gol-row">
        <div class="gol-pos ${i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'pr'}">${i + 1}</div>
        <div class="gol-info">
          <div class="gol-player">${n} ${i === 0 ? '<span style="font-size:16px" title="Goleador del equipo">🏅</span>' : ''}</div>
        </div>
        <div class="gol-count">${c}</div>
      </div>`
        )
        .join('')}
    </div>`
        : ''
    }
    ${
      (e.alineacion || []).length
        ? `
    <div class="sh" style="margin-top:8px"><div class="st">👕 Plantilla</div></div>
    <div class="card">
      ${(e.alineacion || [])
        .map((pl, i) => {
          const gcPl = byP[pl] || 0;
          const esGoleador = topScorers.length > 0 && topScorers[0][0] === pl && gcPl > 0;
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
          <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--muted);width:22px;text-align:center">${i + 1}</span>
          <span style="font-size:13px;font-weight:700;flex:1">${pl}${esGoleador ? ' 🏅' : ''}</span>
          ${gcPl ? `<span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--acc)">${gcPl} ⚽</span>` : ''}
        </div>`;
        })
        .join('')}
    </div>`
        : ''
    }
    <div class="sh" style="margin-top:8px"><div class="st">📅 Historial de partidos</div></div>
    <div class="card">
      ${
        eqParts.length
          ? eqParts
              .map((p) => {
                const isLocal = p.local === key || p.localNombre === e.nombre;
                const myG = isLocal ? p.gL || 0 : p.gV || 0;
                const oppG = isLocal ? p.gV || 0 : p.gL || 0;
                const opp = isLocal ? p.visitaNombre || p.visita : p.localNombre || p.local;
                const res = myG > oppG ? 'G' : myG < oppG ? 'P' : 'E';
                const rc = res === 'G' ? '#16a34a' : res === 'P' ? '#dc2626' : '#64748b';
                return `<div class="gol-row"><div style="font-family:Bebas Neue,sans-serif;font-size:20px;color:${rc};width:24px">${res}</div><div class="gol-info"><div style="font-size:12px;font-weight:700">vs ${opp}</div><div style="font-size:10px;color:var(--muted);font-weight:600">${fmtDate(p.fecha)}</div></div><div style="font-family:Bebas Neue,sans-serif;font-size:22px;color:var(--text)">${myG}:${oppG}</div></div>`;
              })
              .join('')
          : '<div class="empty" style="padding:14px">Sin partidos</div>'
      }
    </div>
    ${buildEquipoFinancialHtml(key, e, eqParts)}`;
  openModal('modalEquipoDetail');
}

function buildEquipoFinancialHtml(key, e, eqParts) {
  const canSeeFinancial = isAdmin || (isCaptain && captainEquipoKey === key);
  if (!canSeeFinancial) return '';
  const insc = Object.entries(C.inscripciones || {}).find(([, i]) => i.nombre === e.nombre && i.torneo === e.torneo && i.cat === e.cat);
  let inscHtml = '<div style="color:var(--muted);font-size:12px;font-weight:600">Sin inscripción registrada</div>';
  if (insc) {
    const [inscKey, inscData] = insc;
    const monto = Number(inscData.montoTotal || inscData.monto || 0);
    const abonos = inscData.abonos ? Object.values(inscData.abonos) : [];
    const pagado = inscData.montoPagado !== undefined && inscData.montoPagado !== null
      ? Number(inscData.montoPagado || 0)
      : abonos.reduce((s, a) => s + (a.monto || 0), 0);
    const pendiente = Math.max(0, monto - pagado);
    const pct = monto > 0 ? Math.min(100, Math.round((pagado / monto) * 100)) : 0;
    inscHtml = `
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-size:11px;color:var(--muted);font-weight:600">Total inscripción</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:24px">$${monto}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--muted);font-weight:600">Pagado</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:#16a34a">$${pagado}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--muted);font-weight:600">Pendiente</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:${pendiente > 0 ? 'var(--red)' : '#16a34a'}">$${pendiente}</div>
        </div>
      </div>
      <div style="height:8px;background:var(--border2);border-radius:4px;overflow:hidden;margin-bottom:10px;margin-top:6px">
        <div style="height:100%;width:${Math.min(pct, 100)}%;background:${pendiente > 0 ? '#f59e0b' : '#16a34a'};border-radius:4px;transition:width .6s ease"></div>
      </div>
      <div style="font-size:10px;font-weight:700;color:${pendiente > 0 ? 'var(--amber)' : '#16a34a'};margin-bottom:8px">${pct}% pagado</div>
      ${
        abonos.length
          ? abonos
              .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
              .map(
                (a) => `
        <div class="fin-row">
          <div>
            <div style="font-size:12px;font-weight:700">${a.metodo === 'efectivo' ? '💵' : a.metodo === 'transferencia' ? '📱' : '✅'} ${a.metodo || '—'}</div>
            <div style="font-size:10px;color:var(--muted);font-weight:600">${fmtDate(a.fecha)}${a.notas ? ` · ${a.notas}` : ''}</div>
          </div>
          <span class="fin-paid">+$${a.monto || 0}</span>
        </div>`
              )
              .join('')
          : '<div style="font-size:11px;color:var(--muted)">Sin abonos registrados</div>'
      }`;
  }
  const arbsPend = eqParts.filter((p) => {
    const arbP = p.arbPago || {};
    const isLocal = p.local === key || p.localNombre === e.nombre;
    const side = isLocal ? 'local' : 'visita';
    const pago = arbP[side] || {};
    return pago.nd || (!p.sinArb && !pago.ef && !pago.tr && !pago.pp && p.arbId);
  });
  let arbHtml = '';
  if (arbsPend.length) {
    arbHtml = arbsPend
      .map((p) => {
        const isLocal = p.local === key || p.localNombre === e.nombre;
        const opp = isLocal ? p.visitaNombre || p.visita : p.localNombre || p.local;
        const costo = isLocal ? p.arbPago?.local?.costo || p.costArb || 250 : p.arbPago?.visita?.costo || p.costArb || 250;
        const nota = (isLocal ? p.arbPago?.local?.nota : p.arbPago?.visita?.nota) || '';
        return `<div class="fin-pending-arb">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;font-weight:800">vs ${opp}</div>
            <div style="font-size:10px;color:var(--muted);font-weight:600">${fmtDate(p.fecha)}${nota ? ` · ${nota}` : ''}</div>
          </div>
          <span class="arb-nd-badge">❌ No pagó $${costo}</span>
        </div>
      </div>`;
      })
      .join('');
  } else {
    arbHtml = '<div style="font-size:11px;color:#16a34a;font-weight:700">✅ Sin arbitrajes pendientes</div>';
  }
  const canEditLineup = isAdmin || (isCaptain && captainEquipoKey === key);
  return `
    <div class="sh" style="margin-top:8px">
      <div class="st">💰 Estado Financiero</div>
      <div class="sl"></div>
      ${isAdmin ? `<button class="btn btn-out btn-sm" onclick="openModal('modalAbono');document.getElementById('ab_insc_key').value='${insc ? insc[0] : ''}';document.getElementById('ab_fecha').value=new Date().toISOString().split('T')[0]">+ Abono</button>` : ''}
    </div>
    <div class="fin-section">
      <div class="fin-section-title">🏷️ Inscripción</div>
      ${inscHtml}
    </div>
    <div class="fin-section">
      <div class="fin-section-title">🦺 Arbitrajes pendientes de pago</div>
      ${arbHtml}
    </div>
    ${
      canEditLineup
        ? `
    <div class="sh" style="margin-top:8px"><div class="st">✏️ Editar alineación</div><div class="sl"></div></div>
    <div class="card" id="alineacionEditor_${key}">
      ${buildAlineacionEditor(key, e)}
    </div>
    <div class="sh" style="margin-top:8px"><div class="st">📬 Solicitudes de unión</div><div class="sl"></div></div>
    <div class="card" id="solicitudesEquipo_${key}">
      ${buildSolicitudesEquipo(key)}
    </div>`
        : ''
    }`;
}

function buildSolicitudesEquipo(key) {
  const sols = Object.entries(C.solicitudes || {}).filter(([, s]) => s.equipoKey === key && s.status === 'pending');
  if (!sols.length) return '<div style="font-size:11px;color:var(--muted)">Sin solicitudes pendientes</div>';
  return sols
    .map(
      ([id, s]) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:800">${s.nombre || s.email}</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600">${s.email || ''} ${s.mensaje ? '— ' + s.mensaje : ''}</div>
      </div>
      <button class="btn btn-g btn-sm" onclick="aceptarSolicitud('${id}','${key}')">✅ Aceptar</button>
      <button class="btn btn-r btn-sm" onclick="rechazarSolicitud('${id}')">✕</button>
    </div>`
    )
    .join('');
}

function buildAlineacionEditor(key, e) {
  const aline = e.alineacion || [];
  return `<div id="aline_list_${key}">
    ${aline
      .map(
        (pl, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--muted);width:20px">${i + 1}</span>
      <input class="fi" style="flex:1;padding:6px 10px" value="${pl}" id="aline_p_${key}_${i}" placeholder="Nombre jugador"/>
      <button onclick="removeAlinePlayer('${key}',${i})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;color:var(--muted)">✕</button>
    </div>`
      )
      .join('')}
    <div style="display:flex;gap:6px;margin-top:8px">
      <input class="fi" id="aline_new_${key}" placeholder="Agregar jugador..." style="flex:1"/>
      <button class="btn btn-out btn-sm" onclick="addAlinePlayer('${key}')">+ Agregar</button>
    </div>
    <button class="btn btn-g btn-full" style="margin-top:8px" onclick="saveAlineacion('${key}')">💾 Guardar Alineación</button>
  </div>`;
}

function addAlinePlayer(key) {
  const inp = document.getElementById('aline_new_' + key);
  if (!inp || !inp.value.trim()) return;
  const e = C.equipos[key];
  if (!e) return;
  const aline = [...(e.alineacion || []), inp.value.trim()];
  const listEl = document.getElementById('aline_list_' + key);
  if (listEl) {
    const i = aline.length - 1;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)';
    row.innerHTML = `<span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--muted);width:20px">${i + 1}</span>
      <input class="fi" style="flex:1;padding:6px 10px" value="${inp.value.trim()}" id="aline_p_${key}_${i}" placeholder="Nombre jugador"/>
      <button onclick="removeAlinePlayer('${key}',${i})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;color:var(--muted)">✕</button>`;
    listEl.insertBefore(row, listEl.querySelector('#aline_new_' + key).parentElement);
  }
  inp.value = '';
}

function removeAlinePlayer(key, idx) {
  const inp = document.getElementById('aline_p_' + key + '_' + idx);
  if (inp) inp.closest('div').remove();
}

function saveAlineacion(key) {
  const e = C.equipos[key];
  if (!e) return;
  const inputs = document.querySelectorAll(`[id^="aline_p_${key}_"]`);
  const aline = Array.from(inputs)
    .map((i) => i.value.trim())
    .filter((v) => v);
  db.ref('equipos/' + key + '/alineacion')
    .set(aline)
    .then(() => showToast('Alineación guardada ✅', 'tg'))
    .catch((err) => showToast('Error: ' + err.message, 'tr'));
}

function resetEquipoForm() {
  document.getElementById('eq_key').value = '';
  document.getElementById('eqModalTitle').textContent = 'Registrar Equipo';
  ['eq_nombre', 'eq_tel', 'eq_logo', 'eq_portero'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('eq_color').value = '#1a3a8a';
  document.getElementById('eq_torneo').value = currentTorneo;
  document.getElementById('eq_cat').value = currentCat;
  document.getElementById('eq_logo_prev').style.display = 'none';
  document.getElementById('eq_logo_lbl').style.display = 'block';
  document.getElementById('eq_lineup_list').innerHTML = '';
}

function addEqPlayer(val = '') {
  const cont = document.getElementById('eq_lineup_list');
  const idx = cont.children.length + 1;
  const div = document.createElement('div');
  div.style = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';
  div.innerHTML = `
    <span style="font-size:11px;color:var(--muted);width:22px;text-align:center;font-weight:700;line-height:32px">${idx}</span>
    <input class="fi" value="${val}" placeholder="Nombre del jugador" style="flex:1"/>
    <button onclick="this.parentElement.remove();renumberPlayers()" style="background:none;border:1.5px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;color:var(--muted);font-size:13px;font-weight:700">✕</button>`;
  cont.appendChild(div);
}

function renumberPlayers() {
  document.querySelectorAll('#eq_lineup_list > div').forEach((div, i) => {
    const span = div.querySelector('span');
    if (span) span.textContent = i + 1;
  });
}

function getEqLineup() {
  return Array.from(document.getElementById('eq_lineup_list').querySelectorAll('input'))
    .map((i) => i.value.trim())
    .filter((v) => v);
}

function editEquipo(key) {
  const e = C.equipos[key];
  if (!e) return;
  resetEquipoForm();
  document.getElementById('eq_key').value = key;
  document.getElementById('eqModalTitle').textContent = 'Editar Equipo';
  document.getElementById('eq_nombre').value = e.nombre || '';
  document.getElementById('eq_tel').value = e.tel || '';
  document.getElementById('eq_torneo').value = e.torneo || 'lombardo_toledano';
  document.getElementById('eq_cat').value = e.cat || 'cat_libre_varonil';
  document.getElementById('eq_color').value = e.color || '#1a3a8a';
  document.getElementById('eq_portero').value = e.portero || '';
  if (e.logo) {
    document.getElementById('eq_logo').value = e.logo;
    const p = document.getElementById('eq_logo_prev');
    p.src = e.logo;
    p.style.display = 'block';
    document.getElementById('eq_logo_lbl').style.display = 'none';
  }
  (e.alineacion || []).forEach((pl) => addEqPlayer(pl));
  openModal('modalEquipo');
}

async function saveEquipo() {
  const n = document.getElementById('eq_nombre').value.trim();
  if (!n) {
    showToast('Ingresa el nombre', 'ta');
    return;
  }
  const key = document.getElementById('eq_key').value;
  const torneo = document.getElementById('eq_torneo').value;
  const cat = document.getElementById('eq_cat').value;
  if (!canAccessTorneo(torneo) || !canAccessCat(cat, torneo)) {
    showToast('No tienes permiso para esa categoría', 'tr');
    return;
  }
  const telefonoCapitan = document.getElementById('eq_tel').value.trim();
  const color = document.getElementById('eq_color').value;
  const logo = document.getElementById('eq_logo').value || null;
  const portero = document.getElementById('eq_portero').value.trim() || null;
  const alineacion = getEqLineup();

  if (fs) {
    const appTorneo = torneo || currentTorneo || 'lombardo_toledano';
    const appCat = cat || currentCat || 'cat_libre_varonil';
    const torneoId = firestoreTorneoId(appTorneo);
    const categoriaId = firestoreCatId(appCat);
    const equipoId = key || ('equipo_' + slugifyId(n));
    const isNew = !key;
    const nombreNormalizado = String(n || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\./g, '')
      .trim();
    const existingAlias = Array.isArray(C.equipos[equipoId]?.alias) ? C.equipos[equipoId].alias : [];
    const alias = Array.from(new Set([
      nombreNormalizado,
      nombreNormalizado.replace(/\s+/g, ''),
      nombreNormalizado.split(' ')[0],
      ...existingAlias
    ].filter(Boolean)));

    try {
      const equipoRef = fs.collection('equipos').doc(equipoId);
      const equipoData = {
        nombre: n,
        nombreNormalizado,
        alias,
        capitan: '',
        telefonoCapitan,
        tel: telefonoCapitan,
        torneo: appTorneo,
        cat: appCat,
        torneoId,
        categoriaId,
        color,
        logo,
        portero,
        alineacion,
        estado: 'activo',
        actualizadoEn: firestoreServerTimestamp()
      };
      if (isNew) equipoData.creadoEn = firestoreServerTimestamp();

      if (isNew) {
        const categoriaSnap = await fs.collection('categorias').doc(categoriaId).get();
        const categoriaData = categoriaSnap.exists ? (categoriaSnap.data() || {}) : {};
        const precioInscripcion = Number(categoriaData.precioInscripcion || 0);
        const fechaLimitePago = categoriaData.fechaLimitePago || '';
        const moneda = categoriaData.moneda || 'MXN';
        const inscripcionId = 'inscripcion_' + slugifyId(n) + '_' + torneoId.replace('torneo_', '');
        const inscripcionRef = fs.collection('inscripciones').doc(inscripcionId);
        const batch = fs.batch();

        batch.set(equipoRef, equipoData, { merge: true });
        batch.set(inscripcionRef, {
          torneo: appTorneo,
          cat: appCat,
          torneoId,
          categoriaId,
          equipoId,
          equipoNombre: n,
          nombre: n,
          montoTotal: precioInscripcion,
          montoPagado: 0,
          saldo: precioInscripcion,
          estado: precioInscripcion > 0 ? 'pendiente' : 'sin_costo',
          fechaLimitePago,
          moneda,
          origen: 'panel',
          creadoEn: firestoreServerTimestamp(),
          actualizadoEn: firestoreServerTimestamp()
        }, { merge: true });
        await batch.commit();
      } else {
        await equipoRef.set(equipoData, { merge: true });
      }

      closeModal('modalEquipo');
      resetEquipoForm();
      showToast(isNew ? 'Equipo registrado e inscripción generada' : 'Equipo actualizado', 'tg');
      return;
    } catch (error) {
      console.error(error);
      showToast('Error guardando equipo en Firestore', 'tr');
      return;
    }
  }

  const data = {
    nombre: n,
    tel: telefonoCapitan,
    torneo,
    cat,
    color,
    logo,
    portero,
    alineacion,
    updatedAt: Date.now()
  };
  if (key) db.ref(`equipos/${key}`).update(data);
  else db.ref('equipos').push({ ...data, creadoAt: Date.now() });
  closeModal('modalEquipo');
  showToast(key ? 'Equipo actualizado' : 'Equipo registrado', 'tg');
}

function deleteEquipo(key) {
  if (!confirm('¿Eliminar equipo?')) return;
  if (fs) {
    fs.collection('equipos').doc(key).delete()
      .then(() => showToast('Equipo eliminado', 'tr'))
      .catch((error) => {
        console.error(error);
        showToast('Error eliminando equipo en Firestore', 'tr');
      });
    return;
  }
  db.ref(`equipos/${key}`).remove();
  showToast('Equipo eliminado', 'tr');
}
