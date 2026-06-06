let arbPeriodo = '3dias';
let eapMethods = { local: null, visita: null };

function setArbPeriodo(periodo) {
  arbPeriodo = periodo;
  ['hoy', '3dias', 'semana', 'mes', 'todo'].forEach((p) => {
    const btn = document.getElementById(`arbBtn_${p}`);
    if (btn) btn.className = p === periodo ? 'btn btn-g btn-sm' : 'btn btn-out btn-sm';
  });
  renderArbitros();
}

function getArbFilteredParts() {
  const all = getParts().filter((partido) => partido.status === 'terminado');
  const now = new Date();
  const hoy = now.toISOString().split('T')[0];
  if (arbPeriodo === 'hoy') return all.filter((partido) => partido.fecha === hoy);
  if (arbPeriodo === '3dias') {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const f = d.toISOString().split('T')[0];
    return all.filter((partido) => (partido.fecha || '') >= f);
  }
  if (arbPeriodo === 'semana') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const f = d.toISOString().split('T')[0];
    return all.filter((partido) => (partido.fecha || '') >= f);
  }
  if (arbPeriodo === 'mes') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const f = d.toISOString().split('T')[0];
    return all.filter((partido) => (partido.fecha || '') >= f);
  }
  return all;
}

function renderArbitros() {
  const el = document.getElementById('arbitrosList');
  if (!el) return;
  const arbs = getArbs();
  if (!arbs.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">ðŸ¦º</span>Sin Ã¡rbitros</div>';
  } else {
    el.innerHTML = arbs.map((arbitro) => {
      const partidos = getArbFilteredParts().filter((partido) => partido.arbId === arbitro._key);
      const cobrado = partidos.reduce((sum, partido) => {
        const pago = partido.arbPago || {};
        return sum + (pago.local?.ef || 0) + (pago.local?.tr || 0) + (pago.local?.pp || 0) + (pago.visita?.ef || 0) + (pago.visita?.tr || 0) + (pago.visita?.pp || 0);
      }, 0);
      const sinCobrar = partidos.filter((partido) => !partido.sinArbitro && !partido.arbPagado).length;
      return `<div class="arb-card">
      <div class="arb-av">ðŸ¦º</div>
      <div class="arb-info">
        <div class="arb-name">${arbitro.nombre}</div>
        <div class="arb-meta">ðŸ“ž ${arbitro.tel || 'â€”'} Â· $${arbitro.tarifa || 250}/partido Â· ${partidos.length} partidos</div>
        ${sinCobrar > 0 ? `<div style="font-size:10px;font-weight:800;color:var(--amber);margin-top:2px">âš ï¸ ${sinCobrar} partido(s) sin cobrar</div>` : '<div style="font-size:10px;font-weight:800;color:var(--acc);margin-top:2px">âœ… Al corriente</div>'}
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        <div class="arb-earned">$${cobrado}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:700">COBRADO</div>
        <button class="btn btn-out btn-sm" onclick="editArbitro('${arbitro._key}')">âœï¸ Editar</button>
        <button class="btn btn-r btn-sm" onclick="deleteArbitro('${arbitro._key}')">ðŸ—‘ï¸</button>
      </div>
    </div>`;
    }).join('');
  }

  const parts = getArbFilteredParts();
  const conCobro = parts.filter((partido) => !partido.sinArbitro);
  const totalEf = conCobro.reduce((sum, partido) => {
    const pago = partido.arbPago || {};
    return sum + (pago.local?.ef || 0) + (pago.visita?.ef || 0);
  }, 0);
  const totalTr = conCobro.reduce((sum, partido) => {
    const pago = partido.arbPago || {};
    return sum + (pago.local?.tr || 0) + (pago.visita?.tr || 0);
  }, 0);
  const totalPp = conCobro.reduce((sum, partido) => {
    const pago = partido.arbPago || {};
    return sum + (pago.local?.pp || 0) + (pago.visita?.pp || 0);
  }, 0);
  const sinArb = parts.filter((partido) => partido.sinArbitro).length;
  const totalDia = totalEf + totalTr + totalPp;
  const totalPorCobrar = conCobro.reduce((sum, partido) => sum + ((partido.costArb || 250) * 2), 0);
  const pendienteCobro = Math.max(0, totalPorCobrar - totalDia);
  const pctCobrado = totalPorCobrar > 0 ? Math.min(100, Math.round((totalDia / totalPorCobrar) * 100)) : 0;
  const gastoArbs = conCobro.reduce((sum, partido) => {
    const arbitro = partido.arbId ? C.arbitros[partido.arbId] : null;
    return sum + (arbitro?.tarifa || 250);
  }, 0);
  const cobEl = document.getElementById('cobrosDelDia');
  if (cobEl) {
    cobEl.innerHTML = `
    <div class="insc-donut-stat arb-donut-stat">
      <div class="resumen-donut" style="--paid:${pctCobrado};--pending:${100 - pctCobrado}">
        <div><strong>${pctCobrado}%</strong><span>Cobrado</span></div>
      </div>
      <div class="insc-donut-copy">
        <div class="insc-filter-title">Arbitrajes por cobrar</div>
        <div class="insc-total-amount">$${totalPorCobrar}</div>
        <div class="money-row"><span class="money-lbl">Cobrado</span><span class="money-val" style="color:var(--emerald)">$${totalDia}</span></div>
        <div class="money-row"><span class="money-lbl">Pendiente</span><span class="money-val" style="color:var(--amber)">$${pendienteCobro}</span></div>
      </div>
    </div>    <div class="money-row"><span class="money-lbl">ðŸ“Š Partidos en perÃ­odo</span><span class="money-val" style="color:var(--blue)">${parts.length}</span></div>
    ${sinArb > 0 ? `<div class="money-row"><span class="money-lbl">ðŸš« Sin cobro de Ã¡rbitro</span><span class="money-val" style="color:var(--muted)">${sinArb}</span></div>` : ''}
    <div class="money-row"><span class="money-lbl">ðŸ’µ Efectivo</span><span class="money-val">$${totalEf}</span></div>
    <div class="money-row"><span class="money-lbl">ðŸ“± Transferencia</span><span class="money-val">$${totalTr}</span></div>
    <div class="money-row"><span class="money-lbl">âœ… Prepago</span><span class="money-val">$${totalPp}</span></div>
    <div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Total cobrado</span><span class="money-val" style="font-size:22px">$${totalDia}</span></div>
    <div class="money-row"><span class="money-lbl">ðŸ¦º Pago a Ã¡rbitros</span><span class="money-val" style="color:var(--red)">âˆ’$${gastoArbs}</span></div>
    <div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Ganancia neta</span><span class="money-val" style="color:var(--acc);font-size:22px">$${totalDia - gastoArbs}</span></div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-r btn-sm" onclick="resetArbitrajes()">ðŸ—‘ï¸ Reiniciar estadÃ­sticas</button>
      <button class="btn btn-out btn-sm" onclick="resetArbitrajesPeriodo()">ðŸ—‘ï¸ Solo este perÃ­odo</button>
    </div>`;
  }

  const editEl = document.getElementById('editCobrosArb');
  if (editEl) {
    if (!conCobro.length) {
      editEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">Sin cobros en este perÃ­odo</div>';
    } else {
      editEl.innerHTML = conCobro.map((partido) => {
        const arbitro = partido.arbId ? C.arbitros[partido.arbId] : null;
        const cobL = (partido.arbPago?.local?.ef || 0) + (partido.arbPago?.local?.tr || 0) + (partido.arbPago?.local?.pp || 0);
        const cobV = (partido.arbPago?.visita?.ef || 0) + (partido.arbPago?.visita?.tr || 0) + (partido.arbPago?.visita?.pp || 0);
        return `<div class="pago-row">
        <div class="pago-info">
          <div class="pago-match">${partido.localNombre || partido.local} vs ${partido.visitaNombre || partido.visita}</div>
          <div class="pago-meta">ðŸ“… ${fmtDate(partido.fecha)} Â· ðŸ¦º ${arbitro?.nombre || 'Sin Ã¡rbitro'}</div>
          <div class="pago-meta">Local: $${cobL} Â· Visita: $${cobV}</div>
        </div>
        <button class="btn btn-out btn-sm" onclick="openEditArbPago('${partido._key}')">âœï¸ Editar</button>
      </div>`;
      }).join('');
    }
  }

  const sinArbAsign = getParts().filter((partido) => partido.status === 'terminado' && !partido.arbId && !partido.sinArbitro);
  const asignEl = document.getElementById('asignacionArb');
  if (asignEl) {
    if (!sinArbAsign.length) {
      asignEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">âœ… Todos los partidos tienen Ã¡rbitro asignado</div>';
    } else {
      asignEl.innerHTML = sinArbAsign.map((partido) => `<div class="pago-row">
      <div class="pago-info"><div class="pago-match">${partido.localNombre || partido.local} vs ${partido.visitaNombre || partido.visita}</div><div class="pago-meta">ðŸ“… ${fmtDate(partido.fecha)}</div></div>
      <select class="fi" id="arb_sel_${partido._key}" style="max-width:120px;font-size:11px;padding:4px 6px">
        <option value="">â€” Ãrbitro â€”</option>
        ${arbs.map((arbitro) => `<option value="${arbitro._key}">${arbitro.nombre}</option>`).join('')}
      </select>
      <button class="btn btn-g btn-sm" onclick="asignarArbitro('${partido._key}')">âœ“</button>
      <button class="btn btn-out btn-sm" onclick="marcarSinArbitro('${partido._key}')" title="Sin cobro de Ã¡rbitro">ðŸš«</button>
    </div>`).join('');
    }
  }

  const pendientes = getArbFilteredParts().filter((partido) => partido.arbId && !partido.arbPagado && !partido.sinArbitro);
  const pp = document.getElementById('pagosPend');
  if (!pp) return;
  if (!pendientes.length) {
    pp.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">âœ… Sin pagos pendientes</div>';
    return;
  }
  pp.innerHTML = pendientes.map((partido) => {
    const arbitro = C.arbitros[partido.arbId];
    return `<div class="pago-row">
    <div class="pago-info"><div class="pago-match">${partido.localNombre || partido.local} vs ${partido.visitaNombre || partido.visita}</div><div class="pago-meta">ðŸ¦º ${arbitro ? arbitro.nombre : 'N/A'} Â· ${fmtDate(partido.fecha)} Â· $${partido.costArb || 250}/eq</div></div>
    <button class="btn btn-g btn-sm" onclick="activePartidoKey='${partido._key}';initPagoArb();openModal('modalPagoArb')">Pagar</button>
    <button class="btn btn-out btn-sm" onclick="openEditArbPago('${partido._key}')">âœï¸</button>
  </div>`;
  }).join('');
}

