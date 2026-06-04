let resumenPeriodo = 'dia';

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
  if (periodo === 'custom') {
    const desde = document.getElementById('res_desde_fecha');
    const hasta = document.getElementById('res_hasta_fecha');
    if (desde && !desde.value) {
      const nd = new Date();
      nd.setDate(nd.getDate() - 7);
      desde.value = nd.toISOString().split('T')[0];
    }
    if (hasta && !hasta.value) hasta.value = new Date().toISOString().split('T')[0];
  }
  renderResumen();
}

function getResumenFilteredData() {
  const allVentas = getVentas();
  const allParts = getParts().filter((partido) => partido.status === 'terminado');
  const allInscs = getInsc();
  const allGastos = getGastos();
  const now = new Date();
  const hoy = now.toISOString().split('T')[0];
  const todayStart = new Date(hoy + 'T00:00:00').getTime();
  const todayEnd = new Date(hoy + 'T23:59:59').getTime();

  if (resumenPeriodo === 'dia') {
    const abonos = allInscs.map((inscripcion) => ({
      ...inscripcion,
      abonos: inscripcion.abonos ? Object.fromEntries(Object.entries(inscripcion.abonos).filter(([, abono]) => abono.fecha === hoy)) : {}
    }));
    return {
      ventas: allVentas.filter((venta) => venta.ts && venta.ts >= todayStart && venta.ts <= todayEnd),
      parts: allParts.filter((partido) => partido.fecha === hoy),
      inscs: abonos,
      gastos: allGastos.filter((gasto) => gasto.fecha === hoy),
      label: 'Hoy'
    };
  }
  if (resumenPeriodo === 'semana') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const f = d.toISOString().split('T')[0];
    const fts = new Date(f).getTime();
    const abonos = allInscs.map((inscripcion) => ({
      ...inscripcion,
      abonos: inscripcion.abonos ? Object.fromEntries(Object.entries(inscripcion.abonos).filter(([, abono]) => (abono.fecha || '') >= f)) : {}
    }));
    return {
      ventas: allVentas.filter((venta) => venta.ts && venta.ts >= fts),
      parts: allParts.filter((partido) => (partido.fecha || '') >= f),
      inscs: abonos,
      gastos: allGastos.filter((gasto) => (gasto.fecha || '') >= f),
      label: 'Semana'
    };
  }
  if (resumenPeriodo === 'mes') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const f = d.toISOString().split('T')[0];
    const fts = new Date(f).getTime();
    const abonos = allInscs.map((inscripcion) => ({
      ...inscripcion,
      abonos: inscripcion.abonos ? Object.fromEntries(Object.entries(inscripcion.abonos).filter(([, abono]) => (abono.fecha || '') >= f)) : {}
    }));
    return {
      ventas: allVentas.filter((venta) => venta.ts && venta.ts >= fts),
      parts: allParts.filter((partido) => (partido.fecha || '') >= f),
      inscs: abonos,
      gastos: allGastos.filter((gasto) => (gasto.fecha || '') >= f),
      label: 'Mes'
    };
  }
  if (resumenPeriodo === 'anual') {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const f = d.toISOString().split('T')[0];
    const fts = new Date(f).getTime();
    const abonos = allInscs.map((inscripcion) => ({
      ...inscripcion,
      abonos: inscripcion.abonos ? Object.fromEntries(Object.entries(inscripcion.abonos).filter(([, abono]) => (abono.fecha || '') >= f)) : {}
    }));
    return {
      ventas: allVentas.filter((venta) => venta.ts && venta.ts >= fts),
      parts: allParts.filter((partido) => (partido.fecha || '') >= f),
      inscs: abonos,
      gastos: allGastos.filter((gasto) => (gasto.fecha || '') >= f),
      label: 'Año'
    };
  }
  if (resumenPeriodo === 'custom') {
    const df = document.getElementById('res_desde_fecha')?.value || '2000-01-01';
    const dt = document.getElementById('res_hasta_fecha')?.value || new Date().toISOString().split('T')[0];
    const dh = document.getElementById('res_desde_hora')?.value || '00:00';
    const th = document.getElementById('res_hasta_hora')?.value || '23:59';
    const tsFrom = new Date(df + 'T' + dh + ':00').getTime();
    const tsTo = new Date(dt + 'T' + th + ':59').getTime();
    const inRange = (date) => date >= df && date <= dt;
    const abonos = allInscs.map((inscripcion) => ({
      ...inscripcion,
      abonos: inscripcion.abonos ? Object.fromEntries(Object.entries(inscripcion.abonos).filter(([, abono]) => inRange(abono.fecha || ''))) : {}
    }));
    return {
      ventas: allVentas.filter((venta) => venta.ts && venta.ts >= tsFrom && venta.ts <= tsTo),
      parts: allParts.filter((partido) => inRange(partido.fecha || '')),
      inscs: abonos,
      gastos: allGastos.filter((gasto) => inRange(gasto.fecha || '')),
      label: `${df} → ${dt}`
    };
  }
  return { ventas: allVentas, parts: allParts, inscs: allInscs, gastos: allGastos, label: 'General' };
}

