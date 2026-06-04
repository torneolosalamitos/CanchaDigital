function renderInscripciones() {
  const el = document.getElementById('inscList');
  if (!el) return;
  renderInscStats();
  const inscripciones = getInsc();
  if (!inscripciones.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">💰</span>Sin equipos registrados</div>';
    return;
  }

  const groups = {};
  inscripciones.forEach((inscripcion) => {
    const torneoKey = inscripcion.torneo || 'villa';
    const catKey = inscripcion.cat || 'liga_alta';
    if (!groups[torneoKey]) groups[torneoKey] = {};
    if (!groups[torneoKey][catKey]) groups[torneoKey][catKey] = [];
    groups[torneoKey][catKey].push(inscripcion);
  });

  let html = '';
  Object.keys(groups).forEach((torneoKey) => {
    const torneoNombre = TORNEO_NAMES[torneoKey] || torneoKey;
    const torneoInscs = Object.values(groups[torneoKey]).flat();
    const torneoPagado = torneoInscs.reduce((sum, inscripcion) => {
      const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
      return sum + abonos.reduce((acc, abono) => acc + abono.monto, 0);
    }, 0);
    const torneoMonto = torneoInscs.reduce((sum, inscripcion) => sum + (inscripcion.montoTotal || 0), 0);
    html += `<div style="background:var(--acc);color:#fff;border-radius:10px;padding:11px 14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px">${torneoNombre}</div>
      <div style="font-size:10px;opacity:.8;font-weight:600">${torneoInscs.length} equipos</div></div>
      <div style="text-align:right"><div style="font-family:'Bebas Neue',sans-serif;font-size:22px">$${torneoPagado}</div>
      <div style="font-size:10px;opacity:.8;font-weight:600">de $${torneoMonto}</div></div>
    </div>`;

    Object.keys(groups[torneoKey]).forEach((catKey) => {
      const catInscs = groups[torneoKey][catKey];
      const catPagado = catInscs.reduce((sum, inscripcion) => {
        const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
        return sum + abonos.reduce((acc, abono) => acc + abono.monto, 0);
      }, 0);
      const catMonto = catInscs.reduce((sum, inscripcion) => sum + (inscripcion.montoTotal || 0), 0);
      html += `<div style="background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:8px 12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:11px;font-weight:800;color:var(--acc);letter-spacing:1px">📋 ${CAT_NAMES[catKey] || catKey}</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted)">${catInscs.length} eq · $${catPagado}/$${catMonto}</div>
      </div>`;

      catInscs.forEach((inscripcion) => {
        const total = inscripcion.montoTotal || 0;
        const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
        const pagado = abonos.reduce((sum, abono) => sum + abono.monto, 0);
        const deuda = total - pagado;
        const pct = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
        const abonosHtml = abonos
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
          .map((abono) => `
          <div class="abono-row">
            <div class="abono-fecha">📅 ${fmtDate(abono.fecha) || '—'}</div>
            <span class="abono-method am-${abono.metodo === 'transferencia' ? 'tr' : abono.metodo === 'prepago' ? 'pp' : 'ef'}">${abono.metodo === 'transferencia' ? 'Transf.' : abono.metodo === 'prepago' ? 'Prepago' : 'Efectivo'}</span>
            <div class="abono-monto">$${abono.monto}</div>
            ${abono.notas ? `<div style="font-size:10px;color:var(--muted)">${abono.notas}</div>` : ''}
          </div>`)
          .join('');

        html += `<div class="insc-card">
          <div class="insc-header">
            ${inscripcion.logo ? `<img class="insc-logo" src="${inscripcion.logo}"/>` : '<div class="insc-ph">⚽</div>'}
            <div class="insc-info">
              <div class="insc-name">${inscripcion.nombre}</div>
              <div class="insc-meta">${CAT_NAMES[inscripcion.cat] || ''}</div>
            </div>
            <div class="insc-total">
              <div class="insc-pagado">$${pagado}</div>
              ${deuda > 0 ? `<div class="insc-deuda">Debe: $${deuda}</div>` : '<div style="font-size:10px;font-weight:800;color:var(--acc)">✅ Pagado</div>'}
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-weight:600;margin-bottom:4px">
            <span>Progreso</span><span>${pct}% de $${total}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
            <button class="btn btn-g btn-sm" onclick="openAbonoModal('${inscripcion._key}')">+ Abonar</button>
            <button class="btn btn-out btn-sm" onclick="editInscEquipo('${inscripcion._key}')">✏️</button>
            <button class="btn btn-r btn-sm" onclick="deleteInsc('${inscripcion._key}')">🗑️</button>
          </div>
          ${abonos.length ? `<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Historial de abonos</div>${abonosHtml}` : '<div style="font-size:11px;color:var(--muted)">Sin abonos</div>'}
        </div>`;
      });
    });
  });
  el.innerHTML = html;
}

