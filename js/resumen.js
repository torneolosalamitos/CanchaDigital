let resumenPeriodo = 'dia';
let resumenScope = 'torneo';
let resumenSelectedCats = [];

const RES_GENERAL_CAT = '__general__';

function setResumenPeriodo(periodo, btn) {
  resumenPeriodo = periodo;
  document.querySelectorAll('[id^=resPer_]').forEach((b) => { b.className = 'btn btn-out btn-sm'; });
  if (btn) btn.className = 'btn btn-g btn-sm';

  const titles = {
    dia: '📋 Resumen del Día',
    semana: '📆 Resumen Semanal',
    mes: '🗓️ Resumen Mensual',
    anual: '📊 Resumen Anual',
    general: '🌐 Resumen General',
    custom: '📆 Rango Personalizado'
  };
  const title = document.getElementById('resumenPeriodoTitle');
  if (title) title.textContent = titles[periodo] || '📋 Resumen';

  const panel = document.getElementById('customRangePanel');
  if (panel) panel.style.display = periodo === 'custom' ? 'block' : 'none';
  if (periodo === 'custom') seedResumenCustomRange();
  renderResumen();
}

function setResumenScope(scope) {
  resumenScope = scope;
  document.querySelectorAll('[id^=resScope_]').forEach((b) => { b.className = 'btn btn-out btn-sm'; });
  const active = document.getElementById('resScope_' + scope);
  if (active) active.className = 'btn btn-g btn-sm';

  if (scope === 'actual') resumenSelectedCats = [currentCat];
  if (scope === 'torneo') resumenSelectedCats = [];
  if (scope === 'custom' && !resumenSelectedCats.length) resumenSelectedCats = [currentCat];
  renderResumen();
}

function toggleResumenCat(catKey, checked) {
  if (checked && !resumenSelectedCats.includes(catKey)) resumenSelectedCats.push(catKey);
  if (!checked) resumenSelectedCats = resumenSelectedCats.filter((key) => key !== catKey);
  if (!resumenSelectedCats.length) resumenSelectedCats = [catKey];
  renderResumen();
}

function seedResumenCustomRange() {
  const desde = document.getElementById('res_desde_fecha');
  const hasta = document.getElementById('res_hasta_fecha');
  if (desde && !desde.value) {
    const nd = new Date();
    nd.setDate(nd.getDate() - 7);
    desde.value = nd.toISOString().split('T')[0];
  }
  if (hasta && !hasta.value) hasta.value = new Date().toISOString().split('T')[0];
}

function getResumenPeriodInfo() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (resumenPeriodo === 'dia') return { from: today, to: today, tsFrom: new Date(today + 'T00:00:00').getTime(), tsTo: new Date(today + 'T23:59:59').getTime(), label: 'Hoy' };
  if (resumenPeriodo === 'semana') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const from = d.toISOString().split('T')[0];
    return { from, to: today, tsFrom: new Date(from + 'T00:00:00').getTime(), tsTo: Date.now(), label: 'Semana' };
  }
  if (resumenPeriodo === 'mes') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const from = d.toISOString().split('T')[0];
    return { from, to: today, tsFrom: new Date(from + 'T00:00:00').getTime(), tsTo: Date.now(), label: 'Mes' };
  }
  if (resumenPeriodo === 'anual') {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const from = d.toISOString().split('T')[0];
    return { from, to: today, tsFrom: new Date(from + 'T00:00:00').getTime(), tsTo: Date.now(), label: 'Año' };
  }
  if (resumenPeriodo === 'custom') {
    seedResumenCustomRange();
    const from = document.getElementById('res_desde_fecha')?.value || '2000-01-01';
    const to = document.getElementById('res_hasta_fecha')?.value || today;
    const fromHour = document.getElementById('res_desde_hora')?.value || '00:00';
    const toHour = document.getElementById('res_hasta_hora')?.value || '23:59';
    return {
      from,
      to,
      tsFrom: new Date(from + 'T' + fromHour + ':00').getTime(),
      tsTo: new Date(to + 'T' + toHour + ':59').getTime(),
      label: `${from} → ${to}`
    };
  }
  return { from: '0000-01-01', to: '9999-12-31', tsFrom: 0, tsTo: Number.MAX_SAFE_INTEGER, label: 'General' };
}

function resumenDateInPeriod(date, period) {
  if (!date) return resumenPeriodo === 'general';
  return date >= period.from && date <= period.to;
}

