const CACHE_STATIC = 'avatar-static-v1';
const CACHE_FONTS = 'avatar-fonts-v1';
const CACHE_API = 'avatar-api-v1';
const CACHE_IMAGES = 'avatar-images-v1';

const STATIC_ASSETS = [
    '/index.html',
    '/css/styles.css',
    '/js/script.js',
    '/manifest.json',
    '/offline.html',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    console.log('[Avatar SW] Instalando...');
    event.waitUntil(
        caches.open(CACHE_STATIC).then((cache) => {
            console.log('[Avatar SW] Pre-cacheando assets estáticos');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Avatar SW] Activado');
    const validCaches = [CACHE_STATIC, CACHE_FONTS, CACHE_API, CACHE_IMAGES];
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => !validCaches.includes(key))
                    .map((key) => {
                        console.log('[Avatar SW] Eliminando caché obsoleto:', key);
                        return caches.delete(key);
                    })
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirstFonts(request));
        return;
    }

    if (url.hostname === 'api.themoviedb.org') {
        event.respondWith(networkFirstApi(request));
        return;
    }

    if (url.hostname === 'image.tmdb.org' || url.hostname === 'img.youtube.com') {
        event.respondWith(cacheFirstImages(request));
        return;
    }

    if (url.origin === self.location.origin) {
        if (request.mode === 'navigate') {
            event.respondWith(networkFirstNavigate(request));
        } else {
            event.respondWith(cacheFirstStatic(request));
        }
    }
});
async function cacheFirstStatic(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_STATIC);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        console.warn('[Avatar SW] Sin red para:', request.url);
    }
}

async function networkFirstNavigate(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_STATIC);
        cache.put(request, response.clone());
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match('/offline.html');
    }
}

async function cacheFirstFonts(request) {
    const cached = await caches.match(request);
    if (cached) {
        fetch(request).then((response) => {
            if (response.ok) {
                caches.open(CACHE_FONTS).then((c) => c.put(request, response));
            }
        }).catch(() => { });
        return cached;
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_FONTS);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        console.warn('[Avatar SW] Sin fuentes y sin caché para:', request.url);
    }
}
async function networkFirstApi(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_API);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) {
            console.log('[Avatar SW] Sirviendo API desde caché (offline):', request.url);
            return cached;
        }
        return new Response(
            JSON.stringify({ error: true, status_message: 'Sin conexión. Mostrando datos cacheados.' }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }
}
async function cacheFirstImages(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_IMAGES);
            await limitCacheSize(CACHE_IMAGES, 150);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        console.warn('[Avatar SW] Sin imagen:', request.url);
    }
}

async function limitCacheSize(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length >= maxItems) {

        await cache.delete(keys[0]);
    }
}