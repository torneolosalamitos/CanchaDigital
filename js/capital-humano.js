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
    el.innerHTML = '<div class="empty"><span class="empty-icon">🦺</span>Sin árbitros</div>';
  } else {
    el.innerHTML = arbs.map((arbitro) => {
      const partidos = getArbFilteredParts().filter((partido) => partido.arbId === arbitro._key);
      const cobrado = partidos.reduce((sum, partido) => {
        const pago = partido.arbPago || {};
        return sum + (pago.local?.ef || 0) + (pago.local?.tr || 0) + (pago.local?.pp || 0) + (pago.visita?.ef || 0) + (pago.visita?.tr || 0) + (pago.visita?.pp || 0);
      }, 0);
      const sinCobrar = partidos.filter((partido) => !partido.sinArbitro && !partido.arbPagado).length;
      return `<div class="arb-card">
      <div class="arb-av">🦺</div>
      <div class="arb-info">
        <div class="arb-name">${arbitro.nombre}</div>
        <div class="arb-meta">📞 ${arbitro.tel || '—'} · $${arbitro.tarifa || 250}/partido · ${partidos.length} partidos</div>
        ${sinCobrar > 0 ? `<div style="font-size:10px;font-weight:800;color:var(--amber);margin-top:2px">⚠️ ${sinCobrar} partido(s) sin cobrar</div>` : '<div style="font-size:10px;font-weight:800;color:var(--acc);margin-top:2px">✅ Al corriente</div>'}
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        <div class="arb-earned">$${cobrado}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:700">COBRADO</div>
        <button class="btn btn-out btn-sm" onclick="editArbitro('${arbitro._key}')">✏️ Editar</button>
        <button class="btn btn-r btn-sm" onclick="deleteArbitro('${arbitro._key}')">🗑️</button>
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
    </div>    <div class="money-row"><span class="money-lbl">📊 Partidos en período</span><span class="money-val" style="color:var(--blue)">${parts.length}</span></div>
    ${sinArb > 0 ? `<div class="money-row"><span class="money-lbl">🚫 Sin cobro de árbitro</span><span class="money-val" style="color:var(--muted)">${sinArb}</span></div>` : ''}
    <div class="money-row"><span class="money-lbl">💵 Efectivo</span><span class="money-val">$${totalEf}</span></div>
    <div class="money-row"><span class="money-lbl">📱 Transferencia</span><span class="money-val">$${totalTr}</span></div>
    <div class="money-row"><span class="money-lbl">✅ Prepago</span><span class="money-val">$${totalPp}</span></div>
    <div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Total cobrado</span><span class="money-val" style="font-size:22px">$${totalDia}</span></div>
    <div class="money-row"><span class="money-lbl">🦺 Pago a árbitros</span><span class="money-val" style="color:var(--red)">−$${gastoArbs}</span></div>
    <div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Ganancia neta</span><span class="money-val" style="color:var(--acc);font-size:22px">$${totalDia - gastoArbs}</span></div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-r btn-sm" onclick="resetArbitrajes()">🗑️ Reiniciar estadísticas</button>
      <button class="btn btn-out btn-sm" onclick="resetArbitrajesPeriodo()">🗑️ Solo este período</button>
    </div>`;
  }

  const editEl = document.getElementById('editCobrosArb');
  if (editEl) {
    if (!conCobro.length) {
      editEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">Sin cobros en este período</div>';
    } else {
      editEl.innerHTML = conCobro.map((partido) => {
        const arbitro = partido.arbId ? C.arbitros[partido.arbId] : null;
        const cobL = (partido.arbPago?.local?.ef || 0) + (partido.arbPago?.local?.tr || 0) + (partido.arbPago?.local?.pp || 0);
        const cobV = (partido.arbPago?.visita?.ef || 0) + (partido.arbPago?.visita?.tr || 0) + (partido.arbPago?.visita?.pp || 0);
        return `<div class="pago-row">
        <div class="pago-info">
          <div class="pago-match">${partido.localNombre || partido.local} vs ${partido.visitaNombre || partido.visita}</div>
          <div class="pago-meta">📅 ${fmtDate(partido.fecha)} · 🦺 ${arbitro?.nombre || 'Sin árbitro'}</div>
          <div class="pago-meta">Local: $${cobL} · Visita: $${cobV}</div>
        </div>
        <button class="btn btn-out btn-sm" onclick="openEditArbPago('${partido._key}')">✏️ Editar</button>
      </div>`;
      }).join('');
    }
  }

  const sinArbAsign = getParts().filter((partido) => partido.status === 'terminado' && !partido.arbId && !partido.sinArbitro);
  const asignEl = document.getElementById('asignacionArb');
  if (asignEl) {
    if (!sinArbAsign.length) {
      asignEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">✅ Todos los partidos tienen árbitro asignado</div>';
    } else {
      asignEl.innerHTML = sinArbAsign.map((partido) => `<div class="pago-row">
      <div class="pago-info"><div class="pago-match">${partido.localNombre || partido.local} vs ${partido.visitaNombre || partido.visita}</div><div class="pago-meta">📅 ${fmtDate(partido.fecha)}</div></div>
      <select class="fi" id="arb_sel_${partido._key}" style="max-width:120px;font-size:11px;padding:4px 6px">
        <option value="">— Árbitro —</option>
        ${arbs.map((arbitro) => `<option value="${arbitro._key}">${arbitro.nombre}</option>`).join('')}
      </select>
      <button class="btn btn-g btn-sm" onclick="asignarArbitro('${partido._key}')">✓</button>
      <button class="btn btn-out btn-sm" onclick="marcarSinArbitro('${partido._key}')" title="Sin cobro de árbitro">🚫</button>
    </div>`).join('');
    }
  }

  const pendientes = getArbFilteredParts().filter((partido) => partido.arbId && !partido.arbPagado && !partido.sinArbitro);
  const pp = document.getElementById('pagosPend');
  if (!pp) return;
  if (!pendientes.length) {
    pp.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">✅ Sin pagos pendientes</div>';
    return;
  }
  pp.innerHTML = pendientes.map((partido) => {
    const arbitro = C.arbitros[partido.arbId];
    return `<div class="pago-row">
    <div class="pago-info"><div class="pago-match">${partido.localNombre || partido.local} vs ${partido.visitaNombre || partido.visita}</div><div class="pago-meta">🦺 ${arbitro ? arbitro.nombre : 'N/A'} · ${fmtDate(partido.fecha)} · $${partido.costArb || 250}/eq</div></div>
    <button class="btn btn-g btn-sm" onclick="activePartidoKey='${partido._key}';initPagoArb();openModal('modalPagoArb')">Pagar</button>
    <button class="btn btn-out btn-sm" onclick="openEditArbPago('${partido._key}')">✏️</button>
  </div>`;
  }).join('');
}

async function marcarSinArbitro(key) {
  const patch = { sinArbitro: true, arbId: null, arbitroNombre: null };
  if (fs) await updateDoc('partidos', key, patch);
  else await db.ref(`partidos/${key}`).update(patch);
  showToast('Marcado sin cobro de árbitro', 'ta');
}

function openEditArbPago(key) {
  const partido = C.partidos[key];
  if (!partido) return;
  document.getElementById('eap_key').value = key;
  document.getElementById('eap_sin_arb').checked = !!partido.sinArbitro;
  document.getElementById('eap_form').style.display = partido.sinArbitro ? 'none' : 'block';
  document.getElementById('eap_costo_l').value = partido.costArb || 250;
  document.getElementById('eap_costo_v').value = partido.costArb || 250;
  document.getElementById('eap_local_title').textContent = `🏠 ${partido.localNombre || partido.local}`;
  document.getElementById('eap_visita_title').textContent = `✈️ ${partido.visitaNombre || partido.visita}`;
  document.getElementById('eap_info').innerHTML = `⚽ <strong>${partido.localNombre || partido.local}</strong> vs <strong>${partido.visitaNombre || partido.visita}</strong><br/><span style="color:var(--muted);font-size:11px">📅 ${fmtDate(partido.fecha)} · 🏟️ ${partido.cancha || '—'}</span>`;
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

async function guardarEditArbPago() {
  const key = document.getElementById('eap_key').value;
  const sinArb = document.getElementById('eap_sin_arb').checked;
  if (sinArb) {
    const patch = { sinArbitro: true, arbPagado: false, arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } } };
    if (fs) await updateDoc('partidos', key, patch);
    else await db.ref(`partidos/${key}`).update(patch);
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
  const arbPago = { ...(C.partidos[key]?.arbPago || {}) };
  if (lp) {
    updates['arbPago/local'] = lp;
    arbPago.local = lp;
  }
  if (vp) {
    updates['arbPago/visita'] = vp;
    arbPago.visita = vp;
  }
  if (lp && vp) updates.arbPagado = true;
  if (fs) {
    const patch = { sinArbitro: false, costArb: costoL };
    if (lp || vp) patch.arbPago = arbPago;
    if (lp && vp) patch.arbPagado = true;
    await updateDoc('partidos', key, patch);
  } else {
    await db.ref(`partidos/${key}`).update(updates);
  }
  closeModal('modalEditArbPago');
  showToast('Cobro actualizado', 'tg');
}

async function eliminarCobroArb() {
  const key = document.getElementById('eap_key').value;
  if (!confirm('¿Eliminar este cobro de arbitraje?')) return;
  const patch = { arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } }, arbPagado: false, sinArbitro: false };
  if (fs) await updateDoc('partidos', key, patch);
  else await db.ref(`partidos/${key}`).update(patch);
  closeModal('modalEditArbPago');
  showToast('Cobro eliminado', 'tr');
}