function marcarSinArbitro(key) {
  db.ref(`partidos/${key}`).update({ sinArbitro: true, arbId: null, arbitroNombre: null });
  showToast('Marcado sin cobro de Ã¡rbitro', 'ta');
}

function openEditArbPago(key) {
  const partido = C.partidos[key];
  if (!partido) return;
  document.getElementById('eap_key').value = key;
  document.getElementById('eap_sin_arb').checked = !!partido.sinArbitro;
  document.getElementById('eap_form').style.display = partido.sinArbitro ? 'none' : 'block';
  document.getElementById('eap_costo_l').value = partido.costArb || 250;
  document.getElementById('eap_costo_v').value = partido.costArb || 250;
  document.getElementById('eap_local_title').textContent = `ðŸ  ${partido.localNombre || partido.local}`;
  document.getElementById('eap_visita_title').textContent = `âœˆï¸ ${partido.visitaNombre || partido.visita}`;
  document.getElementById('eap_info').innerHTML = `âš½ <strong>${partido.localNombre || partido.local}</strong> vs <strong>${partido.visitaNombre || partido.visita}</strong><br/><span style="color:var(--muted);font-size:11px">ðŸ“… ${fmtDate(partido.fecha)} Â· ðŸŸï¸ ${partido.cancha || 'â€”'}</span>`;
  ['l', 'v'].forEach((side) => ['ef', 'tr', 'pp', 'nd'].forEach((method) => {
    const b = document.getElementById(`eap_btn_${side}_${method}`);
    if (b) b.className = 'pmo';
  }));
  openModal('modalEditArbPago');
}

