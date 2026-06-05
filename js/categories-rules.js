function updateReglamentoVisibility() {
  const content = document.getElementById('reglContentLigaAlta');
  const contentFemenil = document.getElementById('reglContentFemenil');
  const placeholder = document.getElementById('reglPlaceholder');
  const heroTitle = document.getElementById('reglHeroTitle');
  if (!content || !placeholder) return;

  if (currentCat === 'liga_alta') {
    content.style.display = '';
    if (contentFemenil) contentFemenil.style.display = 'none';
    placeholder.style.display = 'none';
    if (heroTitle) heroTitle.innerHTML = 'Reglamento<br>& Premios';
  } else if (currentCat === 'cat_libre_femenil') {
    content.style.display = 'none';
    if (contentFemenil) contentFemenil.style.display = '';
    placeholder.style.display = 'none';
    if (heroTitle) heroTitle.innerHTML = 'Reglamento<br>& Premios';
  } else {
    content.style.display = 'none';
    if (contentFemenil) contentFemenil.style.display = 'none';
    placeholder.style.display = '';
    if (heroTitle) {
      const catName = (typeof CAT_NAMES !== 'undefined' ? CAT_NAMES[currentCat] : '') || currentCat;
      heroTitle.textContent = catName;
    }
  }
}

function rebuildCatTabs() {
  const container = document.getElementById('catTabsContainer');
  if (!container) return;
  const orderedKeys = catOrderKeys.filter((key) => CAT_NAMES[key]);
  Object.keys(CAT_NAMES).forEach((key) => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  });
  const addBtnHtml = isAdmin
    ? `<button id="catAddBtn" onclick="openAddCatInline()" style="background:none;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,.5);padding:0 12px;cursor:pointer;font-size:18px;flex-shrink:0;line-height:36px" title="Agregar categoría">+</button>`
    : '';

  container.innerHTML =
    orderedKeys
      .map(
        (key) =>
          `<button class="cat-tab${currentCat === key ? ' active' : ''}" onclick="selectCat('${key}',this)">${CAT_NAMES[key]}</button>`
      )
      .join('') + addBtnHtml;
}

function openAddCatInline() {
  const nombre = prompt('Nombre de la nueva categoría:');
  if (!nombre || !nombre.trim()) return;
  const id = nombre
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  if (!id) {
    showToast('Nombre inválido', 'ta');
    return;
  }
  if (CAT_NAMES[id]) {
    showToast('Esa categoría ya existe', 'ta');
    return;
  }

  CAT_NAMES[id] = nombre.trim();
  catOrderKeys.push(id);
  saveCatOrder();
  currentCat = id;
  rebuildCatTabs();
  showToast(`Categoría "${nombre.trim()}" creada`, 'tg');
}

