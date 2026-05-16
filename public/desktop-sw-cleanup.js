(() => {
  const isTauriDesktop = location.hostname === 'tauri.localhost' || '__TAURI_INTERNALS__' in window;

  if (!isTauriDesktop || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    const unregisterWorkers = navigator.serviceWorker
      .getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => undefined);

    const clearCaches = 'caches' in window
      ? caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).catch(() => undefined)
      : Promise.resolve();

    Promise.all([unregisterWorkers, clearCaches]).catch(() => undefined);
  });
})();