function toggleSinArb() {
  const sinArb = document.getElementById('eap_sin_arb').checked;
  document.getElementById('eap_form').style.display = sinArb ? 'none' : 'block';
}

function setEapPM(side, method) {
  const short = side === 'local' ? 'l' : 'v';
  ['ef', 'tr', 'pp', 'nd'].forEach((m) => {
    const b = document.getElementById(`eap_btn_${short}_${m}`);
    if (b) b.className = 'pmo';
  });
  const btn = document.getElementById(`eap_btn_${short}_${method}`);
  if (btn) btn.className = `pmo ${method === 'ef' ? 'sel-ef' : method === 'tr' ? 'sel-tr' : method === 'pp' ? 'sel-pp' : 'sel-mx'}`;
  if (side === 'local') eapMethods.local = method;
  else eapMethods.visita = method;
  const mix = document.getElementById(`eap_${short}_mix`);
  if (mix) mix.style.display = 'none';
}

function guardarEditArbPago() {
  const key = document.getElementById('eap_key').value;
  const sinArb = document.getElementById('eap_sin_arb').checked;
  if (sinArb) {
    db.ref(`partidos/${key}`).update({ sinArbitro: true, arbPagado: false, arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } } });
    closeModal('modalEditArbPago');
    showToast('Guardado sin cobro', 'ta');
    return;
  }
  const costoL = parseInt(document.getElementById('eap_costo_l').value, 10) || 250;
  const costoV = parseInt(document.getElementById('eap_costo_v').value, 10) || 250;
  const getMethod = (costo, method) => {
    if (!method || method === 'nd') return { ef: 0, tr: 0, pp: 0 };
    if (method === 'ef') return { ef: costo, tr: 0, pp: 0 };
    if (method === 'tr') return { ef: 0, tr: costo, pp: 0 };
    if (method === 'pp') return { ef: 0, tr: 0, pp: costo };
    return { ef: 0, tr: 0, pp: 0 };
  };
  const lp = eapMethods.local ? getMethod(costoL, eapMethods.local) : null;
  const vp = eapMethods.visita ? getMethod(costoV, eapMethods.visita) : null;
  const updates = { sinArbitro: false, costArb: costoL };
  if (lp) updates['arbPago/local'] = lp;
  if (vp) updates['arbPago/visita'] = vp;
  if (lp && vp) updates.arbPagado = true;
  db.ref(`partidos/${key}`).update(updates);
  closeModal('modalEditArbPago');
  showToast('Cobro actualizado', 'tg');
}