function resumenTsInPeriod(item, period) {
  if (item.ts) return item.ts >= period.tsFrom && item.ts <= period.tsTo;
  return resumenDateInPeriod(item.fecha || item.date || '', period);
}

function resumenTournamentMatch(item) {
  if (!item || !item.torneo) return currentTorneo === 'lombardo_toledano';
  return appTorneoId(item.torneo || item.torneoId) === currentTorneo;
}

function resumenCatOf(item) {
  return item?.cat || RES_GENERAL_CAT;
}

function getResumenTournamentCats() {
  return getTournamentCatKeys(currentTorneo).filter((key) => CAT_NAMES[key] && canAccessCat(key, currentTorneo));
}

function getResumenSelectedCats() {
  const available = getResumenTournamentCats();
  if (resumenScope === 'actual') return [currentCat].filter((key) => available.includes(key));
  if (resumenScope === 'custom') {
    const selected = resumenSelectedCats.filter((key) => available.includes(key));
    return selected.length ? selected : [currentCat].filter((key) => available.includes(key));
  }
  return [...available];
}

function resumenCatMatch(item, selectedCats, includeGeneral = true) {
  const cat = resumenCatOf(item);
  if (cat === RES_GENERAL_CAT) return includeGeneral;
  return selectedCats.includes(cat);
}

function formatMoney(num) {
  const n = Math.round(Number(num) || 0);
  return '$' + n.toLocaleString('es-MX');
}

function pct(num, den) {
  if (!den) return 0;
  return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
}

function getAbonosArray(inscripcion) {
  const legacy = inscripcion?.abonos ? Object.values(inscripcion.abonos) : [];
  const inscKey = inscripcion?._key;
  const firestorePagos = Object.entries(C.pagos || {})
    .filter(([, pago]) => !pago.cancelado && inscKey && pago.inscripcionId === inscKey)
    .map(([key, pago]) => ({
      ...pago,
      _key: key,
      fecha: pago.fechaTexto || pago.fecha || '',
      notas: pago.nota || pago.notas || ''
    }));
  return [...legacy, ...firestorePagos];
}

function getInscripcionPaid(inscripcion) {
  if (inscripcion && inscripcion.montoPagado !== undefined && inscripcion.montoPagado !== null) {
    return Number(inscripcion.montoPagado || 0);
  }
  return getAbonosArray(inscripcion).reduce((acc, abono) => acc + (Number(abono.monto) || 0), 0);
}

function getInscripcionMetrics(inscripciones, period) {
  const totalMonto = inscripciones.reduce((sum, insc) => sum + (Number(insc.montoTotal || insc.monto || 0)), 0);
  const pagadoTotal = inscripciones.reduce((sum, insc) => sum + getInscripcionPaid(insc), 0);
  const pagadoPeriodo = inscripciones.reduce((sum, insc) => {
    return sum + getAbonosArray(insc)
      .filter((abono) => resumenDateInPeriod(abono.fecha || '', period))
      .reduce((acc, abono) => acc + (Number(abono.monto) || 0), 0);
  }, 0);
  const pendientes = inscripciones.filter((insc) => {
    const total = Number(insc.montoTotal || insc.monto || 0);
    const pagado = getInscripcionPaid(insc);
    return Math.max(0, total - pagado) > 0;
  });
  return {
    equipos: inscripciones.length,
    pagadas: Math.max(0, inscripciones.length - pendientes.length),
    pendientes: pendientes.length,
    totalMonto,
    pagadoTotal,
    pagadoPeriodo,
    pendienteMonto: Math.max(0, totalMonto - pagadoTotal),
    pctPagadas: pct(inscripciones.length - pendientes.length, inscripciones.length),
    pctCobranza: pct(pagadoTotal, totalMonto)
  };
}

function getArbitrajeMetrics(partidos) {
  const terminado = partidos.filter((p) => p.status === 'terminado');
  const totalEf = terminado.reduce((sum, p) => sum + (p.arbPago?.local?.ef || 0) + (p.arbPago?.visita?.ef || 0), 0);
  const totalTr = terminado.reduce((sum, p) => sum + (p.arbPago?.local?.tr || 0) + (p.arbPago?.visita?.tr || 0), 0);
  const totalPp = terminado.reduce((sum, p) => sum + (p.arbPago?.local?.pp || 0) + (p.arbPago?.visita?.pp || 0), 0);
  const pendientes = terminado.reduce((sum, p) => {
    const costo = p.costArb || 250;
    return sum + (p.arbPago?.local?.nd ? costo : 0) + (p.arbPago?.visita?.nd ? costo : 0);
  }, 0);
  return { partidos: terminado.length, totalEf, totalTr, totalPp, total: totalEf + totalTr + totalPp, pendientes };
}

