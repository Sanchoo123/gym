// Service worker: app funciona offline no ginásio.
// Sobe a versão sempre que alterares ficheiros da app, para o iPhone buscar a nova.
const VERSION = 'v4';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-v1';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/data.js', 'js/coach.js', 'js/ui.js', 'js/body.js', 'js/nutrition.js', 'js/meso.js',
  'data/exercises.json',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Pedidos à API do Claude nunca são guardados
  if (url.hostname === 'api.anthropic.com') return;

  // Imagens dos exercícios e SDK: guardar depois da 1ª vez
  if (url.hostname === 'raw.githubusercontent.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const hit = await c.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok || res.type === 'opaque') c.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Ficheiros da app: cache primeiro, rede como recurso
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
  }
});