function eliminarCobroArb() {
  const key = document.getElementById('eap_key').value;
  if (!confirm('Â¿Eliminar este cobro de arbitraje?')) return;
  db.ref(`partidos/${key}`).update({ arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } }, arbPagado: false, sinArbitro: false });
  closeModal('modalEditArbPago');
  showToast('Cobro eliminado', 'tr');
}

function asignarArbitro(partKey) {
  const arbId = document.getElementById(`arb_sel_${partKey}`)?.value;
  if (!arbId) {
    showToast('Selecciona un Ã¡rbitro', 'ta');
    return;
  }
  const arbitro = C.arbitros[arbId];
  db.ref(`partidos/${partKey}`).update({ arbId, arbitroNombre: arbitro?.nombre || '', sinArbitro: false });
  showToast('Ãrbitro asignado', 'tg');
}

function editArbitro(key) {
  const arbitro = C.arbitros[key];
  if (!arbitro) return;
  document.getElementById('na_n').value = arbitro.nombre || '';
  document.getElementById('na_t').value = arbitro.tel || '';
  document.getElementById('na_f').value = arbitro.tarifa || 250;
  document.getElementById('arbModalTitle').textContent = 'Editar Ãrbitro';
  document.getElementById('na_n').dataset.editKey = key;
  openModal('modalNuevoArb');
}

function deleteArbitro(key) {
  if (!confirm('Â¿Eliminar este Ã¡rbitro?')) return;
  db.ref(`arbitros/${key}`).remove();
  showToast('Ãrbitro eliminado', 'tr');
}

