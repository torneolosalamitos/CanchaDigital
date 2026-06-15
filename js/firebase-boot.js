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
let firebaseEmulatorsConnected = false;

const FIREBASE_EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
  database: 9000
};

function isLocalFirebaseEnvironment() {
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search || '');
  return params.get('emulators') === '1' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1';
}

function connectFirebaseEmulators({ authInstance, fsInstance, dbInstance }) {
  if (firebaseEmulatorsConnected || !isLocalFirebaseEnvironment()) return;
  firebaseEmulatorsConnected = true;
  const host = '127.0.0.1';

  try {
    if (authInstance?.useEmulator) {
      authInstance.useEmulator(`http://${host}:${FIREBASE_EMULATOR_PORTS.auth}`, { disableWarnings: true });
    }
    if (fsInstance?.useEmulator) {
      fsInstance.useEmulator(host, FIREBASE_EMULATOR_PORTS.firestore);
    }
    if (firebase.functions) {
      firebase.functions().useEmulator(host, FIREBASE_EMULATOR_PORTS.functions);
    }
    if (dbInstance?.useEmulator) {
      dbInstance.useEmulator(host, FIREBASE_EMULATOR_PORTS.database);
    }
    window.__CD_USING_FIREBASE_EMULATORS__ = true;
    console.info('[CanchaDigital] Firebase emulators conectados para entorno local.');
  } catch (error) {
    console.error('[CanchaDigital] No se pudieron conectar emuladores Firebase:', error);
  }
}

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
    setAuth,
    setFs
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
    const fsInstance = typeof firebase.firestore === 'function' ? firebase.firestore() : null;
    const authInstance = firebase.auth();
    connectFirebaseEmulators({ authInstance, fsInstance, dbInstance });

    if (typeof setDb === 'function') setDb(dbInstance);
    if (typeof setAuth === 'function') setAuth(authInstance);
    if (typeof setFs === 'function') setFs(fsInstance);

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