function getVentasMetrics(ventas) {
  const total = ventas.reduce((sum, venta) => sum + (Number(venta.total) || 0), 0);
  const productos = {};
  ventas.forEach((venta) => (venta.items || []).forEach((item) => {
    const nombre = item.nombre || 'Producto';
    if (!productos[nombre]) productos[nombre] = { emoji: item.emoji || '📦', qty: 0, total: 0 };
    productos[nombre].qty += Number(item.qty) || 0;
    productos[nombre].total += (Number(item.precio) || 0) * (Number(item.qty) || 0);
  }));
  return {
    total,
    ventas: ventas.length,
    ticket: ventas.length ? Math.round(total / ventas.length) : 0,
    top: Object.entries(productos).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
  };
}

function getGastosMetrics(gastos) {
  const total = gastos.reduce((sum, gasto) => sum + (Number(gasto.monto) || 0), 0);
  const pendiente = gastos.filter((gasto) => gasto.metodo === 'pendiente').reduce((sum, gasto) => sum + (Number(gasto.monto) || 0), 0);
  return { total, pagado: total - pendiente, pendiente, registros: gastos.length };
}

function getResumenData() {
  const period = getResumenPeriodInfo();
  const selectedCats = getResumenSelectedCats();
  const allInsc = getInsc().filter((i) => resumenTournamentMatch(i) && resumenCatMatch(i, selectedCats, false));
  const allParts = getParts().filter((p) => resumenTournamentMatch(p) && resumenCatMatch(p, selectedCats, false) && resumenDateInPeriod(p.fecha || '', period));
  const allVentas = getVentas().filter((v) => resumenTournamentMatch(v) && resumenCatMatch(v, selectedCats, true) && resumenTsInPeriod(v, period));
  const allGastosTienda = (typeof getGastosTienda === 'function' ? getGastosTienda() : [])
    .filter((g) => resumenTournamentMatch(g) && resumenCatMatch(g, selectedCats, true) && resumenDateInPeriod(g.fecha || '', period));
  const allGastosTrab = (typeof getGastos === 'function' ? getGastos() : [])
    .filter((g) => resumenTournamentMatch(g) && resumenCatMatch(g, selectedCats, true) && resumenDateInPeriod(g.fecha || '', period));

  return {
    period,
    selectedCats,
    inscripciones: allInsc,
    partidos: allParts,
    ventas: allVentas,
    gastosTienda: allGastosTienda,
    gastosTrab: allGastosTrab
  };
}

function buildResumenScopeLabel(selectedCats) {
  if (resumenScope === 'actual') return CAT_NAMES[selectedCats[0]] || 'Categoría actual';
  if (resumenScope === 'custom') return selectedCats.map((key) => CAT_NAMES[key] || key).join(' + ');
  return 'Todas las categorías del torneo seleccionado';
}

function renderResumenFilters(selectedCats) {
  const wrap = document.getElementById('resumenCategoryFilters');
  if (!wrap) return;
  wrap.style.display = resumenScope === 'custom' ? 'block' : 'none';
  if (resumenScope !== 'custom') return;

  wrap.innerHTML = `
    <div class="resumen-filter-title">Selecciona una o varias categorías del torneo actual para verlas en el periodo elegido: ${getResumenPeriodInfo().label}</div>
    <div class="resumen-cat-checks">
      ${getResumenTournamentCats().map((key) => `
        <label class="resumen-cat-check">
          <input type="checkbox" ${selectedCats.includes(key) ? 'checked' : ''} onchange="toggleResumenCat('${key}',this.checked)"/>
          <span>${CAT_NAMES[key] || key}</span>
        </label>`).join('')}
    </div>`;
}

