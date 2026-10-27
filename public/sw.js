/**
 * Service Worker for Online Emulator PWA
 * 
 * Provides offline caching for:
 * - App shell (HTML, CSS, JS)
 * - EmulatorJS core files
 * - Game metadata (not ROMs - too large)
 * 
 * Strategy:
 * - Cache-first for static assets (EmulatorJS, icons)
 * - Network-first for API calls (games list, saves)
 * - Network-first for pages (never serve a cached redirect for a navigation)
 */

// Bump to drop caches from older workers (v1 held a redirected "/" that broke page loads).
const CACHE_NAME = "online-emu-v2";

// Assets to cache on install
// "/" is not precached: it redirects to /profiles, and a redirected response
// served for a navigation fails with ERR_FAILED.
const PRECACHE_ASSETS = [
  "/emulatorjs/data/loader.js",
  "/emulatorjs/data/emulator.min.js",
  "/emulatorjs/data/emulator.min.css",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// Install event - precache essential assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Precaching app shell");
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API calls - network first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(event.request);
        })
    );
    return;
  }

  // ROM files - don't cache (too large)
  if (url.pathname.startsWith("/api/roms/")) {
    return;
  }

  // EmulatorJS and static assets - cache first
  if (
    url.pathname.startsWith("/emulatorjs/") ||
    url.pathname.match(/\.(png|jpg|ico|svg|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Pages - network first; fall back to cache only when offline.
  // Redirected responses are never cached or served from cache.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && !response.redirected) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached && !cached.redirected) return cached;
          return Response.error();
        })
      )
  );
});

// Handle push notifications (future feature)
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || "New notification",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        url: data.url || "/",
      },
    };
    event.waitUntil(
      self.registration.showNotification(data.title || "Online Emulator", options)
    );
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification click received.");
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});
