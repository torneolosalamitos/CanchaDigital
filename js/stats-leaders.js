function renderGoleadores() {
  const el = document.getElementById('goleadoresList');
  if (!el) return;
  const sorted = getTopScorersData(10);
  if (!sorted.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">🥅</span>Sin goles registrados</div>';
    updateGoleadoresPublicUI();
    renderPorteros();
    return;
  }
  el.innerHTML = sorted
    .map((g, i) => {
      const pos = i + 1;
      const cls = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : 'pr';
      const rankCls = pos === 1 ? 'rank-1' : pos === 2 ? 'rank-2' : pos === 3 ? 'rank-3' : '';
      return `<div class="gol-row ${rankCls}">
      <div class="gol-pos ${cls}">${pos}</div>
      <div class="gol-info"><div class="gol-player">${g.jugador}</div><div class="gol-team">⚽ ${g.equipo}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0">
        <div class="gol-count">${g.goles}</div>
        <div class="gol-count-lbl">goles</div>
      </div>
    </div>`;
    })
    .join('');
  updateGoleadoresPublicUI();
  renderPorteros();
}

function getGoleadoresPublicKey() {
  return 'ld_goleadores_public_' + currentTorneo + '_' + currentCat;
}

function isGoleadoresPublic() {
  const val = localStorage.getItem(getGoleadoresPublicKey());
  return val === null ? true : val === '1';
}

function toggleGoleadoresPublic() {
  if (!isAdmin) return;
  const nowPublic = !isGoleadoresPublic();
  localStorage.setItem(getGoleadoresPublicKey(), nowPublic ? '1' : '0');
  updateGoleadoresPublicUI();
  renderGoleadores();
  showToast(nowPublic ? '👁️ Goleadores visibles al público' : '🔒 Goleadores ocultos al público', nowPublic ? 'tg' : 'ta');
}

function updateGoleadoresPublicUI() {
  const btn = document.getElementById('btnToggleGoleadoresPublic');
  const banner = document.getElementById('goleadoresPublicBanner');
  const captura = document.getElementById('goleadoresCaptura');
  const pub = isGoleadoresPublic();
  if (btn) {
    btn.style.display = isAdmin ? '' : 'none';
    btn.textContent = pub ? '👁️' : '🙈';
    btn.title = pub ? 'Ocultar al público' : 'Mostrar al público';
    btn.style.borderColor = pub ? '' : 'var(--red)';
    btn.style.color = pub ? '' : 'var(--red)';
  }
  if (banner) banner.style.display = !pub && isAdmin ? '' : 'none';
  if (captura) captura.style.opacity = !pub && !isAdmin ? '0' : '1';
  if (captura) captura.style.pointerEvents = !pub && !isAdmin ? 'none' : '';
  if (captura) captura.style.display = !pub && !isAdmin ? 'none' : '';
}

function getPorterosPublicKey() {
  return 'ld_porteros_public_' + currentTorneo + '_' + currentCat;
}

function isPorterosPublic() {
  const val = localStorage.getItem(getPorterosPublicKey());
  return val === null ? true : val === '1';
}

function updatePorterosPublicUI() {
  const btn = document.getElementById('btnTogglePorterosPublic');
  const banner = document.getElementById('porterosPublicBanner');
  const captura = document.getElementById('porterosCaptura');
  const pub = isPorterosPublic();
  if (btn) {
    btn.style.display = isAdmin ? '' : 'none';
    btn.textContent = pub ? '👁️' : '🙈';
    btn.title = pub ? 'Ocultar al público' : 'Mostrar al público';
    btn.style.borderColor = pub ? '' : 'var(--red)';
    btn.style.color = pub ? '' : 'var(--red)';
  }
  if (banner) banner.style.display = !pub && isAdmin ? '' : 'none';
  if (captura) captura.style.opacity = !pub && !isAdmin ? '0' : '1';
  if (captura) captura.style.pointerEvents = !pub && !isAdmin ? 'none' : '';
  if (captura) captura.style.display = !pub && !isAdmin ? 'none' : '';
}

function renderPorteros() {
  const el = document.getElementById('porterosList');
  if (!el) return;
  const top = getTopGoalkeepersData(10);
  if (!top.length) {
    el.innerHTML =
      '<div class="empty"><span class="empty-icon">🧤</span>Asigna portero en el equipo o en cada partido terminado para ver el ranking</div>';
    return;
  }
  el.innerHTML = top
    .map((g, i) => {
      const pos = i + 1;
      const cls = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : 'pr';
      const rankCls = pos === 1 ? 'rank-1' : pos === 2 ? 'rank-2' : pos === 3 ? 'rank-3' : '';
      if (!isAdmin) {
        return `<div class="gol-row keeper-row ${rankCls}">
        <div class="gol-pos ${cls}">${pos}</div>
        <div class="gol-info">
          <div class="gol-player">${escapeHtml(g.portero)}</div>
          <div class="gol-team">🧤 ${escapeHtml(g.equipo)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0">
          <div class="keeper-main-val">${g.porteriasImbatidas}</div>
          <div class="gol-count-lbl">imbatidas</div>
        </div>
      </div>`;
      }
      return `<div class="gol-row keeper-row ${rankCls}">
      <div class="gol-pos ${cls}">${pos}</div>
      <div class="gol-info">
        <div class="gol-player">${escapeHtml(g.portero)}</div>
        <div class="gol-team">🧤 ${escapeHtml(g.equipo)}</div>
        <div class="keeper-stats">
          <span class="keeper-chip">🧤 ${g.porteriasImbatidas} imbatidas</span>
          <span class="keeper-chip alt">📉 ${g.promedioGC.toFixed(2)} GC/PJ</span>
          <span class="keeper-chip">⚽ ${g.golesRecibidos} GC</span>
          <span class="keeper-chip alt">🎯 ${g.partidos} PJ</span>
        </div>
        ${isAdmin ? `<div class="keeper-admin-eq">Orden del ranking: más porterías imbatidas, menor promedio de goles recibidos y menos goles totales. Ecuación usada: ${escapeHtml(g.equation)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;min-width:54px">
        <div class="keeper-main-val">${g.porteriasImbatidas}</div>
        <div class="gol-count-lbl">imbatidas</div>
      </div>
    </div>`;
    })
    .join('');
}