function resetArbitrajes() {
  if (!confirm('âš ï¸ Â¿Reiniciar TODOS los cobros de arbitraje?')) return;
  const updates = {};
  getParts().forEach((partido) => {
    updates[`partidos/${partido._key}/arbPago`] = { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } };
    updates[`partidos/${partido._key}/arbPagado`] = false;
    updates[`partidos/${partido._key}/sinArbitro`] = false;
  });
  db.ref().update(updates);
  showToast('EstadÃ­sticas reiniciadas', 'ta');
}

function resetArbitrajesPeriodo() {
  const parts = getArbFilteredParts();
  if (!confirm(`Â¿Reiniciar cobros de ${parts.length} partido(s) del perÃ­odo seleccionado?`)) return;
  const updates = {};
  parts.forEach((partido) => {
    updates[`partidos/${partido._key}/arbPago`] = { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } };
    updates[`partidos/${partido._key}/arbPagado`] = false;
  });
  db.ref().update(updates);
  showToast(`${parts.length} cobros reiniciados`, 'ta');
}

function saveArbitro() {
  const nombre = document.getElementById('na_n').value.trim();
  if (!nombre) {
    showToast('Ingresa el nombre', 'ta');
    return;
  }
  const editKey = document.getElementById('na_n').dataset.editKey;
  const data = {
    nombre,
    tel: document.getElementById('na_t').value.trim(),
    tarifa: parseInt(document.getElementById('na_f').value, 10) || 250
  };
  if (editKey) {
    db.ref(`arbitros/${editKey}`).update(data);
    delete document.getElementById('na_n').dataset.editKey;
  } else {
    db.ref('arbitros').push(data);
  }
  closeModal('modalNuevoArb');
  ['na_n', 'na_t', 'na_f'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('arbModalTitle').textContent = 'Nuevo Ãrbitro';
  showToast(editKey ? 'Ãrbitro actualizado' : 'Ãrbitro registrado', 'tg');
}

function switchCHTab(tab) {
  document.getElementById('ch_arb_section').style.display = tab === 'arb' ? 'block' : 'none';
  document.getElementById('ch_trab_section').style.display = tab === 'trab' ? 'block' : 'none';
  document.getElementById('chTab_arb').className = tab === 'arb' ? 'btn btn-g btn-sm' : 'btn btn-out btn-sm';
  document.getElementById('chTab_trab').className = tab === 'trab' ? 'btn btn-g btn-sm' : 'btn btn-out btn-sm';
  document.getElementById('chTab_arb').style.flex = '1';
  document.getElementById('chTab_arb').style.padding = '10px';
  document.getElementById('chTab_trab').style.flex = '1';
  document.getElementById('chTab_trab').style.padding = '10px';
  if (tab === 'trab') renderTrabajadores();
  if (tab === 'arb') renderArbitros();
}

const getTrabs = () => Object.entries(C.trabajadores).map(([key, value]) => ({ ...value, _key: key }));
const getGastos = () => Object.entries(C.gastosTrab)
  .map(([key, value]) => ({ ...value, _key: key }))
  .filter((gasto) => canReadScopedRecord(gasto))
  .sort((a, b) => b.ts - a.ts);

let trabPeriodo = 'mes';
const ROL_NAMES = { tienda: 'ðŸ›’ Tiendita', herrero: 'ðŸ”§ Herrero', electricista: 'âš¡ Electricista', limpieza: 'ðŸ§¹ Limpieza', seguridad: 'ðŸ”’ Seguridad', otro: 'ðŸ“‹ Otro' };

function setTrabPeriodo(periodo) {
  trabPeriodo = periodo;
  ['hoy', '3dias', 'semana', 'mes', 'anual', 'todo'].forEach((x) => {
    const b = document.getElementById(`trabBtn_${x}`);
    if (b) b.className = x === periodo ? 'btn btn-g btn-sm' : 'btn btn-out btn-sm';
  });
  renderTrabajadores();
}

function getTrabFilteredGastos() {
  const all = getGastos();
  const now = new Date();
  const hoy = now.toISOString().split('T')[0];
  if (trabPeriodo === 'hoy') return all.filter((gasto) => gasto.fecha === hoy);
  if (trabPeriodo === '3dias') {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const f = d.toISOString().split('T')[0];
    return all.filter((gasto) => (gasto.fecha || '') >= f);
  }
  if (trabPeriodo === 'semana') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const f = d.toISOString().split('T')[0];
    return all.filter((gasto) => (gasto.fecha || '') >= f);
  }
  if (trabPeriodo === 'mes') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const f = d.toISOString().split('T')[0];
    return all.filter((gasto) => (gasto.fecha || '') >= f);
  }
  if (trabPeriodo === 'anual') {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const f = d.toISOString().split('T')[0];
    return all.filter((gasto) => (gasto.fecha || '') >= f);
  }
  return all;
}

