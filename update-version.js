#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const timestamp = Date.now();
const version = new Date().toISOString().split('T')[0].replace(/-/g, '.');
const shortHash = timestamp.toString(36).slice(-6); // Short readable hash

// Update service worker
const swPath = path.join(__dirname, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(
  /\/\/ Auto-generated timestamp: \d+\nconst CACHE_NAME = 'todo-pwa-\d+';/,
  `// Auto-generated timestamp: ${timestamp}\nconst CACHE_NAME = 'todo-pwa-${timestamp}';`
);
fs.writeFileSync(swPath, swContent);

// Update manifest
const manifestPath = path.join(__dirname, 'manifest.json');
let manifestContent = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestContent);
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Update config with version info
const configPath = path.join(__dirname, 'config.js');
let configContent = fs.readFileSync(configPath, 'utf8');
configContent = configContent.replace(
  /(\/\/ Version info[\s\S]*?buildHash: '[^']*')/,
  `// Version info
  version: '${version}',
  buildTimestamp: ${timestamp},
  buildHash: '${shortHash}'`
);

// If version info doesn't exist, add it
if (!configContent.includes('// Version info')) {
  configContent = configContent.replace(
    '  // Environment info',
    `  // Version info
  version: '${version}',
  buildTimestamp: ${timestamp},
  buildHash: '${shortHash}',
  
  // Environment info`
  );
}

fs.writeFileSync(configPath, configContent);

console.log(`Updated PWA version to ${version} (${shortHash}) - ${timestamp}`);