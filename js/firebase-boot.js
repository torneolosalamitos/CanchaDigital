const FB_CFG = {
  apiKey: "AIzaSyAUyYu6E3oCJdeTNV9GbykmIaiT_ZBXro8",
  authDomain: "torneo-villa-080204.firebaseapp.com",
  databaseURL: "https://torneo-villa-080204-default-rtdb.firebaseio.com",
  projectId: "torneo-villa-080204",
  storageBucket: "torneo-villa-080204.firebasestorage.app",
  messagingSenderId: "635061865343",
  appId: "1:635061865343:web:4016afa91c4da96179684a"
};

let bootFallbackTimer = null;

function dismissInitialLoading() {
  const loader = document.getElementById('loadingScreen');
  const splash = document.getElementById('splash');
  if (loader) loader.classList.remove('show');
  if (splash) splash.classList.remove('hidden');
}

function startFirebaseBoot(options) {
  const {
    applyTheme,
    onAuthChange,
    showToast,
    setDb,
    setAuth
  } = options;

  applyTheme();
  clearTimeout(bootFallbackTimer);
  bootFallbackTimer = setTimeout(() => {
    dismissInitialLoading();
    console.warn('Firebase auth tardó demasiado; se mostró el selector de torneos por seguridad.');
  }, 4000);

  try {
    if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
    const dbInstance = firebase.database();
    const authInstance = firebase.auth();

    if (typeof setDb === 'function') setDb(dbInstance);
    if (typeof setAuth === 'function') setAuth(authInstance);

    authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    authInstance.onAuthStateChanged((user) => {
      clearTimeout(bootFallbackTimer);
      dismissInitialLoading();
      onAuthChange(user);
    });
  } catch (error) {
    console.error(error);
    clearTimeout(bootFallbackTimer);
    dismissInitialLoading();
    if (typeof showToast === 'function') showToast('Error Firebase', 'tr');
  }
}
