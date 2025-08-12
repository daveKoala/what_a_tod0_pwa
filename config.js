// Auto-detect environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isGitHubPages = window.location.hostname.includes('github.io');

const config = {
  // Service Worker paths
  serviceWorkerPath: isLocal ? '/sw.js' : './sw.js',
  serviceWorkerScope: isLocal ? '/' : './',
  
  // Cache URLs
  cacheUrls: isLocal ? [
    '/',
    '/index.html', 
    '/public/style.css',
    '/public/script.js',
    '/manifest.json'
  ] : [
    './',
    './index.html',
    './public/style.css', 
    './public/script.js',
    './manifest.json'
  ],
  
  // Manifest
  manifestStartUrl: isLocal ? '/' : './',
  
  // Environment info
  environment: isLocal ? 'development' : 'production',
  isLocal,
  isGitHubPages
};

window.APP_CONFIG = config;