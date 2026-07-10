const controlCenterState = {
  period: 'month',
  scope: 'selected',
  search: ''
};

const controlCenterCharts = { cashflow: null, debt: null };

function controlCenterDateMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(String(value).length === 10 ? `${value}T12:00:00` : value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getControlCenterPeriod() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (controlCenterState.period === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (controlCenterState.period === 'month') {
    start.setDate(1);
  } else if (controlCenterState.period === 'all') {
    start.setTime(0);
  }

  const labels = { today: 'Hoy', week: 'Esta semana', month: 'Este mes', all: 'Todo el torneo' };
  return { from: start.getTime(), to: end.getTime(), label: labels[controlCenterState.period] || 'Este mes' };
}

function getControlCenterCats() {
  const available = getTournamentCatKeys(currentTorneo).filter((cat) => CAT_NAMES[cat]);
  if (controlCenterState.scope === 'all') return available;
  return available.includes(currentCat) ? [currentCat] : available.slice(0, 1);
}

function controlCenterRecordDate(record = {}) {
  return controlCenterDateMs(
    record.fechaTexto || record.fecha || record.createdAt || record.creadoEn ||
    record.actualizadoEn || record.ts || record.updatedAt || record.creadoAt
  );
}

function controlCenterInPeriod(record, period) {
  if (controlCenterState.period === 'all') return true;
  const ts = controlCenterRecordDate(record);
  return ts >= period.from && ts <= period.to;
}

function controlCenterScopedEntries(collection, cats, usePeriod = false) {
  const period = getControlCenterPeriod();
  return Object.entries(C[collection] || {})
    .map(([key, value]) => normalizeScopedRecord({ ...value, _key: key }))
    .filter((record) => record.torneo === currentTorneo && cats.includes(record.cat))
    .filter((record) => !usePeriod || controlCenterInPeriod(record, period));
}

function getControlCenterData() {
  const cats = getControlCenterCats();
  const period = getControlCenterPeriod();
  const equipos = controlCenterScopedEntries('equipos', cats);
  const partidos = controlCenterScopedEntries('partidos', cats);
  const inscripciones = controlCenterScopedEntries('inscripciones', cats);
  const pagos = controlCenterScopedEntries('pagos', cats, true).filter((pago) => !pago.cancelado);
  const solicitudes = controlCenterScopedEntries('solicitudes', cats);
  const periodPartidos = partidos.filter((partido) => controlCenterInPeriod(partido, period));
  const inscripcionesMetrics = getInscripcionMetrics(inscripciones, {
    from: new Date(period.from).toISOString().slice(0, 10),
    to: new Date(period.to).toISOString().slice(0, 10),
    tsFrom: period.from,
    tsTo: period.to
  });
  const arbitrajeMetrics = getArbitrajeMetrics(periodPartidos, pagos);
  return { cats, period, equipos, partidos, periodPartidos, inscripciones, pagos, solicitudes, inscripcionesMetrics, arbitrajeMetrics };
}

function getControlCenterAlerts(data) {
  const alerts = [];
  const now = Date.now();
  const soon = now + (72 * 60 * 60 * 1000);

  data.inscripciones.forEach((inscripcion) => {
    const total = Number(inscripcion.montoTotal || inscripcion.monto || 0);
    const paid = getInscripcionPaid(inscripcion);
    const pending = Math.max(total - paid, 0);
    if (pending > 0) alerts.push({
      severity: pending >= total && total > 0 ? 'danger' : 'warning',
      type: 'Inscripcion',
      title: inscripcion.equipoNombre || inscripcion.nombre || 'Equipo',
      detail: `Saldo pendiente de ${formatMoney(pending)}`,
      page: 'inscripciones'
    });
  });

  data.partidos.forEach((partido) => {
    const partidoTs = controlCenterDateMs(partido.fecha || partido.date);
    ['local', 'visitante'].forEach((role) => {
      const pending = getMontoPendienteArbitraje(partido, role);
      if (pending <= 0) return;
      alerts.push({
        severity: partidoTs && partidoTs < now ? 'danger' : 'warning',
        type: 'Arbitraje',
        title: getEquipoNombreFromPartido(partido, role),
        detail: `${getPartidoDisplayName(partido)} · pendiente ${formatMoney(pending)}`,
        page: 'admin-arbitrajes'
      });
    });
    if (partidoTs >= now && partidoTs <= soon && !partido.arbitro && !partido.arbitroNombre) {
      alerts.push({
        severity: 'info',
        type: 'Operacion',
        title: 'Partido sin arbitro asignado',
        detail: `${getPartidoDisplayName(partido)} · ${fmtDate(partido.fecha) || partido.fecha || 'proximo'}`,
        page: 'partidos'
      });
    }
  });

  data.equipos.forEach((equipo) => {
    const missing = [];
    if (!equipo.logo) missing.push('logo');
    if (!equipo.capitan) missing.push('capitan');
    if (!(equipo.tel || equipo.telefonoCapitan)) missing.push('contacto');
    if (missing.length) alerts.push({
      severity: 'info',
      type: 'Datos',
      title: equipo.nombre || 'Equipo incompleto',
      detail: `Falta completar: ${missing.join(', ')}`,
      page: 'equipos'
    });
  });

  const pendingRequests = data.solicitudes.filter((request) => !request.status || request.status === 'pending');
  if (pendingRequests.length) alerts.push({
    severity: 'info',
    type: 'Usuarios',
    title: `${pendingRequests.length} solicitud${pendingRequests.length === 1 ? '' : 'es'} pendiente${pendingRequests.length === 1 ? '' : 's'}`,
    detail: 'Revisa las solicitudes de jugadores y equipos.',
    page: 'equipos'
  });

  data.cats.forEach((cat) => {
    if (!getActiveSeason(currentTorneo, cat)) alerts.push({
      severity: 'warning',
      type: 'Temporada',
      title: CAT_NAMES[cat] || cat,
      detail: 'No tiene una temporada activa configurada.',
      page: 'historial'
    });
  });

  const rank = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function setControlCenterPeriod(period, button) {
  controlCenterState.period = period;
  document.querySelectorAll('[data-ops-period]').forEach((item) => item.classList.remove('is-active'));
  if (button) button.classList.add('is-active');
  renderControlCenter({ keepAuditCache: true });
}

function setControlCenterScope(scope, button) {
  controlCenterState.scope = scope;
  document.querySelectorAll('[data-ops-scope]').forEach((item) => item.classList.remove('is-active'));
  if (button) button.classList.add('is-active');
  renderControlCenter({ keepAuditCache: true });
}

function setControlCenterSearch(value) {
  controlCenterState.search = String(value || '').trim().toLowerCase();
  renderControlCenterAlerts(getControlCenterData());
}

function navigateControlAction(page) {
  const nav = Array.from(document.querySelectorAll('.nav-tab')).find((button) => (
    button.getAttribute('onclick') === `showPage('${page}',this)`
  ));
  showPage(page, nav || null);
}

function controlCenterKpi(label, value, meta, tone = 'primary') {
  return `<article class="ops-kpi ops-tone-${tone}">
    <span>${escapeHtml(label)}</span>
    <strong>${value}</strong>
    <small>${escapeHtml(meta)}</small>
  </article>`;
}

function renderControlCenterKpis(data, alerts) {
  const target = document.getElementById('opsKpis');
  if (!target) return;
  const insc = data.inscripcionesMetrics;
  const arb = data.arbitrajeMetrics;
  const critical = alerts.filter((alert) => alert.severity === 'danger').length;
  const totalExpected = insc.totalMonto + data.periodPartidos.length * DEFAULT_ARBITRAJE_MONTO_EQUIPO * 2;
  const totalCollected = insc.pagadoTotal + arb.total;
  target.innerHTML = [
    controlCenterKpi('Cobranza total', formatMoney(totalCollected), `${pct(totalCollected, totalExpected)}% de ${formatMoney(totalExpected)}`, 'success'),
    controlCenterKpi('Por recuperar', formatMoney(insc.pendienteMonto + arb.pendientes), 'Inscripciones y arbitrajes', 'warning'),
    controlCenterKpi('Equipos activos', String(data.equipos.length), `${data.cats.length} categoria${data.cats.length === 1 ? '' : 's'}`, 'primary'),
    controlCenterKpi('Atencion inmediata', String(critical), `${alerts.length} alertas operativas`, critical ? 'danger' : 'success')
  ].join('');
}

function renderControlCenterAlerts(data) {
  const target = document.getElementById('opsAlerts');
  if (!target) return;
  const query = controlCenterState.search;
  const alerts = getControlCenterAlerts(data).filter((alert) => (
    !query || `${alert.type} ${alert.title} ${alert.detail}`.toLowerCase().includes(query)
  ));
  const count = document.getElementById('opsAlertCount');
  if (count) count.textContent = String(alerts.length);
  refreshOperationsBadge(alerts);
  if (!alerts.length) {
    target.innerHTML = '<div class="ops-empty-state"><span>✓</span><strong>Operacion al dia</strong><small>No hay pendientes para este filtro.</small></div>';
    return;
  }
  target.innerHTML = alerts.slice(0, 30).map((alert) => `
    <button class="ops-alert ops-alert-${alert.severity}" onclick="navigateControlAction('${alert.page}')">
      <span class="ops-alert-dot"></span>
      <span class="ops-alert-copy"><small>${escapeHtml(alert.type)}</small><strong>${escapeHtml(alert.title)}</strong><em>${escapeHtml(alert.detail)}</em></span>
      <span class="ops-alert-arrow">›</span>
    </button>`).join('');
}

function refreshOperationsBadge(alertsArg) {
  if (!(isAdmin || isOwner)) return;
  let alerts = alertsArg;
  if (!alerts) {
    try { alerts = getControlCenterAlerts(getControlCenterData()); } catch (_err) { alerts = []; }
  }
  const actionable = alerts.filter((alert) => alert.severity !== 'info').length;
  const badge = document.getElementById('opsNavBadge');
  if (badge) {
    badge.textContent = actionable > 99 ? '99+' : String(actionable);
    badge.style.display = actionable ? '' : 'none';
  }
}

function renderControlCenterHealth(data) {
  const target = document.getElementById('opsHealth');
  if (!target) return;
  const checks = [
    { label: 'Equipos con logo', ok: data.equipos.filter((team) => team.logo).length, total: data.equipos.length },
    { label: 'Equipos con capitan', ok: data.equipos.filter((team) => team.capitan).length, total: data.equipos.length },
    { label: 'Inscripciones vinculadas', ok: data.inscripciones.filter((item) => item.equipoId || item.equipoKey).length, total: data.inscripciones.length },
    { label: 'Partidos con fecha', ok: data.partidos.filter((partido) => partido.fecha || partido.date).length, total: data.partidos.length }
  ];
  target.innerHTML = checks.map((check) => {
    const percentage = check.total ? pct(check.ok, check.total) : 100;
    return `<div class="ops-health-row"><div><strong>${escapeHtml(check.label)}</strong><small>${check.ok} de ${check.total}</small></div><div class="ops-progress"><i style="width:${percentage}%"></i></div><b>${percentage}%</b></div>`;
  }).join('');
}

function renderControlCenterScope(data) {
  const target = document.getElementById('opsCategoryGrid');
  if (!target) return;
  target.innerHTML = data.cats.map((cat) => {
    const teams = data.equipos.filter((team) => team.cat === cat).length;
    const games = data.partidos.filter((game) => game.cat === cat).length;
    const debt = data.inscripciones.filter((item) => item.cat === cat).reduce((sum, item) => {
      return sum + Math.max(Number(item.montoTotal || item.monto || 0) - getInscripcionPaid(item), 0);
    }, 0);
    const season = getActiveSeason(currentTorneo, cat);
    return `<article class="ops-category-card"><span>${escapeHtml(CAT_NAMES[cat] || cat)}<em class="ops-season-state ${season ? 'is-active' : ''}">${season ? 'Temporada activa' : 'Sin temporada'}</em></span><div><strong>${teams}</strong><small>equipos</small></div><div><strong>${games}</strong><small>partidos</small></div><div><strong>${formatMoney(debt)}</strong><small>pendiente</small></div></article>`;
  }).join('');
}

function renderControlCenterOwner() {
  const panel = document.getElementById('opsOwnerPanel');
  const target = document.getElementById('opsOwnerGrid');
  if (!panel || !target) return;
  panel.hidden = !isOwner;
  if (!isOwner) return;
  const users = Object.values(C.usuarios || {});
  const counts = users.reduce((result, user) => {
    const role = OWNER_EMAILS.includes(String(user.email || '').toLowerCase()) ? 'owner' : (user.role || 'viewer');
    result[role] = (result[role] || 0) + 1;
    return result;
  }, {});
  const cards = [
    ['Propietarios', counts.owner || 0, 'Control total'],
    ['Administradores', counts.admin || 0, 'Gestion por alcance'],
    ['Capitanes', counts.captain || 0, 'Gestion de equipo'],
    ['Usuarios', counts.viewer || 0, 'Acceso publico']
  ];
  target.innerHTML = cards.map(([label, value, detail]) => `<article><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(detail)}</small></article>`).join('');
}

function opsCssVar(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value;
}

function destroyControlCenterCharts() {
  Object.keys(controlCenterCharts).forEach((key) => {
    if (controlCenterCharts[key]) controlCenterCharts[key].destroy();
    controlCenterCharts[key] = null;
  });
}

function renderControlCenterCharts(data) {
  if (typeof Chart === 'undefined') return;
  destroyControlCenterCharts();
  const cashCanvas = document.getElementById('opsCashflowChart');
  const debtCanvas = document.getElementById('opsDebtChart');
  if (!cashCanvas || !debtCanvas) return;

  const dayMap = {};
  data.pagos.forEach((payment) => {
    const date = getPaymentDate(payment) || new Date(controlCenterRecordDate(payment) || Date.now()).toISOString().slice(0, 10);
    if (!dayMap[date]) dayMap[date] = { inscripcion: 0, arbitraje: 0 };
    const type = String(payment.tipo || payment.concepto || '').toLowerCase().includes('arbit') ? 'arbitraje' : 'inscripcion';
    dayMap[date][type] += Number(payment.monto || 0);
  });
  const labels = Object.keys(dayMap).sort().slice(-14);
  if (!labels.length) labels.push(new Date().toISOString().slice(0, 10));
  const textColor = opsCssVar('--text2');
  const gridColor = opsCssVar('--border');
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: textColor, font: { family: 'Montserrat', weight: 700 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Montserrat', size: 10 } } },
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: (value) => `$${Number(value).toLocaleString('es-MX')}` } }
    }
  };
  controlCenterCharts.cashflow = new Chart(cashCanvas, {
    type: 'bar',
    data: {
      labels: labels.map((date) => date.slice(5)),
      datasets: [
        { label: 'Inscripciones', data: labels.map((date) => dayMap[date]?.inscripcion || 0), backgroundColor: opsCssVar('--color-primary'), borderRadius: 6 },
        { label: 'Arbitrajes', data: labels.map((date) => dayMap[date]?.arbitraje || 0), backgroundColor: opsCssVar('--color-info'), borderRadius: 6 }
      ]
    },
    options: commonOptions
  });

  const pending = data.inscripcionesMetrics.pendienteMonto + data.arbitrajeMetrics.pendientes;
  const paid = data.inscripcionesMetrics.pagadoTotal + data.arbitrajeMetrics.total;
  controlCenterCharts.debt = new Chart(debtCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Cobrado', 'Pendiente'],
      datasets: [{ data: [paid, pending], backgroundColor: [opsCssVar('--color-success'), opsCssVar('--color-warning')], borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Montserrat', weight: 700 } } } }
    }
  });
}

