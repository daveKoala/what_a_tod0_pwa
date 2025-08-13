// Service Worker registration with update handling
if ("serviceWorker" in navigator) {
  const { serviceWorkerPath, serviceWorkerScope } = window.APP_CONFIG;
  navigator.serviceWorker
    .register(serviceWorkerPath, { scope: serviceWorkerScope })
    .then((reg) => {
      console.log("Service Worker registered successfully", reg);
      
      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            showUpdateNotification();
          }
        });
      });
    })
    .catch((err) => {
      console.error("Service Worker registration failed:", err);
      console.log("Attempting to fetch sw.js directly to debug...");
      fetch(window.APP_CONFIG.serviceWorkerPath).then(r => console.log("sw.js fetch status:", r.status)).catch(e => console.log("sw.js fetch error:", e));
    });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.type === 'UPDATE_AVAILABLE') {
      showUpdateNotification();
    }
  });
}

function showUpdateNotification() {
  const updateBanner = document.createElement('div');
  updateBanner.className = 'update-notification';
  updateBanner.innerHTML = `
    <div class="update-content">
      <span>New version available!</span>
      <button onclick="updateApp()">Update Now</button>
      <button onclick="dismissUpdate(this)">×</button>
    </div>
  `;
  document.body.appendChild(updateBanner);
}

function updateApp() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({type: 'SKIP_WAITING'});
  }
  window.location.reload();
}

function dismissUpdate(btn) {
  btn.closest('.update-notification').remove();
}