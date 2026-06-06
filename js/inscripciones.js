let inscScope = 'actual';
let inscSelectedCats = [];

function getInscAvailableCats() {
  return (catOrderKeys || []).filter((key) => CAT_NAMES[key] && canAccessCat(key));
}

function getInscSelectedCats() {
  const available = getInscAvailableCats();
  if (inscScope === 'actual') return [currentCat].filter((key) => available.includes(key));
  if (inscScope === 'torneo') return [...available];
  const selected = inscSelectedCats.filter((key) => available.includes(key));
  return selected.length ? selected : [currentCat].filter((key) => available.includes(key));
}

function setInscScope(scope) {
  inscScope = scope;
  if (scope === 'actual') inscSelectedCats = [currentCat];
  if (scope === 'torneo') inscSelectedCats = [];
  if (scope === 'custom' && !inscSelectedCats.length) inscSelectedCats = [currentCat];
  renderInscripciones();
}

function toggleInscCat(catKey, checked) {
  if (checked && !inscSelectedCats.includes(catKey)) inscSelectedCats.push(catKey);
  if (!checked) inscSelectedCats = inscSelectedCats.filter((key) => key !== catKey);
  if (!inscSelectedCats.length) inscSelectedCats = [catKey];
  renderInscripciones();
}

function getFilteredInsc() {
  const selectedCats = getInscSelectedCats();
  return getInsc().filter((inscripcion) => {
    const torneo = inscripcion.torneo || 'villa';
    const cat = inscripcion.cat || 'liga_alta';
    return torneo === currentTorneo && selectedCats.includes(cat) && canAccessTorneo(torneo) && canAccessCat(cat, torneo);
  });
}

function getInscPaymentStats(inscripciones) {
  const totalMonto = inscripciones.reduce((sum, inscripcion) => sum + (Number(inscripcion.montoTotal || inscripcion.monto || 0)), 0);
  const totalPagado = inscripciones.reduce((sum, inscripcion) => {
    const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
    return sum + abonos.reduce((acc, abono) => acc + (Number(abono.monto) || 0), 0);
  }, 0);
  const pendiente = Math.max(0, totalMonto - totalPagado);
  return { totalMonto, totalPagado, pendiente, pct: totalMonto > 0 ? Math.round((totalPagado / totalMonto) * 100) : 0 };
}

function renderInscScopeControls() {
  const el = document.getElementById('inscScopeControls');
  if (!el) return;
  const selected = getInscSelectedCats();
  el.innerHTML = `
    <div class="insc-filter-card">
      <div class="insc-filter-head">
        <div>
          <div class="insc-filter-title">Vista de inscripciones</div>
          <div class="insc-filter-sub">${TORNEO_NAMES[currentTorneo] || ''}</div>
        </div>
        <div class="insc-filter-pills">
          <button class="btn ${inscScope === 'actual' ? 'btn-g' : 'btn-out'} btn-sm" onclick="setInscScope('actual')">Actual</button>
          <button class="btn ${inscScope === 'torneo' ? 'btn-g' : 'btn-out'} btn-sm" onclick="setInscScope('torneo')">Todas</button>
          <button class="btn ${inscScope === 'custom' ? 'btn-g' : 'btn-out'} btn-sm" onclick="setInscScope('custom')">Seleccionar</button>
        </div>
      </div>
      ${inscScope === 'custom' ? `<div class="resumen-cat-checks" style="margin-top:10px">
        ${getInscAvailableCats().map((key) => `
          <label class="resumen-cat-check">
            <input type="checkbox" ${selected.includes(key) ? 'checked' : ''} onchange="toggleInscCat('${key}',this.checked)"/>
            <span>${CAT_NAMES[key]}</span>
          </label>`).join('')}
      </div>` : ''}
    </div>`;
}

function renderInscripciones() {
  const el = document.getElementById('inscList');
  if (!el) return;
  renderInscScopeControls();
  const inscripciones = getFilteredInsc();
  renderInscStats(inscripciones);
  if (!inscripciones.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">💰</span>Sin equipos registrados en esta vista</div>';
    return;
  }

  const groups = {};
  inscripciones.forEach((inscripcion) => {
    const catKey = inscripcion.cat || 'liga_alta';
    if (!groups[catKey]) groups[catKey] = [];
    groups[catKey].push(inscripcion);
  });

  el.innerHTML = Object.keys(groups).map((catKey) => {
    const catInscs = groups[catKey];
    const stats = getInscPaymentStats(catInscs);
    return `<div class="insc-cat-section">
      <div class="insc-cat-head">
        <div><span>Categoría</span><strong>${CAT_NAMES[catKey] || catKey}</strong></div>
        <div><b>$${stats.totalPagado}</b><small>de $${stats.totalMonto}</small></div>
      </div>
      ${catInscs.map(renderInscCard).join('')}
    </div>`;
  }).join('');
}