function renderTrabajadores() {
  const trabs = getTrabs();
  const el = document.getElementById('trabajadoresList');
  if (!el) return;
  if (!trabs.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">ðŸ‘·</span>Sin trabajadores registrados</div>';
  } else {
    el.innerHTML = trabs.map((trabajador) => {
      const gastos = getGastos().filter((gasto) => gasto.trabajadorKey === trabajador._key);
      const totalPagado = gastos.filter((gasto) => gasto.metodo !== 'pendiente').reduce((sum, gasto) => sum + gasto.monto, 0);
      const pendiente = gastos.filter((gasto) => gasto.metodo === 'pendiente').reduce((sum, gasto) => sum + gasto.monto, 0);
      return `<div class="arb-card">
      <div class="arb-av">${ROL_NAMES[trabajador.rol]?.split(' ')[0] || 'ðŸ‘·'}</div>
      <div class="arb-info">
        <div class="arb-name">${trabajador.nombre}</div>
        <div class="arb-meta">${ROL_NAMES[trabajador.rol] || trabajador.rol} Â· ${trabajador.tel || ''}</div>
        ${trabajador.desc ? `<div class="arb-meta" style="font-style:italic">${trabajador.desc}</div>` : ''}
        ${pendiente > 0 ? `<div style="font-size:10px;font-weight:800;color:var(--amber);margin-top:2px">â³ $${pendiente} pendiente</div>` : ''}
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        <div class="arb-earned">$${totalPagado}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:700">PAGADO</div>
        <button class="btn btn-out btn-sm" onclick="editTrabajador('${trabajador._key}')">âœï¸</button>
        <button class="btn btn-r btn-sm" onclick="deleteTrabajador('${trabajador._key}')">ðŸ—‘ï¸</button>
      </div>
    </div>`;
    }).join('');
  }

  const sel = document.getElementById('gasto_trab_sel');
  if (sel) {
    sel.innerHTML = '<option value="">â€” Seleccionar â€”</option>' + trabs.map((trabajador) => `<option value="${trabajador._key}">${trabajador.nombre} (${ROL_NAMES[trabajador.rol] || trabajador.rol})</option>`).join('');
  }

  const gastosFilt = getTrabFilteredGastos();
  const totalPer = gastosFilt.reduce((sum, gasto) => sum + gasto.monto, 0);
  const pendPer = gastosFilt.filter((gasto) => gasto.metodo === 'pendiente').reduce((sum, gasto) => sum + gasto.monto, 0);
  const resEl = document.getElementById('resumenTrabajadores');
  if (resEl) {
    resEl.innerHTML = `
    <div class="money-row"><span class="money-lbl">ðŸ’µ Total pagado en perÃ­odo</span><span class="money-val">$${totalPer - pendPer}</span></div>
    <div class="money-row"><span class="money-lbl">â³ Pendiente de pago</span><span class="money-val" style="color:var(--amber)">$${pendPer}</span></div>
    <div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Total gasto trabajadores</span><span class="money-val">$${totalPer}</span></div>`;
  }

  const histEl = document.getElementById('historialGastosTrab');
  if (histEl) {
    if (!gastosFilt.length) {
      histEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">Sin pagos en este perÃ­odo</div>';
      return;
    }
    histEl.innerHTML = gastosFilt.map((gasto) => {
      const trab = C.trabajadores[gasto.trabajadorKey];
      return `<div class="pago-row">
        <div class="pago-info">
          <div class="pago-match">${trab?.nombre || 'â€”'} Â· ${gasto.concepto || 'Sin concepto'}</div>
          <div class="pago-meta">ðŸ“… ${fmtDate(gasto.fecha)} Â· ${gasto.metodo === 'efectivo' ? 'ðŸ’µ Efectivo' : gasto.metodo === 'transferencia' ? 'ðŸ“± Transferencia' : 'â³ Pendiente'}${gasto.notas ? ' Â· ' + gasto.notas : ''}</div>
        </div>
        <span class="pago-amt">$${gasto.monto}</span>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${gasto.metodo === 'pendiente' ? `<button class="btn btn-g btn-sm" onclick="marcarGastoPagado('${gasto._key}')">âœ“ Pagar</button>` : ''}
          <button class="btn btn-r btn-sm" onclick="deleteGastoTrab('${gasto._key}')">ðŸ—‘ï¸</button>
        </div>
      </div>`;
    }).join('');
  }
  const fd = document.getElementById('gasto_fecha');
  if (fd && !fd.value) fd.value = new Date().toISOString().split('T')[0];
}

