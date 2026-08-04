/* Built into dist/sw.js by the serviceWorker() plugin in vite.config.js, which
   substitutes the two placeholders below with the real build output so the
   worker can never point at hashed filenames that no longer exist.
   Don't write those placeholder names anywhere else in this file. */

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `observations-${VERSION}`;

// Paths are relative to the worker, so the same build works at a domain root
// or under a /repo-name/ subpath without knowing which it got deployed to.
const scoped = (path) => new URL(path, self.registration.scope).toString();
const SHELL = () => scoped('index.html');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* cache: 'reload' forces these past the HTTP cache. GitHub Pages serves
       everything with max-age=600, so a plain addAll can bake a ten-minute-old
       index.html — one that names assets this deploy already deleted — into the
       precache, where it would be served forever. */
    await cache.addAll(PRECACHE.map((p) => new Request(scoped(p), { cache: 'reload' })));
    /* Take over without waiting for every tab to close. A worker that serves a
       broken shell leaves a blank page, and a blank page can't render the
       "update ready" prompt that would otherwise be the only way to replace it
       — so a new worker has to be able to supersede a bad one unprompted. */
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('observations-') && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// The page asks for this once the user accepts an update.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  /* Navigations go to the network first, revalidating rather than trusting the
     ten-minute HTTP cache, and fall back to the cached shell when there's no
     connection. Serving the cached shell first would be faster, but it would
     also mean a shell that ever went stale keeps rendering a blank page with no
     way to notice — correctness wins over the few hundred ms. */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(new Request(req, { cache: 'no-cache' }));
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(SHELL(), fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(SHELL());
        if (cached) return cached;
        return new Response('This app is offline and has not been cached yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Only cache real same-origin successes; opaque/error responses would
      // poison the cache with something we can't inspect later.
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      return Response.error();
    }
  })());
});
