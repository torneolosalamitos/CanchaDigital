function openLoginModal() {
  const modal = document.getElementById('loginModal');
  lastModalTrigger = document.activeElement;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  const lastEmail = localStorage.getItem('ld_last_email') || '';
  const emailEl = document.getElementById('l_email');
  if (emailEl && !emailEl.value) emailEl.value = lastEmail;
  requestAnimationFrame(() => emailEl?.focus({ preventScroll: true }));
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  modal.style.display = 'none';
  modal.removeAttribute('aria-modal');
  document.body.classList.remove('modal-open');
  if (lastModalTrigger?.focus) lastModalTrigger.focus({ preventScroll: true });
  lastModalTrigger = null;
}

function loginGoogle() {
  auth
    .signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .then(() => closeLoginModal())
    .catch((error) => showLErr(error.message));
}

function loginEmail() {
  const email = document.getElementById('l_email').value.trim();
  const password = document.getElementById('l_pass').value;
  if (!email || !password) {
    showLErr('Ingresa correo y contraseña');
    return;
  }

  auth
    .signInWithEmailAndPassword(email, password)
    .then(() => {
      localStorage.setItem('ld_last_email', email);
      closeLoginModal();
    })
    .catch((error) => {
      const messages = {
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/user-not-found': 'Usuario no encontrado'
      };
      showLErr(messages[error.code] || error.message);
    });
}

function showLErr(message) {
  const errorEl = document.getElementById('lmerr');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setTimeout(() => (errorEl.style.display = 'none'), 4000);
}

function signOut() {
  if (!auth) return;
  auth
    .signOut()
    .then(() => {
      isAdmin = false;
      isCaptain = false;
      captainEquipoKey = null;
      const viewerProfile = document.getElementById('viewerProfileOverlay');
      if (viewerProfile) viewerProfile.style.display = 'none';
      const chip = document.getElementById('userChip');
      if (chip) chip.classList.remove('show');
      showToast('Sesion cerrada', 'ta');
    })
    .catch(() => showToast('No se pudo cerrar sesion', 'tr'));
}