async function asignarArbitro(partKey) {
  const arbId = document.getElementById(`arb_sel_${partKey}`)?.value;
  if (!arbId) {
    showToast('Selecciona un árbitro', 'ta');
    return;
  }
  const arbitro = C.arbitros[arbId];
  const patch = { arbId, arbitroNombre: arbitro?.nombre || '', sinArbitro: false };
  if (fs) await updateDoc('partidos', partKey, patch);
  else await db.ref(`partidos/${partKey}`).update(patch);
  showToast('Árbitro asignado', 'tg');
}

function editArbitro(key) {
  const arbitro = C.arbitros[key];
  if (!arbitro) return;
  document.getElementById('na_n').value = arbitro.nombre || '';
  document.getElementById('na_t').value = arbitro.tel || '';
  document.getElementById('na_f').value = arbitro.tarifa || 250;
  document.getElementById('arbModalTitle').textContent = 'Editar Árbitro';
  document.getElementById('na_n').dataset.editKey = key;
  openModal('modalNuevoArb');
}

async function deleteArbitro(key) {
  if (!confirm('¿Eliminar este árbitro?')) return;
  if (fs) await deleteDoc('arbitros', key);
  else await db.ref(`arbitros/${key}`).remove();
  showToast('Árbitro eliminado', 'tr');
}