function renderInscCard(inscripcion) {
  const total = Number(inscripcion.montoTotal || inscripcion.monto || 0);
  const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
  const pagado = abonos.reduce((sum, abono) => sum + (Number(abono.monto) || 0), 0);
  const deuda = Math.max(0, total - pagado);
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

  return `<div class="insc-card">
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
}

function renderInscStats(inscripciones = getFilteredInsc()) {
  const stats = getInscPaymentStats(inscripciones);
  const el = document.getElementById('inscStats');
  if (el) {
    el.innerHTML = `
    <div class="insc-donut-stat">
      <div class="resumen-donut" style="--paid:${stats.pct};--pending:${100 - stats.pct}">
        <div><strong>${stats.pct}%</strong><span>Cobrado</span></div>
      </div>
      <div class="insc-donut-copy">
        <div class="insc-filter-title">Total por cobrar</div>
        <div class="insc-total-amount">$${stats.totalMonto}</div>
        <div class="money-row"><span class="money-lbl">Cobrado</span><span class="money-val" style="color:var(--emerald)">$${stats.totalPagado}</span></div>
        <div class="money-row"><span class="money-lbl">Pendiente</span><span class="money-val" style="color:var(--amber)">$${stats.pendiente}</span></div>
      </div>
    </div>
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
  const torneo = document.getElementById('ie_torneo').value;
  const cat = document.getElementById('ie_cat').value;
  if (!canAccessTorneo(torneo) || !canAccessCat(cat, torneo)) {
    showToast('No tienes permiso para esa categoría', 'tr');
    return;
  }
  const data = {
    nombre,
    torneo,
    cat,
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
  document.getElementById('ie_torneo').value = currentTorneo;
  document.getElementById('ie_cat').value = currentCat;
  document.getElementById('ie_logo_prev').style.display = 'none';
  document.getElementById('ie_logo_lbl').style.display = 'block';
}

function editInscEquipo(key) {
  const inscripcion = C.inscripciones[key];
  if (!inscripcion || !canAccessTorneo(inscripcion.torneo || 'villa') || !canAccessCat(inscripcion.cat || 'liga_alta', inscripcion.torneo || 'villa')) return;
  document.getElementById('ie_key').value = key;
  document.getElementById('ieModalTitle').textContent = 'Editar Equipo';
  document.getElementById('ie_nombre').value = inscripcion.nombre || '';
  document.getElementById('ie_torneo').value = inscripcion.torneo || currentTorneo;
  document.getElementById('ie_cat').value = inscripcion.cat || currentCat;
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
  const inscripcion = C.inscripciones[key];
  if (!inscripcion || !canAccessTorneo(inscripcion.torneo || 'villa') || !canAccessCat(inscripcion.cat || 'liga_alta', inscripcion.torneo || 'villa')) {
    showToast('No tienes permiso para eliminar esta inscripción', 'tr');
    return;
  }
  if (!confirm('¿Eliminar esta inscripción?')) return;
  db.ref(`inscripciones/${key}`).remove();
  showToast('Inscripción eliminada', 'tr');
}

function openAbonoModal(key) {
  const inscripcion = C.inscripciones[key];
  if (!inscripcion || !canAccessTorneo(inscripcion.torneo || 'villa') || !canAccessCat(inscripcion.cat || 'liga_alta', inscripcion.torneo || 'villa')) {
    showToast('No tienes permiso para esta inscripción', 'tr');
    return;
  }
  document.getElementById('ab_insc_key').value = key;
  document.getElementById('ab_monto').value = '';
  document.getElementById('ab_fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('ab_notas').value = '';
  document.getElementById('ab_metodo').value = 'efectivo';
  openModal('modalAbono');
}

function saveAbono() {
  const key = document.getElementById('ab_insc_key').value;
  const inscripcion = C.inscripciones[key];
  if (!inscripcion || !canAccessTorneo(inscripcion.torneo || 'villa') || !canAccessCat(inscripcion.cat || 'liga_alta', inscripcion.torneo || 'villa')) {
    showToast('No tienes permiso para esta inscripción', 'tr');
    return;
  }
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
