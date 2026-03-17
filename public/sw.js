self.addEventListener('install', () => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// A simple fetch listener is required by most browsers to trigger the PWA install prompt
self.addEventListener('fetch', () => {
    // We can add offline caching later
});
