let toastT;

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  if (id === 'modalGastoTienda' && !document.getElementById('gt_key')?.value && typeof resetGastoTiendaForm === 'function') {
    resetGastoTiendaForm();
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function showToast(msg, type = 'tg') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

function applyTheme() {
  localStorage.removeItem('ld_theme');
  document.getElementById('html').setAttribute('data-theme', 'light');
}

function toggleTheme() {
  applyTheme();
}

function bindModalOverlayDismissers() {
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.remove('open');
    });
  });
}

document.addEventListener('DOMContentLoaded', bindModalOverlayDismissers);