function setSectionVisible(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

function resumenNavEnabled(navId) {
  const el = document.getElementById(navId);
  return !el || el.style.display !== 'none';
}

function renderResumen() {
  const data = getResumenData();
  const { period, selectedCats } = data;
  const inscOn = resumenNavEnabled('navInsc');
  const capHumOn = resumenNavEnabled('navArb');
  const tiendaOn = !!tiendaEnabled;
  const inscData = inscOn ? data.inscripciones : [];
  const gastosTrabData = capHumOn ? data.gastosTrab : [];
  const insc = getInscripcionMetrics(inscData, period);
  const arb = getArbitrajeMetrics(data.partidos);
  const ventas = getVentasMetrics(data.ventas);
  const gastosTrab = getGastosMetrics(gastosTrabData);
  const gastosTienda = getGastosMetrics(data.gastosTienda);

  const ingresos = (tiendaOn ? ventas.total : 0) + arb.total + insc.pagadoPeriodo;
  const egresos = gastosTrab.total + (tiendaOn ? gastosTienda.total : 0);
  const neto = ingresos - egresos;

  const logo = document.getElementById('resumenTorneoLogo');
  if (logo) logo.src = TORNEO_LOGOS[currentTorneo] || '';
  const title = document.getElementById('resumenTorneoTitle');
  if (title) title.textContent = TORNEO_NAMES[currentTorneo] || 'Torneo';
  const scopeLabel = document.getElementById('resumenScopeLabel');
  if (scopeLabel) scopeLabel.textContent = `${buildResumenScopeLabel(selectedCats)} · ${period.label}`;

  renderResumenFilters(selectedCats);
  setSectionVisible('resumenInscSection', inscOn);
  setSectionVisible('resumenCapHumSection', capHumOn);
  setSectionVisible('resumenVentasSection', tiendaOn);

  const rg = document.getElementById('resumenGrid');
  if (rg) {
    rg.innerHTML = `
      <div class="res-card res-kpi-card"><div class="res-l">Equipos inscritos</div><div class="res-n">${insc.equipos}</div><div class="res-mini">Pagadas ${insc.pagadas} · Pendientes ${insc.pendientes}</div></div>
      <div class="res-card res-kpi-card"><div class="res-l">Ingresos</div><div class="res-n" style="color:var(--acc)">${formatMoney(ingresos)}</div><div class="res-mini">${period.label}</div></div>
      <div class="res-card res-kpi-card"><div class="res-l">Egresos</div><div class="res-n" style="color:var(--red)">${formatMoney(egresos)}</div><div class="res-mini">Gastos registrados</div></div>
      <div class="res-card res-kpi-card"><div class="res-l">Neto</div><div class="res-n" style="color:${neto >= 0 ? 'var(--emerald)' : 'var(--red)'}">${formatMoney(neto)}</div><div class="res-mini">Ingreso - egreso</div></div>`;
  }

  renderResumenDashboards({ insc, arb, ventas, gastosTrab, gastosTienda, tiendaOn, inscOn, capHumOn, ingresos, egresos, neto, period });
  renderResumenCategoryBreakdown({ ...data, inscripciones: inscData, gastosTrab: gastosTrabData }, period, tiendaOn, inscOn, capHumOn);
  if (inscOn) renderResumenInscripciones(insc, inscData, period);
  renderResDeudas(inscOn ? inscData : [], data.partidos);
  if (tiendaOn) renderResumenVentas(ventas, gastosTienda, period);
  renderResumenArbitrajes(arb, period);
  if (capHumOn) renderResumenCapitalHumano(gastosTrabData, gastosTrab, period);
  renderResumenInsights({ insc, arb, ventas, gastosTrab, gastosTienda, tiendaOn, ingresos, egresos, neto, period });
}

function renderResumenDashboards(ctx) {
  const el = document.getElementById('resumenDashboards');
  if (!el) return;
  const insc = ctx.insc;
  const salesCard = ctx.tiendaOn ? `
    <div class="resumen-panel">
      <div class="resumen-panel-title">Tienda</div>
      <div class="resumen-big-money">${formatMoney(ctx.ventas.total)}</div>
      <div class="resumen-meter"><span style="width:${pct(ctx.ventas.total, Math.max(ctx.ingresos, 1))}%"></span></div>
      <div class="resumen-split"><span>${ctx.ventas.ventas} ventas</span><strong>Ticket ${formatMoney(ctx.ventas.ticket)}</strong></div>
    </div>` : '';
  el.innerHTML = `
    ${ctx.inscOn ? `<div class="resumen-panel">
      <div class="resumen-panel-title">Cobranza</div>
      <div class="resumen-big-money">${formatMoney(insc.pagadoTotal)}</div>
      <div class="resumen-meter"><span style="width:${insc.pctCobranza}%"></span></div>
      <div class="resumen-split"><span>Pendiente</span><strong>${formatMoney(insc.pendienteMonto)}</strong></div>
    </div>` : ''}
    <div class="resumen-panel">
      <div class="resumen-panel-title">Arbitrajes</div>
      <div class="resumen-big-money">${formatMoney(ctx.arb.total)}</div>
      <div class="resumen-bar-list">
        ${resumenBar('Efectivo', ctx.arb.totalEf, ctx.arb.total)}
        ${resumenBar('Transferencia', ctx.arb.totalTr, ctx.arb.total)}
        ${resumenBar('Prepago', ctx.arb.totalPp, ctx.arb.total)}
      </div>
    </div>
    ${salesCard}
    ${ctx.capHumOn ? `<div class="resumen-panel">
      <div class="resumen-panel-title">Capital Humano</div>
      <div class="resumen-big-money" style="color:var(--red)">${formatMoney(ctx.gastosTrab.total)}</div>
      <div class="resumen-split"><span>Pagado</span><strong>${formatMoney(ctx.gastosTrab.pagado)}</strong></div>
      <div class="resumen-split"><span>Pendiente</span><strong>${formatMoney(ctx.gastosTrab.pendiente)}</strong></div>
    </div>` : ''}`;
}

function resumenBar(label, value, max) {
  return `<div class="resumen-bar-row"><span>${label}</span><div><i style="width:${pct(value, max)}%"></i></div><strong>${formatMoney(value)}</strong></div>`;
}

function renderResumenCategoryBreakdown(data, period, tiendaOn, inscOn = true, capHumOn = true) {
  const el = document.getElementById('resumenCategoryBreakdown');
  if (!el) return;

  const cats = [...data.selectedCats];
  const hasGeneral = [...data.ventas, ...data.gastosTienda, ...data.gastosTrab].some((item) => resumenCatOf(item) === RES_GENERAL_CAT);
  if (hasGeneral) cats.push(RES_GENERAL_CAT);

  el.innerHTML = cats.map((catKey) => {
    const match = (item) => resumenCatOf(item) === catKey;
    const catInsc = data.inscripciones.filter(match);
    const catParts = data.partidos.filter(match);
    const catVentas = data.ventas.filter(match);
    const catGastosTienda = data.gastosTienda.filter(match);
    const catGastosTrab = data.gastosTrab.filter(match);
    const insc = getInscripcionMetrics(catInsc, period);
    const arb = getArbitrajeMetrics(catParts);
    const ventas = getVentasMetrics(catVentas);
    const gastos = getGastosMetrics(catGastosTrab);
    const retiros = getGastosMetrics(catGastosTienda);
    const ingresos = insc.pagadoPeriodo + arb.total + (tiendaOn ? ventas.total : 0);
    const egresos = gastos.total + (tiendaOn ? retiros.total : 0);
    const title = catKey === RES_GENERAL_CAT ? 'General del torneo' : (CAT_NAMES[catKey] || catKey);
    return `<div class="resumen-cat-card">
      <div class="resumen-cat-head">
        <div><span>Categoría</span><strong>${title}</strong></div>
        <b style="color:${ingresos - egresos >= 0 ? 'var(--emerald)' : 'var(--red)'}">${formatMoney(ingresos - egresos)}</b>
      </div>
      <div class="resumen-cat-grid">
        ${inscOn ? `<div><span>Equipos</span><strong>${insc.equipos}</strong></div>
        <div><span>Inscripciones</span><strong>${formatMoney(insc.pagadoPeriodo)}</strong></div>` : ''}
        <div><span>Arbitrajes</span><strong>${formatMoney(arb.total)}</strong></div>
        ${tiendaOn ? `<div><span>Tienda</span><strong>${formatMoney(ventas.total)}</strong></div>` : ''}
        ${capHumOn ? `<div><span>Capital humano</span><strong>${formatMoney(gastos.total)}</strong></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderResumenInscripciones(metrics, inscripciones, period) {
  const el = document.getElementById('resInsc');
  if (!el) return;
  if (!inscripciones.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">💰</span>Sin inscripciones en este filtro</div>';
    return;
  }
  const rows = inscripciones.map((insc) => {
    const total = Number(insc.montoTotal || insc.monto || 0);
    const pagado = getInscripcionPaid(insc);
    const deuda = Math.max(0, total - pagado);
    return `<div class="resumen-team-row">
      <div><strong>${escapeHtml(insc.nombre || 'Equipo')}</strong><span>${CAT_NAMES[insc.cat] || 'Categoría'}</span></div>
      <div class="resumen-team-money"><b>${formatMoney(pagado)}</b><small>${deuda > 0 ? 'Debe ' + formatMoney(deuda) : 'Pagado'}</small></div>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="resumen-pay-layout">
      <div class="resumen-pay-donuts">
        <div class="resumen-donut" style="--paid:${metrics.pctPagadas};--pending:${100 - metrics.pctPagadas}">
          <div><strong>${metrics.pctPagadas}%</strong><span>Pagadas</span></div>
        </div>
        <div class="resumen-donut" style="--paid:${metrics.pctCobranza};--pending:${100 - metrics.pctCobranza}">
          <div><strong>${metrics.pctCobranza}%</strong><span>Cobrado</span></div>
        </div>
      </div>
      <div class="resumen-pay-bars">
        ${resumenBar('Pagadas', metrics.pagadas, Math.max(metrics.equipos, 1))}
        ${resumenBar('Pendientes', metrics.pendientes, Math.max(metrics.equipos, 1))}
        ${resumenBar('Cobrado total', metrics.pagadoTotal, Math.max(metrics.totalMonto, 1))}
        ${resumenBar('Cobrado en ' + period.label, metrics.pagadoPeriodo, Math.max(metrics.totalMonto, 1))}
      </div>
    </div>
    ${rows}`;
}

function renderResumenVentas(ventas, gastosTienda, period) {
  const el = document.getElementById('resVentas');
  if (!el) return;
  if (!ventas.ventas && !gastosTienda.registros) {
    el.innerHTML = `<div class="empty"><span class="empty-icon">🛒</span>Sin movimientos de tienda en ${period.label}</div>`;
    return;
  }
  el.innerHTML = `
    <div class="money-row"><span class="money-lbl">Ventas · ${period.label}</span><span class="money-val">${formatMoney(ventas.total)}</span></div>
    <div class="money-row"><span class="money-lbl">Retiros / gastos tienda</span><span class="money-val" style="color:var(--amber)">${formatMoney(gastosTienda.total)}</span></div>
    <div class="money-row"><span class="money-lbl">Ticket promedio</span><span class="money-val">${formatMoney(ventas.ticket)}</span></div>
    ${ventas.top.length ? ventas.top.map(([nombre, data]) => `<div class="money-row"><span class="money-lbl">${data.emoji} ${escapeHtml(nombre)} (${data.qty})</span><span class="money-val">${formatMoney(data.total)}</span></div>`).join('') : ''}`;
}

function renderResumenArbitrajes(arb, period) {
  const el = document.getElementById('resArb');
  if (!el) return;
  el.innerHTML = `
    <div class="money-row"><span class="money-lbl">Partidos terminados · ${period.label}</span><span class="money-val">${arb.partidos}</span></div>
    <div class="money-row"><span class="money-lbl">💵 Efectivo</span><span class="money-val">${formatMoney(arb.totalEf)}</span></div>
    <div class="money-row"><span class="money-lbl">📱 Transferencia</span><span class="money-val">${formatMoney(arb.totalTr)}</span></div>
    <div class="money-row"><span class="money-lbl">✅ Prepago</span><span class="money-val">${formatMoney(arb.totalPp)}</span></div>
    <div class="money-row total-row"><span class="money-lbl">Total arbitrajes</span><span class="money-val">${formatMoney(arb.total)}</span></div>
    ${arb.pendientes ? `<div class="money-row"><span class="money-lbl">Pendiente por cobrar</span><span class="money-val" style="color:var(--red)">${formatMoney(arb.pendientes)}</span></div>` : ''}`;
}

function renderResumenCapitalHumano(gastos, metrics, period) {
  const el = document.getElementById('resCapHum');
  if (!el) return;
  if (!gastos.length) {
    el.innerHTML = `<div class="empty"><span class="empty-icon">👥</span>Sin gastos de capital humano en ${period.label}</div>`;
    return;
  }
  const byTrab = {};
  gastos.forEach((gasto) => {
    const trab = C.trabajadores?.[gasto.trabajadorKey];
    const nombre = trab?.nombre || 'Sin asignar';
    if (!byTrab[nombre]) byTrab[nombre] = { total: 0, pendiente: 0 };
    byTrab[nombre].total += Number(gasto.monto) || 0;
    if (gasto.metodo === 'pendiente') byTrab[nombre].pendiente += Number(gasto.monto) || 0;
  });
  el.innerHTML = Object.entries(byTrab).map(([nombre, data]) => `
    <div class="money-row"><span class="money-lbl">👷 ${escapeHtml(nombre)}</span><span class="money-val">${formatMoney(data.total)}</span></div>
    ${data.pendiente ? `<div class="money-row"><span class="money-lbl">Pendiente · ${escapeHtml(nombre)}</span><span class="money-val" style="color:var(--amber)">${formatMoney(data.pendiente)}</span></div>` : ''}`).join('') +
    `<div class="money-row total-row"><span class="money-lbl">Total · ${period.label}</span><span class="money-val" style="color:var(--red)">${formatMoney(metrics.total)}</span></div>`;
}

function renderResumenInsights(ctx) {
  const el = document.getElementById('finInsights');
  if (!el) return;
  const margin = pct(ctx.neto, Math.max(ctx.ingresos, 1));
  const alerts = [];
  if (ctx.insc.pendienteMonto > 0) alerts.push(`Hay ${formatMoney(ctx.insc.pendienteMonto)} pendientes de inscripción. Es el dinero más directo de recuperar.`);
  if (ctx.arb.pendientes > 0) alerts.push(`Hay ${formatMoney(ctx.arb.pendientes)} de arbitrajes marcados como no pagados.`);
  if (ctx.tiendaOn && ctx.ventas.ticket > 0 && ctx.ventas.ticket < 40) alerts.push('El ticket promedio de tienda es bajo; conviene crear combos para subirlo.');
  if (!alerts.length) alerts.push('El filtro actual no muestra alertas fuertes. Mantén el seguimiento por categoría para evitar mezclas.');
  el.innerHTML = `
    <div class="resumen-insight-card">
      <div class="resumen-insight-title">Margen neto estimado</div>
      <div class="resumen-insight-value" style="color:${ctx.neto >= 0 ? 'var(--emerald)' : 'var(--red)'}">${margin}%</div>
      <p>${ctx.neto >= 0 ? 'El periodo queda positivo con el filtro seleccionado.' : 'El periodo queda negativo; revisa gastos o cobros pendientes.'}</p>
    </div>
    ${alerts.map((text) => `<div class="resumen-insight-card soft"><p>${text}</p></div>`).join('')}`;
}

function renderResDeudas(inscripcionesArg, partidosArg) {
  const el = document.getElementById('resDeudas');
  if (!el) return;
  const inscDeudas = (inscripcionesArg || []).map((insc) => {
    const total = Number(insc.montoTotal || insc.monto || 0);
    const pagado = getInscripcionPaid(insc);
    return { nombre: insc.nombre || 'Equipo', cat: insc.cat, pendiente: Math.max(0, total - pagado), pagado, total };
  }).filter((d) => d.pendiente > 0);

  const arbDeudas = (partidosArg || []).filter((p) => p.status === 'terminado').flatMap((p) => {
    const costo = p.costArb || 250;
    const out = [];
    if (p.arbPago?.local?.nd) out.push({ nombre: p.localNombre || p.local || 'Local', pendiente: costo, cat: p.cat, tipo: 'Arbitraje' });
    if (p.arbPago?.visita?.nd) out.push({ nombre: p.visitaNombre || p.visita || 'Visita', pendiente: costo, cat: p.cat, tipo: 'Arbitraje' });
    return out;
  });

  const all = [...inscDeudas.map((d) => ({ ...d, tipo: 'Inscripción' })), ...arbDeudas];
  if (!all.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">✅</span>Sin deudas pendientes en este filtro</div>';
    return;
  }
  const total = all.reduce((sum, d) => sum + d.pendiente, 0);
  el.innerHTML = `<div class="money-row total-row"><span class="money-lbl">Total por cobrar</span><span class="money-val" style="color:var(--red)">${formatMoney(total)}</span></div>` +
    all.map((d) => `<div class="resumen-debt-row"><div><strong>${escapeHtml(d.nombre)}</strong><span>${d.tipo} · ${CAT_NAMES[d.cat] || 'Categoría'}</span></div><b>${formatMoney(d.pendiente)}</b></div>`).join('');
}

function renderIncomeChart() {
  renderResumen();
}
