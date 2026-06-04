function renderTienda() {
  renderTiendaStats();
  renderPOS();
  renderInventario();
  renderHistorialVentas();
  renderGastosTienda();
  renderTurnoUI();
}

function renderTiendaStats() {
  const ventas = getVentas();
  const totalVentas = ventas.reduce((sum, venta) => sum + venta.total, 0);
  const itemsTotal = ventas.reduce((sum, venta) => sum + (venta.items || []).reduce((acc, item) => acc + item.qty, 0), 0);
  const lowStock = getProd().filter((producto) => producto.stock <= 5).length;
  const el = document.getElementById('tiendaStats');
  if (el) {
    el.innerHTML = `
    <div class="stat-box sb-teal"><div class="sn" style="color:var(--teal)">$${totalVentas}</div><div class="sl2">Ventas hoy</div></div>
    <div class="stat-box sb-purple"><div class="sn" style="color:var(--purple)">${itemsTotal}</div><div class="sl2">Vendidos</div></div>
    <div class="stat-box sb-red"><div class="sn" style="color:var(--red)">${lowStock}</div><div class="sl2">Stock bajo</div></div>`;
  }
}

function renderPOS() {
  const el = document.getElementById('posGrid');
  if (!el) return;
  el.innerHTML = getProd().map((producto) => `
    <div class="pos-item ${producto.stock <= 5 ? 'low' : ''}" onclick="addToCart('${producto._key}')">
      ${producto.stock <= 5 ? '<div class="low-dot"></div>' : ''}
      ${producto.imagen ? `<img class="pi-img" src="${producto.imagen}"/>` : `<span class="pi-em">${producto.emoji || '📦'}</span>`}
      <div class="pi-n">${producto.nombre}</div>
      <div class="pi-p">$${producto.precio}</div>
      <div class="pi-s">${producto.stock} pzs</div>
    </div>`).join('');
}

function addToCart(key) {
  const producto = C.productos[key];
  if (!producto || producto.stock === 0) {
    showToast('Sin stock', 'tr');
    return;
  }
  const existing = cart.find((item) => item.key === key);
  if (existing) {
    if (existing.qty >= producto.stock) {
      showToast('Stock agotado', 'tr');
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      key,
      imagen: producto.imagen,
      emoji: producto.emoji,
      nombre: producto.nombre,
      precio: producto.precio,
      qty: 1
    });
  }
  renderCart();
  showToast(`${producto.emoji || '📦'} ${producto.nombre} +1`, 'tg');
}

function changeQty(key, delta) {
  const idx = cart.findIndex((item) => item.key === key);
  if (idx < 0) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCart();
}

function clearCart() {
  cart.length = 0;
  renderCart();
}

function renderCart() {
  const el = document.getElementById('cartItems');
  if (!el) return;
  if (!cart.length) {
    el.innerHTML = '<div class="cart-empty-msg">Toca un producto para agregarlo</div>';
    document.getElementById('cartTotal').textContent = '$0';
    return;
  }
  el.innerHTML = cart.map((item) => `
    <div class="cart-item">
      ${item.imagen ? `<img class="ci-img" src="${item.imagen}"/>` : `<span class="ci-em">${item.emoji || '📦'}</span>`}
      <div class="ci-info"><div class="ci-name">${item.nombre}</div><div class="ci-sub">$${item.precio} × ${item.qty} = $${item.precio * item.qty}</div></div>
      <div class="ci-qty">
        <button class="qty-btn" onclick="changeQty('${item.key}',-1)">−</button>
        <span class="qty-n">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.key}',1)">+</button>
      </div>
    </div>`).join('');
  document.getElementById('cartTotal').textContent = `$${cart.reduce((sum, item) => sum + item.precio * item.qty, 0)}`;
}

