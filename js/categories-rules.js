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
    ? `<button id="catAddBtn" onclick="openAddCatInline()" style="background:none;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,.5);padding:0 12px;cursor:pointer;font-size:18px;flex-shrink:0;line-height:36px" title="Agregar categoría">＋</button>`
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

function openGestionCats() {
  const label = document.getElementById('gcTorneoLabel');
  if (label) label.textContent = TORNEO_NAMES[currentTorneo] || currentTorneo;
  renderGcList();
  openModal('modalGestionCats');
}
