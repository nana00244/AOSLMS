import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Build the offline inventory from emitted files, including lazy chunks and local fonts. */
function offlineApp(): Plugin {
  let publicDir = '';
  return {
    name: 'aos-offline-app',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_, bundle) {
      const contents = new Map<string, string | Uint8Array>();
      for (const [name, file] of Object.entries(bundle)) {
        if (!name.endsWith('.map'))
          contents.set(name, file.type === 'chunk' ? file.code : file.source);
      }
      const visit = (directory: string, prefix = '') => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const name = `${prefix}${entry.name}`;
          if (entry.isDirectory()) visit(join(directory, entry.name), `${name}/`);
          else if (entry.isFile()) contents.set(name, readFileSync(join(directory, entry.name)));
        }
      };
      if (publicDir) visit(publicDir);
      const names = [...contents.keys()].sort();
      // Worker behavior changes also need a distinct cache, even when all app assets match.
      const digest = createHash('sha256').update(offlineApp.toString()).update('\0');
      for (const name of names)
        digest.update(name).update('\0').update(contents.get(name)!).update('\0');
      const version = digest.digest('hex').slice(0, 20);
      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: `// Generated from the complete production asset inventory. No private API responses are cached.
const PREFIX = 'aos-app-shell-';
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(names)};
const BASE = new URL('./', self.location.href);
const URLS = FILES.map(name => new URL(name, BASE).href);
const KNOWN = new Set(URLS);
const INDEX = new URL('index.html', BASE).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(URLS.map(url => new Request(url, { cache: 'reload' })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // A replacement waits until existing tabs close, preserving their current code and edits.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'AOS_OFFLINE_STATUS' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const complete = (await Promise.all(URLS.map(url => cache.match(url)))).every(Boolean);
    event.ports[0].postMessage({ ready: complete, version: CACHE });
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin) return;
  const navigation = request.mode === 'navigate' && (url.pathname === BASE.pathname || url.pathname === new URL(INDEX).pathname);
  url.search = '';
  url.hash = '';
  if (!navigation && !KNOWN.has(url.href)) return;
  const key = navigation ? INDEX : url.href;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const stored = await cache.match(key);
    if (stored) return stored;
    // Missing/evicted data must fail visibly offline; never substitute HTML for an asset or API.
    return fetch(request);
  })());
});
`,
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