function saveTrabajador() {
  const nombre = document.getElementById('nt_nombre').value.trim();
  if (!nombre) {
    showToast('Ingresa el nombre', 'ta');
    return;
  }
  const key = document.getElementById('nt_key').value;
  const data = {
    nombre,
    rol: document.getElementById('nt_rol').value,
    desc: document.getElementById('nt_desc').value.trim(),
    tel: document.getElementById('nt_tel').value.trim(),
    pago: parseInt(document.getElementById('nt_pago').value, 10) || 0,
    updatedAt: Date.now()
  };
  if (key) db.ref(`trabajadores/${key}`).update(data);
  else db.ref('trabajadores').push({ ...data, creadoAt: Date.now() });
  closeModal('modalNuevoTrab');
  ['nt_nombre', 'nt_desc', 'nt_tel', 'nt_pago', 'nt_key'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('trabModalTitle').textContent = 'ðŸ‘· Nuevo Trabajador';
  showToast(key ? 'Trabajador actualizado' : 'Trabajador registrado', 'tg');
}

function editTrabajador(key) {
  const trabajador = C.trabajadores[key];
  if (!trabajador) return;
  document.getElementById('nt_key').value = key;
  document.getElementById('nt_nombre').value = trabajador.nombre || '';
  document.getElementById('nt_rol').value = trabajador.rol || 'otro';
  document.getElementById('nt_desc').value = trabajador.desc || '';
  document.getElementById('nt_tel').value = trabajador.tel || '';
  document.getElementById('nt_pago').value = trabajador.pago || 0;
  document.getElementById('trabModalTitle').textContent = 'âœï¸ Editar Trabajador';
  openModal('modalNuevoTrab');
}

function deleteTrabajador(key) {
  if (!confirm('Â¿Eliminar este trabajador?')) return;
  db.ref(`trabajadores/${key}`).remove();
  showToast('Trabajador eliminado', 'tr');
}

function registrarGastoTrab() {
  const trabKey = document.getElementById('gasto_trab_sel').value;
  if (!trabKey) {
    showToast('Selecciona un trabajador', 'ta');
    return;
  }
  const monto = parseInt(document.getElementById('gasto_monto').value, 10) || 0;
  if (!monto) {
    showToast('Ingresa el monto', 'ta');
    return;
  }
  db.ref('gastosTrab').push({
    trabajadorKey: trabKey,
    concepto: document.getElementById('gasto_concepto').value.trim(),
    monto,
    torneo: currentTorneo,
    cat: currentCat,
    fecha: document.getElementById('gasto_fecha').value,
    metodo: document.getElementById('gasto_metodo').value,
    notas: document.getElementById('gasto_notas').value.trim(),
    ts: Date.now()
  });
  ['gasto_concepto', 'gasto_monto', 'gasto_notas'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('gasto_trab_sel').value = '';
  showToast('Pago registrado', 'tg');
}

function marcarGastoPagado(key) {
  db.ref(`gastosTrab/${key}/metodo`).set('efectivo');
  showToast('Marcado como pagado', 'tg');
}

function deleteGastoTrab(key) {
  if (!confirm('Â¿Eliminar este registro de pago?')) return;
  db.ref(`gastosTrab/${key}`).remove();
  showToast('Registro eliminado', 'tr');
}