function renderInscStats() {
  const inscripciones = getInsc();
  const totalMonto = inscripciones.reduce((sum, inscripcion) => sum + (inscripcion.montoTotal || 0), 0);
  const totalPagado = inscripciones.reduce((sum, inscripcion) => {
    const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
    return sum + abonos.reduce((acc, abono) => acc + abono.monto, 0);
  }, 0);
  const pendiente = totalMonto - totalPagado;
  const el = document.getElementById('inscStats');
  if (el) {
    el.innerHTML = `
    <div class="stat-box sb-emerald"><div class="sn" style="color:var(--emerald)">$${totalPagado}</div><div class="sl2">Recaudado</div></div>
    <div class="stat-box sb-red"><div class="sn" style="color:var(--red)">$${pendiente}</div><div class="sl2">Pendiente</div></div>
    <div class="stat-box sb-purple"><div class="sn" style="color:var(--purple)">${inscripciones.length}</div><div class="sl2">Equipos</div></div>`;
  }
}

function saveInscEquipo() {
  const nombre = document.getElementById('ie_nombre').value.trim();
  if (!nombre) {
    showToast('Ingresa el nombre', 'ta');
    return;
  }
  const key = document.getElementById('ie_key').value;
  const data = {
    nombre,
    torneo: document.getElementById('ie_torneo').value,
    cat: document.getElementById('ie_cat').value,
    montoTotal: parseInt(document.getElementById('ie_monto').value, 10) || 0,
    logo: document.getElementById('ie_logo').value || null,
    updatedAt: Date.now()
  };
  if (key) db.ref(`inscripciones/${key}`).update(data);
  else db.ref('inscripciones').push({ ...data, abonos: {}, creadoAt: Date.now() });
  closeModal('modalInscEquipo');
  resetInscForm();
  showToast(key ? 'Actualizado' : 'Equipo inscrito', 'tg');
}

function resetInscForm() {
  document.getElementById('ie_key').value = '';
  document.getElementById('ieModalTitle').textContent = 'Nuevo Equipo — Inscripción';
  ['ie_nombre', 'ie_monto', 'ie_logo'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('ie_torneo').value = 'villa';
  document.getElementById('ie_cat').value = 'liga_alta';
  document.getElementById('ie_logo_prev').style.display = 'none';
  document.getElementById('ie_logo_lbl').style.display = 'block';
}

function editInscEquipo(key) {
  const inscripcion = C.inscripciones[key];
  if (!inscripcion) return;
  document.getElementById('ie_key').value = key;
  document.getElementById('ieModalTitle').textContent = 'Editar Equipo';
  document.getElementById('ie_nombre').value = inscripcion.nombre || '';
  document.getElementById('ie_torneo').value = inscripcion.torneo || 'villa';
  document.getElementById('ie_cat').value = inscripcion.cat || 'liga_alta';
  document.getElementById('ie_monto').value = inscripcion.montoTotal || 0;
  document.getElementById('ie_logo').value = inscripcion.logo || '';
  if (inscripcion.logo) {
    const preview = document.getElementById('ie_logo_prev');
    preview.src = inscripcion.logo;
    preview.style.display = 'block';
    document.getElementById('ie_logo_lbl').style.display = 'none';
  }
  openModal('modalInscEquipo');
}

function deleteInsc(key) {
  if (!confirm('¿Eliminar esta inscripción?')) return;
  db.ref(`inscripciones/${key}`).remove();
  showToast('Inscripción eliminada', 'tr');
}

function openAbonoModal(key) {
  document.getElementById('ab_insc_key').value = key;
  document.getElementById('ab_monto').value = '';
  document.getElementById('ab_fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('ab_notas').value = '';
  document.getElementById('ab_metodo').value = 'efectivo';
  openModal('modalAbono');
}

function saveAbono() {
  const key = document.getElementById('ab_insc_key').value;
  const monto = parseInt(document.getElementById('ab_monto').value, 10) || 0;
  if (!monto) {
    showToast('Ingresa el monto', 'ta');
    return;
  }
  db.ref(`inscripciones/${key}/abonos`).push({
    monto,
    fecha: document.getElementById('ab_fecha').value,
    metodo: document.getElementById('ab_metodo').value,
    notas: document.getElementById('ab_notas').value.trim(),
    ts: Date.now()
  });
  closeModal('modalAbono');
  showToast('Abono registrado', 'tg');
}