function cobrar() {
  if (!cart.length) {
    showToast('Carrito vacío', 'tr');
    return;
  }
  const total = cart.reduce((sum, item) => sum + item.precio * item.qty, 0);
  const updates = {};
  cart.forEach((item) => {
    const producto = C.productos[item.key];
    if (producto) updates[`productos/${item.key}/stock`] = Math.max(0, producto.stock - item.qty);
  });
  db.ref().update(updates);
  const now = new Date();
  const fecha = now.toISOString().split('T')[0];
  const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const turnoActivo = Object.entries(C.turnos || {}).find(([, turno]) => turno.activo);
  const turnoKey = turnoActivo ? turnoActivo[0] : null;
  db.ref('ventas').push({
    hora,
    fecha,
    fechaHoraFin: null,
    items: cart.map((item) => ({ emoji: item.emoji || '📦', nombre: item.nombre, precio: item.precio, qty: item.qty })),
    total,
    ts: Date.now(),
    nota: '',
    turnoKey
  });
  if (turnoKey) {
    db.ref(`turnos/${turnoKey}/ventasCount`).transaction((count) => (count || 0) + 1);
    db.ref(`turnos/${turnoKey}/ventasTotal`).transaction((amount) => (amount || 0) + total);
  }
  showToast(`Cobrado $${total}`, 'tg');
  cart.length = 0;
  renderCart();
}

function renderInventario() {
  const el = document.getElementById('inventarioList');
  if (!el) return;
  const productos = getProd();
  if (!productos.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">📦</span>Sin productos</div>';
    return;
  }
  el.innerHTML = productos.map((producto) => `
    <div class="inv-row">
      ${producto.imagen ? `<img class="inv-img" src="${producto.imagen}"/>` : `<span class="inv-em">${producto.emoji || '📦'}</span>`}
      <div class="inv-info"><div class="inv-name">${producto.nombre}</div><div class="inv-det">$${producto.precio} · ${producto.stock} pzs</div></div>
      <div class="inv-ctrl">
        <input class="inv-adj" id="adj_${producto._key}" type="number" value="5" min="1"/>
        <button class="btn btn-out btn-sm" onclick="adjStock('${producto._key}',1)">+</button>
        <button class="btn btn-out btn-sm" onclick="adjStock('${producto._key}',-1)">−</button>
        <button class="btn btn-out btn-sm" onclick="editProd('${producto._key}')">✏️</button>
        <button class="btn btn-r btn-sm" onclick="deleteProd('${producto._key}')">🗑️</button>
      </div>
    </div>`).join('');
}

function adjStock(key, sign) {
  const producto = C.productos[key];
  if (!producto) return;
  const amount = parseInt(document.getElementById('adj_' + key)?.value, 10) || 5;
  db.ref(`productos/${key}/stock`).set(Math.max(0, producto.stock + (sign * amount)));
}

function editProd(key) {
  const producto = C.productos[key];
  if (!producto) return;
  document.getElementById('prod_key').value = key;
  document.getElementById('prodModalTitle').textContent = 'Editar Producto';
  document.getElementById('prod_nombre').value = producto.nombre || '';
  document.getElementById('prod_emoji').value = producto.emoji || '';
  document.getElementById('prod_precio').value = producto.precio || '';
  document.getElementById('prod_stock').value = producto.stock || 0;
  document.getElementById('prod_img').value = producto.imagen || '';
  if (producto.imagen) {
    const preview = document.getElementById('prod_img_prev');
    preview.src = producto.imagen;
    preview.style.display = 'block';
    document.getElementById('prod_img_lbl').style.display = 'none';
  }
  openModal('modalAddProd');
}

function deleteProd(key) {
  if (!confirm('¿Eliminar producto?')) return;
  db.ref(`productos/${key}`).remove();
  showToast('Producto eliminado', 'tr');
}