async function resetArbitrajes() {
  if (!confirm('⚠️ ¿Reiniciar TODOS los cobros de arbitraje?')) return;
  if (fs) {
    const batch = fs.batch();
    getParts().forEach((partido) => {
      batch.set(fs.collection('partidos').doc(partido._key), {
        arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } },
        arbPagado: false,
        sinArbitro: false,
        actualizadoEn: firestoreServerTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  } else {
    const updates = {};
    getParts().forEach((partido) => {
      updates[`partidos/${partido._key}/arbPago`] = { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } };
      updates[`partidos/${partido._key}/arbPagado`] = false;
      updates[`partidos/${partido._key}/sinArbitro`] = false;
    });
    await db.ref().update(updates);
  }
  showToast('Estadísticas reiniciadas', 'ta');
}

async function resetArbitrajesPeriodo() {
  const parts = getArbFilteredParts();
  if (!confirm(`¿Reiniciar cobros de ${parts.length} partido(s) del período seleccionado?`)) return;
  if (fs) {
    const batch = fs.batch();
    parts.forEach((partido) => {
      batch.set(fs.collection('partidos').doc(partido._key), {
        arbPago: { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } },
        arbPagado: false,
        actualizadoEn: firestoreServerTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  } else {
    const updates = {};
    parts.forEach((partido) => {
      updates[`partidos/${partido._key}/arbPago`] = { local: { ef: 0, tr: 0, pp: 0 }, visita: { ef: 0, tr: 0, pp: 0 } };
      updates[`partidos/${partido._key}/arbPagado`] = false;
    });
    await db.ref().update(updates);
  }
  showToast(`${parts.length} cobros reiniciados`, 'ta');
}

async function saveArbitro() {
  const nombre = document.getElementById('na_n').value.trim();
  if (!nombre) {
    showToast('Ingresa el nombre', 'ta');
    return;
  }
  const editKey = document.getElementById('na_n').dataset.editKey;
  const data = scopedPayload({
    nombre,
    tel: document.getElementById('na_t').value.trim(),
    tarifa: parseInt(document.getElementById('na_f').value, 10) || 250,
    torneo: currentTorneo,
    cat: currentCat
  });
  if (editKey) {
    if (fs) await saveDoc('arbitros', editKey, data);
    else await db.ref(`arbitros/${editKey}`).update(data);
    delete document.getElementById('na_n').dataset.editKey;
  } else {
    if (fs) await saveDoc('arbitros', newDocId('arbitro', nombre), data);
    else await db.ref('arbitros').push(data);
  }
  closeModal('modalNuevoArb');
  ['na_n', 'na_t', 'na_f'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('arbModalTitle').textContent = 'Nuevo Árbitro';
  showToast(editKey ? 'Árbitro actualizado' : 'Árbitro registrado', 'tg');
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
const ROL_NAMES = { tienda: '🛒 Tiendita', herrero: '🔧 Herrero', electricista: '⚡ Electricista', limpieza: '🧹 Limpieza', seguridad: '🔒 Seguridad', otro: '📋 Otro' };

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
    el.innerHTML = '<div class="empty"><span class="empty-icon">👷</span>Sin trabajadores registrados</div>';
  } else {
    el.innerHTML = trabs.map((trabajador) => {
      const gastos = getGastos().filter((gasto) => gasto.trabajadorKey === trabajador._key);
      const totalPagado = gastos.filter((gasto) => gasto.metodo !== 'pendiente').reduce((sum, gasto) => sum + gasto.monto, 0);
      const pendiente = gastos.filter((gasto) => gasto.metodo === 'pendiente').reduce((sum, gasto) => sum + gasto.monto, 0);
      return `<div class="arb-card">
      <div class="arb-av">${ROL_NAMES[trabajador.rol]?.split(' ')[0] || '👷'}</div>
      <div class="arb-info">
        <div class="arb-name">${trabajador.nombre}</div>
        <div class="arb-meta">${ROL_NAMES[trabajador.rol] || trabajador.rol} · ${trabajador.tel || ''}</div>
        ${trabajador.desc ? `<div class="arb-meta" style="font-style:italic">${trabajador.desc}</div>` : ''}
        ${pendiente > 0 ? `<div style="font-size:10px;font-weight:800;color:var(--amber);margin-top:2px">⏳ $${pendiente} pendiente</div>` : ''}
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        <div class="arb-earned">$${totalPagado}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:700">PAGADO</div>
        <button class="btn btn-out btn-sm" onclick="editTrabajador('${trabajador._key}')">✏️</button>
        <button class="btn btn-r btn-sm" onclick="deleteTrabajador('${trabajador._key}')">🗑️</button>
      </div>
    </div>`;
    }).join('');
  }

  const sel = document.getElementById('gasto_trab_sel');
  if (sel) {
    sel.innerHTML = '<option value="">— Seleccionar —</option>' + trabs.map((trabajador) => `<option value="${trabajador._key}">${trabajador.nombre} (${ROL_NAMES[trabajador.rol] || trabajador.rol})</option>`).join('');
  }

  const gastosFilt = getTrabFilteredGastos();
  const totalPer = gastosFilt.reduce((sum, gasto) => sum + gasto.monto, 0);
  const pendPer = gastosFilt.filter((gasto) => gasto.metodo === 'pendiente').reduce((sum, gasto) => sum + gasto.monto, 0);
  const resEl = document.getElementById('resumenTrabajadores');
  if (resEl) {
    resEl.innerHTML = `
    <div class="money-row"><span class="money-lbl">💵 Total pagado en período</span><span class="money-val">$${totalPer - pendPer}</span></div>
    <div class="money-row"><span class="money-lbl">⏳ Pendiente de pago</span><span class="money-val" style="color:var(--amber)">$${pendPer}</span></div>
    <div class="money-row total-row"><span class="money-lbl" style="font-weight:800">Total gasto trabajadores</span><span class="money-val">$${totalPer}</span></div>`;
  }

  const histEl = document.getElementById('historialGastosTrab');
  if (histEl) {
    if (!gastosFilt.length) {
      histEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;font-weight:600">Sin pagos en este período</div>';
      return;
    }
    histEl.innerHTML = gastosFilt.map((gasto) => {
      const trab = C.trabajadores[gasto.trabajadorKey];
      return `<div class="pago-row">
        <div class="pago-info">
          <div class="pago-match">${trab?.nombre || '—'} · ${gasto.concepto || 'Sin concepto'}</div>
          <div class="pago-meta">📅 ${fmtDate(gasto.fecha)} · ${gasto.metodo === 'efectivo' ? '💵 Efectivo' : gasto.metodo === 'transferencia' ? '📱 Transferencia' : '⏳ Pendiente'}${gasto.notas ? ' · ' + gasto.notas : ''}</div>
        </div>
        <span class="pago-amt">$${gasto.monto}</span>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${gasto.metodo === 'pendiente' ? `<button class="btn btn-g btn-sm" onclick="marcarGastoPagado('${gasto._key}')">✓ Pagar</button>` : ''}
          <button class="btn btn-r btn-sm" onclick="deleteGastoTrab('${gasto._key}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }
  const fd = document.getElementById('gasto_fecha');
  if (fd && !fd.value) fd.value = new Date().toISOString().split('T')[0];
}

async function saveTrabajador() {
  const nombre = document.getElementById('nt_nombre').value.trim();
  if (!nombre) {
    showToast('Ingresa el nombre', 'ta');
    return;
  }
  const key = document.getElementById('nt_key').value;
  const data = scopedPayload({
    nombre,
    rol: document.getElementById('nt_rol').value,
    desc: document.getElementById('nt_desc').value.trim(),
    tel: document.getElementById('nt_tel').value.trim(),
    pago: parseInt(document.getElementById('nt_pago').value, 10) || 0,
    torneo: currentTorneo,
    cat: currentCat,
    updatedAt: Date.now()
  });
  if (fs) await saveDoc('trabajadores', key || newDocId('trabajador', nombre), key ? data : { ...data, creadoAt: Date.now() });
  else if (key) await db.ref(`trabajadores/${key}`).update(data);
  else await db.ref('trabajadores').push({ ...data, creadoAt: Date.now() });
  closeModal('modalNuevoTrab');
  ['nt_nombre', 'nt_desc', 'nt_tel', 'nt_pago', 'nt_key'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('trabModalTitle').textContent = '👷 Nuevo Trabajador';
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
  document.getElementById('trabModalTitle').textContent = '✏️ Editar Trabajador';
  openModal('modalNuevoTrab');
}

async function deleteTrabajador(key) {
  if (!confirm('¿Eliminar este trabajador?')) return;
  if (fs) await deleteDoc('trabajadores', key);
  else await db.ref(`trabajadores/${key}`).remove();
  showToast('Trabajador eliminado', 'tr');
}

async function registrarGastoTrab() {
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
  const data = scopedPayload({
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
  if (fs) await saveDoc('gastosTrab', newDocId('gasto_trab', `${trabKey}_${Date.now()}`), data);
  else await db.ref('gastosTrab').push(data);
  ['gasto_concepto', 'gasto_monto', 'gasto_notas'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('gasto_trab_sel').value = '';
  showToast('Pago registrado', 'tg');
}

async function marcarGastoPagado(key) {
  if (fs) await updateDoc('gastosTrab', key, { metodo: 'efectivo' });
  else await db.ref(`gastosTrab/${key}/metodo`).set('efectivo');
  showToast('Marcado como pagado', 'tg');
}

async function deleteGastoTrab(key) {
  if (!confirm('¿Eliminar este registro de pago?')) return;
  if (fs) await deleteDoc('gastosTrab', key);
  else await db.ref(`gastosTrab/${key}`).remove();
  showToast('Registro eliminado', 'tr');
}