function renderResumen() {
  const { ventas, parts, inscs, gastos, label } = getResumenFilteredData();
  const allGastosTienda = getGastosTienda();
  const totalGastosTiendaPer = allGastosTienda.filter((gasto) => {
    if (!gasto.fecha) return true;
    if (resumenPeriodo === 'dia') return gasto.fecha === new Date().toISOString().split('T')[0];
    if (resumenPeriodo === 'semana') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return (gasto.fecha || '') >= d.toISOString().split('T')[0];
    }
    if (resumenPeriodo === 'mes') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return (gasto.fecha || '') >= d.toISOString().split('T')[0];
    }
    if (resumenPeriodo === 'anual') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return (gasto.fecha || '') >= d.toISOString().split('T')[0];
    }
    return true;
  }).reduce((sum, gasto) => sum + gasto.monto, 0);

  const tv = ventas.reduce((sum, venta) => sum + venta.total, 0);
  const numV = ventas.length;
  const totalEf = parts.reduce((sum, partido) => {
    const pago = partido.arbPago || {};
    return sum + (pago.local?.ef || 0) + (pago.visita?.ef || 0);
  }, 0);
  const totalTr = parts.reduce((sum, partido) => {
    const pago = partido.arbPago || {};
    return sum + (pago.local?.tr || 0) + (pago.visita?.tr || 0);
  }, 0);
  const totalPp = parts.reduce((sum, partido) => {
    const pago = partido.arbPago || {};
    return sum + (pago.local?.pp || 0) + (pago.visita?.pp || 0);
  }, 0);
  const totalArb = totalEf + totalTr + totalPp;
  const totalInscPagado = inscs.reduce((sum, inscripcion) => {
    const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
    return sum + abonos.reduce((acc, abono) => acc + abono.monto, 0);
  }, 0);
  const totalInscPendiente = getInsc().reduce((sum, inscripcion) => {
    const abonos = inscripcion.abonos ? Object.values(inscripcion.abonos) : [];
    const pagado = abonos.reduce((acc, abono) => acc + abono.monto, 0);
    return sum + Math.max(0, (inscripcion.montoTotal || 0) - pagado);
  }, 0);
  const totalGastosTrab = (gastos || []).reduce((sum, gasto) => sum + gasto.monto, 0);
  const totalGeneral = tv + totalArb;
  const gananciaNet = totalGeneral - totalGastosTrab - totalGastosTiendaPer;
  const periodLabel = label;

  const rg = document.getElementById('resumenGrid');
  if (rg) {
    rg.innerHTML = `
    <div class="res-card" style="border-top:3px solid var(--acc)"><div class="res-n" style="color:var(--acc)">$${tv}</div><div class="res-l">Ventas · ${periodLabel}</div></div>
    <div class="res-card" style="border-top:3px solid var(--blue)"><div class="res-n" style="color:var(--blue)">${numV}</div><div class="res-l">N° Ventas · ${periodLabel}</div></div>
    <div class="res-card" style="border-top:3px solid var(--amber)"><div class="res-n" style="color:var(--amber)">$${totalArb}</div><div class="res-l">Arbitrajes · ${periodLabel}</div></div>
    <div class="res-card" style="border-top:3px solid var(--acc)"><div class="res-n" style="color:var(--acc)">$${totalInscPagado}</div><div class="res-l">Inscripciones · ${periodLabel}</div></div>
    <div class="res-card" style="border-top:3px solid var(--red)"><div class="res-n" style="color:var(--red)">$${totalGastosTrab}</div><div class="res-l">Cap. Humano · ${periodLabel}</div></div>
    <div class="res-card" style="border-top:3px solid var(--amber)"><div class="res-n" style="color:var(--amber)">$${totalGastosTiendaPer}</div><div class="res-l">Retiros Tienda · ${periodLabel}</div></div>
    <div class="res-card card-gold" style="grid-column:1/-1"><div class="res-n" style="color:var(--gold);font-size:40px">$${gananciaNet}</div><div class="res-l">💰 Ganancia Neta · ${periodLabel}</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Ventas + Arbitrajes − Capital Humano</div></div>`;
  }

  const prods = getProd();
  const stockBajo = prods.filter((producto) => producto.stock <= 5).length;
  const ticketPromedio = numV > 0 ? Math.round(tv / numV) : 0;
  const vpp = {};
  ventas.forEach((venta) => (venta.items || []).forEach((item) => {
    if (!vpp[item.nombre]) vpp[item.nombre] = { emoji: item.emoji || '📦', qty: 0, total: 0 };
    vpp[item.nombre].qty += item.qty;
    vpp[item.nombre].total += item.precio * item.qty;
  }));
  const topProds = Object.entries(vpp).sort((a, b) => b[1].total - a[1].total).slice(0, 5);

  const margenNeto = totalGeneral > 0 ? Math.round((gananciaNet / totalGeneral) * 100) : 0;
  const ingPorPartido = parts.length > 0 ? Math.round(totalArb / parts.length) : 0;
  const eficienciaOp = totalGastosTrab > 0 ? Math.round((gananciaNet / Math.max(totalGastosTrab, 1)) * 100) / 100 : 0;
  const roiInsc = (totalInscPagado + totalInscPendiente) > 0 ? Math.round((totalInscPagado / (totalInscPagado + totalInscPendiente)) * 100) : 100;

  const fi = document.getElementById('finInsights');
  if (fi) {
    fi.innerHTML = `
    <div class="res-grid" style="margin-bottom:12px">
      <div class="res-card" style="border-top:3px solid var(--acc)">
        <div class="res-n" style="color:var(--acc)">$${totalGeneral}</div>
        <div class="res-l">Ingresos Brutos</div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">Ventas + Arbitrajes</div>
      </div>
      <div class="res-card" style="border-top:3px solid var(--red)">
        <div class="res-n" style="color:var(--red)">$${totalGastosTrab}</div>
        <div class="res-l">Gastos Operativos</div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">Capital Humano</div>
      </div>
    </div>
    <div class="fin-ratio">
      <div class="fin-ratio-title">💵 Ticket Promedio en Tienda</div>
      <div class="fin-ratio-val">$${ticketPromedio}</div>
      <div class="fin-ratio-desc">${ticketPromedio === 0 ? 'Sin ventas en este período.' : ticketPromedio < 25 ? '⚠️ Ticket bajo. Implementa combos: Agua + Sabritas = $40. Un ticket más alto reduce el número de transacciones que necesitas para llegar a tu meta.' : '✅ Ticket saludable. Sigue ofreciendo variedad y combos para mantenerlo.'}</div>
    </div>
    <div class="fin-ratio">
      <div class="fin-ratio-title">📊 Margen de Ganancia Neta</div>
      <div class="fin-ratio-val" style="color:${margenNeto >= 40 ? 'var(--acc)' : margenNeto >= 20 ? 'var(--amber)' : 'var(--red)'}">
        ${margenNeto}%
      </div>
      <div class="fin-ratio-desc">
        ${margenNeto >= 40 ? '✅ Excelente: conservas $' + margenNeto + ' de cada $100 que entran. Reinvierte en infraestructura o promociones para seguir creciendo.' : margenNeto >= 20 ? '⚠️ Aceptable: $' + margenNeto + ' de cada $100. Revisa gastos de capital humano — ahí suele estar la palanca para mejorar.' : '🔴 Margen bajo: solo $' + margenNeto + ' de cada $100. Tus gastos consumen casi todo el ingreso. Prioriza cobros pendientes.'}
      </div>
    </div>
    <div class="fin-ratio">
      <div class="fin-ratio-title">⚽ Ingreso de Arbitraje por Partido</div>
      <div class="fin-ratio-val">$${ingPorPartido}</div>
      <div class="fin-ratio-desc">
        ${parts.length === 0 ? 'Sin partidos terminados en este período.' : ingPorPartido < 400 ? '⚠️ Ingreso bajo. Verifica que AMBOS equipos paguen su cuota ($250 c/u = $500 por partido). Un partido no cobrado es ingreso perdido.' : '✅ Arbitraje bien cobrado. Con ' + parts.length + ' partido(s) en el período, la recaudación es consistente.'}
      </div>
    </div>
    <div class="fin-ratio">
      <div class="fin-ratio-title">⚖️ Retorno sobre Gasto Operativo (ROO)</div>
      <div class="fin-ratio-val" style="color:${eficienciaOp >= 2 ? 'var(--acc)' : eficienciaOp >= 1 ? 'var(--amber)' : 'var(--red)'}">
        ${eficienciaOp}x
      </div>
      <div class="fin-ratio-desc">
        ${totalGastosTrab === 0 ? 'Sin gastos de capital humano en este período.' : eficienciaOp >= 2 ? '✅ Por cada $1 que gastas en personal, generas $' + eficienciaOp + ' de ganancia. Eficiencia excelente.' : eficienciaOp >= 1 ? '⚠️ $' + eficienciaOp + ' de ganancia por cada $1 de gasto en personal. Optimiza turnos o tarifas para mejorar.' : '🔴 Gastas más en personal de lo que ganas en neto. Revisa tarifas de árbitros y pagos a trabajadores.'}
      </div>
    </div>
    <div class="fin-ratio">
      <div class="fin-ratio-title">💳 Cobranza de Inscripciones</div>
      <div class="fin-ratio-val" style="color:${roiInsc >= 80 ? 'var(--acc)' : roiInsc >= 50 ? 'var(--amber)' : 'var(--red)'}">
        ${roiInsc}%
      </div>
      <div class="fin-ratio-desc">
        ${roiInsc === 100 ? '✅ Sin cartera vencida. Todas las inscripciones cobradas.' : roiInsc >= 80 ? '✅ Has cobrado el ' + roiInsc + '% de inscripciones. Da seguimiento a los $' + totalInscPendiente + ' restantes antes de la próxima jornada.' : roiInsc >= 50 ? '⚠️ Solo el ' + roiInsc + '% cobrado. Implementa la regla: sin pago confirmado, sin alineación registrada.' : '🔴 Cartera crítica — solo el ' + roiInsc + '% cobrado. Considera suspender equipos con deuda alta hasta regularizar.'}
      </div>
    </div>
    ${stockBajo > 0 ? `<div class="insight-box warn"><div class="insight-title">⚠️ Alerta de Stock Bajo</div><div class="insight-text">${stockBajo} producto(s) con 5 o menos unidades. Reabastece antes del próximo partido — agua y refrescos son los de mayor rotación.</div></div>` : ''}
    ${totalInscPendiente > 0 ? `<div class="insight-box alert"><div class="insight-title">💰 Inscripciones Pendientes: $${totalInscPendiente}</div><div class="insight-text">Cobrar esto aumentaría tu ganancia neta directamente sin ningún costo adicional. Es el dinero más fácil de recuperar.</div></div>` : ''}
    <div class="insight-box"><div class="insight-title">🏆 Recomendación del Período</div><div class="insight-text">${topProds.length > 0 ? 'Producto estrella: "' + topProds[0][0] + '" — $' + topProds[0][1].total + ' en ventas. Siempre con stock. ' : ''} ${ticketPromedio > 0 && ticketPromedio < 30 ? 'Sube el ticket con combos de $40-50. ' : ''} ${parts.length > 0 && ingPorPartido < 500 ? 'Cobra arbitraje a ambos equipos en cada partido. ' : ''} ${margenNeto > 0 && margenNeto < 30 ? 'Foco en margen: reduce gastos variables o sube tarifas de inscripción.' : ''}</div></div>`;
  }

  renderIncomeChart(tv, totalArb, totalGastosTrab, totalInscPagado, periodLabel);
  renderResDeudas();

  const ri = document.getElementById('resInsc');
  if (ri) {
    ri.innerHTML = `
    <div class="money-row"><span class="money-lbl">✅ Abonos · ${periodLabel}</span><span class="money-val">$${totalInscPagado}</span></div>
    <div class="money-row"><span class="money-lbl">⏳ Total pendiente (general)</span><span class="money-val" style="color:var(--red)">$${totalInscPendiente}</span></div>`;
  }

  const rv = document.getElementById('resVentas');
  if (rv) {
    rv.innerHTML = !topProds.length
      ? `<div style="color:var(--muted);font-size:12px;padding:8px">Sin ventas en ${periodLabel}</div>`
      : topProds.map(([nombre, data]) => `<div class="money-row"><span class="money-lbl">${data.emoji} ${nombre} (${data.qty} pzs)</span><span class="money-val">$${data.total}</span></div>`).join('');
  }

  const ra = document.getElementById('resArb');
  if (ra) {
    ra.innerHTML = `
    <div class="money-row"><span class="money-lbl">💵 Efectivo</span><span class="money-val">$${totalEf}</span></div>
    <div class="money-row"><span class="money-lbl">📱 Transferencia</span><span class="money-val">$${totalTr}</span></div>
    <div class="money-row"><span class="money-lbl">✅ Prepago</span><span class="money-val">$${totalPp}</span></div>
    <div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Total · ${periodLabel}</span><span class="money-val">$${totalArb}</span></div>`;
  }

  const raCapHum = document.getElementById('resCapHum');
  if (raCapHum) {
    const trabGastosPer = gastos || [];
    const byTrab = {};
    trabGastosPer.forEach((gasto) => {
      const trab = C.trabajadores[gasto.trabajadorKey];
      const nombre = trab?.nombre || 'Sin asignar';
      if (!byTrab[nombre]) byTrab[nombre] = { total: 0, pendiente: 0 };
      byTrab[nombre].total += gasto.monto;
      if (gasto.metodo === 'pendiente') byTrab[nombre].pendiente += gasto.monto;
    });
    raCapHum.innerHTML = !trabGastosPer.length
      ? `<div style="color:var(--muted);font-size:12px;padding:8px">Sin gastos en ${periodLabel}</div>`
      : Object.entries(byTrab).map(([nombre, data]) => `<div class="money-row"><span class="money-lbl">👷 ${nombre}${data.pendiente > 0 ? ` <span style="color:var(--amber);font-size:10px">(⏳ $${data.pendiente} pend.)</span>` : ''}</span><span class="money-val">$${data.total}</span></div>`).join('') +
        `<div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Total · ${periodLabel}</span><span class="money-val" style="color:var(--red)">$${totalGastosTrab}</span></div>`;
  }
}