function renderGcList() {
  const el = document.getElementById('gcList');
  if (!el) return;
  const orderedKeys = catOrderKeys.filter((key) => CAT_NAMES[key]);
  Object.keys(CAT_NAMES).forEach((key) => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  });
  el.innerHTML = orderedKeys
    .map((key, index) => {
      const value = CAT_NAMES[key];
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--muted);width:24px;text-align:center">${index + 1}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:800">${value}</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600">ID: ${key}</div>
      </div>
      ${index > 0 ? `<button title="Subir" onclick="moverCat('${key}',-1)" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 7px;cursor:pointer">↑</button>` : ''}
      ${index < orderedKeys.length - 1 ? `<button title="Bajar" onclick="moverCat('${key}',1)" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 7px;cursor:pointer">↓</button>` : ''}
      <button class="btn btn-out btn-sm" onclick="editarCategoria('${key}','${value}')">✏️</button>
      ${orderedKeys.length > 1 ? `<button class="btn btn-r btn-sm" onclick="eliminarCategoria('${key}')">🗑️</button>` : ''}
    </div>`;
    })
    .join('');
}

function addCategoria() {
  const id = document.getElementById('gc_id').value.trim().replace(/\s+/g, '_').toLowerCase();
  const nombre = document.getElementById('gc_nombre').value.trim();
  const orden = parseInt(document.getElementById('gc_orden')?.value, 10) || 99;
  if (!id || !nombre) {
    showToast('Ingresa ID y nombre', 'ta');
    return;
  }
  if (CAT_NAMES[id]) {
    showToast('Ese ID ya existe', 'ta');
    return;
  }
  CAT_NAMES[id] = nombre;
  catOrderKeys = catOrderKeys.filter((key) => key !== id);
  const insertAt = catOrderKeys.findIndex((key) => catOrderKeys.indexOf(key) >= orden);
  if (insertAt < 0) catOrderKeys.push(id);
  else catOrderKeys.splice(orden, 0, id);
  saveCatOrder();
  document.getElementById('gc_id').value = '';
  document.getElementById('gc_nombre').value = '';
  if (document.getElementById('gc_orden')) document.getElementById('gc_orden').value = '99';
  renderGcList();
  rebuildCatTabs();
  showToast('Categoría agregada', 'tg');
}

function editarCategoria(key, currentName) {
  const nuevo = prompt(`Nuevo nombre para "${currentName}":`, currentName);
  if (!nuevo || nuevo.trim() === currentName) return;
  CAT_NAMES[key] = nuevo.trim();
  saveCatOrder();
  renderGcList();
  rebuildCatTabs();
  showToast('Categoría actualizada', 'tg');
}

function moverCat(key, dir) {
  const idx = catOrderKeys.indexOf(key);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= catOrderKeys.length) return;
  catOrderKeys.splice(idx, 1);
  catOrderKeys.splice(newIdx, 0, key);
  saveCatOrder();
  renderGcList();
  rebuildCatTabs();
}

function eliminarCategoria(key) {
  if (!confirm(`¿Eliminar la categoría "${CAT_NAMES[key]}"?\nSolo se elimina de las pestañas, los datos no se borran.`)) return;
  delete CAT_NAMES[key];
  catOrderKeys = catOrderKeys.filter((item) => item !== key);
  saveCatOrder();
  if (currentCat === key) currentCat = catOrderKeys[0] || 'liga_alta';
  renderGcList();
  rebuildCatTabs();
  showToast('Categoría eliminada', 'tg');
}

function openResetCategoria() {
  const rcCat = document.getElementById('rc_cat');
  if (rcCat) {
    rcCat.innerHTML = Object.entries(CAT_NAMES)
      .map(([key, value]) => `<option value="${key}">${value}</option>`)
      .join('');
  }
  document.getElementById('rc_torneo').value = currentTorneo;
  document.getElementById('rc_confirm').value = '';
  openModal('modalResetCat');
}

function confirmarResetCategoria() {
  const torneo = document.getElementById('rc_torneo').value;
  const cat = document.getElementById('rc_cat').value;
  const catNombre = CAT_NAMES[cat] || cat;
  const confirmVal = document.getElementById('rc_confirm').value.trim();
  if (confirmVal !== catNombre) {
    showToast('El nombre no coincide - escribe exactamente: ' + catNombre, 'ta');
    return;
  }

  const toDelParts = Object.entries(C.partidos || {})
    .filter(([, partido]) => partido.torneo === torneo && partido.cat === cat)
    .map(([key]) => key);
  const toDelEquipos = Object.entries(C.equipos || {})
    .filter(([, equipo]) => equipo.torneo === torneo && equipo.cat === cat)
    .map(([key]) => key);
  const toDelInscs = Object.entries(C.inscripciones || {})
    .filter(([, inscripcion]) => inscripcion.torneo === torneo && inscripcion.cat === cat)
    .map(([key]) => key);

  const updates = {};
  toDelParts.forEach((key) => { updates[`partidos/${key}`] = null; });
  toDelEquipos.forEach((key) => { updates[`equipos/${key}`] = null; });
  toDelInscs.forEach((key) => { updates[`inscripciones/${key}`] = null; });

  db.ref().update(updates).then(() => {
    closeModal('modalResetCat');
    renderTabla();
    renderGoleadores();
    renderPartidos();
    renderEquiposPage();
    showToast(`Categoria ${catNombre} reiniciada - lista para nueva temporada`, 'tg');
  }).catch((error) => showToast('Error: ' + error.message, 'tr'));
}
