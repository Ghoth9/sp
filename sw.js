// ============================================================
// Spairdee - Service Worker
// Version: 1.0
// Caching strategy: Cache-first for static, Network-first for dynamic
// ============================================================

const CACHE_NAME = 'spairdee-v14';

// Static assets to pre-cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/db.js',
    './js/app.js',
    './js/dashboard.js',
    './js/customers.js',
    './js/services.js',
    './js/appointments.js',
    './js/inventory.js',
    './manifest.json',
    './assets/icons/icon.svg'
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap',
    'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js'
];

// ── Install Event ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                        return Promise.allSettled(
                            CDN_ASSETS.map((url) =>
                                fetch(url, { mode: 'cors' })
                                    .then((response) => {
                                        if (response.ok) {
                                            return cache.put(url, response);
                                        }
                                    })
                                    .catch((err) => {
                                        console.warn(`[SW] Failed to cache CDN asset: ${url}`, err);
                                    })
                            )
                        );
                    });
            })
            .then(() => {
                console.log('[SW] Install complete');
            })
    );

    // Skip waiting – activate immediately
    self.skipWaiting();
});

// ── Activate Event ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log(`[SW] Deleting old cache: ${name}`);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// ── Fetch Event ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) schemes
    if (!url.protocol.startsWith('http')) return;

    // Determine strategy based on request type
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request));
    } else if (isGoogleFont(url)) {
        event.respondWith(cacheFirst(request));
    } else {
        event.respondWith(networkFirst(request));
    }
});

// ── Strategy: Cache First ─────────────────────────────────────
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        updateCache(request);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('[SW] Cache-first fetch failed:', request.url, error);
        return offlineFallback(request);
    }
}

// ── Strategy: Network First ───────────────────────────────────
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('[SW] Network-first falling back to cache:', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        return offlineFallback(request);
    }
}

// ── Background Cache Update ───────────────────────────────────
async function updateCache(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse);
        }
    } catch (error) {
        // Silently fail
    }
}

// ── Offline Fallback ──────────────────────────────────────────
async function offlineFallback(request) {
    if (request.mode === 'navigate') {
        const cachedIndex = await caches.match('./index.html');
        if (cachedIndex) return cachedIndex;
    }

    return new Response(
        `<!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Spairdee - ออฟไลน์</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Noto Sans Thai', 'Inter', sans-serif;
                    background: #0a0e17;
                    color: #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 2rem;
                    text-align: center;
                }
                .offline-container {
                    max-width: 400px;
                }
                .offline-icon {
                    font-size: 4rem;
                    margin-bottom: 1.5rem;
                    opacity: 0.6;
                }
                h1 {
                    font-size: 1.5rem;
                    color: #06b6d4;
                    margin-bottom: 0.75rem;
                }
                p {
                    color: #94a3b8;
                    line-height: 1.6;
                    margin-bottom: 1.5rem;
                }
                button {
                    background: linear-gradient(135deg, #06b6d4, #0891b2);
                    color: white;
                    border: none;
                    padding: 0.75rem 2rem;
                    border-radius: 0.5rem;
                    font-size: 1rem;
                    cursor: pointer;
                    font-family: inherit;
                    transition: transform 0.2s;
                }
                button:hover { transform: scale(1.05); }
                button:active { transform: scale(0.95); }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <div class="offline-icon">❄️</div>
                <h1>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
                <p>Spairdee ต้องการการเชื่อมต่อเพื่อโหลดข้อมูลระบบ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่</p>
                <button onclick="window.location.reload()">ลองใหม่อีกครั้ง</button>
            </div>
        </body>
        </html>`,
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            }
        }
    );
}

// ── Helper Functions ──────────────────────────────────────────
function isStaticAsset(url) {
    const staticExtensions = ['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.ico', '.woff', '.woff2'];
    const pathname = url.pathname.toLowerCase();
    return staticExtensions.some((ext) => pathname.endsWith(ext));
}

function isGoogleFont(url) {
    return url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com';
}

// ── Message Handler ───────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ cleared: true });
        });
    }
});

console.log('[SW] Service Worker script loaded');