function renderIncomeChart(ventas, arbitraje, gastos, inscripciones, label) {
  const wrap = document.querySelector('.chart-wrap');
  if (!wrap) return;
  const totalGT = getGastosTienda ? getGastosTienda().reduce((sum, gasto) => sum + gasto.monto, 0) : 0;
  const neto = ventas + arbitraje - gastos - totalGT;
  const rows = [
    { label: '💵 Ventas', val: ventas, color: '#0d9488', bg: 'rgba(13,148,136,.15)' },
    { label: '🦺 Arbitraje', val: arbitraje, color: '#4d7ef5', bg: 'rgba(77,126,245,.15)' },
    { label: '🏷️ Inscripciones', val: inscripciones, color: '#7c3aed', bg: 'rgba(124,58,237,.15)' },
    { label: '👷 Cap. Humano', val: gastos, color: '#dc2626', bg: 'rgba(220,38,38,.12)' },
    { label: '🛒 Ret. Tienda', val: totalGT, color: '#d97706', bg: 'rgba(217,119,6,.12)' },
    { label: '✨ Neto', val: neto, color: neto >= 0 ? '#16a34a' : '#dc2626', bg: neto >= 0 ? 'rgba(22,163,74,.12)' : 'rgba(220,38,38,.12)' }
  ];
  const maxVal = Math.max(...rows.map((row) => Math.abs(row.val)), 1);
  const fmt = (v) => {
    const abs = Math.abs(v);
    if (abs >= 1000000) return '$' + (abs / 1000000).toFixed(1) + 'M';
    if (abs >= 1000) return '$' + (abs / 1000).toFixed(1) + 'k';
    return '$' + abs;
  };
  wrap.innerHTML = `<div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">📊 Distribución de Ingresos — ${label || ''}</div>` +
    rows.map((row) => {
      const pct = Math.round(Math.abs(row.val) / maxVal * 100);
      const isNeg = row.val < 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:110px;flex-shrink:0;font-size:11px;font-weight:700;color:var(--text);white-space:nowrap">${row.label}</div>
        <div style="flex:1;background:var(--border);border-radius:4px;height:20px;overflow:hidden;position:relative">
          <div style="height:100%;width:${pct}%;background:${row.color};border-radius:4px;transition:width .4s;min-width:${row.val !== 0 ? '4px' : '0'}"></div>
        </div>
        <div style="width:72px;flex-shrink:0;text-align:right;font-family:'Bebas Neue',sans-serif;font-size:16px;color:${row.color};${isNeg ? '' : ''}">
          ${isNeg ? '-' : ''}${fmt(row.val)}
        </div>
      </div>`;
    }).join('');
}

function renderResDeudas() {
  const el = document.getElementById('resDeudas');
  if (!el) return;

  const inscDeudas = Object.entries(C.inscripciones || {})
    .map(([, inscripcion]) => {
      const monto = inscripcion.monto || 0;
      const pagado = inscripcion.abonos ? Object.values(inscripcion.abonos).reduce((sum, abono) => sum + (abono.monto || 0), 0) : 0;
      const pendiente = Math.max(0, monto - pagado);
      return {
        tipo: 'insc',
        nombre: inscripcion.nombre || '—',
        pendiente,
        monto,
        pagado,
        abonos: inscripcion.abonos ? Object.values(inscripcion.abonos) : [],
        torneo: inscripcion.torneo,
        cat: inscripcion.cat
      };
    })
    .filter((deuda) => deuda.pendiente > 0);

  const arbDeudas = [];
  Object.values(C.partidos || {}).forEach((partido) => {
    if (partido.status !== 'terminado') return;
    const arbP = partido.arbPago || {};
    const checkSide = (side, equipo) => {
      const pago = arbP[side] || {};
      if (pago.nd) {
        const costo = pago.costo || partido.costArb || 250;
        arbDeudas.push({
          tipo: 'arb',
          nombre: equipo || side,
          pendiente: costo,
          fecha: partido.fecha,
          cancha: partido.cancha,
          vsEquipo: side === 'local' ? (partido.visitaNombre || partido.visita) : (partido.localNombre || partido.local),
          nota: pago.nota || ''
        });
      }
    };
    checkSide('local', partido.localNombre || partido.local);
    checkSide('visita', partido.visitaNombre || partido.visita);
  });

  if (!inscDeudas.length && !arbDeudas.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">✅</span>Sin deudas pendientes</div>';
    return;
  }

  const totalInsc = inscDeudas.reduce((sum, deuda) => sum + deuda.pendiente, 0);
  const totalArb = arbDeudas.reduce((sum, deuda) => sum + deuda.pendiente, 0);
  const totalDeuda = totalInsc + totalArb;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:2px solid var(--border2);margin-bottom:10px">
    <span style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">Total por cobrar</span>
    <span style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--red)">$${totalDeuda}</span>
  </div>`;

  if (inscDeudas.length) {
    html += `<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">🏷️ Inscripciones — $${totalInsc} total</div>`;
    html += inscDeudas.map((deuda) => `
      <div style="background:rgba(220,38,38,.04);border:1px solid rgba(220,38,38,.15);border-radius:10px;padding:10px 12px;margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:13px;font-weight:800">${deuda.nombre}</div>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--red)">$${deuda.pendiente} pendiente</span>
        </div>
        <div style="font-size:10px;color:var(--muted);font-weight:600">Total $${deuda.monto} · Pagado $${deuda.pagado}</div>
        ${deuda.abonos.length ? `<div style="margin-top:6px">${deuda.abonos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map((abono) => `
          <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--muted)">${fmtDate(abono.fecha)} · ${abono.metodo || '—'}${abono.notas ? ` · ${abono.notas}` : ''}</span>
            <span style="color:#16a34a;font-weight:800">+$${abono.monto}</span>
          </div>`).join('')}</div>` : ''}
      </div>`).join('');
  }

  if (arbDeudas.length) {
    html += `<div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin:12px 0 8px">🦺 Arbitrajes sin pagar — $${totalArb} total</div>`;
    html += arbDeudas.map((deuda) => `
      <div style="background:rgba(220,38,38,.04);border:1px solid rgba(220,38,38,.15);border-radius:10px;padding:10px 12px;margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:800">${deuda.nombre}</div>
            <div style="font-size:10px;color:var(--muted);font-weight:600">vs ${deuda.vsEquipo} · ${fmtDate(deuda.fecha)}${deuda.nota ? ` · ${deuda.nota}` : ''}</div>
          </div>
          <span class="arb-nd-badge">❌ $${deuda.pendiente}</span>
        </div>
      </div>`).join('');
  }

  el.innerHTML = html;
}