function saveProd() {
  const nombre = document.getElementById('prod_nombre').value.trim();
  const precio = parseInt(document.getElementById('prod_precio').value, 10) || 0;
  if (!nombre || precio <= 0) {
    showToast('Nombre y precio requeridos', 'ta');
    return;
  }
  const key = document.getElementById('prod_key').value;
  const data = {
    nombre,
    emoji: document.getElementById('prod_emoji').value.trim() || '📦',
    precio,
    stock: parseInt(document.getElementById('prod_stock').value, 10) || 0,
    imagen: document.getElementById('prod_img').value || null
  };
  if (key) db.ref(`productos/${key}`).update(data);
  else db.ref('productos').push(data);
  closeModal('modalAddProd');
  document.getElementById('prod_key').value = '';
  document.getElementById('prodModalTitle').textContent = 'Nuevo Producto';
  ['prod_nombre', 'prod_emoji', 'prod_precio', 'prod_stock', 'prod_img'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  document.getElementById('prod_img_prev').style.display = 'none';
  document.getElementById('prod_img_lbl').style.display = 'block';
  showToast(key ? 'Producto actualizado' : 'Producto agregado', 'tg');
}

function renderHistorialVentas() {
  const el = document.getElementById('historialVentas');
  if (!el) return;
  const dDesde = document.getElementById('vt_desde_fecha');
  const dHasta = document.getElementById('vt_hasta_fecha');
  if (dDesde && !dDesde.value) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    dDesde.value = d.toISOString().split('T')[0];
  }
  if (dHasta && !dHasta.value) dHasta.value = new Date().toISOString().split('T')[0];
  const desde = dDesde?.value || '';
  const hasta = dHasta?.value || '';
  const desdeH = (document.getElementById('vt_desde_hora')?.value || '00:00').substring(0, 5);
  const hastaH = (document.getElementById('vt_hasta_hora')?.value || '23:59').substring(0, 5);
  let ventas = getVentas();
  if (desde || hasta) {
    ventas = ventas.filter((venta) => {
      const fecha = venta.fecha || '';
      const hora = (venta.hora || '00:00').substring(0, 5);
      if (!fecha) return true;
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      if (desde && fecha === desde && hora < desdeH) return false;
      if (hasta && fecha === hasta && hora > hastaH) return false;
      return true;
    });
  }
  if (!ventas.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">🧾</span>Sin ventas en este período</div>';
    return;
  }
  const byDate = {};
  ventas.forEach((venta) => {
    const fecha = venta.fecha || 'Sin fecha';
    if (!byDate[fecha]) byDate[fecha] = [];
    byDate[fecha].push(venta);
  });
  let out = '';
  Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach((fecha) => {
    const dayVentas = byDate[fecha];
    const total = dayVentas.reduce((sum, venta) => sum + (venta.total || 0), 0);
    out += `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0 3px;border-bottom:1px solid var(--border2);margin-bottom:4px">
      <span style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--acc)">📅 ${fmtDate(fecha)}</span>
      <span style="font-size:10px;font-weight:700;color:var(--muted)">${dayVentas.length} venta${dayVentas.length !== 1 ? 's' : ''} · $${total}</span>
    </div>`;
    out += dayVentas.map((venta) => {
      const horaStr = venta.hora || '';
      return `<div class="venta-row">
        <div style="flex:1">
          <div class="v-hora">${horaStr}${venta.fechaHoraFin ? ' → ' + venta.fechaHoraFin : ''}</div>
          <div class="v-items">${(venta.items || []).map((item) => `${item.emoji || '📦'}×${item.qty}`).join('  ')}${venta.nota ? ` — ${venta.nota}` : ''}</div>
        </div>
        <div class="v-monto">$${venta.total}</div>
        <div class="v-actions">
          <button class="btn btn-out btn-sm" onclick="openEditVentaFecha('${venta._key}')" title="Editar fecha/hora">📅</button>
          <button class="btn btn-out btn-sm" onclick="openEditVenta('${venta._key}')">✏️</button>
          <button class="btn btn-r btn-sm" onclick="deleteVenta('${venta._key}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  });
  el.innerHTML = out;
}

function resetVentasFilter() {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const dDesde = document.getElementById('vt_desde_fecha');
  if (dDesde) dDesde.value = d.toISOString().split('T')[0];
  const dHasta = document.getElementById('vt_hasta_fecha');
  if (dHasta) dHasta.value = new Date().toISOString().split('T')[0];
  const hDesde = document.getElementById('vt_desde_hora');
  if (hDesde) hDesde.value = '';
  const hHasta = document.getElementById('vt_hasta_hora');
  if (hHasta) hHasta.value = '';
  renderHistorialVentas();
}

function openEditVenta(key) {
  const venta = C.ventas[key];
  if (!venta) return;
  document.getElementById('ev_key').value = key;
  document.getElementById('ev_total').value = venta.total || 0;
  document.getElementById('ev_nota').value = venta.nota || '';
  openModal('modalEditVenta');
}

function saveEditVenta() {
  const key = document.getElementById('ev_key').value;
  const total = parseInt(document.getElementById('ev_total').value, 10) || 0;
  const nota = document.getElementById('ev_nota').value.trim();
  db.ref(`ventas/${key}`).update({ total, nota });
  closeModal('modalEditVenta');
  showToast('Venta actualizada', 'tg');
}

function deleteVenta(key) {
  if (!confirm('¿Eliminar esta venta?')) return;
  db.ref(`ventas/${key}`).remove();
  showToast('Venta eliminada', 'tr');
}

function abrirTurno() {
  const ya = Object.values(C.turnos || {}).find((turno) => turno.activo);
  if (ya) {
    showToast('Ya hay un turno abierto', 'ta');
    return;
  }
  const now = new Date();
  const horaApertura = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fecha = now.toISOString().split('T')[0];
  db.ref('turnos').push({ activo: true, horaApertura, fecha, ts: Date.now(), ventasCount: 0, ventasTotal: 0 });
  showToast('🟢 Tienda abierta — ' + horaApertura, 'tg');
}

function cerrarTurno() {
  const entry = Object.entries(C.turnos || {}).find(([, turno]) => turno.activo);
  if (!entry) {
    showToast('Sin turno activo', 'ta');
    return;
  }
  const [key] = entry;
  const now = new Date();
  const horaCierre = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  db.ref(`turnos/${key}`).update({ activo: false, horaCierre, tsCierre: Date.now() });
  showToast('🔴 Turno cerrado — ' + horaCierre, 'tb');
}

function renderTurnoUI() {
  const turnoActivo = Object.values(C.turnos || {}).find((turno) => turno.activo);
  const btnAbrir = document.getElementById('btnAbrirTienda');
  const btnCerrar = document.getElementById('btnCerrarTienda');
  const status = document.getElementById('turnoStatus');
  const banner = document.getElementById('turnoBanner');
  if (!btnAbrir || !btnCerrar || !status) return;
  if (turnoActivo) {
    btnAbrir.style.display = 'none';
    btnCerrar.style.display = '';
    status.style.color = '#16a34a';
    status.textContent = 'Abierta desde ' + turnoActivo.horaApertura + ' · ' + turnoActivo.ventasCount + ' ventas · $' + (turnoActivo.ventasTotal || 0) + ' recaudado';
    banner.innerHTML = '<div style="background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.25);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px"><div style="width:8px;height:8px;border-radius:50%;background:#16a34a;animation:pdot 1.5s infinite;flex-shrink:0"></div><div style="font-size:11px;font-weight:700;color:#16a34a">Turno activo desde ' + turnoActivo.horaApertura + ' · ' + turnoActivo.ventasCount + ' venta(s) · $' + (turnoActivo.ventasTotal || 0) + '</div></div>';
  } else {
    btnAbrir.style.display = '';
    btnCerrar.style.display = 'none';
    status.style.color = 'var(--muted)';
    status.textContent = 'Tienda cerrada';
    banner.innerHTML = '';
  }
}

const getGastosTienda = () => Object.entries(C.gastosTienda || {}).map(([key, value]) => ({ ...value, _key: key })).sort((a, b) => b.ts - a.ts);

function renderGastosTienda() {
  const el = document.getElementById('gastosTiendaList');
  if (!el) return;
  const gastos = getGastosTienda();
  if (!gastos.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">💸</span>Sin retiros registrados</div>';
    return;
  }
  const total = gastos.reduce((sum, gasto) => sum + gasto.monto, 0);
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1.5px solid var(--border2);margin-bottom:6px">
    <span style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">Total retirado</span>
    <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--amber)">$${total}</span>
  </div>` + gastos.map((gasto) => `<div class="venta-row">
    <div style="flex:1">
      <div style="font-size:12px;font-weight:800">${gasto.concepto || 'Sin concepto'}</div>
      <div style="font-size:10px;color:var(--muted);font-weight:600">📅 ${fmtDate(gasto.fecha)} · ⏰ ${gasto.hora || '—'}</div>
      ${gasto.notas ? `<div style="font-size:11px;color:var(--muted);font-style:italic">${gasto.notas}</div>` : ''}
    </div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--amber)">$${gasto.monto}</div>
    <div class="v-actions">
      <button class="btn btn-out btn-sm" onclick="editGastoTienda('${gasto._key}')">✏️</button>
      <button class="btn btn-r btn-sm" onclick="deleteGastoTienda('${gasto._key}')">🗑️</button>
    </div>
  </div>`).join('');
}

function saveGastoTienda() {
  const concepto = document.getElementById('gt_concepto').value.trim();
  const monto = parseFloat(document.getElementById('gt_monto').value) || 0;
  if (!concepto || !monto) {
    showToast('Concepto y monto requeridos', 'ta');
    return;
  }
  const key = document.getElementById('gt_key').value;
  const now = new Date();
  const data = {
    concepto,
    monto,
    fecha: document.getElementById('gt_fecha').value || now.toISOString().split('T')[0],
    hora: document.getElementById('gt_hora').value || now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    notas: document.getElementById('gt_notas').value.trim(),
    ts: Date.now()
  };
  if (key) db.ref(`gastosTienda/${key}`).update(data);
  else db.ref('gastosTienda').push(data);
  closeModal('modalGastoTienda');
  resetGastoTiendaForm();
  showToast(key ? 'Gasto actualizado' : 'Retiro registrado', 'tg');
}

function resetGastoTiendaForm() {
  const now = new Date();
  document.getElementById('gt_key').value = '';
  document.getElementById('gt_concepto').value = '';
  document.getElementById('gt_monto').value = '';
  document.getElementById('gt_fecha').value = now.toISOString().split('T')[0];
  document.getElementById('gt_hora').value = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).substring(0, 5);
  document.getElementById('gt_notas').value = '';
  document.getElementById('gtModalTitle').textContent = '💸 Gasto / Retiro';
}

function editGastoTienda(key) {
  const gasto = C.gastosTienda[key];
  if (!gasto) return;
  document.getElementById('gt_key').value = key;
  document.getElementById('gt_concepto').value = gasto.concepto || '';
  document.getElementById('gt_monto').value = gasto.monto || 0;
  document.getElementById('gt_fecha').value = gasto.fecha || '';
  document.getElementById('gt_hora').value = gasto.hora || '';
  document.getElementById('gt_notas').value = gasto.notas || '';
  document.getElementById('gtModalTitle').textContent = '✏️ Editar Retiro';
  openModal('modalGastoTienda');
}

function deleteGastoTienda(key) {
  if (!confirm('¿Eliminar este retiro?')) return;
  db.ref(`gastosTienda/${key}`).remove();
  showToast('Retiro eliminado', 'tr');
}

function openEditVentaFecha(key) {
  const venta = C.ventas[key];
  if (!venta) return;
  document.getElementById('evf_key').value = key;
  document.getElementById('evf_total').value = venta.total || 0;
  document.getElementById('evf_fecha').value = venta.fecha || new Date().toISOString().split('T')[0];
  document.getElementById('evf_hora_ini').value = venta.hora || '';
  document.getElementById('evf_hora_fin').value = venta.fechaHoraFin || '';
  document.getElementById('evf_nota').value = venta.nota || '';
  openModal('modalEditVentaFecha');
}

function saveEditVentaFecha() {
  const key = document.getElementById('evf_key').value;
  const total = parseInt(document.getElementById('evf_total').value, 10) || 0;
  const fecha = document.getElementById('evf_fecha').value;
  const hora = document.getElementById('evf_hora_ini').value;
  const horaFin = document.getElementById('evf_hora_fin').value;
  const nota = document.getElementById('evf_nota').value.trim();
  db.ref(`ventas/${key}`).update({ total, fecha, hora, fechaHoraFin: horaFin || null, nota });
  closeModal('modalEditVentaFecha');
  showToast('Venta actualizada', 'tg');
}