function renderControlCenterAudit() {
  const target = document.getElementById('opsAudit');
  if (!target) return;
  const cats = getControlCenterCats();
  const entries = Object.values(C.auditLogs || {})
    .filter((entry) => entry.torneo === currentTorneo && cats.includes(entry.cat))
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    .slice(0, 24);
  if (!entries.length) {
    target.innerHTML = '<div class="ops-empty-state compact"><strong>Sin actividad registrada todavia</strong><small>Las nuevas altas, cambios y eliminaciones apareceran aqui.</small></div>';
    return;
  }
  target.innerHTML = entries.map((entry) => {
    const date = entry.createdAtMs ? new Date(entry.createdAtMs).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ahora';
    return `<div class="ops-audit-row"><span class="ops-audit-action ops-audit-${entry.action}">${escapeHtml(auditActionLabel(entry.action))}</span><div><strong>${escapeHtml(entry.entityLabel || entry.collection)}</strong><small>${escapeHtml(entry.entityName || entry.entityId)}</small></div><div class="ops-audit-actor"><strong>${escapeHtml(entry.actorName || entry.actorEmail || 'Usuario')}</strong><small>${date}</small></div></div>`;
  }).join('');
}

function exportControlCenterCsv() {
  const data = getControlCenterData();
  const alerts = getControlCenterAlerts(data);
  const rows = [
    ['CanchaDigital', TORNEO_NAMES[currentTorneo], data.period.label],
    ['Indicador', 'Valor', 'Detalle'],
    ['Equipos', data.equipos.length, data.cats.map((cat) => CAT_NAMES[cat]).join(' | ')],
    ['Inscripciones cobradas', data.inscripcionesMetrics.pagadoTotal, 'MXN'],
    ['Inscripciones pendientes', data.inscripcionesMetrics.pendienteMonto, 'MXN'],
    ['Arbitrajes cobrados', data.arbitrajeMetrics.total, 'MXN'],
    ['Arbitrajes pendientes', data.arbitrajeMetrics.pendientes, 'MXN'],
    [],
    ['Alertas', 'Elemento', 'Detalle'],
    ...alerts.map((alert) => [alert.type, alert.title, alert.detail])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `canchadigital_${currentTorneo}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function renderControlCenter(options = {}) {
  if (!(isAdmin || isOwner)) return;
  const data = getControlCenterData();
  const alerts = getControlCenterAlerts(data);
  const title = document.getElementById('opsTournamentTitle');
  const subtitle = document.getElementById('opsScopeLabel');
  const logo = document.getElementById('opsTournamentLogo');
  if (title) title.textContent = TORNEO_NAMES[currentTorneo] || 'CanchaDigital';
  if (subtitle) subtitle.textContent = `${data.period.label} · ${data.cats.map((cat) => CAT_NAMES[cat]).join(' + ')}`;
  if (logo) logo.src = TORNEO_LOGOS[currentTorneo] || '';
  renderControlCenterKpis(data, alerts);
  renderControlCenterAlerts(data);
  renderControlCenterHealth(data);
  renderControlCenterScope(data);
  renderControlCenterOwner();
  renderControlCenterCharts(data);
  renderControlCenterAudit();

  if (!options.keepAuditCache) {
    loadAuditLogs().then(() => renderControlCenterAudit()).catch(() => {});
  }
}
