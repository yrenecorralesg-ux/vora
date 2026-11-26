const CACHE_STATIC = 'vora-static-v1';
const CACHE_PAGES = 'vora-pages-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_PAGES)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'CLEAR_TENANT_CACHE' && typeof data.slug === 'string') {
    const prefix = `/t/${data.slug.toLowerCase()}`;
    event.waitUntil(
      caches.open(CACHE_PAGES).then((cache) =>
        cache.keys().then((reqs) =>
          Promise.all(
            reqs
              .filter((r) => new URL(r.url).pathname.toLowerCase().startsWith(prefix))
              .map((r) => cache.delete(r)),
          ),
        ),
      ),
    );
  }
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/brand/') ||
    pathname.startsWith('/solee/') ||
    pathname.startsWith('/landing/') ||
    /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(pathname)
  );
}

function isCacheablePosNavigation(pathname) {
  return /^\/t\/[^/]+\/(pos(\/customer-display)?|login)\/?$/i.test(pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);
        if (cached) return cached;
        const net = await networkPromise;
        return net || new Response('', { status: 504 });
      }),
    );
    return;
  }

  if (req.mode === 'navigate' && isCacheablePosNavigation(url.pathname)) {
    const cacheKey = url.pathname;
    event.respondWith(
      caches.open(CACHE_PAGES).then(async (cache) => {
        try {
          const res = await fetch(req);
          if (
            res &&
            res.ok &&
            res.type === 'basic' &&
            !res.redirected &&
            new URL(res.url).pathname === url.pathname
          ) {
            cache.put(cacheKey, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const cached = await cache.match(cacheKey);
          if (cached) return cached;
          throw new Error('Offline without cached shell');
        }
      }),
    );
  }
});
