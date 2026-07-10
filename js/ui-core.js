let toastT;
let lastModalTrigger = null;

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  lastModalTrigger = document.activeElement;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.classList.add('open');
  document.body.classList.add('modal-open');
  if (id === 'modalGastoTienda' && !document.getElementById('gt_key')?.value && typeof resetGastoTiendaForm === 'function') {
    resetGastoTiendaForm();
  }
  requestAnimationFrame(() => {
    const focusTarget = el.querySelector('[autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
      el.querySelector('button:not([disabled])');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  });
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.removeAttribute('aria-modal');
  }
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.classList.remove('modal-open');
    if (lastModalTrigger?.focus) lastModalTrigger.focus({ preventScroll: true });
    lastModalTrigger = null;
  }
}

function showToast(msg, type = 'tg') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.setAttribute('role', type === 'tr' ? 'alert' : 'status');
  t.setAttribute('aria-live', type === 'tr' ? 'assertive' : 'polite');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

function renderEmptyState({ icon = '○', title = 'Sin información', description = '', actionLabel = '', action = '' } = {}) {
  return `<div class="empty empty-state">
    <span class="empty-icon">${icon}</span>
    <strong>${title}</strong>
    ${description ? `<p>${description}</p>` : ''}
    ${actionLabel && action ? `<button class="btn btn-g btn-sm" onclick="${action}">${actionLabel}</button>` : ''}
  </div>`;
}

function applyTheme() {
  localStorage.removeItem('ld_theme');
  document.getElementById('html').setAttribute('data-theme', 'light');
}

function bindModalOverlayDismissers() {
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });
  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.addEventListener('click', (event) => {
      if (event.target === loginModal && typeof closeLoginModal === 'function') closeLoginModal();
    });
  }
}

document.addEventListener('DOMContentLoaded', bindModalOverlayDismissers);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const openModals = Array.from(document.querySelectorAll('.modal-overlay.open'));
  const topModal = openModals[openModals.length - 1];
  if (topModal) {
    closeModal(topModal.id);
    return;
  }
  const loginModal = document.getElementById('loginModal');
  if (loginModal?.style.display === 'flex' && typeof closeLoginModal === 'function') closeLoginModal();
});
