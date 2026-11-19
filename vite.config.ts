import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function offlineApp() {
  return {
    name: 'aos-offline-app',
    generateBundle(
      this: { emitFile: (file: { type: 'asset'; fileName: string; source: string }) => void },
      _options: unknown,
      bundle: Record<string, { type: string }>,
    ) {
      const assets = Object.keys(bundle).filter((name) =>
        /\.(?:html|js|css|woff2?|svg|png|webp|ico|json)$/.test(name),
      );
      const version = assets
        .slice()
        .sort()
        .join('|')
        .split('')
        .reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261)
        .toString(36);
      const worker = `const CACHE = 'aos-app-shell-${version}';
const FILES = ${JSON.stringify(assets.map((name) => './' + name))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('aos-app-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  const sameOrigin = new URL(request.url).origin === self.location.origin;
  if (request.method !== 'GET' || (!sameOrigin && request.destination !== 'image')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok || (request.destination === 'image' && response.type === 'opaque')) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  })));
});`;
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source: worker });
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify({
          name: 'Ayisatu Owen International School',
          short_name: 'Ayisatu Owen',
          start_url: './',
          scope: './',
          display: 'standalone',
          background_color: '#f9f7f1',
          theme_color: '#192f40',
        }),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), offlineApp()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
